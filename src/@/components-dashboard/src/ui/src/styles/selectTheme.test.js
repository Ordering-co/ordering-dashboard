import { describe, expect, it } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { mergeThemePrimary } from '~/utils/bootTheme'

import { resolveSelectTheme } from './selectTheme'

describe('select presentation roles', () => {
  it('resolves semantic modes, density, motion, icon size and the tenant font', () => {
    const tenantFont = { name: 'Tenant Sans', family: "'Tenant Sans', system-ui", weights: [400] }
    const custom = mergeThemePrimary(createDashboardTheme({
      ...theme,
      fonts: { ...theme.fonts, primary: tenantFont }
    }), '#F5A300')
    const light = resolveSelectTheme(custom)
    const dark = resolveSelectTheme(createDashboardTheme(theme, { mode: 'dark' }))

    expect(light).toMatchObject({
      action: '#F5A300',
      actionContent: '#F5A300',
      surface: '#FFFFFF',
      text: '#0B0C0D',
      compactHeight: '32px',
      touchTarget: '44px',
      iconSize: '16px',
      focusWidth: '2px',
      focusOffset: '2px',
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      fontFamily: "'Tenant Sans', system-ui"
    })
    expect(dark).toMatchObject({
      surface: '#17181A',
      surfaceSubtle: '#212224',
      text: '#FFFFFF',
      border: '#34363A'
    })
  })
})
