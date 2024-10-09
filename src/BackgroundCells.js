import React, { createRef } from 'react'
import PropTypes from 'prop-types'
import clsx from 'clsx'

import { notify } from './utils/helpers'
import { dateCellSelection, getSlotAtX, pointInBox } from './utils/selection'
import { getBoundsForNode, isEvent, isShowMore } from './Selection'
import { DnDContext } from './addons/dragAndDrop/DnDContext'

class BackgroundCells extends React.Component {
  static contextType = DnDContext

  constructor(props, context) {
    super(props, context)

    this.state = {
      selecting: false,
    }
    this.containerRef = createRef()
    this._selectorInitialized = false
    this._isMounted = false  // Track whether the component is mounted
    this._removeListeners = []  // Store cleanup functions
  }

  componentDidMount() {
    this._isMounted = true  // Mark the component as mounted
    this.props.selectable && this._selectable()
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.selectable && this.props.selectable) this._selectable()
  }

  componentWillUnmount() {
    this._isMounted = false  // Mark the component as unmounted
    this._teardownSelectable()  // Remove all event listeners
  }

  _teardownSelectable() {
    // Invoke each stored cleanup function to remove the event listeners
    this._removeListeners.forEach(({remove}) => remove())
    this._removeListeners = []  // Clear the array
  }

  render() {
    let {
      range,
      getNow,
      getters,
      date: currentDate,
      components: { dateCellWrapper: Wrapper },
      localizer,
    } = this.props
    let { selecting, startIdx, endIdx } = this.state
    let current = getNow()

    return (
      <div className="rbc-row-bg" ref={this.containerRef}>
        {range.map((date, index) => {
          let selected = selecting && index >= startIdx && index <= endIdx
          const { className, style } = getters.dayProp(date)

          return (
            <Wrapper key={index} value={date} range={range}>
              <div
                style={style}
                className={clsx(
                  'rbc-day-bg',
                  className,
                  selected && 'rbc-selected-cell',
                  localizer.isSameDate(date, current) && 'rbc-today',
                  currentDate &&
                  localizer.neq(currentDate, date, 'month') &&
                  'rbc-off-range-bg'
                )}
              />
            </Wrapper>
          )
        })}
      </div>
    )
  }

  getSlotsInRange(start, end) {
    const { range } = this.props
    return range.slice(start, end + 1)
  }

  _selectable() {
    if (this._selectorInitialized) return

    if (!this.context) return

    this._selectorInitialized = true
    let node = this.containerRef.current
    let selector = this.context.draggable.selector

    let selectorClicksHandler = (point, actionType) => {
      if (!isEvent(node, point) && !isShowMore(node, point)) {
        let rowBox = getBoundsForNode(node)
        let { range, rtl } = this.props

        if (pointInBox(rowBox, point)) {
          let currentCell = getSlotAtX(rowBox, point.x, rtl, range.length)

          this._selectSlot({
            slots: this.getSlotsInRange(currentCell, currentCell),
            action: actionType,
            box: point,
          })
        }
      }

      this._initial = {}
      this._isMounted && this.setState({ selecting: false })  // Check if component is mounted before updating state
    }

    // Adding event listeners and storing their cleanup functions
    this._removeListeners.push(
      selector.on('selecting', (box) => {
        const { event } = this.context.draggable.dragAndDropAction
        if (event) return

        let { range, rtl } = this.props
        let startIdx = -1
        let endIdx = -1

        if (!this.state.selecting) {
          notify(this.props.onSelectStart, [box])
          this._initial = { x: box.x, y: box.y }
        }

        if (selector.isSelected(node)) {
          let nodeBox = getBoundsForNode(node)
          ;({ startIdx, endIdx } = dateCellSelection(
            this._initial,
            nodeBox,
            box,
            range.length,
            rtl
          ))
        }

        this._isMounted && this.setState({
          selecting: true,
          box,
          startIdx,
          endIdx,
        })
      })
    )

    this._removeListeners.push(
      selector.on('click', (point) => {
        const nodeBounds = getBoundsForNode(node)
        if (!pointInBox(nodeBounds, point)) return

        selectorClicksHandler(point, 'click')
      })
    )

    this._removeListeners.push(
      selector.on('doubleClick', (point) => {
        const nodeBounds = getBoundsForNode(node)
        if (!pointInBox(nodeBounds, point)) return

        selectorClicksHandler(point, 'doubleClick')
      })
    )

    this._removeListeners.push(
      selector.on(
        'clearBackgroundCells',
        () => {
          const { startIdx, endIdx } = this.state
          this._isMounted && this.setState({ selecting: false })

          return this.getSlotsInRange(startIdx, endIdx)
        },
        { executeAll: true }
      )
    )

    this._removeListeners.push(
      selector.on('endMove', () => {
        if (!this.state.selecting) return

        const dates = selector.emit('clearBackgroundCells').flat()

        this._selectSlot({
          ...this.state,
          action: 'select',
          slots: dates,
        })

        this._initial = {}
        this._isMounted && this.setState({ selecting: false })
        notify(this.props.onSelectEnd, [this.state])
      })
    )
  }

  _selectSlot({ slots, action, bounds, box }) {
    if (slots.length > 0)
      this.props.onSelectSlot &&
      this.props.onSelectSlot(
        {
          action,
          bounds,
          box,
          resourceId: this.props.resourceId,
        },
        slots
      )
  }
}

export default BackgroundCells
