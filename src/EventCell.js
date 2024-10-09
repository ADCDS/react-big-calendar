import PropTypes from 'prop-types'
import React from 'react'
import clsx from 'clsx'
import CalendarContext from './CalendarContext'

class EventCell extends React.Component {
  static contextType = CalendarContext;

  constructor(props) {
    super(props)
    this.pointerDownTimeout = null
    this.lastTap = 0 // to store the timestamp of the last tap on touch devices
    this.isTouchEvent = false // flag to track if it's a touch event
  }

  handlePointerDown = (event, e) => {
    this.isTouchEvent = e.pointerType === 'touch'

    if (this.isTouchEvent) {
      // Start a timeout for touch-and-hold to trigger the context menu callback
      this.pointerDownTimeout = setTimeout(() => {
        this.pointerDownTimeout = null
        // Trigger the context menu callback (printing "lancha") on touch-and-hold
        this.context.onEventContextMenu && this.context.onEventContextMenu(e)
      }, 800) // 800ms for long press detection
    } else {
      // For non-touch devices, use a shorter timeout for click detection
      this.pointerDownTimeout = setTimeout(() => {
        this.pointerDownTimeout = null // Clear timeout if the user holds down
      }, 200) // 200ms is typical for distinguishing a click from a hold
    }
  }

  handlePointerUp = (event, e) => {
    // If the timeout is still active, it means the user released quickly (i.e., clicked)
    if (this.pointerDownTimeout) {
      clearTimeout(this.pointerDownTimeout)
      this.pointerDownTimeout = null

      // For touch events, handle tap and double-tap logic
      if (this.isTouchEvent) {
        const currentTime = new Date().getTime()
        const tapGap = currentTime - this.lastTap

        if (tapGap < 300 && tapGap > 0) {
          // If a double-tap is detected (within 300ms), trigger onSelect
          if (this.props.onSelect) {
            this.props.onSelect(event, e)
          }
        } else {
          this.props.onSelect(event, e, { dryRun: true }) // Select event to display interactive buttons
        }

        this.lastTap = currentTime // Update lastTap time
      } else {
        // For non-touch devices, trigger onSelect immediately
        if (this.props.onSelect) {
          this.props.onSelect(event, e)
        }
      }
    } else {
      this.props.onSelect(event, e, { dryRun: true }) // Select event for touch-drag-move
    }
  }

  handlePointerLeave = () => {
    // Clear the timeout if the pointer leaves the element before the release
    if (this.pointerDownTimeout) {
      clearTimeout(this.pointerDownTimeout)
      this.pointerDownTimeout = null
    }
  }

  render() {
    let {
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
      components: { event: Event, eventWrapper: EventWrapper },
      slotStart,
      slotEnd,
      ...props
    } = this.props
    delete props.resizable

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
        {Event ? (
          <Event
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
      <EventWrapper {...this.props} type="date">
        <div
          {...props}
          style={{ ...userProps.style, ...style }}
          className={clsx('rbc-event', className, userProps.className, {
            'rbc-selected': selected,
            'rbc-event-allday': showAsAllDay,
            'rbc-event-continues-prior': continuesPrior,
            'rbc-event-continues-after': continuesAfter,
          })}
          onContextMenu={this.context.onEventContextMenu}
          onPointerDown={(e) => this.handlePointerDown(event, e)}
          onPointerUp={(e) => this.handlePointerUp(event, e)}
          onPointerLeave={this.handlePointerLeave}
          onDoubleClick={(e) => onDoubleClick && onDoubleClick(event, e)}
          onKeyDown={(e) => onKeyPress && onKeyPress(event, e)}
        >
          {typeof children === 'function' ? children(content) : content}
        </div>
      </EventWrapper>
    )
  }
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
