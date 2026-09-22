import { hexToHsl } from '@/app/lib/@system/utils'
describe('hexToHsl', () => {
  it('converts pure white', () => { expect(hexToHsl('#ffffff')).toBe('0 0% 100%') })
  it('converts pure black', () => { expect(hexToHsl('#000000')).toBe('0 0% 0%') })
  it('converts pure red', () => { expect(hexToHsl('#ff0000')).toMatch(/^0 100% 50%$/) })
  it('handles hex without # prefix', () => { expect(hexToHsl('ffffff')).toBe('0 0% 100%') })
  it('returns null for invalid input', () => { expect(hexToHsl('notahex')).toBeNull() })
  it('returns null for 3-char shorthand', () => { expect(hexToHsl('#fff')).toBeNull() })
  it('returns null for empty string', () => { expect(hexToHsl('')).toBeNull() })
  it('converts a gray', () => { expect(hexToHsl('#808080')).toMatch(/^0 0% /) })
})
