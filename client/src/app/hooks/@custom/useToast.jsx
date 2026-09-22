// @custom — Toast notification store and hook (shadcn-style)
//
// Provides an imperative `toast()` API callable from anywhere (event handlers,
// async code, non-React modules) plus a `useToast()` hook for components that
// need to read/dismiss the current toast queue. Backed by a module-level
// reducer store so the `toast()` function does not require React context.

import { useEffect, useState } from 'react'

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 5000

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
}

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const toastTimeouts = new Map()

function addToRemoveQueue(toastId, dispatch, delay = TOAST_REMOVE_DELAY) {
  if (toastTimeouts.has(toastId)) return
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId })
  }, delay)
  toastTimeouts.set(toastId, timeout)
}

function clearRemoveTimeout(toastId) {
  const timeout = toastTimeouts.get(toastId)
  if (timeout) {
    clearTimeout(timeout)
    toastTimeouts.delete(toastId)
  }
}

export function reducer(state, action) {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t
        ),
      }
    }

    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) return { ...state, toasts: [] }
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) }

    default:
      return state
  }
}

const listeners = []
let memoryState = { toasts: [] }

function dispatch(action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

export function toast({ duration = TOAST_REMOVE_DELAY, ...props } = {}) {
  const id = genId()

  const update = (next) =>
    dispatch({ type: actionTypes.UPDATE_TOAST, toast: { ...next, id } })

  const dismiss = () => {
    clearRemoveTimeout(id)
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id })
    addToRemoveQueue(id, dispatch, 200)
  }

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  if (duration !== Infinity) addToRemoveQueue(id, dispatch, duration)

  return { id, dismiss, update }
}

toast.success = (message, opts = {}) =>
  toast({ title: opts.title, description: message, variant: 'default', ...opts })

toast.error = (message, opts = {}) =>
  toast({ title: opts.title, description: message, variant: 'destructive', ...opts })

toast.info = (message, opts = {}) =>
  toast({ title: opts.title, description: message, variant: 'default', ...opts })

export function useToast() {
  const [state, setState] = useState(memoryState)

  useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  }
}
