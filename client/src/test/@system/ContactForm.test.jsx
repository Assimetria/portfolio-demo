// @system — ContactForm tests: client validation, success state, server error
// mapping (429 / field errors / 503 / network) and the Turnstile gate.
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactForm, validateContact, describeSubmitError, MESSAGES } from '@/app/components/@system/site/ContactForm'

jest.mock('@/app/lib/@system/api', () => {
  const actual = jest.requireActual('@/app/lib/@system/api')
  return { ApiError: actual.ApiError, api: { get: jest.fn(), post: jest.fn() } }
})
const { api, ApiError } = require('@/app/lib/@system/api')

const GOOD = { name: 'Ana Silva', email: 'ana@example.com', message: 'I would like to book a consultation next week.' }

async function fillAndSubmit(user, values = GOOD) {
  const form = screen.getByTestId('contact-form')
  await user.type(screen.getByLabelText(/^name/i), values.name)
  await user.type(screen.getByLabelText(/^email/i), values.email)
  await user.type(screen.getByLabelText(/^message/i), values.message)
  await user.click(screen.getByRole('button', { name: /send message/i }))
  return form
}

beforeEach(() => {
  jest.clearAllMocks()
  delete window.turnstile
  // Default: Turnstile not enforced.
  api.get.mockResolvedValue({ data: { retentionDays: 180, turnstile: { siteKey: '' } } })
})

describe('validateContact', () => {
  it('flags name, email and short message', () => {
    const errors = validateContact({ name: 'A', email: 'nope', message: 'short' }, {})
    expect(errors).toEqual({
      name: 'Please enter your name.',
      email: 'Please enter a valid email address.',
      message: 'Please write at least 10 characters.',
    })
  })

  it('honours required/minLength from site.contact.formFields', () => {
    const fields = { phone: { required: true }, subject: { required: true }, message: { minLength: 20 } }
    const errors = validateContact({ ...GOOD, message: 'twelve chars' }, fields)
    expect(errors.phone).toBeDefined()
    expect(errors.subject).toBeDefined()
    expect(errors.message).toBe('Please write at least 20 characters.')
    expect(validateContact({ ...GOOD, phone: '1', subject: 's', message: 'x'.repeat(20) }, fields)).toEqual({})
  })
})

describe('describeSubmitError', () => {
  it('maps network failures (no status) to the network message', () => {
    expect(describeSubmitError(new TypeError('Failed to fetch'))).toEqual({ message: MESSAGES.network, fieldErrors: {} })
  })

  it('maps 429 and 503 to their server message', () => {
    expect(describeSubmitError(new ApiError('Too many messages sent from this address.', { status: 429 })).message).toMatch(/too many/i)
    expect(describeSubmitError(new ApiError('Contact form is temporarily unavailable', { status: 503 })).message).toMatch(/unavailable/i)
  })

  it('maps zod field errors (body.* prefix stripped) and the turnstile field', () => {
    const err = new ApiError('Validation failed', {
      status: 400,
      body: { errors: [{ field: 'body.email', message: 'A valid email address is required' }, { field: 'body.turnstileToken', message: 'x' }, { field: 'body.bogus', message: 'ignored' }] },
    })
    expect(describeSubmitError(err)).toEqual({
      message: 'Validation failed',
      fieldErrors: { email: 'A valid email address is required', turnstile: MESSAGES.turnstile },
    })
  })
})

describe('ContactForm', () => {
  it('renders the fields, a hidden honeypot, and asks the server for its config', async () => {
    render(<ContactForm />)
    expect(screen.getByTestId('contact-form')).toBeInTheDocument()
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^message/i)).toBeInTheDocument()
    const honeypot = document.querySelector('input[name="website"]')
    expect(honeypot).toHaveAttribute('tabindex', '-1')
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/contact/config'))
    expect(screen.queryByTestId('turnstile-widget')).not.toBeInTheDocument()
  })

  it('shows validation messages and does not post', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await fillAndSubmit(user, { name: 'A', email: 'not-an-email', message: 'short' })
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(3)
    expect(alerts[0]).toHaveTextContent(/name/i)
    expect(alerts[1]).toHaveTextContent(/email/i)
    expect(alerts[2]).toHaveTextContent(/characters/i)
    expect(api.post).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^name/i)).toHaveFocus()
  })

  it('posts through the shared api client (CSRF-aware) and shows the success state', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { id: 42, createdAt: '2026-09-20T10:00:00.000Z' } })
    render(<ContactForm />)
    await fillAndSubmit(user)
    await waitFor(() => expect(screen.getByTestId('contact-success')).toBeInTheDocument())
    expect(api.post).toHaveBeenCalledTimes(1)
    const [path, body] = api.post.mock.calls[0]
    expect(path).toBe('/contact')
    expect(body).toMatchObject({ name: GOOD.name, email: GOOD.email, message: GOOD.message, website: '', phone: '', subject: '' })
    expect(body.sourcePath).toBe(window.location.pathname)
    expect(body).not.toHaveProperty('turnstileToken')
    expect(screen.getByRole('status')).toHaveTextContent(/thank you/i)
  })

  it('accepts the legacy absolute endpoint prop without double-prefixing /api', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { id: 1 } })
    render(<ContactForm endpoint="/api/contact" />)
    await fillAndSubmit(user)
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/contact', expect.any(Object)))
    expect(api.get).toHaveBeenCalledWith('/contact/config')
  })

  it('"Send another message" returns to an empty form', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { id: 1 } })
    render(<ContactForm />)
    await fillAndSubmit(user)
    await screen.findByTestId('contact-success')
    await user.click(screen.getByRole('button', { name: /send another/i }))
    expect(screen.getByLabelText(/^name/i)).toHaveValue('')
  })

  it('shows the server message on 429 and keeps the form (no fake success)', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue(new ApiError('Too many messages sent from this address. Please try again later.', { status: 429, body: {} }))
    render(<ContactForm />)
    await fillAndSubmit(user)
    const err = await screen.findByTestId('contact-error')
    expect(err).toHaveTextContent(/too many messages/i)
    expect(screen.queryByTestId('contact-success')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^name/i)).toHaveValue(GOOD.name)
  })

  it('shows the network error message when fetch itself fails', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<ContactForm />)
    await fillAndSubmit(user)
    expect(await screen.findByTestId('contact-error')).toHaveTextContent(/network error/i)
  })

  it('surfaces server-side field errors on the matching inputs', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue(new ApiError('Validation failed', { status: 400, body: { errors: [{ field: 'body.email', message: 'A valid email address is required' }] } }))
    render(<ContactForm />)
    await fillAndSubmit(user)
    await screen.findByTestId('contact-error')
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('A valid email address is required')).toBeInTheDocument()
  })

  it('shows the 503 message when the form is unavailable', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue(new ApiError('Contact form is temporarily unavailable', { status: 503, body: {} }))
    render(<ContactForm />)
    await fillAndSubmit(user)
    expect(await screen.findByTestId('contact-error')).toHaveTextContent(/temporarily unavailable/i)
  })

  describe('Turnstile', () => {
    let capturedOptions
    beforeEach(() => {
      capturedOptions = null
      window.turnstile = {
        render: jest.fn((_el, opts) => { capturedOptions = opts; return 'widget-1' }),
        remove: jest.fn(),
        reset: jest.fn(),
      }
      api.get.mockResolvedValue({ data: { retentionDays: 180, turnstile: { siteKey: '1x00000000000000000000AA' } } })
    })

    it('renders the widget only when the server reports a site key', async () => {
      render(<ContactForm />)
      await screen.findByTestId('turnstile-widget')
      await waitFor(() => expect(window.turnstile.render).toHaveBeenCalled())
      expect(capturedOptions.sitekey).toBe('1x00000000000000000000AA')
    })

    it('blocks submit until the challenge yields a token, then sends it', async () => {
      const user = userEvent.setup()
      api.post.mockResolvedValue({ data: { id: 5 } })
      render(<ContactForm />)
      await screen.findByTestId('turnstile-widget')
      await waitFor(() => expect(capturedOptions).not.toBeNull())

      await fillAndSubmit(user)
      expect(screen.getByText(MESSAGES.turnstile)).toBeInTheDocument()
      expect(api.post).not.toHaveBeenCalled()

      act(() => capturedOptions.callback('cf-token-123'))
      await waitFor(() => expect(screen.queryByText(MESSAGES.turnstile)).not.toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /send message/i }))
      await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
      expect(api.post.mock.calls[0][1].turnstileToken).toBe('cf-token-123')
      await screen.findByTestId('contact-success')
    })
  })
})
