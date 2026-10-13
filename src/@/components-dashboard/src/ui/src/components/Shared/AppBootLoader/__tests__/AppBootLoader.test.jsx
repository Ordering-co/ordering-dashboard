import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'

import { defaultTheme, renderWithProviders } from '~/__tests__/helpers/testUtils'
import { AppBootLoader, resolveBootDensity, resolveBootVariant } from '../index'

describe('AppBootLoader', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders the current spinner when variant is spinner', () => {
    renderWithProviders(
      <AppBootLoader variant='spinner' content='Loading…' />
    )

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(document.querySelector('.spinner')).toBeTruthy()
    expect(screen.queryByTestId('boot-home')).not.toBeInTheDocument()
  })

  it('defaults to the current spinner when variant is omitted or invalid', () => {
    const { unmount } = renderWithProviders(
      <AppBootLoader content='Loading…' />
    )

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(document.querySelector('.spinner')).toBeTruthy()

    unmount()
    renderWithProviders(
      <AppBootLoader variant='nope' content='Loading…' />
    )

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(document.querySelector('.spinner')).toBeTruthy()
    expect(screen.queryByTestId('boot-home')).not.toBeInTheDocument()
  })

  it('does not render spinner chrome when variant is home', () => {
    renderWithProviders(
      <AppBootLoader variant='home' content='Loading…' />
    )

    expect(screen.getByTestId('boot-home')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    expect(document.querySelector('.spinner')).toBeNull()
  })

  it('ignores density when variant is spinner', () => {
    renderWithProviders(
      <AppBootLoader variant='spinner' density='full' content='Loading…' />
    )

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(document.querySelector('.spinner')).toBeTruthy()
    expect(screen.queryByTestId('boot-home')).not.toBeInTheDocument()
    expect(screen.queryByTestId('boot-chart')).not.toBeInTheDocument()
  })

  it('renders a light Home shell without chart or lower blocks', () => {
    renderWithProviders(<AppBootLoader variant='home' density='light' />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Loading dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('boot-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('boot-sidebar-footer')).toBeInTheDocument()
    expect(screen.getByTestId('boot-sidebar-user')).toBeInTheDocument()
    expect(screen.getByTestId('boot-sidebar-help')).toBeInTheDocument()
    expect(screen.getByTestId('boot-sidebar-logout')).toBeInTheDocument()
    expect(screen.getByTestId('boot-sidebar-nav').children).toHaveLength(10)
    expect(screen.getByTestId('boot-metrics')).toBeInTheDocument()
    expect(screen.queryByTestId('boot-chart')).not.toBeInTheDocument()
    expect(screen.queryByTestId('boot-tiles')).not.toBeInTheDocument()
    expect(screen.queryByTestId('boot-lower')).not.toBeInTheDocument()
  })

  it('renders chart, extra tiles, and a lower block in full density', () => {
    renderWithProviders(<AppBootLoader variant='home' density='full' />)

    expect(screen.getByTestId('boot-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('boot-welcome')).toBeInTheDocument()
    expect(screen.getByTestId('boot-chart')).toBeInTheDocument()
    expect(screen.getByTestId('boot-tiles')).toBeInTheDocument()
    expect(screen.getByTestId('boot-lower')).toBeInTheDocument()
    expect(screen.queryByTestId('boot-metrics')).not.toBeInTheDocument()
  })

  it('treats a missing or invalid home density as light', () => {
    const { unmount } = renderWithProviders(<AppBootLoader variant='home' />)

    expect(screen.queryByTestId('boot-chart')).not.toBeInTheDocument()
    unmount()
    renderWithProviders(<AppBootLoader variant='home' density='heavy' />)
    expect(screen.queryByTestId('boot-chart')).not.toBeInTheDocument()
    expect(screen.getByTestId('boot-metrics')).toBeInTheDocument()
  })

  it('maps auth to full density and guests or unknown to light', () => {
    expect(resolveBootDensity(true)).toBe('full')
    expect(resolveBootDensity(false)).toBe('light')
    expect(resolveBootDensity(undefined)).toBe('light')
  })

  it('uses a persisted session token when auth is still unknown', () => {
    window.localStorage.setItem('token', 'persisted-token')

    expect(resolveBootDensity(undefined)).toBe('full')
    expect(resolveBootDensity(null)).toBe('full')
    expect(resolveBootDensity(false)).toBe('light')
  })

  it('shows the index.html splash, not the dashboard, while nobody is signed in', () => {
    renderWithProviders(<AppBootLoader variant='auth' />)

    const splash = screen.getByTestId('boot-auth')
    expect(splash).toHaveAttribute('role', 'status')
    // Same classes as the HTML splash, without its fade-in, so the hand-over does not flicker
    expect(splash.className).toContain('od-boot--auto')
    expect(splash.querySelector('.od-boot__inner--static')).not.toBeNull()
    // jsdom runs on localhost: the Ordering.co mark shows
    expect(splash.className).toContain('od-boot--brand')
    expect(screen.queryByTestId('boot-home')).toBeNull()
    expect(screen.queryByTestId('boot-sidebar')).toBeNull()
  })

  it('picks the dashboard shell only with a session', () => {
    expect(resolveBootVariant(true)).toBe('home')
    expect(resolveBootVariant(false)).toBe('auth')
    expect(resolveBootVariant(undefined)).toBe('auth')
    window.localStorage.setItem('token', 'persisted-token')
    expect(resolveBootVariant(undefined)).toBe('home')
    expect(resolveBootVariant(false)).toBe('auth')
  })

  it('hides the sidebar below 768px in CSS', () => {
    renderWithProviders(<AppBootLoader variant='home' density='light' />)

    const rules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText)
      } catch {
        return []
      }
    }).join(' ')

    expect(rules).toMatch(/max-width:\s*767px/)
    expect(rules).toMatch(/display:\s*none/)
  })

  it('uses Home-sized heights for welcome, chart, tiles, and services', () => {
    renderWithProviders(<AppBootLoader variant='home' density='full' />)

    expect(screen.getByTestId('boot-welcome')).toBeInTheDocument()
    expect(screen.getByTestId('boot-chart')).toBeInTheDocument()
    expect(screen.getByTestId('boot-lower')).toBeInTheDocument()

    const rules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText)
      } catch {
        return []
      }
    }).join(' ')

    expect(rules).toMatch(/min-height:\s*180px/)
    expect(rules).toMatch(/min-height:\s*360px/)
    expect(rules).toMatch(/height:\s*300px/)
    expect(rules).toMatch(/min-height:\s*150px/)
    expect(rules).toMatch(/width:\s*63px/)
    expect(rules).toMatch(/height:\s*63px/)
  })

  it('pins user, help, and logout bones to the bottom of the sidebar', () => {
    renderWithProviders(<AppBootLoader variant='home' density='full' />)

    const footer = screen.getByTestId('boot-sidebar-footer')
    expect(footer).toBeInTheDocument()
    expect(screen.getByTestId('boot-sidebar-user')).toBeInTheDocument()
    expect(screen.getByTestId('boot-sidebar-help')).toBeInTheDocument()
    expect(screen.getByTestId('boot-sidebar-logout')).toBeInTheDocument()

    const rules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText)
      } catch {
        return []
      }
    }).join(' ')

    expect(rules).toMatch(/margin-top:\s*auto/)
  })

  it('uses gray theme tokens for skeleton bones, not primary', () => {
    renderWithProviders(
      <AppBootLoader variant='home' density='light' />,
      {
        theme: {
          ...defaultTheme,
          colors: {
            ...defaultTheme.colors,
            primary: '#2C7BE5',
            gray: '#DEE2E6',
            secundary: '#F8F9FA'
          }
        }
      }
    )

    const rules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText)
      } catch {
        return []
      }
    }).join(' ')

    expect(rules).toMatch(/#DEE2E6|rgb\(\s*222,\s*226,\s*230\s*\)/)
    expect(rules).toMatch(/#F8F9FA|rgb\(\s*248,\s*249,\s*250\s*\)/)
    expect(rules).not.toMatch(/#2C7BE5|rgb\(\s*44,\s*123,\s*229\s*\)/)
  })
})
