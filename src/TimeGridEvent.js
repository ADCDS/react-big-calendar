import React, { useEffect, useRef, useContext } from 'react'
import clsx from 'clsx'
import { DnDContext } from './addons/dragAndDrop/DnDContext'
import CalendarContext from './CalendarContext'
import { getBoundsForNode } from './Selection'
import { pointInBox } from './utils/selection'
import { notify } from './utils/helpers' // Assuming you have a CalendarContext

function stringifyPercent(v) {
  return typeof v === 'string' ? v : v + '%'
}

function TimeGridEvent(props) {
  const {
    style,
    className,
    event,
    accessors,
    rtl,
    selected,
    label,
    continuesPrior,
    continuesAfter,
    getters,
    isBackgroundEvent,
    components: { event: EventComponent, eventWrapper: EventWrapper }
  } = props

  const nodeRef = useRef(null)
  const eventRef = useRef(event);

  useEffect(() => {
    eventRef.current =  event
  }, [event]);

  const calendarContext = useContext(CalendarContext)
  const dragContext = useContext(DnDContext)
  const selector = dragContext?.draggable?.selector

  const title = accessors.title(event)
  const tooltip = accessors.tooltip(event)
  const end = accessors.end(event)
  const start = accessors.start(event)

  const isOnPoint = useRef(false);
  const longPressTimer = useRef(null) // Store the long-press timer

  const userProps = getters.eventProp(event, start, end, selected)

  const { height, top, width, xOffset } = style

  const eventStyle = {
    ...userProps.style,
    top: stringifyPercent(top),
    height: stringifyPercent(height),
    width: stringifyPercent(width),
    [rtl ? 'right' : 'left']: stringifyPercent(xOffset),
  }

  useEffect(() => {
    if (!nodeRef.current || !selector) return

    const node = nodeRef.current

    // Handle click events
    const removeBeforeSelectListener = selector.on('beforeSelect', (point, e) => {
      const nodeBounds = getBoundsForNode(node)
      if (!pointInBox(nodeBounds, point)) return

      /*Mouse left long-click should not trigger ctx menu*/
      if(e.type !== "mousedown") {
        longPressTimer.current = setTimeout(() => {
          handleContextMenu(e) // Trigger context menu after 800ms
        }, 800)
      }

      isOnPoint.current = true;
    })


    const removeSelectingListener = selector.on('selecting', (point, e) => {
      clearTimeout(longPressTimer.current)
    })

    const removeOnEndListener = selector.on('endMove', (point, e) => {
      if(isOnPoint.current) {
        calendarContext.onSelectEvent && notify(calendarContext.onSelectEvent, [eventRef.current, e, { dryRun: true }])
      }

      isOnPoint.current = false;
    })

    const removeClickListener = selector.on('click', (point, e) => {
      if(isOnPoint.current || e.type === "mouseup" /*Mouse left long-click should not trigger ctx menu*/) {
        calendarContext.onSelectEvent && notify(calendarContext.onSelectEvent, [eventRef.current, e])
      }

      clearTimeout(longPressTimer.current);
      isOnPoint.current = false;
    })

    // Handle context menu (right-click) events
    const handleContextMenu = (e) => {
      isOnPoint.current = false; // Avoid triggering endMove handler if we tap-and-hold
      e.preventDefault();
      calendarContext.onEventContextMenu && calendarContext.onEventContextMenu(event, e)
    }

    node.addEventListener('contextmenu', handleContextMenu)

    return () => {
      removeBeforeSelectListener && removeBeforeSelectListener.remove()
      removeClickListener && removeClickListener.remove()
      removeSelectingListener && removeSelectingListener.remove()
      removeOnEndListener && removeOnEndListener.remove()
      node.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [
    selector,
    nodeRef,
    calendarContext.onSelectEvent,
  ])

  const inner = [
    <div key="1" className="rbc-event-label">
      {label}
    </div>,
    <div key="2" className="rbc-event-content">
      {EventComponent ? <EventComponent event={event} title={title} /> : title}
    </div>,
  ]

  return (
    <EventWrapper type="time" {...props}>
      <div
        ref={nodeRef}
        role="button"
        tabIndex={0}
        style={eventStyle}
        title={
          tooltip
            ? (typeof label === 'string' ? label + ': ' : '') + tooltip
            : undefined
        }
        className={clsx(
          isBackgroundEvent ? 'rbc-background-event' : 'rbc-event',
          className,
          userProps.className,
          {
            'rbc-selected': selected,
            'rbc-event-continues-earlier': continuesPrior,
            'rbc-event-continues-later': continuesAfter,
          }
        )}
      >
        {inner}
      </div>
    </EventWrapper>
  )
}

export default TimeGridEvent
