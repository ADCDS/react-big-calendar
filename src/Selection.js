import contains from 'dom-helpers/contains'
import closest from 'dom-helpers/closest'
import listen from 'dom-helpers/listen'

function addEventListener(type, handler, target = document) {
  return listen(target, type, handler, { passive: false })
}

export function isOverContainer(container, x, y) {
  return !container || contains(container, document.elementFromPoint(x, y))
}

export function getEventNodeFromPoint(node, { clientX, clientY }) {
  let target = document.elementFromPoint(clientX, clientY)
  return closest(target, '.rbc-event', node)
}

export function getShowMoreNodeFromPoint(node, { clientX, clientY }) {
  let target = document.elementFromPoint(clientX, clientY)
  return closest(target, '.rbc-show-more', node)
}

export function isEvent(node, bounds) {
  return !!getEventNodeFromPoint(node, bounds)
}

export function isShowMore(node, bounds) {
  return !!getShowMoreNodeFromPoint(node, bounds)
}

function getEventCoordinates(e) {
  let target = e

  if (e.touches && e.touches.length) {
    target = e.touches[0]
  }

  return {
    clientX: target.clientX,
    clientY: target.clientY,
    pageX: target.pageX,
    pageY: target.pageY,
  }
}

const clickTolerance = 5
const clickInterval = 250

class Selection {
  constructor(
    node,
    { global = false, longPressThreshold = 250, validContainers = [] } = {}
  ) {
    this.selecting = false
    this.isDetached = false
    this.container = node
    this.globalMouse = !node || global
    this.longPressThreshold = longPressThreshold
    this.validContainers = validContainers

    this._listeners = Object.create(null)

    this._handleInitialEvent = this._handleInitialEvent.bind(this)
    this._handleMoveEvent = this._handleMoveEvent.bind(this)
    this._keyListener = this._keyListener.bind(this)
    this._dropFromOutsideListener = this._dropFromOutsideListener.bind(this)
    this._dragOverFromOutsideListener =
      this._dragOverFromOutsideListener.bind(this)


    this._lastTapTime = 0; // Track time of last tap
    this._isHolding = false; // Track if user is holding after double-tap

    // Fixes an iOS 10 bug where scrolling could not be prevented on the window.
    // https://github.com/metafizzy/flickity/issues/457#issuecomment-254501356
    this._removeTouchMoveWindowListener = addEventListener(
      'touchmove',
      () => {
        // console.log("im still alive")
      },
      window
    )
    this._removeKeyDownListener = addEventListener('keydown', this._keyListener)
    this._removeKeyUpListener = addEventListener('keyup', this._keyListener)
    this._removeDropFromOutsideListener = addEventListener(
      'drop',
      this._dropFromOutsideListener
    )
    this._removeDragOverFromOutsideListener = addEventListener(
      'dragover',
      this._dragOverFromOutsideListener
    )
    this._addInitialEventListener()
  }

  on(type, handler, options = {}) {
    let handlers = this._listeners[type] || (this._listeners[type] = [])

    handlers.push({
      _fn: handler,
      options
    })

    return {
      remove() {
        let idx = handlers.indexOf(handler)
        if (idx !== -1) handlers.splice(idx, 1)
      },
    }
  }

  emit(type, ...args) {
    let result
    let handlers = this._listeners[type] || []

    handlers.forEach(({_fn, options}) => {
      if (result === undefined || options.executeAll) {
        if(options.executeAll) {
          if(!result) {
            result = [];
          }

          result.push(_fn(...args));
        } else {
          result = _fn(...args)
        }
      }
    })
    return result
  }

  teardown() {
    this._initialEventData = null
    this._selectRect = null
    this._onlyTouch = false
    this.selecting = false
    this._lastClickData = null
    this.isDetached = true
    this._listeners = Object.create(null)
    this._removeTouchMoveWindowListener && this._removeTouchMoveWindowListener()
    this._removeInitialEventListener && this._removeInitialEventListener()
    this._removeEndListener && this._removeEndListener()
    this._onEscListener && this._onEscListener()
    this._removeMoveListener && this._removeMoveListener()
    this._removeKeyUpListener && this._removeKeyUpListener()
    this._removeKeyDownListener && this._removeKeyDownListener()
    this._removeDropFromOutsideListener && this._removeDropFromOutsideListener()
    this._removeDragOverFromOutsideListener &&
      this._removeDragOverFromOutsideListener()
  }

  isSelected(node) {
    let box = this._selectRect

    if (!box || !this.selecting) return false

    let boundsForNode = getBoundsForNode(node)
    // console.log("isSelected", {box, selecting: this.selecting, boundsForNode});
    return objectsCollide(box, boundsForNode)
  }

  filter(items) {
    let box = this._selectRect

    //not selecting
    if (!box || !this.selecting) return []

    return items.filter(this.isSelected, this)
  }

  // Adds a listener that will call the handler only after the user has pressed on the screen
  // without moving their finger for 250ms.
  _addLongPressListener(handler, initialEvent) {
    let timer = null
    let removeTouchMoveListener = null
    let removeTouchEndListener = null
    const handleTouchStart = (initialEvent) => {
      timer = setTimeout(() => {
        cleanup()
        handler(initialEvent)
      }, this.longPressThreshold)
      removeTouchMoveListener = addEventListener('touchmove', () => cleanup())
      removeTouchEndListener = addEventListener('touchend', () => cleanup())
    }
    const removeTouchStartListener = addEventListener(
      'touchstart',
      handleTouchStart
    )
    const cleanup = () => {
      if (timer) {
        clearTimeout(timer)
      }
      if (removeTouchMoveListener) {
        removeTouchMoveListener()
      }
      if (removeTouchEndListener) {
        removeTouchEndListener()
      }

      timer = null
      removeTouchMoveListener = null
      removeTouchEndListener = null
    }

    if (initialEvent) {
      handleTouchStart(initialEvent)
    }

    return () => {
      cleanup()
      removeTouchStartListener()
    }
  }

  // Detect double-tap-and-hold gesture
  _handleTouchStart(e) {
    const now = Date.now();
    const timeSinceLastTap = now - this._lastTapTime;

    const possibleEvent = this.emit('probeEventDrag', getEventCoordinates(e));

    if (possibleEvent || (timeSinceLastTap < clickInterval && timeSinceLastTap > 0)) {
      // Double-tap detected
      this._isHolding = true;
      this._handleInitialEvent(e);
      e.preventDefault();
    } else {
      this._isHolding = false; // Reset if no double-tap
    }

    this._lastTapTime = now;
  }

  // Listen for mousedown and touchstart events. When one is received, disable the other and setup
  // future event handling based on the type of event.
  _addInitialEventListener() {
    // console.log('_addInitialEventListener call')

    const removeMouseDownListener = addEventListener('pointerdown', (e) => {
      if (!this._onlyTouch && e.pointerType === "mouse") {
        // console.log("mousedown");

        this._removeInitialEventListener()
        this._handleInitialEvent(e)
        this._removeInitialEventListener = addEventListener(
          'mousedown',
          this._handleInitialEvent
        )
      }
    })

    const removeTouchStartListener = addEventListener('touchstart', (e) => {
      // console.log("touchstart")
      this._onlyTouch = true;
      this._handleTouchStart(e);
    });

    const removeTouchMoveListener = addEventListener('touchmove', (e) => {
      if(this._isHolding) {
        this._handleMoveEvent(e);
      }
    });

    const removeTouchEndListener = addEventListener('touchend', (e) => {
      if(this._isHolding) {
        this._handleEndMove(e);
      }
    });

    this._removeInitialEventListener = () => {
      removeMouseDownListener()
      removeTouchStartListener()
      removeTouchMoveListener()
      removeTouchEndListener()
    }
  }

  _dropFromOutsideListener(e) {
    const { pageX, pageY, clientX, clientY } = getEventCoordinates(e)

    this.emit('dropFromOutside', {
      x: pageX,
      y: pageY,
      clientX: clientX,
      clientY: clientY,
    })

    e.preventDefault()
  }

  _dragOverFromOutsideListener(e) {
    const { pageX, pageY, clientX, clientY } = getEventCoordinates(e)

    this.emit('dragOverFromOutside', {
      x: pageX,
      y: pageY,
      clientX: clientX,
      clientY: clientY,
    })

    e.preventDefault()
  }

  _handleEndMove(e) {
    this._isHolding = false;

    if (!this.selecting && this._initialEventData) {
      this.emit('click', this._initialEventData)
    } else {
      this.selecting = false;

      let eventCoordinates;

      if(e.pointerType === "mouse") {
        eventCoordinates = getEventCoordinates(e);
      } else {
        eventCoordinates = this._lastEventCoordinates;
      }

      this.emit('endMove', eventCoordinates)
    }

    this._removeEndListener && this._removeEndListener();
    this._onEscListener && this._onEscListener();
    this._removeMoveListener && this._removeMoveListener();
  }

  _handleInitialEvent(e) {
    this._initialEvent = e
    // console.log({ isDetached: this.isDetached })
    if (this.isDetached) {
      return
    }

    const { clientX, clientY, pageX, pageY } = getEventCoordinates(e)
    let node = this.container(),
      collides,
      offsetData

    // console.log("Selector node", node);

    // Right clicks
    if (
      e.which === 3 ||
      e.button === 2 ||
      !isOverContainer(node, clientX, clientY)
    )
      return

    if (!this.globalMouse && node && !contains(node, e.target)) {
      let { top, left, bottom, right } = normalizeDistance(0)

      offsetData = getBoundsForNode(node)

      collides = objectsCollide(
        {
          top: offsetData.top - top,
          left: offsetData.left - left,
          bottom: offsetData.bottom + bottom,
          right: offsetData.right + right,
        },
        { top: pageY, left: pageX }
      )

      if (!collides) return
    }

    let touch = /^touch/.test(e.type)
    let result = this.emit(
      'beforeSelect',
      (this._initialEventData = {
        isTouch: touch,
        x: pageX,
        y: pageY,
        clientX,
        clientY,
      }),
      e
    )

    if (touch) {
      this.emit('selectStart', this._initialEventData)
    }

    switch (e.type) {
      case 'mousedown':
        this._removeEndListener = addEventListener(
          'mouseup',
          (e) => this._handleEndMove(e)
        )
        this._onEscListener = addEventListener(
          'keydown',
          (e) => this._handleEndMove(e)
        )
        this._removeMoveListener = addEventListener(
          'mousemove',
          (e) => {
            this.selecting = true;
            if (!this._onlyTouch && this.selecting) {
              this._handleMoveEvent(e)
            }
          }
        )
        break
      default:
        break
    }
  }

  // Check whether provided event target element
  // - is contained within a valid container
  _isWithinValidContainer(e) {
    const eventTarget = e.target
    const containers = this.validContainers

    if (!containers || !containers.length || !eventTarget) {
      return true
    }

    return containers.some((target) => !!eventTarget.closest(target))
  }

  _handleClickEvent(e) {
    const { pageX, pageY, clientX, clientY } = getEventCoordinates(e)
    const now = new Date().getTime()

    if (
      this._lastClickData &&
      now - this._lastClickData.timestamp < clickInterval
    ) {
      // Double click event
      this._lastClickData = null
      return this.emit('doubleClick', {
        x: pageX,
        y: pageY,
        clientX: clientX,
        clientY: clientY,
      })
    }

    // Click event
    this._lastClickData = {
      timestamp: now,
    }
    return this.emit('click', {
      x: pageX,
      y: pageY,
      clientX: clientX,
      clientY: clientY,
    })
  }

  _handleMoveEvent(e) {
    if (!this._initialEventData || this.isDetached) {
      // console.log('Leaving 1', {
      //   _initialEventData: this._initialEventData,
      //   isDetached: this.isDetached,
      // })
      return
    }

    let { x, y } = this._initialEventData
    this._lastEventCoordinates = getEventCoordinates(e);
    const { pageX, pageY } = this._lastEventCoordinates;

    let w = Math.abs(x - pageX)
    let h = Math.abs(y - pageY)

    let left = Math.min(pageX, x),
      top = Math.min(pageY, y),
      old = this.selecting
    const click = this.isClick(pageX, pageY)
    // Prevent emitting selectStart event until mouse is moved.
    // in Chrome on Windows, mouseMove event may be fired just after mouseDown event.
    if (click && !old && !(w || h)) {
      // console.log('Leaving 2', { click, old, w, h })
      return
    }

    if (!click) {
      this.selecting = true
      this._selectRect = {
        top,
        left,
        x: pageX,
        y: pageY,
        right: left + w,
        bottom: top + h,
      }

      this.emit('selecting', this._selectRect)
      e.preventDefault();
    }
  }

  _keyListener(e) {
    this.ctrl = e.metaKey || e.ctrlKey
  }

  isClick(pageX, pageY) {
    let { x, y, isTouch } = this._initialEventData
    return (
      !isTouch &&
      Math.abs(pageX - x) <= clickTolerance &&
      Math.abs(pageY - y) <= clickTolerance
    )
  }
}

/**
 * Resolve the disance prop from either an Int or an Object
 * @return {Object}
 */
function normalizeDistance(distance = 0) {
  if (typeof distance !== 'object')
    distance = {
      top: distance,
      left: distance,
      right: distance,
      bottom: distance,
    }

  return distance
}

/**
 * Given two objects containing "top", "left", "offsetWidth" and "offsetHeight"
 * properties, determine if they collide.
 * @param  {Object|HTMLElement} a
 * @param  {Object|HTMLElement} b
 * @return {bool}
 */
export function objectsCollide(nodeA, nodeB, tolerance = 0) {
  let {
    top: aTop,
    left: aLeft,
    right: aRight = aLeft,
    bottom: aBottom = aTop,
  } = getBoundsForNode(nodeA)
  let {
    top: bTop,
    left: bLeft,
    right: bRight = bLeft,
    bottom: bBottom = bTop,
  } = getBoundsForNode(nodeB)

  return !(
    // 'a' bottom doesn't touch 'b' top
    (
      aBottom - tolerance < bTop ||
      // 'a' top doesn't touch 'b' bottom
      aTop + tolerance > bBottom ||
      // 'a' right doesn't touch 'b' left
      aRight - tolerance < bLeft ||
      // 'a' left doesn't touch 'b' right
      aLeft + tolerance > bRight
    )
  )
}

/**
 * Given a node, get everything needed to calculate its boundaries
 * @param  {HTMLElement} node
 * @return {Object}
 */
export function getBoundsForNode(node) {
  // console.log("getBoundsForNode", node);
  if (!node.getBoundingClientRect) return node

  let rect = node.getBoundingClientRect(),
    left = rect.left + pageOffset('left'),
    top = rect.top + pageOffset('top')

  return {
    top,
    left,
    right: (node.offsetWidth || 0) + left,
    bottom: (node.offsetHeight || 0) + top,
  }
}

function pageOffset(dir) {
  if (dir === 'left') return window.pageXOffset || document.body.scrollLeft || 0
  if (dir === 'top') return window.pageYOffset || document.body.scrollTop || 0
}
export default Selection
