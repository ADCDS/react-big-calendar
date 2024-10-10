import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

import { accessor } from '../../utils/propTypes'
import Selection from '../../Selection'
import EventWrapper from './EventWrapper'
import EventContainerWrapper from './EventContainerWrapper'
import WeekWrapper from './WeekWrapper'
import { mergeComponents } from './common'
import { DnDContext } from './DnDContext'

export default function withDragAndDrop(Calendar) {
  function DragAndDropCalendar(props) {
    const {
      onEventDrop,
        onEventResize,
        onDragStart,
        onDragOver,
        onDropFromOutside,
        dragFromOutsideItem,
        draggableAccessor,
        resizableAccessor,
        selectable,
        resizable = true,
        components,
        elementProps
    } = props;

    const [state, setState] = useState({
      interacting: false,
      action: null,
      event: null,
      direction: null,
      actuallyMoved: false,
      eventOrigin: null,
    })

    const calendarRef = useRef(null)
    const selectorRef = useRef(null)
    const [isSelectorReady, setSelectorReady] = useState(false) // Track when selector is initialized

    // Initialize the selector only when the calendarRef is available
    useEffect(() => {
      if (calendarRef.current && !selectorRef.current) {
        selectorRef.current = new Selection(calendarRef.current)
        setSelectorReady(true) // Selector is now ready
      }
    }, [calendarRef.current])

    const defaultOnDragOver = (event) => {
      event.preventDefault()
    }

    const handleBeginAction = useCallback((event, action, direction) => {
      setState((prev) => ({ ...prev, event, action, direction }))
      if (onDragStart) onDragStart({ event, action, direction })
    }, [onDragStart])

    const handleInitialMove = useCallback(() => {
      setState((prev) => ({ ...prev, actuallyMoved: true }))
    }, [])

    const handleInteractionStart = useCallback(() => {
      if (!state.interacting) {
        setState((prev) => ({ ...prev, interacting: true }))
      }
    }, [state.interacting])

    const setEventOrigin = useCallback((origin) => {
      setState((prev) => ({ ...prev, eventOrigin: origin }))
    }, [])

    const handleInteractionEnd = useCallback(
      (interactionInfo) => {
        const { action, event } = state

        if (!action) return

        setState({
          action: null,
          event: null,
          interacting: false,
          direction: null,
          actuallyMoved: false,
        })

        if (interactionInfo == null) return

        interactionInfo.event = event

        if (action === 'move' && onEventDrop) onEventDrop(interactionInfo)
        if (action === 'resize' && onEventResize) onEventResize(interactionInfo)
      },
      [state, onEventDrop, onEventResize],
    )

    const getDnDContextValue = useCallback(() => {
      return {
        draggable: {
          selector: selectorRef.current,
          onStart: handleInteractionStart,
          onEnd: handleInteractionEnd,
          onBeginAction: handleBeginAction,
          onInitialMove: handleInitialMove,
          onDropFromOutside: onDropFromOutside,
          dragFromOutsideItem: dragFromOutsideItem,
          setEventOrigin: setEventOrigin,
          draggableAccessor: draggableAccessor,
          resizableAccessor: resizableAccessor,
          dragAndDropAction: state,
        },
      }
    }, [
      handleInteractionStart,
      handleInteractionEnd,
      handleBeginAction,
      handleInitialMove,
      onDropFromOutside,
      dragFromOutsideItem,
      setEventOrigin,
      draggableAccessor,
      resizableAccessor,
      state,
    ])

    const elementPropsWithDropFromOutside = onDropFromOutside
      ? {
        ...elementProps,
        onDragOver: onDragOver || defaultOnDragOver,
      }
      : elementProps

    const mergedComponents = mergeComponents(components, {
      eventWrapper: EventWrapper,
      eventContainerWrapper: EventContainerWrapper,
      weekWrapper: WeekWrapper,
    })

    const context = getDnDContextValue()

    return (
      <DnDContext.Provider value={context}>
        <Calendar
          {...props}
          ref={calendarRef}
          readyToRender={isSelectorReady}
          elementProps={elementPropsWithDropFromOutside}
          components={mergedComponents}
          selectable={selectable ? 'ignoreEvents' : false}
          className={clsx(
            props.className,
            'rbc-addons-dnd',
            !!state.interacting && 'rbc-addons-dnd-is-dragging',
          )}
        />
      </DnDContext.Provider>
    )
  }

  DragAndDropCalendar.propTypes = {
    ...Calendar.propTypes,

    onEventDrop: PropTypes.func,
    onEventResize: PropTypes.func,
    onDragStart: PropTypes.func,
    onDragOver: PropTypes.func,
    onDropFromOutside: PropTypes.func,

    dragFromOutsideItem: PropTypes.func,

    draggableAccessor: accessor,
    resizableAccessor: accessor,

    selectable: PropTypes.oneOf([true, false, 'ignoreEvents']),
    resizable: PropTypes.bool,
  }

  DragAndDropCalendar.defaultProps = {
    ...Calendar.defaultProps,
    draggableAccessor: null,
    resizableAccessor: null,
    resizable: true,
  }

  return DragAndDropCalendar
}
