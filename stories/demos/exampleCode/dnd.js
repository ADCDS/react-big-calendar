import React, { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import events from '../../resources/events'
import { Calendar, Views, DateLocalizer } from 'react-big-calendar'
import DemoLink from '../../DemoLink.component'
// Storybook cannot alias this, so you would use 'react-big-calendar/lib/addons/dragAndDrop'
import withDragAndDrop from '../../../src/addons/dragAndDrop'
// Storybook cannot alias this, so you would use 'react-big-calendar/lib/addons/dragAndDrop/styles.scss'
import '../../../src/addons/dragAndDrop/styles.scss'
import EventWrapper from '../../../src/addons/dragAndDrop/EventWrapper'


const DragAndDropCalendar = withDragAndDrop(Calendar)

const EventWrapperComponent = (props) => {
  return (
    <EventWrapper {...props}>
      {props.children}
    </EventWrapper>
  );
};

function buildMessage(slotInfo) {
  return `[onSelectSlot] a date selection was made, passing 'slotInfo'
  ${JSON.stringify(slotInfo, null, 2)}`
}


export default function DragAndDrop({ localizer }) {
  const clickRef = useRef(null)
  const [myEvents, setMyEvents] = useState(events)

  const moveEvent = useCallback(
    ({ event, start, end, isAllDay: droppedOnAllDaySlot = false }) => {
      const { allDay } = event
      if (!allDay && droppedOnAllDaySlot) {
        event.allDay = true
      }
      if (allDay && !droppedOnAllDaySlot) {
          event.allDay = false;
      }

      setMyEvents((prev) => {
        const existing = prev.find((ev) => ev.id === event.id) ?? {}
        const filtered = prev.filter((ev) => ev.id !== event.id)
        return [...filtered, { ...existing, start, end, allDay: event.allDay }]
      })
    },
    [setMyEvents]
  )

  const resizeEvent = useCallback(
    ({ event, start, end }) => {
      setMyEvents((prev) => {
        const existing = prev.find((ev) => ev.id === event.id) ?? {}
        const filtered = prev.filter((ev) => ev.id !== event.id)
        return [...filtered, { ...existing, start, end }]
      })
    },
    [setMyEvents]
  )

  const onSelectSlot = useCallback((slotInfo, event, metadata) => {
    if(metadata?.dryRun)
      return;

    /**
     * Here we are waiting 250 milliseconds prior to firing
     * our method. Why? Because both 'click' and 'doubleClick'
     * would fire, in the event of a 'doubleClick'. By doing
     * this, the 'click' handler is overridden by the 'doubleClick'
     * action.
     */
    window.clearTimeout(clickRef?.current)
    clickRef.current = window.setTimeout(() => {
      window.alert(buildMessage(slotInfo))
    }, 250)
  }, [])

  const defaultDate = useMemo(() => new Date(2015, 3, 13), [])

  return (
    <Fragment>
      <DemoLink fileName="dnd">
        <strong>
          Drag 1and Drop an "event" from one slot to another to "move" the event,
          or drag an event's drag handles to "resize" the event.
        </strong>
      </DemoLink>
      <div className="height600">
        <DragAndDropCalendar
          defaultDate={defaultDate}
          defaultView={Views.MONTH}
          events={myEvents}
          localizer={localizer}
          onEventDrop={moveEvent}
          onEventResize={resizeEvent}
          selectable={true}
          onSelectSlot={onSelectSlot}
          onSelectEvent={onSelectSlot}
          components={{
            eventWrapper: (props) => <EventWrapperComponent {...props}/>
          }}
          popup
          resizable
        />
      </div>
    </Fragment>
  )
}
DragAndDrop.propTypes = {
  localizer: PropTypes.instanceOf(DateLocalizer),
}
