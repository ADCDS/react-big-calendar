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
    this._removeListeners = []  // Store cleanup functions
  }

  componentDidMount() {
    this._selectable()
  }

  componentWillUnmount() {
    this._teardownSelectable()  // Clean up listeners
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
        segment.right === lastSegment.right) ||
      segment.left === 0
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

    let { start, duration } = eventTimes(event, accessors, localizer)
    start = localizer.merge(date, start)
    const end = localizer.add(start, duration, 'milliseconds')
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
    let isInBox = false
    let selector = this.context.draggable.selector

    // Storing the cleanup functions returned by the event listeners
    this._removeListeners.push(
      selector.on('probeEventDrag', (point) => {
        return getEventNodeFromPoint(node, point)
      })
    )

    this._removeListeners.push(
      selector.on('beforeSelect', (point, e) => {
        const bounds = getBoundsForNode(node)
        isInBox = pointInBox(bounds, point)

        if (this.context.draggable.dragAndDropAction.event) return
        if (!isInBox) return

        const eventNode = getEventNodeFromPoint(node, point)
        if (!eventNode) return

        this.context.draggable.setEventOrigin(this)

        const eventIdFromNode = eventNode.dataset.eventId
        const allEvents = this.props.children[0]

        for (const child of allEvents) {
          if (child.props.segments && Array.isArray(child.props.segments)) {
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
      })
    )

    this._removeListeners.push(
      selector.on('selecting', (box) => {
        const bounds = getBoundsForNode(node)
        const { dragAndDropAction } = this.context.draggable

        if(!dragAndDropAction.actuallyMoved) {
          this.context.draggable.onInitialMove();
        }

        if (!isInBox && this.props.isAllDay) return
        if (dragAndDropAction.action === 'move') {
          this.handleMove(box, bounds)
        }
        if (dragAndDropAction.action === 'resize') {
          this.handleResize(box, bounds)
        }
      })
    )

    this._removeListeners.push(
      selector.on('dropFromOutside', (point) => {
        if (!this.context.draggable.onDropFromOutside) return
        const bounds = getBoundsForNode(node)
        if (!pointInBox(bounds, point)) return
        this.handleDropFromOutside(point, bounds)
      })
    )

    this._removeListeners.push(
      selector.on('dragOverFromOutside', (point) => {
        const item = this.context.draggable.dragFromOutsideItem
          ? this.context.draggable.dragFromOutsideItem()
          : null
        if (!item) return
        const bounds = getBoundsForNode(node)

        this.handleDragOverFromOutside(point, bounds)
      })
    )

    this._removeListeners.push(
      selector.on('endMove', (point) => {
        const { clientX, clientY } = point
        const draggableArea = node.parentElement
        const origin = this.context.draggable.dragAndDropAction.eventOrigin

        if (origin && origin instanceof WeekWrapper && !isOverContainer(draggableArea, clientX, clientY)) {
          this.reset()
          this.context.draggable.onEnd(null)
        } else {
          this.handleInteractionEnd()
        }
      })
    )

    this._removeListeners.push(
      selector.on('click', () => {
        this.reset()
        this.context.draggable.onEnd(null)
      })
    )

    this._removeListeners.push(
      selector.on('reset', () => {
        this.reset()
        this.context.draggable.onEnd(null)
      })
    )
  }

  _teardownSelectable() {
    // Invoke each stored cleanup function to remove the event listeners
    this._removeListeners.forEach(({ remove }) => remove())
    this._removeListeners = []  // Clear the array
  }

  handleInteractionEnd = () => {
    if (!this.state.segment) return

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
