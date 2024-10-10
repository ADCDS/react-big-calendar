import React from 'react'
import clsx from 'clsx'
import CalendarContext from './CalendarContext'

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
    components: { event: EventComponent, eventWrapper: EventWrapper },
  } = props

  const title = accessors.title(event)
  const tooltip = accessors.tooltip(event)
  const end = accessors.end(event)
  const start = accessors.start(event)

  const userProps = getters.eventProp(event, start, end, selected)

  const { height, top, width, xOffset } = style

  const eventStyle = {
    ...userProps.style,
    top: stringifyPercent(top),
    height: stringifyPercent(height),
    width: stringifyPercent(width),
    [rtl ? 'right' : 'left']: stringifyPercent(xOffset),
  }

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
