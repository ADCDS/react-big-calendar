import React, { createRef } from 'react'
import PropTypes from 'prop-types'
import clsx from 'clsx'

import Selection, { getBoundsForNode, isEvent } from './Selection'
import * as TimeSlotUtils from './utils/TimeSlots'
import { isSelected, pointInBox } from './utils/selection'
import { notify } from './utils/helpers'
import * as DayEventLayout from './utils/DayEventLayout'
import TimeSlotGroup from './TimeSlotGroup'
import TimeGridEvent from './TimeGridEvent'
import { DayLayoutAlgorithmPropType } from './utils/propTypes'
import DayColumnWrapper from './DayColumnWrapper'
import { DnDContext } from './addons/dragAndDrop/DnDContext'

class DayColumn extends React.Component {
  static contextType = DnDContext

  state = { selecting: false, timeIndicatorPosition: null }
  intervalTriggered = false

  constructor(...args) {
    super(...args)

    this.slotMetrics = TimeSlotUtils.getSlotMetrics(this.props)
    this._selectedSlots = []
    this.containerRef = createRef()
    this._removeListeners = []  // Store cleanup functions
  }

  componentDidMount() {
    this.props.selectable && this._selectable()

    if (this.props.isNow) {
      this.setTimeIndicatorPositionUpdateInterval()
    }
  }

  componentWillUnmount() {
    this._teardownSelectable()  // Clean up listeners
    this.clearTimeIndicatorInterval()
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.selectable && !prevProps.selectable) this._selectable()
    if (!this.props.selectable && prevProps.selectable) this._teardownSelectable()

    const { getNow, isNow, localizer, date, min, max } = this.props
    const getNowChanged = localizer.neq(prevProps.getNow(), getNow(), 'minutes')

    if (prevProps.isNow !== isNow || getNowChanged) {
      this.clearTimeIndicatorInterval()

      if (isNow) {
        const tail =
          !getNowChanged &&
          localizer.eq(prevProps.date, date, 'minutes') &&
          prevState.timeIndicatorPosition === this.state.timeIndicatorPosition

        this.setTimeIndicatorPositionUpdateInterval(tail)
      }
    } else if (
      isNow &&
      (localizer.neq(prevProps.min, min, 'minutes') ||
        localizer.neq(prevProps.max, max, 'minutes'))
    ) {
      this.positionTimeIndicator()
    }
  }

  setTimeIndicatorPositionUpdateInterval(tail = false) {
    if (!this.intervalTriggered && !tail) {
      this.positionTimeIndicator()
    }

    this._timeIndicatorTimeout = window.setTimeout(() => {
      this.intervalTriggered = true
      this.positionTimeIndicator()
      this.setTimeIndicatorPositionUpdateInterval()
    }, 60000)
  }

  clearTimeIndicatorInterval() {
    this.intervalTriggered = false
    window.clearTimeout(this._timeIndicatorTimeout)
  }

  positionTimeIndicator() {
    const { min, max, getNow } = this.props
    const current = getNow()

    if (current >= min && current <= max) {
      const top = this.slotMetrics.getCurrentTimePosition(current)
      this.intervalTriggered = true
      this.setState({ timeIndicatorPosition: top })
    } else {
      this.clearTimeIndicatorInterval()
    }
  }

  render() {
    const {
      date,
      max,
      rtl,
      isNow,
      resource,
      accessors,
      localizer,
      getters: { dayProp, ...getters },
      components: { eventContainerWrapper: EventContainer, ...components },
    } = this.props

    this.slotMetrics = this.slotMetrics.update(this.props)

    let { slotMetrics } = this
    let { selecting, top, height, startDate, endDate } = this.state
    let selectDates = { start: startDate, end: endDate }
    const { className, style } = dayProp(max, resource)
    const DayColumnWrapperComponent =
      components.dayColumnWrapper || DayColumnWrapper

    return (
      <DayColumnWrapperComponent
        ref={this.containerRef}
        date={date}
        style={style}
        className={clsx(
          className,
          'rbc-day-slot',
          'rbc-time-column',
          isNow && 'rbc-now',
          isNow && 'rbc-today',
          selecting && 'rbc-slot-selecting'
        )}
        slotMetrics={slotMetrics}
        resource={resource}
      >
        {slotMetrics.groups.map((grp, idx) => (
          <TimeSlotGroup
            key={idx}
            group={grp}
            resource={resource}
            getters={getters}
            components={components}
          />
        ))}
        <EventContainer
          localizer={localizer}
          resource={resource}
          accessors={accessors}
          getters={getters}
          components={components}
          slotMetrics={slotMetrics}
          parentType={this.props.parentType}
        >
          <div className={clsx('rbc-events-container', rtl && 'rtl')}>
            {this.renderEvents({
              events: this.props.backgroundEvents,
              isBackgroundEvent: true,
            })}
            {this.renderEvents({ events: this.props.events })}
          </div>
        </EventContainer>

        {selecting && (
          <div className="rbc-slot-selection" style={{ top, height }}>
            <span>{localizer.format(selectDates, 'selectRangeFormat')}</span>
          </div>
        )}
        {isNow && this.intervalTriggered && (
          <div
            className="rbc-current-time-indicator"
            style={{ top: `${this.state.timeIndicatorPosition}%` }}
          />
        )}
      </DayColumnWrapperComponent>
    )
  }

  renderEvents = ({ events, isBackgroundEvent }) => {
    let {
      rtl,
      selected,
      accessors,
      localizer,
      getters,
      components,
      step,
      timeslots,
      dayLayoutAlgorithm,
      resizable,
    } = this.props

    const { slotMetrics } = this
    const { messages } = localizer

    let styledEvents = DayEventLayout.getStyledEvents({
      events,
      accessors,
      slotMetrics,
      minimumStartDifference: Math.ceil((step * timeslots) / 2),
      dayLayoutAlgorithm,
    })

    return styledEvents.map(({ event, style }, idx) => {
      let end = accessors.end(event)
      let start = accessors.start(event)
      let format = 'eventTimeRangeFormat'
      let label

      const startsBeforeDay = slotMetrics.startsBeforeDay(start)
      const startsAfterDay = slotMetrics.startsAfterDay(end)

      if (startsBeforeDay) format = 'eventTimeRangeEndFormat'
      else if (startsAfterDay) format = 'eventTimeRangeStartFormat'

      if (startsBeforeDay && startsAfterDay) label = messages.allDay
      else label = localizer.format({ start, end }, format)

      let continuesPrior = startsBeforeDay || slotMetrics.startsBefore(start)
      let continuesAfter = startsAfterDay || slotMetrics.startsAfter(end)

      return (
        <TimeGridEvent
          style={style}
          event={event}
          label={label}
          key={'evt_' + idx}
          getters={getters}
          rtl={rtl}
          parentType={this.props.parentType}
          components={components}
          continuesPrior={continuesPrior}
          continuesAfter={continuesAfter}
          accessors={accessors}
          resource={this.props.resource}
          selected={isSelected(event, selected)}
          isBackgroundEvent={isBackgroundEvent}
          resizable={resizable}
        />
      )
    })
  }

  _selectable = () => {
    let node = this.containerRef.current

    const { localizer } = this.props
    const selector = this.context.draggable.selector

    let selectionState = (point) => {
      let currentSlot = this.slotMetrics.closestSlotFromPoint(
        point,
        getBoundsForNode(node)
      )

      if (!this.state.selecting) {
        this._initialSlot = currentSlot
      }

      let initialSlot = this._initialSlot
      if (localizer.lte(initialSlot, currentSlot)) {
        currentSlot = this.slotMetrics.nextSlot(currentSlot)
      } else if (localizer.gt(initialSlot, currentSlot)) {
        initialSlot = this.slotMetrics.nextSlot(initialSlot)
      }

      const selectRange = this.slotMetrics.getRange(
        localizer.min(initialSlot, currentSlot),
        localizer.max(initialSlot, currentSlot)
      )

      return {
        ...selectRange,
        selecting: true,

        top: `${selectRange.top}%`,
        height: `${selectRange.height}%`,
      }
    }

    let selectorClicksHandler = (box, actionType) => {
      if (!isEvent(this.containerRef.current, box)) {
        const { startDate, endDate } = selectionState(box)
        this._selectSlot({
          startDate,
          endDate,
          action: actionType,
          box,
        })

        this.notifySelectSlot({
          startDate,
          endDate,
          action: actionType,
          box,
        })
      }
      this.setState({ selecting: false })
    }

    this._removeListeners.push(
      selector.on('click', (box) => {
        const nodeBounds = getBoundsForNode(node)
        if (!pointInBox(nodeBounds, box)) return

        selectorClicksHandler(box, 'click')
      })
    )

    this._removeListeners.push(
      selector.on('doubleClick', (box) => {
        const nodeBounds = getBoundsForNode(node)
        if (!pointInBox(nodeBounds, box)) return

        selectorClicksHandler(box, 'doubleClick')
      })
    )

    this._removeListeners.push(
      selector.on('selecting', (bounds) => {
        const nodeBounds = getBoundsForNode(node)
        if (!pointInBox(nodeBounds, bounds)) return

        const { event } = this.context.draggable.dragAndDropAction
        if (event) return

        let onSelecting = this.props.onSelecting
        let current = this.state || {}
        let state = selectionState(bounds)
        let { startDate: start, endDate: end } = state

        if (onSelecting) {
          if (
            (localizer.eq(current.startDate, start, 'minutes') &&
              localizer.eq(current.endDate, end, 'minutes')) ||
            onSelecting({ start, end, resourceId: this.props.resource }) ===
            false
          )
            return
        }

        if (
          this.state.start !== state.start ||
          this.state.end !== state.end ||
          this.state.selecting !== state.selecting
        ) {
          this.setState({ ...state, bounds, action: 'select' })
        }

        if (this.state.selecting) {
          this._selectSlot({ ...this.state, bounds })
        }
      })
    )

    this._removeListeners.push(
      selector.on('endMove', () => {
        if (!this.state.selecting) return

        this.notifySelectSlot(this.state)
      })
    )

    this._removeListeners.push(
      selector.on('reset', () => {
        if (this.state.selecting) {
          this.setState({ selecting: false })
        }
      })
    )
  }

  notifySelectSlot({ endDate, startDate, action, bounds, box }) {
    this.setState({ selecting: false })
    notify(this.props.onSelectSlot, {
      slots: this._selectedSlots,
      start: startDate,
      end: endDate,
      resourceId: this.props.resource,
      action: action,
      bounds,
      box,
    })
  }

  _teardownSelectable = () => {
    // Invoke each stored cleanup function to remove the event listeners
    this._removeListeners.forEach(({ remove }) => remove())
    this._removeListeners = []  // Clear the array
  }

  _selectSlot = ({ startDate, endDate }) => {
    let current = startDate
    this._selectedSlots = []

    while (this.props.localizer.lte(current, endDate)) {
      this._selectedSlots.push(current)
      current = new Date(+current + this.props.step * 60 * 1000) // using Date ensures not to create an endless loop the day DST begins
    }
  }
}

DayColumn.propTypes = {
  events: PropTypes.array.isRequired,
  backgroundEvents: PropTypes.array.isRequired,
  step: PropTypes.number.isRequired,
  date: PropTypes.instanceOf(Date).isRequired,
  min: PropTypes.instanceOf(Date).isRequired,
  max: PropTypes.instanceOf(Date).isRequired,
  getNow: PropTypes.func.isRequired,
  isNow: PropTypes.bool,

  rtl: PropTypes.bool,
  resizable: PropTypes.bool,

  accessors: PropTypes.object.isRequired,
  components: PropTypes.object.isRequired,
  getters: PropTypes.object.isRequired,
  localizer: PropTypes.object.isRequired,

  showMultiDayTimes: PropTypes.bool,
  culture: PropTypes.string,
  timeslots: PropTypes.number,

  selected: PropTypes.object,
  selectable: PropTypes.oneOf([true, false, 'ignoreEvents']),
  eventOffset: PropTypes.number,
  longPressThreshold: PropTypes.number,

  onSelecting: PropTypes.func,
  onSelectSlot: PropTypes.func.isRequired,
  onSelectEvent: PropTypes.func.isRequired,
  onDoubleClickEvent: PropTypes.func.isRequired,
  onKeyPressEvent: PropTypes.func,

  className: PropTypes.string,
  dragThroughEvents: PropTypes.bool,
  resource: PropTypes.any,

  dayLayoutAlgorithm: DayLayoutAlgorithmPropType,
}

DayColumn.defaultProps = {
  dragThroughEvents: true,
  timeslots: 2,
}

export default DayColumn
