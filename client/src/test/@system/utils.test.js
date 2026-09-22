import { describe, it, expect } from 'vitest'
import { cn } from '@/app/lib/@system/utils'

describe('cn (className utility)', () => {
  it('returns a single class unchanged', () => {
    expect(cn('text-red-500')).toBe('text-red-500')
  })

  it('merges multiple classes', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'skip', 'keep')).toBe('base keep')
  })

  it('resolves Tailwind conflicts — last class wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles undefined and null gracefully', () => {
    expect(cn('base', undefined, null)).toBe('base')
  })

  it('returns empty string with no valid inputs', () => {
    expect(cn()).toBe('')
  })
})
