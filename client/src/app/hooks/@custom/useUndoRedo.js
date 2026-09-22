// @custom — useUndoRedo hook for undo/redo state management
// Provides a generic undo/redo stack for any serializable state.
// Works with any state shape — just pass a snapshot via pushState().
import { useState, useCallback, useRef } from 'react'

const MAX_HISTORY = 50

export function useUndoRedo(initialState) {
  const [state, setState] = useState(initialState)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])
  const currentRef = useRef(initialState)

  function updateFlags() {
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(redoStackRef.current.length > 0)
  }

  // Push a new state snapshot onto the undo stack
  const pushState = useCallback((newState) => {
    const undoStack = undoStackRef.current
    undoStack.push(currentRef.current)
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift()
    }
    // Clear redo stack on new action
    redoStackRef.current = []
    currentRef.current = newState
    setState(newState)
    updateFlags()
  }, [])

  // Undo: restore the previous state
  const undo = useCallback(() => {
    const undoStack = undoStackRef.current
    if (undoStack.length === 0) return false

    const previousState = undoStack.pop()
    const redoStack = redoStackRef.current
    redoStack.push(currentRef.current)
    currentRef.current = previousState
    setState(previousState)
    updateFlags()
    return true
  }, [])

  // Redo: restore the next state
  const redo = useCallback(() => {
    const redoStack = redoStackRef.current
    if (redoStack.length === 0) return false

    const nextState = redoStack.pop()
    const undoStack = undoStackRef.current
    undoStack.push(currentRef.current)
    currentRef.current = nextState
    setState(nextState)
    updateFlags()
    return true
  }, [])

  // Reset all history
  const resetHistory = useCallback((newState) => {
    undoStackRef.current = []
    redoStackRef.current = []
    currentRef.current = newState
    setState(newState)
    updateFlags()
  }, [])

  return {
    state,
    setState,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
  }
}