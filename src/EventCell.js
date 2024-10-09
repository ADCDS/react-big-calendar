import React, { useEffect, useRef, useContext } from 'react'
import PropTypes from 'prop-types'
import clsx from 'clsx'
import { DnDContext } from './addons/dragAndDrop/DnDContext'
import CalendarContext from './CalendarContext'
import { getBoundsForNode } from './Selection'
import { pointInBox } from './utils/selection'
import { notify } from './utils/helpers'

function EventCell(props) {
  const {
    style,
    className,
    event,
    selected,
    isAllDay,
    onDoubleClick,
    onKeyPress,
    localizer,
    continuesPrior,
    continuesAfter,
    accessors,
    getters,
    children,
    components: { event: EventComponent, eventWrapper: EventWrapper },
    slotStart,
    slotEnd,
    ...restProps
  } = props

  const nodeRef = useRef(null)
  const eventRef = useRef(event);

  useEffect(() => {
    eventRef.current =  event
  }, [event]);

  const calendarContext = useContext(CalendarContext)
  const dragContext = useContext(DnDContext)
  const selector = dragContext?.draggable?.selector

  const isOnPoint = useRef(false)
  const longPressTimer = useRef(null)

  useEffect(() => {
    if (!nodeRef.current || !selector) return

    const node = nodeRef.current

    // Handle 'beforeSelect' to detect when the pointer is over the event
    const removeBeforeSelectListener = selector.on('beforeSelect', (point, e) => {
      const nodeBounds = getBoundsForNode(node)
      if (!pointInBox(nodeBounds, point)) return

      // Start a timer for long-press (touch devices)
      if (e.type !== 'mousedown') {
        longPressTimer.current = setTimeout(() => {
          handleContextMenu(e) // Trigger context menu after 800ms
        }, 800)
      }

      isOnPoint.current = true
    })

    // Clear the long-press timer if the user starts selecting
    const removeSelectingListener = selector.on('selecting', () => {
      clearTimeout(longPressTimer.current)
    })

    // Handle 'endMove' to trigger select event if the pointer was on the event
    const removeOnEndListener = selector.on('endMove', (point, e) => {
      if (isOnPoint.current) {
        calendarContext.onSelectEvent &&
        notify(calendarContext.onSelectEvent, [eventRef.current, e, { dryRun: true }])
      }
      isOnPoint.current = false
    })

    // Handle 'click' event
    const removeClickListener = selector.on('click', (point, e) => {
      const nodeBounds = getBoundsForNode(node)
      if (!pointInBox(nodeBounds, point)) return

      calendarContext.onSelectEvent && notify(calendarContext.onSelectEvent, [eventRef.current, e, {dryRun: e.type === "touchend"}])

      clearTimeout(longPressTimer.current)
      isOnPoint.current = false
    })

    // Handle context menu (right-click or long-press)
    const handleContextMenu = (e) => {
      isOnPoint.current = false // Avoid triggering 'endMove' handler
      e.preventDefault()
      calendarContext.onEventContextMenu && calendarContext.onEventContextMenu(eventRef.current, e)
    }

    node.addEventListener('contextmenu', handleContextMenu)

    return () => {
      removeBeforeSelectListener && removeBeforeSelectListener.remove()
      removeSelectingListener && removeSelectingListener.remove()
      removeOnEndListener && removeOnEndListener.remove()
      removeClickListener && removeClickListener.remove()
      node.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [selector, nodeRef, calendarContext])

  // Event properties
  let title = accessors.title(event)
  let tooltip = accessors.tooltip(event)
  let end = accessors.end(event)
  let start = accessors.start(event)
  let allDay = accessors.allDay(event)

  let showAsAllDay =
    isAllDay ||
    allDay ||
    localizer.diff(start, localizer.ceil(end, 'day'), 'day') > 1

  let userProps = getters.eventProp(event, start, end, selected)

  const content = (
    <div className="rbc-event-content" title={tooltip || undefined}>
      {EventComponent ? (
        <EventComponent
          event={event}
          continuesPrior={continuesPrior}
          continuesAfter={continuesAfter}
          title={title}
          isAllDay={allDay}
          localizer={localizer}
          slotStart={slotStart}
          slotEnd={slotEnd}
        />
      ) : (
        title
      )}
    </div>
  )

  return (
    <EventWrapper {...props} type="date">
      <div
        {...restProps}
        ref={nodeRef}
        style={{ ...userProps.style, ...style }}
        className={clsx('rbc-event', className, userProps.className, {
          'rbc-selected': selected,
          'rbc-event-allday': showAsAllDay,
          'rbc-event-continues-prior': continuesPrior,
          'rbc-event-continues-after': continuesAfter,
        })}
      >
        {typeof children === 'function' ? children(content) : content}
      </div>
    </EventWrapper>
  )
}

EventCell.propTypes = {
  event: PropTypes.object.isRequired,
  slotStart: PropTypes.instanceOf(Date),
  slotEnd: PropTypes.instanceOf(Date),

  resizable: PropTypes.bool,
  selected: PropTypes.bool,
  isAllDay: PropTypes.bool,
  continuesPrior: PropTypes.bool,
  continuesAfter: PropTypes.bool,

  accessors: PropTypes.object.isRequired,
  components: PropTypes.object.isRequired,
  getters: PropTypes.object.isRequired,
  localizer: PropTypes.object,

  onSelect: PropTypes.func,
  onDoubleClick: PropTypes.func,
  onKeyPress: PropTypes.func,
}

export default EventCell
