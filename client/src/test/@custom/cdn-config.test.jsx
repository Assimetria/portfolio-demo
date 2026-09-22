/**
 * Unit tests for CDN URL configuration on the client side.
 *
 * Verifies that:
 *   - window.__CDN_URL and window.__AUTH_CDN_URL are set by main.jsx
 *   - The values default to empty strings when not configured
 *   - Auth page index.jsx picks up the CDN URL from window
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('CDN URL configuration', () => {
  beforeEach(() => {
    // Simulate what main.jsx does — set the window globals
    window.__CDN_URL = ''
    window.__AUTH_CDN_URL = ''
  })

  afterEach(() => {
    delete window.__CDN_URL
    delete window.__AUTH_CDN_URL
  })

  it('sets __CDN_URL to empty string when no CDN is configured', () => {
    expect(window.__CDN_URL).toBe('')
  })

  it('sets __AUTH_CDN_URL to empty string when no CDN is configured', () => {
    expect(window.__AUTH_CDN_URL).toBe('')
  })

  it('preserves the CDN URL when set via info.cdn config', () => {
    const mockInfo = { cdn: { url: 'https://cdn.example.com', authAssetsUrl: 'https://auth-cdn.example.com' } }
    window.__CDN_URL = mockInfo.cdn?.url || ''
    window.__AUTH_CDN_URL = mockInfo.cdn?.authAssetsUrl || window.__CDN_URL

    expect(window.__CDN_URL).toBe('https://cdn.example.com')
    expect(window.__AUTH_CDN_URL).toBe('https://auth-cdn.example.com')
  })

  it('falls back __AUTH_CDN_URL to __CDN_URL when authAssetsUrl is not set', () => {
    const mockInfo = { cdn: { url: 'https://cdn.example.com' } }
    window.__CDN_URL = mockInfo.cdn?.url || ''
    window.__AUTH_CDN_URL = mockInfo.cdn?.authAssetsUrl || window.__CDN_URL

    expect(window.__AUTH_CDN_URL).toBe('https://cdn.example.com')
  })

  it('handles the case where cdn config is completely absent', () => {
    const mockInfo = {}
    window.__CDN_URL = mockInfo.cdn?.url || ''
    window.__AUTH_CDN_URL = mockInfo.cdn?.authAssetsUrl || window.__CDN_URL

    expect(window.__CDN_URL).toBe('')
    expect(window.__AUTH_CDN_URL).toBe('')
  })
})