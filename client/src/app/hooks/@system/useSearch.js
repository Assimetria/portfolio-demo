// @system — useSearch hook
// Provides debounced full-text search with loading, error, and pagination state.
//
// Usage:
//   const { hits, total, loading, error, search } = useSearch({ index: 'products' })
//   search('headphones')
//
//   // With pagination:
//   const { hits, total, page, totalPages, setPage } = useSearch({ index: 'products', limit: 10 })

import { useState, useCallback, useRef, useEffect } from 'react'
import { search as searchApi } from '../api/@system/search'

export function useSearch(options) {
  const {
    index,
    limit = 20,
    initialQuery = '',
    debounceMs = 300,
    filters,
    sort,
    fields,
    onResults,
  } = options

  const [hits, setHits]               = useState([])
  const [total, setTotal]             = useState(0)
  const [page, setPageState]          = useState(1)
  const [totalPages, setTotalPages]   = useState(0)
  const [query, setQuery]             = useState(initialQuery)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [processingTimeMs, setProcessingTimeMs] = useState(undefined)
  const [provider, setProvider]       = useState(null)

  const debounceRef = useRef(null)
  const latestQueryRef = useRef('')

  const executeSearch = useCallback(
    async (q, targetPage) => {
      if (!q.trim()) {
        setHits([])
        setTotal(0)
        setTotalPages(0)
        setPageState(1)
        setError(null)
        setLoading(false)
        return
      }

      const thisQuery = q
      latestQueryRef.current = q

      setLoading(true)
      setError(null)

      try {
        const offset = (targetPage - 1) * limit
        const res = await searchApi({ index, q, filters, sort, limit, offset, fields })

        // Ignore stale responses if a newer query has been fired
        if (latestQueryRef.current !== thisQuery) return

        if (res.status !== 200 || !res.data) {
          setError(res.message ?? 'Search failed')
          return
        }

        const data = res.data
        setHits(data.hits)
        setTotal(data.total)
        setPageState(data.page)
        setTotalPages(data.totalPages)
        setProcessingTimeMs(data.processingTimeMs)
        setProvider(data.provider)

        onResults?.(data)
      } catch (err) {
        if (latestQueryRef.current !== thisQuery) return
        setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        if (latestQueryRef.current === thisQuery) {
          setLoading(false)
        }
      }
    },
    [index, limit, filters, sort, fields, onResults]
  )

  const search = useCallback(
    (q) => {
      setQuery(q)
      setPageState(1)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        executeSearch(q, 1)
      }, debounceMs)
    },
    [executeSearch, debounceMs]
  )

  const setPage = useCallback(
    (newPage) => {
      setPageState(newPage)
      executeSearch(query, newPage)
    },
    [executeSearch, query]
  )

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    latestQueryRef.current = ''
    setHits([])
    setTotal(0)
    setPageState(1)
    setTotalPages(0)
    setQuery('')
    setError(null)
    setLoading(false)
    setProcessingTimeMs(undefined)
  }, [])

  // Run initial query if provided
  useEffect(() => {
    if (initialQuery) {
      executeSearch(initialQuery, 1)
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { hits, total, page, totalPages, query, loading, error, processingTimeMs, provider, search, setPage, clear }
}
