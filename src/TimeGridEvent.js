import clsx from 'clsx'
import React, { useState } from 'react'

function stringifyPercent(v) {
  return typeof v === 'string' ? v : v + '%'
}

/* eslint-disable react/prop-types */
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
    onPointerDown,
    isBackgroundEvent,
    onKeyPress,
    components: { event: Event, eventWrapper: EventWrapper },
  } = props

  const [pointerDownTimeout, setPointerDownTimeout] = useState(null)
  const [lastTap, setLastTap] = useState(0) // To store the timestamp of the last tap

  let title = accessors.title(event)
  let tooltip = accessors.tooltip(event)
  let end = accessors.end(event)
  let start = accessors.start(event)

  let userProps = getters.eventProp(event, start, end, selected)

  const inner = [
    <div key="1" className="rbc-event-label">
      {label}
    </div>,
    <div key="2" className="rbc-event-content">
      {Event ? <Event event={event} title={title} /> : title}
    </div>,
  ]

  const { height, top, width, xOffset } = style

  const eventStyle = {
    ...userProps.style,
    top: stringifyPercent(top),
    height: stringifyPercent(height),
    width: stringifyPercent(width),
    [rtl ? 'right' : 'left']: stringifyPercent(xOffset),
  }

  // Handle pointer down and hold
  const handlePointerDown = (e) => {
    const timeout = setTimeout(() => {
      setPointerDownTimeout(null)
    }, 200) // Timeout to distinguish click from hold (200ms)

    setPointerDownTimeout(timeout)
  }

  const handlePointerUp = (e) => {
    // console.log("TimeGridEvent handlePointerUp")

    if (pointerDownTimeout) {
      clearTimeout(pointerDownTimeout)
      setPointerDownTimeout(null)

      if (e.pointerType === 'touch') {
        const currentTime = new Date().getTime()
        const tapGap = currentTime - lastTap

        if (tapGap < 300 && tapGap > 0) {
          // If a double-tap is detected (within 300ms), trigger onPointerDown
          if (onPointerDown) {
            onPointerDown(e)
          }
        } else {
          onPointerDown(e, {dryRun: true})
        }

        setLastTap(currentTime)
      } else {
        // For non-touch devices (mouse), trigger onPointerDown immediately
        if (onPointerDown) {
          onPointerDown(e)
        }
      }
    }
  }

  const handlePointerLeave = () => {
    if (pointerDownTimeout) {
      clearTimeout(pointerDownTimeout)
      setPointerDownTimeout(null)
    }
  }

  return (
    <EventWrapper type="time" {...props}>
      <div
        role="button"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        style={eventStyle}
        onKeyDown={onKeyPress}
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
