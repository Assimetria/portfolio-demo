// @system — Contact form. POSTs to /api/contact (server/src/api/@system/contact)
// through the shared API client (lib/@system/api.js), which sends cookies and
// the double-submit CSRF token exactly like the auth forms do — /api/contact
// is CSRF-protected, not exempt.
//
// Client-side validation mirrors the server zod schema; a honeypot field
// ("website") is rendered off-screen and must stay empty. Cloudflare Turnstile
// is rendered only when GET /api/contact/config returns a site key (i.e. the
// server has the secret and will verify). Success/error states come from the
// real request — there is no simulated delay.
import { useEffect, useId, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { site } from '@/config'
import { api } from '@/app/lib/@system/api'
import { cn } from '@/app/lib/@system/utils'
import { TurnstileWidget } from './TurnstileWidget'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MESSAGES = {
  generic: 'Something went wrong. Please try again or email us directly.',
  network: 'Network error — please check your connection and try again.',
  tooMany: 'Too many messages. Please try again later.',
  unavailable: 'The contact form is temporarily unavailable. Please try again in a few minutes.',
  turnstile: 'Please complete the anti-spam check.',
}

export function validateContact(values, fields) {
  const errors = {}
  const name = (values.name || '').trim()
  const email = (values.email || '').trim()
  const message = (values.message || '').trim()
  const minLen = fields?.message?.minLength ?? 10

  if (name.length < 2) errors.name = 'Please enter your name.'
  if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.'
  if (fields?.phone?.required && !(values.phone || '').trim()) errors.phone = 'Please enter a phone number.'
  if (fields?.subject?.required && !(values.subject || '').trim()) errors.subject = 'Please enter a subject.'
  if (message.length < minLen) errors.message = `Please write at least ${minLen} characters.`
  return errors
}

/**
 * Map an API failure to { message, fieldErrors }. Exported for tests.
 * `err.status` / `err.errors` come from lib/@system/api ApiError; a plain
 * TypeError from fetch means the network failed.
 */
export function describeSubmitError(err) {
  const status = err?.status
  if (status === undefined) return { message: MESSAGES.network, fieldErrors: {} }
  if (status === 429) return { message: err.message || MESSAGES.tooMany, fieldErrors: {} }
  if (status === 503) return { message: err.message || MESSAGES.unavailable, fieldErrors: {} }

  const fieldErrors = {}
  for (const er of err.errors ?? []) {
    const key = String(er.field || '').replace(/^body\.?/, '')
    if (key === 'turnstileToken') fieldErrors.turnstile = MESSAGES.turnstile
    else if (key in EMPTY) fieldErrors[key] = er.message
  }
  return { message: err.message || MESSAGES.generic, fieldErrors }
}

const EMPTY = { name: '', email: '', phone: '', subject: '', message: '', website: '' }

/** Accepts either an API-relative path ('/contact') or the legacy absolute '/api/contact'. */
function toApiPath(endpoint) {
  return String(endpoint || '/contact').replace(/^\/api(?=\/)/, '')
}

export function ContactForm({ className, endpoint = '/contact' }) {
  const contact = site.contact ?? {}
  const fields = contact.formFields ?? {}
  const uid = useId()
  const apiPath = toApiPath(endpoint)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [serverError, setServerError] = useState('')
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileGen, setTurnstileGen] = useState(0) // bump to remount (reset) the widget

  const showPhone = fields.phone?.show !== false
  const showSubject = fields.subject?.show !== false

  // Ask the server whether Turnstile is enforced. Failure = no widget; the
  // server answers with a clear 400 if it does require a token.
  useEffect(() => {
    let cancelled = false
    api
      .get(`${apiPath}/config`)
      .then((res) => {
        if (!cancelled) setTurnstileSiteKey(res?.data?.turnstile?.siteKey || '')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [apiPath])

  function onChange(e) {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }))
  }

  function onTurnstileToken(token) {
    setTurnstileToken(token || '')
    if (token && errors.turnstile) setErrors((er) => ({ ...er, turnstile: undefined }))
  }

  function resetTurnstile() {
    setTurnstileToken('')
    setTurnstileGen((g) => g + 1)
  }

  async function onSubmit(e) {
    e.preventDefault()
    const nextErrors = validateContact(values, fields)
    if (turnstileSiteKey && !turnstileToken) nextErrors.turnstile = MESSAGES.turnstile
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      const first = Object.keys(nextErrors).find((k) => k !== 'turnstile')
      if (first) document.getElementById(`${uid}-${first}`)?.focus()
      return
    }
    setStatus('submitting')
    setServerError('')
    try {
      await api.post(apiPath, {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
        website: values.website, // honeypot — empty for humans
        sourcePath: window.location.pathname,
        ...(turnstileSiteKey ? { turnstileToken } : {}),
      })
      setStatus('success')
      setValues(EMPTY)
      resetTurnstile()
    } catch (err) {
      const { message, fieldErrors } = describeSubmitError(err)
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors)
      setServerError(message)
      setStatus('error')
      if (turnstileSiteKey) resetTurnstile() // tokens are single-use
    }
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="contact-success"
        className={cn('flex flex-col items-start gap-3 rounded-xl border border-brand-border bg-brand-surface p-6', className)}
      >
        <CheckCircle2 className="h-8 w-8 text-[var(--color-success)]" aria-hidden="true" />
        <p className="text-base font-medium text-brand-text">{contact.successMessage || 'Thank you — your message has been sent.'}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setStatus('idle')}>
          Send another message
        </Button>
      </div>
    )
  }

  const field = (key, { as = 'input', type = 'text', autoComplete } = {}) => {
    const cfg = fields[key] ?? {}
    const id = `${uid}-${key}`
    const errId = `${id}-error`
    const Comp = as === 'textarea' ? Textarea : Input
    const required = cfg.required ?? (key === 'name' || key === 'email' || key === 'message')
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-brand-text">
          {cfg.label || key.charAt(0).toUpperCase() + key.slice(1)}
          {required ? <span aria-hidden="true" className="text-[var(--color-error)]"> *</span> : <span className="ml-1 text-xs font-normal text-brand-text-muted">(optional)</span>}
        </Label>
        <Comp
          id={id}
          name={key}
          type={as === 'input' ? type : undefined}
          autoComplete={autoComplete}
          placeholder={cfg.placeholder}
          value={values[key]}
          onChange={onChange}
          required={required}
          aria-required={required}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? errId : undefined}
          rows={as === 'textarea' ? 5 : undefined}
          disabled={status === 'submitting'}
          className={cn('bg-brand-bg text-brand-text', errors[key] && 'border-[var(--color-error)] focus-visible:ring-[var(--color-error)]')}
        />
        {errors[key] && (
          <p id={errId} role="alert" className="text-sm text-[var(--color-error)]">
            {errors[key]}
          </p>
        )}
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Contact form"
      data-testid="contact-form"
      className={cn('relative flex flex-col gap-4 rounded-xl border border-brand-border bg-brand-surface p-6', className)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', { autoComplete: 'name' })}
        {field('email', { type: 'email', autoComplete: 'email' })}
      </div>
      {(showPhone || showSubject) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {showPhone && field('phone', { type: 'tel', autoComplete: 'tel' })}
          {showSubject && field('subject')}
        </div>
      )}
      {field('message', { as: 'textarea' })}

      {/* Honeypot — visually hidden, excluded from the tab order and from screen readers. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input id={`${uid}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={onChange} />
      </div>

      {turnstileSiteKey && (
        <div className="flex flex-col gap-1.5">
          <TurnstileWidget key={turnstileGen} siteKey={turnstileSiteKey} onToken={onTurnstileToken} />
          {errors.turnstile && (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {errors.turnstile}
            </p>
          )}
        </div>
      )}

      {status === 'error' && serverError && (
        <p role="alert" data-testid="contact-error" className="flex items-start gap-2 rounded-md border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 p-3 text-sm text-brand-text">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-error)]" aria-hidden="true" />
          <span>{serverError}</span>
        </p>
      )}

      <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-brand-text-muted">Fields marked * are required.</p>
        <Button type="submit" size="lg" disabled={status === 'submitting'} className="w-full sm:w-auto">
          {status === 'submitting' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            fields.submitLabel || 'Send message'
          )}
        </Button>
      </div>
    </form>
  )
}

export default ContactForm
