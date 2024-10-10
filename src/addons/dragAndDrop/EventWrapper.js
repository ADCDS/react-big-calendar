import React, { useContext, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import clsx from 'clsx'
import { accessor as get } from '../../utils/accessors'
import { DnDContext } from './DnDContext'
import CalendarContext from '../../CalendarContext'
import { getBoundsForNode } from '../../Selection'
import { pointInBox } from '../../utils/selection'
import { notify } from '../../utils/helpers'

function EventWrapper(props) {
  const { event, type, continuesPrior, continuesAfter, resizable, children } =
    props

  const nodeRef = useRef(null)
  const eventId = useRef(null)
  const isOnPoint = useRef(false)
  const longPressTimer = useRef(null)
  const lastTap = useRef(0)

  const dragContext = useContext(DnDContext)
  const selector = dragContext?.draggable?.selector

  const calendarContext = useContext(CalendarContext)

  useEffect(() => {
    if (!nodeRef.current || !selector) return

    const node = nodeRef.current

    // Handle context menu (right-click) events
    const handleContextMenu = (e) => {
      isOnPoint.current = false // Avoid triggering endMove handler if we tap-and-hold
      e.preventDefault()
      calendarContext.onEventContextMenu &&
        calendarContext.onEventContextMenu(event, e)
    }

    // Handle click events
    const removeBeforeSelectListener = selector.on(
      'beforeSelect',
      (point, e) => {
        const nodeBounds = getBoundsForNode(node)
        if (!pointInBox(nodeBounds, point)) return

        /* Mouse left long-click should not trigger context menu */
        if (e.type !== 'mousedown') {
          longPressTimer.current = setTimeout(() => {
            handleContextMenu(e) // Trigger context menu after 800ms
          }, 800)
        }

        eventId.current = event.id
        isOnPoint.current = true
      }
    )

    const removeSelectingListener = selector.on('selecting', () => {
      clearTimeout(longPressTimer.current)
    })

    const removeOnEndListener = selector.on('endMove', (point, e) => {
      if (isOnPoint.current) {
        calendarContext.onSelectEvent &&
          notify(calendarContext.onSelectEvent, [event, e, { dryRun: true }])
      }

      isOnPoint.current = false
    })

    const removeClickListener = selector.on('click', (point, e) => {
      const nodeBounds = getBoundsForNode(node)
      if (!pointInBox(nodeBounds, point)) return

      // Detect double tap for touch devices
      if (e.type === 'touchend') {
        const currentTime = new Date().getTime()
        const tapLength = currentTime - lastTap.current

        if (tapLength < 300 && tapLength > 0) {
          // Double tap detected, trigger onSelectEvent with no dryRun
          calendarContext.onSelectEvent &&
            notify(calendarContext.onSelectEvent, [event, e, { dryRun: false }])
        }

        lastTap.current = currentTime
      } else {
        // Handle regular clicks or single tap on non-touch devices
        calendarContext.onSelectEvent &&
          notify(calendarContext.onSelectEvent, [
            event,
            e,
            { dryRun: e.type === 'touchend' },
          ])
      }

      clearTimeout(longPressTimer.current)
      isOnPoint.current = false
    })

    node.addEventListener('contextmenu', handleContextMenu)

    return () => {
      removeBeforeSelectListener && removeBeforeSelectListener.remove()
      removeClickListener && removeClickListener.remove()
      removeSelectingListener && removeSelectingListener.remove()
      removeOnEndListener && removeOnEndListener.remove()
      node.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [selector, nodeRef, event.id, calendarContext.onSelectEvent])

  const { draggable } = dragContext
  const { draggableAccessor, resizableAccessor } = draggable

  const isDraggable = draggableAccessor ? !!get(event, draggableAccessor) : true

  /* Event is not draggable, no need to wrap it */
  if (!isDraggable) {
    return React.cloneElement(children, {
      ref: nodeRef,
    })
  }

  const isResizable =
    resizable && (resizableAccessor ? !!get(event, resizableAccessor) : true)

  const newProps = {
    'data-event-id': `${event.id}`,
    ref: nodeRef,
  }

  if (event.__isPreview) {
    return React.cloneElement(children, {
      className: clsx(children.props.className, 'rbc-addons-dnd-drag-preview'),
      ref: nodeRef,
    })
  }

  if (isResizable) {
    // Replace original event child with anchor-embellished child
    let StartAnchor = null
    let EndAnchor = null

    if (type === 'date') {
      StartAnchor = !continuesPrior && renderAnchor('Left')
      EndAnchor = !continuesAfter && renderAnchor('Right')
    } else {
      StartAnchor = !continuesPrior && renderAnchor('Up')
      EndAnchor = !continuesAfter && renderAnchor('Down')
    }

    newProps.children = (
      <div className="rbc-addons-dnd-resizable">
        {StartAnchor}
        {children.props.children}
        {EndAnchor}
      </div>
    )
  }

  if (
    draggable.dragAndDropAction.interacting && // If an event is being dragged right now
    draggable.dragAndDropAction.event === event && // And it's the current event
    draggable.dragAndDropAction.actuallyMoved // And it actually moved
  ) {
    // Add a new class to it
    newProps.className = clsx(
      children.props.className,
      'rbc-addons-dnd-dragged-event'
    )
  }

  return React.cloneElement(children, newProps)
}

function renderAnchor(direction) {
  const cls = direction === 'Up' || direction === 'Down' ? 'ns' : 'ew'
  return (
    <div
      data-anchor-direction={direction}
      className={`rbc-addons-dnd-resize-${cls}-anchor`}
    >
      <div className={`rbc-addons-dnd-resize-${cls}-icon`} />
    </div>
  )
}

EventWrapper.propTypes = {
  type: PropTypes.oneOf(['date', 'time']),
  event: PropTypes.object.isRequired,
  continuesPrior: PropTypes.bool,
  continuesAfter: PropTypes.bool,
  resizable: PropTypes.bool,
  children: PropTypes.element.isRequired,
}

export default EventWrapper
