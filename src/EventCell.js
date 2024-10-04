import PropTypes from 'prop-types'
import React from 'react'
import clsx from 'clsx'

class EventCell extends React.Component {
  constructor(props) {
    super(props)
    this.pointerDownTimeout = null
    this.lastTap = 0 // to store the timestamp of the last tap on touch devices
  }

  handlePointerDown = (event, e) => {
    // Start a timeout to detect if the user holds the click/touch for too long
    this.pointerDownTimeout = setTimeout(() => {
      this.pointerDownTimeout = null // Clear timeout if the user holds down
    }, 200) // 200ms is a typical threshold for distinguishing a click from a hold
  }

  handlePointerUp = (event, e) => {
    // console.log("EventCell handlePointerUp");
    // If the timeout is still active, it means the user released quickly (i.e., clicked)
    if (this.pointerDownTimeout) {
      clearTimeout(this.pointerDownTimeout)
      this.pointerDownTimeout = null

      // Check pointer type to differentiate between touch and mouse
      if (e.pointerType === 'touch') {
        const currentTime = new Date().getTime()
        const tapGap = currentTime - this.lastTap

        if (tapGap < 300 && tapGap > 0) {
          // If a double-tap is detected (within 300ms), trigger onSelect
          if (this.props.onSelect) {
            this.props.onSelect(event, e)
          }
        } else {
          this.props.onSelect(event, e, {dryRun: true}) // Just selects the event to display the interactive buttons
        }

        this.lastTap = currentTime // Update lastTap time

      } else {
        // For non-touch devices (mouse), trigger onSelect immediately
        if (this.props.onSelect) {
          this.props.onSelect(event, e)
        }
      }
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
