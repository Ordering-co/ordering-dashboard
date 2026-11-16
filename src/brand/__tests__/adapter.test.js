import { describe, expect, it } from 'vitest'
import theme from '../../theme.json'
import { createDashboardTheme, createOrderingTheme, getOrderingAction } from '../adapter'
import { tokens, variables } from '../ordering.tokens.generated'
import { mergeThemePrimary } from '../../utils/bootTheme'
import { darken } from 'polished'
import { resolveButtonTheme } from '../../@/components-dashboard/src/ui/src/styles/Buttons/theme'
import { resolveFieldTheme } from '../../@/components-dashboard/src/ui/src/styles/fieldsTheme'
import { resolveSelectTheme } from '../../@/components-dashboard/src/ui/src/styles/selectTheme'

describe('dashboard initialization before tenant resolution', () => {
  it.each(['light', 'dark'])('initializes %s defaults as computable JS colors, retaining unrelated subtrees', mode => {
    const source = { ...theme, rtl: true, images: { logos: { logotype: 'tenant.svg' } }, sounds: { notification: 'sound.mp3' } }
    const adapted = createDashboardTheme(source, { mode })
    expect(adapted.colors.primary).toBe(source.colors.primary)
    expect(getOrderingAction(adapted)).toBe(tokens.theme[mode].semantic.action.default)
    expect(adapted.colors.backgroundPage).toBe(tokens.theme[mode].semantic.background)
    expect(() => darken(0.04, adapted.colors.primary)).not.toThrow()
    expect(adapted.fonts.primary.family).toBe(tokens.font.family.sans)
    expect(adapted.images).toBe(source.images)
    expect(adapted.sounds).toBe(source.sounds)
    expect(adapted.rtl).toBe(true)
    expect(adapted.colors.deadlineRisk).toBe(source.colors.deadlineRisk)
    expect(source.colors).toBe(theme.colors)
    expect(source.fonts.primary.name).toBe('Poppins')
  })

  it('preserves custom colors/fonts and runtime overrides even if equal to a former default', () => {
    const customFont = { name: 'Tenant Font', weights: [400] }
    const adapted = createDashboardTheme({ ...theme, fonts: { ...theme.fonts, primary: customFont }, colors: { ...theme.colors, primary: '#123456', backgroundPage: '#FAFAFA' } })
    expect(adapted.fonts.primary).toBe(customFont)
    expect(adapted.colors.primary).toBe('#123456')
    expect(adapted.colors.backgroundPage).toBe('#FAFAFA')
    const updated = mergeThemePrimary(adapted, theme.colors.primary)
    expect(updated.colors.primary).toBe(theme.colors.primary)
    expect(getOrderingAction(updated)).toBe(theme.colors.primary)
    expect(updated.ordering.semantic).toBe(adapted.ordering.semantic)
    expect(updated.fonts).toBe(adapted.fonts)
  })
})

describe('additive Ordering.co adapter', () => {
  it('preserves legacy and partial-theme typography fallbacks', () => {
    const legacy = { colors: {}, fonts: { primary: { name: 'Legacy' } } }
    expect(resolveButtonTheme(legacy).fontSize).toBe('14px')
    expect(resolveFieldTheme(legacy).fontSize).toBe('14px')
    expect(resolveSelectTheme(legacy).fontUi).toBe('14px')

    const partial = {
      ...legacy,
      ordering: { font: { size: { productUi: '15px', productContent: '16px' } } }
    }
    expect(resolveButtonTheme(partial).fontSize).toBe('15px')
    expect(resolveFieldTheme(partial).fontSize).toBe('16px')
    expect(resolveSelectTheme(partial).fontUi).toBe('15px')
  })

  it('preserves every legacy key and reference including tenant values without parsing them', () => {
    const legacy = Object.freeze({ ...theme, rtl: true, colors: Object.freeze({ ...theme.colors, primary: 'tenant-value-as-supplied' }), images: { logo: 'tenant.svg' } })
    const adapted = createOrderingTheme(legacy)
    for (const key of Object.keys(legacy)) expect(adapted[key]).toBe(legacy[key])
    expect(legacy).not.toHaveProperty('ordering')
    expect(adapted.ordering.semantic.action.default).toBe(tokens.theme.light.semantic.action.default)
  })

  it.each(['light', 'dark'])('derives %s JS and CSS roles from the same released source', mode => {
    const adapted = createOrderingTheme(theme, { mode }).ordering
    expect(adapted.semantic).toEqual(tokens.theme[mode].semantic)
    expect(adapted.css['--od-bg']).toBe(adapted.semantic.background)
    expect(adapted.css['--od-text']).toBe(adapted.semantic.text.default)
    expect(adapted.css['--od-action']).toBe(adapted.semantic.action.default)
    expect(adapted.css['--od-font-sans']).toBe(tokens.font.family.sans)
    expect(adapted.typography.roles).toEqual({
      control: { size: tokens.font.size.productUi },
      controlValue: { size: tokens.font.size.productContent },
      content: { size: tokens.font.size.productContent },
      secondary: { size: tokens.font.size[1] },
      sectionTitle: { size: tokens.font.size[4] },
      title: { size: tokens.font.size[5] },
      identifier: {
        size: tokens.font.size.productUi,
        family: tokens.font.family.mono,
        ligatures: tokens.font.variant.monoLigatures
      }
    })
    expect(adapted.css).toEqual({
      ...variables.root,
      ...variables.product,
      ...variables[mode],
      '--od-type-control-size': tokens.font.size.productUi,
      '--od-type-control-value-size': tokens.font.size.productContent,
      '--od-type-content-size': tokens.font.size.productContent,
      '--od-type-secondary-size': tokens.font.size[1],
      '--od-type-section-title-size': tokens.font.size[4],
      '--od-type-title-size': tokens.font.size[5],
      '--od-type-identifier-size': tokens.font.size.productUi,
      '--od-type-identifier-font': tokens.font.family.mono,
      '--od-type-identifier-ligatures': tokens.font.variant.monoLigatures
    })
    expect(adapted.release).toBe('1.3.0')
  })

  it('defaults to Light and never follows system preference or local storage', () => {
    window.localStorage.setItem('theme', 'dark')
    expect(createOrderingTheme(theme).ordering.mode).toBe('light')
    window.localStorage.removeItem('theme')
    expect(() => createOrderingTheme(theme, { mode: 'unknown' })).toThrow('Unsupported Ordering.co fixture mode')
  })

  it('prevents one consumer from mutating another mode or the source tokens', () => {
    const light = createOrderingTheme(theme).ordering
    const original = tokens.theme.light.semantic.action.default
    expect(() => { light.semantic.action.default = 'changed' }).toThrow()
    expect(createOrderingTheme(theme).ordering.semantic.action.default).toBe(original)
    expect(tokens.theme.light.semantic.action.default).toBe(original)
    expect(createOrderingTheme(theme, { mode: 'dark' }).ordering.semantic).toEqual(tokens.theme.dark.semantic)
  })
})
