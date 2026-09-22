// @custom — Form builder utility with validation.
// Provides declarative field schemas, a validator library, and a `useFormBuilder`
// React hook that manages values, touched state, errors, and submission.
//
// Example:
//   const form = useFormBuilder({
//     fields: {
//       email: { initial: '', validators: [validators.required(), validators.email()] },
//       age:   { initial: '', validators: [validators.required(), validators.min(18)] },
//     },
//     onSubmit: async (values) => { ... },
//   })
//
//   <input {...form.fieldProps('email')} />
//   {form.errors.email && <p>{form.errors.email}</p>}

import { useCallback, useMemo, useState } from 'react'

const isEmpty = (v) => v === undefined || v === null || v === ''

export const validators = {
  required: (message = 'This field is required') => (value) =>
    isEmpty(value) ? message : null,

  minLength: (len, message) => (value) =>
    !isEmpty(value) && String(value).length < len
      ? (message || `Must be at least ${len} characters`)
      : null,

  maxLength: (len, message) => (value) =>
    !isEmpty(value) && String(value).length > len
      ? (message || `Must be at most ${len} characters`)
      : null,

  min: (n, message) => (value) =>
    !isEmpty(value) && Number(value) < n
      ? (message || `Must be at least ${n}`)
      : null,

  max: (n, message) => (value) =>
    !isEmpty(value) && Number(value) > n
      ? (message || `Must be at most ${n}`)
      : null,

  pattern: (regex, message = 'Invalid format') => (value) =>
    !isEmpty(value) && !regex.test(String(value)) ? message : null,

  email: (message = 'Enter a valid email') => (value) =>
    !isEmpty(value) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))
      ? message
      : null,

  url: (message = 'Enter a valid URL') => (value) => {
    if (isEmpty(value)) return null
    try {
      new URL(String(value))
      return null
    } catch {
      return message
    }
  },

  matches: (otherField, message = 'Fields do not match') => (value, values) =>
    !isEmpty(value) && value !== values?.[otherField] ? message : null,

  custom: (fn, message = 'Invalid value') => (value, values) => {
    const ok = fn(value, values)
    return ok ? null : message
  },
}

export function runValidators(value, rules, values) {
  if (!rules) return null
  for (const rule of rules) {
    const err = rule(value, values)
    if (err) return err
  }
  return null
}

export function validateForm(fields, values) {
  const errors = {}
  for (const [name, config] of Object.entries(fields)) {
    const err = runValidators(values[name], config.validators, values)
    if (err) errors[name] = err
  }
  return errors
}

export function useFormBuilder({ fields, onSubmit } = { fields: {} }) {
  const initialValues = useMemo(() => {
    const out = {}
    for (const [name, config] of Object.entries(fields)) {
      out[name] = config.initial ?? ''
    }
    return out
  }, [fields])

  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState({})
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const setValue = useCallback((name, value) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value }
      const rules = fields[name]?.validators
      if (rules) {
        const err = runValidators(value, rules, next)
        setErrors((e) => ({ ...e, [name]: err }))
      }
      return next
    })
  }, [fields])

  const setFieldTouched = useCallback((name, isTouched = true) => {
    setTouched((prev) => ({ ...prev, [name]: isTouched }))
  }, [])

  const validate = useCallback(() => {
    const nextErrors = validateForm(fields, values)
    setErrors(nextErrors)
    return nextErrors
  }, [fields, values])

  const reset = useCallback(() => {
    setValues(initialValues)
    setTouched({})
    setErrors({})
    setSubmitError(null)
  }, [initialValues])

  const handleSubmit = useCallback(async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    const nextErrors = validateForm(fields, values)
    setErrors(nextErrors)
    // Mark all as touched so errors show.
    const allTouched = {}
    for (const name of Object.keys(fields)) allTouched[name] = true
    setTouched(allTouched)

    if (Object.keys(nextErrors).length > 0) return { ok: false, errors: nextErrors }

    if (!onSubmit) return { ok: true, values }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await onSubmit(values)
      return { ok: true, values, result }
    } catch (err) {
      const message = err?.message || 'Submission failed'
      setSubmitError(message)
      return { ok: false, error: message }
    } finally {
      setIsSubmitting(false)
    }
  }, [fields, values, onSubmit])

  const fieldProps = useCallback((name) => ({
    name,
    value: values[name] ?? '',
    onChange: (eventOrValue) => {
      const val = eventOrValue?.target
        ? (eventOrValue.target.type === 'checkbox'
            ? eventOrValue.target.checked
            : eventOrValue.target.value)
        : eventOrValue
      setValue(name, val)
    },
    onBlur: () => setFieldTouched(name, true),
  }), [values, setValue, setFieldTouched])

  const isValid = Object.keys(errors).length === 0
  const isDirty = useMemo(
    () => Object.keys(values).some((k) => values[k] !== initialValues[k]),
    [values, initialValues]
  )

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    submitError,
    setValue,
    setFieldTouched,
    validate,
    reset,
    handleSubmit,
    fieldProps,
  }
}

export default useFormBuilder
