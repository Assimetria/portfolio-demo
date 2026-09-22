describe('cookies helpers', () => {
  const originalEnv = process.env.NODE_ENV

  const loadModule = () => {
    jest.resetModules()
    return require('../../../src/lib/@system/Helpers/cookies')
  }

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  const mockRes = () => ({ cookie: jest.fn() })

  it('exports TTL constants', () => {
    const {
      ACCESS_TOKEN_TTL_MS,
      REFRESH_TOKEN_TTL_MS,
      REMEMBER_ME_REFRESH_TTL_MS,
    } = loadModule()
    expect(ACCESS_TOKEN_TTL_MS).toBe(15 * 60 * 1000)
    expect(REFRESH_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
    expect(REMEMBER_ME_REFRESH_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })

  describe('setAccessCookie', () => {
    it('sets access_token cookie with httpOnly and 15-min maxAge', () => {
      process.env.NODE_ENV = 'development'
      const { setAccessCookie, ACCESS_TOKEN_TTL_MS } = loadModule()
      const res = mockRes()
      setAccessCookie(res, 'abc.jwt.token')
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'abc.jwt.token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          maxAge: ACCESS_TOKEN_TTL_MS,
          path: '/',
        })
      )
    })

    it('uses secure=true in production', () => {
      process.env.NODE_ENV = 'production'
      const { setAccessCookie } = loadModule()
      const res = mockRes()
      setAccessCookie(res, 't')
      expect(res.cookie.mock.calls[0][2].secure).toBe(true)
    })
  })

  describe('setRefreshCookie', () => {
    it('scopes refresh cookie to /api/sessions with 7-day TTL by default', () => {
      process.env.NODE_ENV = 'development'
      const { setRefreshCookie, REFRESH_TOKEN_TTL_MS } = loadModule()
      const res = mockRes()
      setRefreshCookie(res, 'refresh-token')
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          maxAge: REFRESH_TOKEN_TTL_MS,
          path: '/api/sessions',
        })
      )
    })

    it('extends to 30 days when rememberMe is set', () => {
      const { setRefreshCookie, REMEMBER_ME_REFRESH_TTL_MS } = loadModule()
      const res = mockRes()
      setRefreshCookie(res, 't', { rememberMe: true })
      expect(res.cookie.mock.calls[0][2].maxAge).toBe(REMEMBER_ME_REFRESH_TTL_MS)
    })
  })
})
