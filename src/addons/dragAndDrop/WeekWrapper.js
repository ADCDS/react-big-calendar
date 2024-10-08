import PropTypes from 'prop-types'
import React from 'react'
import EventRow from '../../EventRow'
import Selection, { getBoundsForNode, getEventNodeFromPoint, isOverContainer } from '../../Selection'
import { eventSegments } from '../../utils/eventLevels'
import { getSlotAtX, pointInBox } from '../../utils/selection'
import { dragAccessors, eventTimes, pointInColumn } from './common'
import { DnDContext } from './DnDContext'

class WeekWrapper extends React.Component {
  static propTypes = {
    isAllDay: PropTypes.bool,
    slotMetrics: PropTypes.object.isRequired,
    accessors: PropTypes.object.isRequired,
    getters: PropTypes.object.isRequired,
    components: PropTypes.object.isRequired,
    resourceId: PropTypes.any,
    rtl: PropTypes.bool,
    localizer: PropTypes.any,
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

  reset() {
    if (this.state.segment) this.setState({ segment: null })
  }

  update(event, start, end) {
    const segment = eventSegments(
      { ...event, end, start, __isPreview: true },
      this.props.slotMetrics.range,
      dragAccessors,
      this.props.localizer
    )

    const { segment: lastSegment } = this.state
    if (
      (lastSegment &&
        segment.span === lastSegment.span &&
        segment.left === lastSegment.left &&
        segment.right === lastSegment.right)
      || segment.left === 0
    ) {
      return
    }
    this.setState({ segment })
  }

  handleMove = (point, bounds, draggedEvent) => {
    if (!pointInBox(bounds, point)) return this.reset()
    const event = this.context.draggable.dragAndDropAction.event || draggedEvent
    const { accessors, slotMetrics, rtl, localizer } = this.props

    const slot = getSlotAtX(bounds, point.x, rtl, slotMetrics.slots)

    const date = slotMetrics.getDateForSlot(slot)

    // Adjust the dates, but maintain the times when moving
    let { start, duration } = eventTimes(event, accessors, localizer)
    start = localizer.merge(date, start)
    const end = localizer.add(start, duration, 'milliseconds')
    // Update the event preview
    this.update(event, start, end)

    return event
  }

  handleResize(point, bounds) {
    const { event, direction } = this.context.draggable.dragAndDropAction
    const { accessors, slotMetrics, rtl, localizer } = this.props

    let { start, end } = eventTimes(event, accessors, localizer)

    const slot = getSlotAtX(bounds, point.x, rtl, slotMetrics.slots)
    const date = slotMetrics.getDateForSlot(slot)
    const cursorInRow = pointInBox(bounds, point)

    if (direction === 'RIGHT') {
      if (cursorInRow) {
        if (slotMetrics.last < start) return this.reset()
        if (localizer.eq(localizer.startOf(end, 'day'), end))
          end = localizer.add(date, 1, 'day')
        else end = date
      } else if (
        localizer.inRange(start, slotMetrics.first, slotMetrics.last) ||
        (bounds.bottom < point.y && +slotMetrics.first > +start)
      ) {
        end = localizer.add(slotMetrics.last, 1, 'milliseconds')
      } else {
        this.setState({ segment: null })
        return
      }
      const originalEnd = accessors.end(event)
      end = localizer.merge(end, originalEnd)
      if (localizer.lt(end, start)) {
        end = originalEnd
      }
    } else if (direction === 'LEFT') {
      if (cursorInRow) {
        if (slotMetrics.first > end) return this.reset()
        start = date
      } else if (
        localizer.inRange(end, slotMetrics.first, slotMetrics.last) ||
        (bounds.top > point.y && localizer.lt(slotMetrics.last, end))
      ) {
        start = localizer.add(slotMetrics.first, -1, 'milliseconds')
      } else {
        this.reset()
        return
      }
      const originalStart = accessors.start(event)
      start = localizer.merge(start, originalStart)
      if (localizer.gt(start, end)) {
        start = originalStart
      }
    }

    this.update(event, start, end)
    return event
  }

  _selectable = () => {
    let node = this.ref.current.closest('.rbc-month-row, .rbc-allday-cell')

    let isInBox = false;
    // Valid container check only necessary in TimeGrid views
    let selector = this._selector = this.context.draggable.selector;

    selector.on('probeEventDrag', (point) => {
      return getEventNodeFromPoint(node, point);
    });

    selector.on('beforeSelect', (point, e) => {
      // console.log("WeekWrapper beforeSelect");

      const bounds = getBoundsForNode(node)
      isInBox = pointInBox(bounds, point);

      if (this.context.draggable.dragAndDropAction.event) {
        // Already selecting an event
        return
      }

      if (!isInBox) {
        // Return undefined so DayColumn beforeSelect can be triggered
        return
      }

      const eventNode = getEventNodeFromPoint(node, point)
      if (!eventNode) return false

      this.context.draggable.setEventOrigin(this);

      // Get the event ID from the eventNode
      let eventIdFromNode = eventNode.dataset.eventId

      // Get the events from children
      const allEvents = this.props.children[0]

      for (const child of allEvents) {
        if(child.props.segments && Array.isArray(child.props.segments)) {
          for (const segment of child.props.segments) {
            let evtProp = segment.event
            if (String(evtProp.id) === eventIdFromNode) {
              this.context.draggable.onStart()

              const isResizeHandle = e.target
                .getAttribute('class')
                ?.includes('rbc-addons-dnd-resize')
              if (!isResizeHandle) {
                this.context.draggable.onBeginAction(evtProp, 'move')
              } else {
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
              break
            }
          }
        }
      }

      return true
    })

    selector.on('selecting', (box) => {
      const bounds = getBoundsForNode(node)
      const { dragAndDropAction } = this.context.draggable

      // If we are on month view this.props.isAllDay === true, in that case
      // We need to proc selecting in all weeks so the user can move/resize
      // multi-days events
      if (!isInBox && this.props.isAllDay) {
        // Return undefined so DayColumn beforeSelect can be triggered
        return
      }

      // console.log('WeekWrapper selecting', { box, dragAndDropAction })

      if (dragAndDropAction.action === 'move') {
        this.handleMove(box, bounds)
      }
      if (dragAndDropAction.action === 'resize') {
        this.handleResize(box, bounds)
      }
    })

    selector.on('dropFromOutside', (point) => {
      if (!this.context.draggable.onDropFromOutside) return
      const bounds = getBoundsForNode(node)
      if (!pointInBox(bounds, point)) return
      this.handleDropFromOutside(point, bounds)
    })

    selector.on('dragOverFromOutside', (point) => {
      const item = this.context.draggable.dragFromOutsideItem
        ? this.context.draggable.dragFromOutsideItem()
        : null
      if (!item) return
      const bounds = getBoundsForNode(node)

      this.handleDragOverFromOutside(point, bounds)
    })

    selector.on('endMove', (point) => {
      const { clientX, clientY } = point;
      const draggableArea = node.parentElement;

      const origin = this.context.draggable.dragAndDropAction.eventOrigin;

      if (origin && origin instanceof WeekWrapper && !isOverContainer(draggableArea, clientX, clientY)) {
        this.reset();
        this.context.draggable.onEnd(null)
      } else {
        this.handleInteractionEnd()
      }
    })

    selector.on('click', () => {
      this.reset()
      this.context.draggable.onEnd(null)
    })

    selector.on('reset', () => {
      this.reset()
      this.context.draggable.onEnd(null)
    })
  }

  handleInteractionEnd = () => {
    if(!this.state.segment)
      return;

    const { resourceId, isAllDay } = this.props
    const { event } = this.state.segment

    this.reset()

    this.context.draggable.onEnd({
      start: event.start,
      end: event.end,
      resourceId,
      isAllDay,
    })
  }

  render() {
    const { children, accessors } = this.props

    let { segment } = this.state

    return (
      <div ref={this.ref} className="rbc-addons-dnd-row-body">
        {children}

        {segment && (
          <EventRow
            {...this.props}
            selected={null}
            className="rbc-addons-dnd-drag-row"
            segments={[segment]}
            accessors={{
              ...accessors,
              ...dragAccessors,
            }}
          />
        )}
      </div>
    )
  }
}

export default WeekWrapper
