import PropTypes from 'prop-types'
import React from 'react'
import { DnDContext } from './DnDContext'
import { scrollParent, scrollTop } from 'dom-helpers'
import qsa from 'dom-helpers/cjs/querySelectorAll'

import Selection, { getBoundsForNode, getEventNodeFromPoint } from '../../Selection'
import TimeGridEvent from '../../TimeGridEvent'
import { dragAccessors, eventTimes, pointInColumn } from './common'

class EventContainerWrapper extends React.Component {
  static propTypes = {
    accessors: PropTypes.object.isRequired,
    components: PropTypes.object.isRequired,
    getters: PropTypes.object.isRequired,
    localizer: PropTypes.object.isRequired,
    slotMetrics: PropTypes.object.isRequired,
    resource: PropTypes.any,
  }

  static contextType = DnDContext

  constructor(...args) {
    super(...args)
    this.state = {}
    this.ref = React.createRef()
  }

  componentDidMount() {
    this._selectable()
  }

  componentWillUnmount() {
    this._teardownSelectable()
  }

  reset() {
    if (this.state.event)
      this.setState({ event: null, top: null, height: null })
  }

  update(event, { startDate, endDate, top, height }) {
    const { event: lastEvent } = this.state
    if (
      lastEvent &&
      startDate === lastEvent.start &&
      endDate === lastEvent.end
    ) {
      return
    }

    this.setState({
      top,
      height,
      event: { ...event, start: startDate, end: endDate },
    })
  }

  handleMove = (point, bounds) => {
    let pointInColumn1 = pointInColumn(bounds, point)

    if (!pointInColumn1) return this.reset()
    const { event } = this.context.draggable.dragAndDropAction
    const { accessors, slotMetrics } = this.props

    const newSlot = slotMetrics.closestSlotFromPoint(
      { y: point.y - this.eventOffsetTop, x: point.x },
      bounds
    );

    const { duration } = eventTimes(event, accessors, this.props.localizer)
    let newEnd = this.props.localizer.add(newSlot, duration, 'milliseconds')
    this.update(event, slotMetrics.getRange(newSlot, newEnd, false, true))

    return event
  }

  handleResize(point, bounds) {
    const { accessors, slotMetrics, localizer } = this.props
    const { event, direction } = this.context.draggable.dragAndDropAction
    const newTime = slotMetrics.closestSlotFromPoint(point, bounds)

    let { start, end } = eventTimes(event, accessors, localizer)
    let newRange
    if (direction === 'UP') {
      const newStart = localizer.min(
        newTime,
        slotMetrics.closestSlotFromDate(end, -1)
      )
      // Get the new range based on the new start
      // but don't overwrite the end date as it could be outside this day boundary.
      newRange = slotMetrics.getRange(newStart, end)
      newRange = {
        ...newRange,
        endDate: end,
      }
    } else if (direction === 'DOWN') {
      // Get the new range based on the new end
      // but don't overwrite the start date as it could be outside this day boundary.
      const newEnd = localizer.max(
        newTime,
        slotMetrics.closestSlotFromDate(start)
      )
      newRange = slotMetrics.getRange(start, newEnd)
      newRange = {
        ...newRange,
        startDate: start,
      }
    }

    if (newRange) {
      this.update(event, newRange)
    }
    return event
  }

  handleDropFromOutside = (point, boundaryBox) => {
    const { slotMetrics, resource } = this.props

    let start = slotMetrics.closestSlotFromPoint(
      { y: point.y, x: point.x },
      boundaryBox
    )

    this.context.draggable.onDropFromOutside({
      start,
      end: slotMetrics.nextSlot(start),
      allDay: false,
      resource,
    })
  }

  handleDragOverFromOutside = (point, bounds) => {
    const { slotMetrics } = this.props

    const start = slotMetrics.closestSlotFromPoint(
      { y: point.y, x: point.x },
      bounds
    )
    const end = slotMetrics.nextSlot(start)
    const event = this.context.draggable.dragFromOutsideItem()
    this.update(event, slotMetrics.getRange(start, end, false, true))
  }

  updateParentScroll = (parent, node) => {
    setTimeout(() => {
      const draggedEl = qsa(node, '.rbc-addons-dnd-drag-preview')[0]
      if (draggedEl) {
        if (draggedEl.offsetTop < parent.scrollTop) {
          scrollTop(parent, Math.max(draggedEl.offsetTop, 0))
        } else if (
          draggedEl.offsetTop + draggedEl.offsetHeight >
          parent.scrollTop + parent.clientHeight
        ) {
          scrollTop(
            parent,
            Math.min(
              draggedEl.offsetTop -
                parent.offsetHeight +
                draggedEl.offsetHeight,
              parent.scrollHeight
            )
          )
        }
      }
    })
  }

  _selectable = () => {
    let wrapper = this.ref.current
    let node = wrapper.children[0]

    // console.log('______SELECTABLE', node)
    let isBeingDragged = false
    let isInDayColumn = false

    let selector = (this._selector = new Selection(
      () => wrapper.closest('.rbc-time-view'),
      {},
      this.context
    ))

    let parent = scrollParent(wrapper)

    selector.on('beforeSelect', (point, e) => {
      isInDayColumn = pointInColumn(getBoundsForNode(node), point)

      const eventNode = getEventNodeFromPoint(node, point)
      if (!eventNode) return false

      this.eventOffsetTop = point.y - getBoundsForNode(eventNode).top

      if (this.context.draggable.dragAndDropAction.event) {
        // Already selecting an event
        return {event: this.context.draggable.dragAndDropAction.event}
      }

      const { dragAndDropAction } = this.context.draggable

      if (dragAndDropAction.action === 'resize') {
        return isInDayColumn
      }

      const events = this.props.children.props.children
      let eventIdFromNode = eventNode.dataset.eventId

      let evtProp;
      for (const event of events[1]) {
        if (event.props.event.id === Number(eventIdFromNode)) {
          evtProp = event.props.event
          this.context.draggable.onStart()

          const isResizeHandle = e.target
            .getAttribute('class')
            ?.includes('rbc-addons-dnd-resize')
          if (!isResizeHandle) {
            isBeingDragged = true
            this.context.draggable.onBeginAction(evtProp, 'move')
          } else {
            isBeingDragged = true

            let anchorDirection = e.target.dataset.anchorDirection
            if (!anchorDirection) {
              anchorDirection = e.target.parentNode.dataset.anchorDirection
            }

            this.context.draggable.onBeginAction(
              evtProp,
              'resize',
              anchorDirection.toUpperCase()
            )
          }
        }
      }

      if(evtProp) {
        // eventOffsetTop is distance from the top of the event to the initial
        // mouseDown position. We need this later to compute the new top of the
        // event during move operations, since the final location is really a
        // delta from this point. note: if we want to DRY this with WeekWrapper,
        // probably better just to capture the mouseDown point here and do the
        // placement computation in handleMove()...

        // return {event: evtProp}
      }

      // If no event was found, return null, that way we trigger the beforeSelect
      // In the sibling days in week view
    })

    selector.on('probeEventDrag', (point) => {
      isInDayColumn = pointInColumn(getBoundsForNode(node), point)
      return getEventNodeFromPoint(node, point);
    });

    selector.on('selecting', (box) => {
      const bounds = getBoundsForNode(node)
      const { dragAndDropAction } = this.context.draggable;

      if (dragAndDropAction.action === 'move') {
        this.updateParentScroll(parent, node)
        this.handleMove(box, bounds)

        return true // Avoid calling WeekWrapper's selecting callback
      }
      if (dragAndDropAction.action === 'resize') {
        if(!isInDayColumn)
          return;

        this.updateParentScroll(parent, node)
        this.handleResize(box, bounds)

        return true // Avoid calling WeekWrapper's selecting callback
      }
    })

    selector.on('dropFromOutside', (point) => {
      if (!this.context.draggable.onDropFromOutside) return
      const bounds = getBoundsForNode(node)
      if (!pointInColumn(bounds, point)) return
      this.handleDropFromOutside(point, bounds)
    })

    selector.on('dragOverFromOutside', (point) => {
      const item = this.context.draggable.dragFromOutsideItem
        ? this.context.draggable.dragFromOutsideItem()
        : null
      if (!item) return
      const bounds = getBoundsForNode(node)
      if (!pointInColumn(bounds, point)) return this.reset()
      this.handleDragOverFromOutside(point, bounds)
    });

    selector.on('click', () => {
      if (isBeingDragged) this.reset()
      this.context.draggable.onEnd(null)
    })

    selector.on('reset', () => {
      this.reset()
      this.context.draggable.onEnd(null)
    })

    selector.on('endMove', () => {
      if(this.state.event) {
        // If the moved event did not belong to this container, return null,
        // that way we allow the sibling days in week view's endMove to trigger

        this.context.draggable.onEnd(this.state.event)
        this.reset()
      }
    })
  }

  _teardownSelectable = () => {
    if (!this._selector) return
    this._selector.teardown()
    this._selector = null
  }

  renderContent() {
    const { children, accessors, components, getters, slotMetrics, localizer } =
      this.props

    let { event, top, height } = this.state

    const events = children.props.children

    let label, startsBeforeDay, startsAfterDay

    if (event) {
      const { start, end } = event
      let format = 'eventTimeRangeFormat'

      startsBeforeDay = slotMetrics.startsBeforeDay(start)
      startsAfterDay = slotMetrics.startsAfterDay(end)

      if (startsBeforeDay) format = 'eventTimeRangeEndFormat'
      else if (startsAfterDay) format = 'eventTimeRangeStartFormat'

      if (startsBeforeDay && startsAfterDay) label = localizer.messages.allDay
      else label = localizer.format({ start, end }, format)
    }

    // console.log({ event })

    return React.cloneElement(children, {
      children: (
        <React.Fragment>
          {events}

          {event && (
            <TimeGridEvent
              event={event}
              label={label}
              className="rbc-addons-dnd-drag-preview"
              style={{ top, height, width: 100 }}
              getters={getters}
              components={components}
              accessors={{ ...accessors, ...dragAccessors }}
              continuesPrior={startsBeforeDay}
              continuesAfter={startsAfterDay}
            />
          )}
        </React.Fragment>
      ),
    })
  }

  render() {
    // console.log('render')
    return <div ref={this.ref}>{this.renderContent()}</div>
  }
}

export default EventContainerWrapper
