import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ThemeProvider, useTheme } from '.'

const createTheme = ({ family = 'Tenant Font One', local = false, rtl = false } = {}) => ({
  fonts: {
    primary: {
      name: family,
      weights: [400, 600],
      ...(local ? { family: `'${family}', system-ui`, local: true } : {})
    },
    special: {
      name: 'Tenant Display',
      weights: [400],
      local: true
    }
  },
  colors: {
    backgroundPage: '#FFFFFF',
    headingColor: '#0B0C0D',
    borderColor: '#DEE0E3'
  },
  rtl,
  tenant: {
    value: 'preserved'
  }
})

let themeActions
let currentTheme

const ThemeProbe = () => {
  const [theme, actions] = useTheme()
  currentTheme = theme
  themeActions = actions
  return null
}

const renderTheme = theme => render(
  <ThemeProvider theme={theme}>
    <ThemeProbe />
  </ThemeProvider>
)

describe('ThemeContext runtime updates', () => {
  it('reconciles a changed client font in place and removes its link when switching to a local font', async () => {
    renderTheme(createTheme())

    const primaryFontLink = () => document.querySelectorAll('#primary-font-styles')
    await waitFor(() => expect(primaryFontLink()).toHaveLength(1))
    const originalLink = primaryFontLink()[0]
    expect(primaryFontLink()[0].href).toContain('Tenant%20Font%20One:wght@400;600')

    act(() => {
      themeActions.merge({
        fonts: {
          ...createTheme({ family: 'Tenant Font One' }).fonts,
          secondary: { name: 'Tenant Secondary', weights: [300] }
        }
      })
    })

    await waitFor(() => expect(document.querySelector('#secondary-font-styles')).not.toBeNull())
    expect(primaryFontLink()[0]).toBe(originalLink)

    act(() => {
      themeActions.merge({
        fonts: {
          primary: { name: 'Tenant Font Two', weights: [300, 700] },
          special: { name: 'Tenant Display', local: true }
        }
      })
    })

    await waitFor(() => {
      expect(primaryFontLink()).toHaveLength(1)
      expect(primaryFontLink()[0].href).toContain('Tenant%20Font%20Two:wght@300;700')
      expect(document.querySelector('#secondary-font-styles')).toBeNull()
    })
    expect(primaryFontLink()[0]).toBe(originalLink)
    expect(currentTheme.tenant).toEqual({ value: 'preserved' })

    act(() => {
      themeActions.merge({
        fonts: createTheme({ family: 'Ordering Inter Local', local: true }).fonts
      })
    })

    await waitFor(() => expect(primaryFontLink()).toHaveLength(0))
    expect(currentTheme.fonts.primary).toMatchObject({
      name: 'Ordering Inter Local',
      family: "'Ordering Inter Local', system-ui",
      local: true
    })
    expect(currentTheme.tenant).toEqual({ value: 'preserved' })
  })

  it('does not fetch a family-only font or take ownership of a host stylesheet', async () => {
    const hostFont = document.createElement('link')
    hostFont.id = 'primary-font-styles'
    hostFont.rel = 'stylesheet'
    hostFont.href = 'https://assets.example.test/tenant-font.css'
    document.body.appendChild(hostFont)

    const { unmount } = renderTheme(createTheme())
    await waitFor(() => expect(document.querySelector('#primary-font-styles')).toBe(hostFont))
    expect(hostFont.href).toBe('https://assets.example.test/tenant-font.css')

    act(() => {
      themeActions.merge({
        fonts: {
          primary: { name: 'Fixture Tenant Sans', family: 'monospace' }
        }
      })
    })

    expect(document.querySelector('#primary-font-styles')).toBe(hostFont)
    expect(document.querySelectorAll('link[href*="fonts.googleapis.com"]')).toHaveLength(0)
    unmount()
    expect(document.querySelector('#primary-font-styles')).toBe(hostFont)
    hostFont.remove()
  })

  it('keeps update as replacement and merge as a shallow functional update', () => {
    renderTheme(createTheme())

    act(() => {
      themeActions.merge({ rtl: true })
      themeActions.merge({ colors: { backgroundPage: '#17181A' } })
    })

    expect(currentTheme).toMatchObject({
      rtl: true,
      colors: { backgroundPage: '#17181A' },
      tenant: { value: 'preserved' }
    })
    expect(currentTheme.colors).not.toHaveProperty('headingColor')

    const replacement = createTheme({ family: 'Replacement Font' })
    delete replacement.tenant
    act(() => themeActions.update(replacement))

    expect(currentTheme).toBe(replacement)
    expect(currentTheme).not.toHaveProperty('tenant')
    expect(currentTheme.rtl).toBe(false)
  })
})
