import { createApiClient, ApiError } from '../../app/lib/@custom/apiClient'

function mockFetchOnce(status, body, headers = {}) {
  const responseHeaders = new Headers({ 'content-type': 'application/json', ...headers })
  return jest.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    headers: responseHeaders,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
}

describe('apiClient (@custom)', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  test('GET returns parsed JSON body', async () => {
    global.fetch = mockFetchOnce(200, { data: { id: 1 } })
    const client = createApiClient({ baseUrl: '/api' })
    const result = await client.get('/items')
    expect(result).toEqual({ data: { id: 1 } })
  })

  test('throws ApiError with status and body on non-2xx', async () => {
    global.fetch = mockFetchOnce(500, { message: 'boom' })
    const client = createApiClient({ baseUrl: '/api' })
    await expect(client.get('/items')).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      body: { message: 'boom' },
    })
  })

  test('request interceptor can inject headers', async () => {
    const fetchMock = mockFetchOnce(200, { ok: true })
    global.fetch = fetchMock
    const client = createApiClient({ baseUrl: '/api' })
    client.interceptors.request.use((cfg) => {
      cfg.headers['X-Trace-Id'] = 'abc-123'
      return cfg
    })
    await client.get('/items')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-Trace-Id']).toBe('abc-123')
  })

  test('response interceptor can transform result', async () => {
    global.fetch = mockFetchOnce(200, { raw: 1 })
    const client = createApiClient({ baseUrl: '/api' })
    client.interceptors.response.use((r) => ({ ...r, data: { wrapped: r.data } }))
    const result = await client.get('/items')
    expect(result).toEqual({ wrapped: { raw: 1 } })
  })

  test('error interceptor runs before rejection', async () => {
    global.fetch = mockFetchOnce(400, { message: 'bad' })
    const client = createApiClient({ baseUrl: '/api' })
    const seen = []
    client.interceptors.error.use((err) => {
      seen.push(err.status)
      return err
    })
    await expect(client.get('/x')).rejects.toBeInstanceOf(ApiError)
    expect(seen).toEqual([400])
  })

  test('attaches Bearer token from getAuthToken', async () => {
    const fetchMock = mockFetchOnce(200, {})
    global.fetch = fetchMock
    const client = createApiClient({
      baseUrl: '/api',
      getAuthToken: () => 'tok-42',
    })
    await client.get('/me')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Authorization']).toBe('Bearer tok-42')
  })

  test('network error becomes ApiError with status 0', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('offline'))
    const client = createApiClient({ baseUrl: '/api' })
    await expect(client.get('/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    })
  })
})
