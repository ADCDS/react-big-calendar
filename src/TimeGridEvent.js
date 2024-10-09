import clsx from 'clsx'
import React, { useState, useContext } from 'react'
import CalendarContext from './CalendarContext' // Assuming you have a CalendarContext

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

  const calendarContext = useContext(CalendarContext) // Use the context
  const [pointerDownTimeout, setPointerDownTimeout] = useState(null)
  const [lastTap, setLastTap] = useState(0) // To store the timestamp of the last tap
  const [isTouchEvent, setIsTouchEvent] = useState(false) // To track if it's a touch event

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

  // Handle pointer down and hold for touch devices
  const handlePointerDown = (e) => {
    setIsTouchEvent(e.pointerType === 'touch')

    if (e.pointerType === 'touch') {
      const timeout = setTimeout(() => {
        setPointerDownTimeout(null)
        // Trigger context menu action on long press
        if (calendarContext.onEventContextMenu) {
          calendarContext.onEventContextMenu(e)
        }
      }, 800) // Long press detection timeout (800ms)

      setPointerDownTimeout(timeout)
    } else {
      // Shorter timeout for non-touch devices
      const timeout = setTimeout(() => {
        setPointerDownTimeout(null)
      }, 200)

      setPointerDownTimeout(timeout)
    }
  }

  const handlePointerUp = (e) => {
    // If the timeout is still active, it means the user released quickly (i.e., clicked)
    if (pointerDownTimeout) {
      clearTimeout(pointerDownTimeout)
      setPointerDownTimeout(null)

      if (isTouchEvent) {
        const currentTime = new Date().getTime()
        const tapGap = currentTime - lastTap

        if (tapGap < 300 && tapGap > 0) {
          // If a double-tap is detected (within 300ms), trigger onPointerDown
          if (onPointerDown) {
            onPointerDown(e)
          }
        } else {
          onPointerDown(e, { dryRun: true }) // Select the event without interaction
        }

        setLastTap(currentTime)
      } else {
        // For non-touch devices (mouse), trigger onPointerDown immediately
        if (onPointerDown) {
          onPointerDown(e)
        }
      }
    } else {
      onPointerDown && onPointerDown(e, { dryRun: true }) // Select the event on touch-drag-move
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
        onContextMenu={calendarContext.onEventContextMenu}
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
