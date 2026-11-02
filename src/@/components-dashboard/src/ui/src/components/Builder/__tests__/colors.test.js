import { describe, expect, it } from 'vitest'

import { alphaOf, fromPickerColor, withAlpha } from '../ThemeSchemaEditor/colors'

describe('theme colors', () => {
  it('reads the opacity of a color', () => {
    expect(alphaOf('#112233')).toBe(1)
    expect(alphaOf('rgba(0,0,0,0.4)')).toBe(0.4)
    expect(alphaOf('transparent')).toBe(0)
    expect(alphaOf('{color.primary}')).toBe(1)
  })

  it('stores a color at an opacity as the theme does: hex, rgba() or transparent', () => {
    expect(withAlpha('#336699', 1)).toBe('#336699')
    expect(withAlpha('#336699', 0.456)).toBe('rgba(51,102,153,0.46)')
    expect(withAlpha('rgba(0,0,0,0.4)', 0.25)).toBe('rgba(0,0,0,0.25)')
    expect(withAlpha('rgba(0,0,0,0.4)', 1)).toBe('#000000')
    expect(withAlpha('#336699', 0)).toBe('transparent')
  })

  it('keeps the opacity of a picked color only where it may be translucent', () => {
    expect(fromPickerColor('#ff0000', 'rgba(0,0,0,0.4)')).toBe('rgba(255,0,0,0.4)')
    expect(fromPickerColor('#ff0000', 'rgba(0,0,0,0.4)', { alpha: false })).toBe('#FF0000')
    expect(fromPickerColor('#ff0000', 'transparent', { alpha: true })).toBe('#FF0000')
  })
})
