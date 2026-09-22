// @system — TurnstileWidget: lazy script loading + explicit render lifecycle.
import { render, screen, waitFor, act } from '@testing-library/react'
import { TurnstileWidget, loadTurnstile, TURNSTILE_SCRIPT_URL, __resetTurnstileLoader } from '@/app/components/@system/site/TurnstileWidget'

beforeEach(() => {
  delete window.turnstile
  __resetTurnstileLoader()
  document.head.querySelectorAll('script').forEach((s) => s.remove())
})

describe('TurnstileWidget', () => {
  it('renders nothing without a site key', () => {
    const { container } = render(<TurnstileWidget siteKey="" onToken={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders explicitly via window.turnstile and forwards tokens / expiry', async () => {
    let opts
    window.turnstile = { render: jest.fn((_el, o) => { opts = o; return 'w1' }), remove: jest.fn() }
    const onToken = jest.fn()
    const { unmount } = render(<TurnstileWidget siteKey="1x-key" onToken={onToken} theme="dark" />)
    const el = screen.getByTestId('turnstile-widget')
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledWith(el, expect.objectContaining({ sitekey: '1x-key', theme: 'dark' })))

    act(() => opts.callback('tok'))
    expect(onToken).toHaveBeenLastCalledWith('tok')
    act(() => opts['expired-callback']())
    expect(onToken).toHaveBeenLastCalledWith('')

    unmount()
    expect(window.turnstile.remove).toHaveBeenCalledWith('w1')
  })

  it('injects the Cloudflare script once and resolves when it loads', async () => {
    const p = loadTurnstile()
    const script = document.head.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
    expect(script).not.toBeNull()
    expect(script.src).toMatch(/^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/)
    expect(loadTurnstile()).toBe(p) // cached
    window.turnstile = { render: jest.fn(), remove: jest.fn() }
    script.dispatchEvent(new Event('load'))
    await expect(p).resolves.toBe(window.turnstile)
    expect(document.head.querySelectorAll('script').length).toBe(1)
  })

  it('reports an empty token when the script fails to load (CSP / blocker)', async () => {
    const onToken = jest.fn()
    render(<TurnstileWidget siteKey="1x-key" onToken={onToken} />)
    const script = document.head.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
    expect(script).not.toBeNull()
    act(() => { script.dispatchEvent(new Event('error')) })
    await waitFor(() => expect(onToken).toHaveBeenCalledWith(''))
  })
})
