import React from 'react'
import PropTypes from 'prop-types'
import clsx from 'clsx'
import CalendarContext from './CalendarContext'

function EventCell(props) {
  const {
    style,
    className,
    event,
    selected,
    isAllDay,
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
