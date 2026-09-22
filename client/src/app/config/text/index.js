// Text resolver: merges @system defaults with @custom overrides.
// @system/text/index.js = template default copy (overwritten during template sync)
// @custom/text/index.js = product-specific copy (NEVER overwritten during sync)
//
// Usage: import { text } from '@/app/config/text'
// Result: deep-merged text — @custom keys win on any overlap

import { text as systemText } from '../@system/text'
import { text as customText } from '../@custom/text'

function deepMerge(base, overrides) {
  const result = { ...base }
  for (const key of Object.keys(overrides)) {
    if (
      overrides[key] &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key]) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], overrides[key])
    } else {
      result[key] = overrides[key]
    }
  }
  return result
}

export const text = deepMerge(systemText, customText)
