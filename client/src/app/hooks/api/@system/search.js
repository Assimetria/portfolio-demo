const BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || '/api'

export async function search(params) {
  const qs = new URLSearchParams()
  qs.set('q', params.q)
  if (params.filters) qs.set('filters', params.filters)
  if (params.sort) qs.set('sort', params.sort)
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  if (params.fields) qs.set('fields', params.fields)

  try {
    const res = await fetch(`${BASE_URL}/search/${params.index}?${qs.toString()}`, {
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      return { status: res.status, message: err.message ?? 'Search failed' }
    }
    const data = await res.json()
    return { status: 200, data }
  } catch (err) {
    return { status: 500, message: err instanceof Error ? err.message : 'Search failed' }
  }
}
