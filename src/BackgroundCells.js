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
  }

  componentDidMount() {
    this.props.selectable && this._selectable()
  }

  componentWillUnmount() {
    this._teardownSelectable()
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.selectable && this.props.selectable) this._selectable()

    if (prevProps.selectable && !this.props.selectable)
      this._teardownSelectable()
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
    let node = this.containerRef.current
    console.log("BackgroundCells _selectable", node);

    let selector = this._selector = this.context.draggable.selector;

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
      this.setState({ selecting: false })
    }

    selector.on('selecting', (box) => {
      const { event } = this.context.draggable.dragAndDropAction

      console.log("BackgroundCells selecting", {event})
      if(event)
        return;

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

      this.setState({
        selecting: true,
        box,
        startIdx,
        endIdx,
      })
    })

    selector.on('click', (point) => selectorClicksHandler(point, 'click'))

    selector.on('doubleClick', (point) =>
      selectorClicksHandler(point, 'doubleClick')
    )

    selector.on('clearBackgroundCells', () => {
      const { startIdx, endIdx } = this.state
      this.setState({ selecting: false })

      return this.getSlotsInRange(startIdx, endIdx);
    }, {executeAll: true})

    selector.on('endMove', () => {
      console.log("BackgroundCells endMove", node);
      if(!this.state.selecting)
        return;

      // Clear other background cells:
      const dates = selector.emit('clearBackgroundCells').flat();

      this._selectSlot({
        ...this.state,
        action: 'select',
        slots: dates
      });

      this._initial = {}
      this.setState({ selecting: false })
      notify(this.props.onSelectEnd, [this.state])
    })
  }

  _teardownSelectable() {
    if (!this._selector) return
    this._selector.teardown()
    this._selector = null
  }

  _selectSlot({ slots, action, bounds, box }) {
    if (slots.length > 0)
      this.props.onSelectSlot &&
        this.props.onSelectSlot({
          action,
          bounds,
          box,
          resourceId: this.props.resourceId,
        },
        slots
      )
  }
}

BackgroundCells.propTypes = {
  date: PropTypes.instanceOf(Date),
  getNow: PropTypes.func.isRequired,

  getters: PropTypes.object.isRequired,
  components: PropTypes.object.isRequired,

  container: PropTypes.func,
  dayPropGetter: PropTypes.func,
  selectable: PropTypes.oneOf([true, false, 'ignoreEvents']),
  longPressThreshold: PropTypes.number,

  onSelectSlot: PropTypes.func.isRequired,
  onSelectEnd: PropTypes.func,
  onSelectStart: PropTypes.func,

  range: PropTypes.arrayOf(PropTypes.instanceOf(Date)),
  rtl: PropTypes.bool,
  type: PropTypes.string,
  resourceId: PropTypes.any,

  localizer: PropTypes.any,
}

export default BackgroundCells
