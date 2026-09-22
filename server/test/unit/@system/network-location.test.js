/**
 * Unit tests for the @system network helper `resolveIpLocation` — the one
 * exported helper that leans on the optional GeoIP module.
 *
 * `network.js` lazily `require('../GeoIP')` at call time (never at module
 * top-level), so this suite mocks the GeoIP module and drives `resolveIpLocation`
 * through both its happy/downstream paths without ever touching geoip-lite or
 * instantiating a DB connection.
 */

jest.mock('../../../src/lib/@system/GeoIP', () => ({
  getLocationFromRequest: jest.fn(() => ({ country: 'US' })),
}))

const GeoIP = require('../../../src/lib/@system/GeoIP')
const { resolveIpLocation } = require('../../../src/lib/@system/Helpers/network')

describe('resolveIpLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    GeoIP.getLocationFromRequest.mockReturnValue({ country: 'US' })
  })

  it('resolves country + normalised IP for a request with req.ip', () => {
    const req = { ip: '::ffff:203.0.113.9', headers: {} }
    const result = resolveIpLocation(req)

    // IPv4-mapped IPv6 is unwrapped to a plain dotted-octet address.
    expect(result.ip).toBe('203.0.113.9')
    expect(result.country).toBe('US')
    // The same request object is handed to GeoIP so it can use its own
    // trusted-IP resolution logic.
    expect(GeoIP.getLocationFromRequest).toHaveBeenCalledWith(req)
  })

  it('falls back to "unknown" country when GeoIP returns nothing', () => {
    GeoIP.getLocationFromRequest.mockReturnValue(null)
    const result = resolveIpLocation({ ip: '8.8.8.8', headers: {} })
    expect(result.ip).toBe('8.8.8.8')
    expect(result.country).toBe('unknown')
  })

  it('falls back to "unknown" country on an empty/undefined geo object', () => {
    GeoIP.getLocationFromRequest.mockReturnValue(undefined)
    const result = resolveIpLocation({ ip: '192.0.2.1', headers: {} })
    expect(result.country).toBe('unknown')
  })

  it('returns an empty ip string when the request carries no usable address', () => {
    GeoIP.getLocationFromRequest.mockReturnValue(undefined)
    // No req.ip, no X-Forwarded-For, no socket remote address.
    const result = resolveIpLocation({ headers: {} })
    expect(result.ip).toBe('')
    expect(result.country).toBe('unknown')
  })

  it('is tolerant of a non-object req (never throws)', () => {
    GeoIP.getLocationFromRequest.mockReturnValue(undefined)
    expect(() => resolveIpLocation(null)).not.toThrow()
    const result = resolveIpLocation(null)
    expect(result.ip).toBe('')
    expect(result.country).toBe('unknown')
  })

  it('uses a supplied GeoIP country when the request is IPv4 native', () => {
    const req = { ip: '198.51.100.4', headers: {} }
    const result = resolveIpLocation(req)
    expect(result.ip).toBe('198.51.100.4')
    expect(result.country).toBe('US')
  })
})
