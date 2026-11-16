import React, { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeProvider, useTheme } from '../../@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { useDashboardBootReveal } from '../../utils/useDashboardBootReveal'
import { createDashboardTheme, getOrderingAction } from '../adapter'
import defaults from '../../theme.json'

const DirectionFromLanguage = () => {
  const [, { merge }] = useTheme()
  useEffect(() => { merge({ rtl: true }) }, [])
  return null
}

const BootProbe = () => {
  const [theme, { update }] = useTheme()
  const ready = useDashboardBootReveal({
    sessionLoading: false,
    orderLoading: false,
    auth: false,
    configLoading: false,
    configs: { dashboard_buttons_colors: { value: '#123456' } },
    theme,
    update
  })
  return (
    <>
      <DirectionFromLanguage />
      <output data-testid='boot-coordination'>{JSON.stringify({ ready, rtl: theme.rtl, action: getOrderingAction(theme), dataPrimary: theme.colors.primary })}</output>
    </>
  )
}

const MergeProbe = () => {
  const [theme, { merge }] = useTheme()
  useEffect(() => {
    merge({ rtl: true })
    merge({ fixtureMarker: 'kept' })
  }, [])
  return <output data-testid='merge-coordination'>{JSON.stringify({ rtl: theme.rtl, marker: theme.fixtureMarker })}</output>
}

const ReplacementProbe = () => {
  const [theme, { update }] = useTheme()
  useEffect(() => { update(createDashboardTheme(defaults)) }, [])
  return <output data-testid='replacement'>{String(Object.hasOwn(theme, 'fixtureMarker'))}</output>
}

describe('shared boot appearance coordination', () => {
  it('preserves language RTL when tenant color is resolved in the same effect flush', () => {
    render(<ThemeProvider theme={createDashboardTheme(defaults)}><BootProbe /></ThemeProvider>)
    expect(JSON.parse(screen.getByTestId('boot-coordination').textContent)).toEqual({
      ready: true,
      rtl: true,
      action: '#123456',
      dataPrimary: '#123456'
    })
  })

  it('merges concurrent independent appearance changes against the current theme', () => {
    render(<ThemeProvider theme={createDashboardTheme(defaults)}><MergeProbe /></ThemeProvider>)
    expect(JSON.parse(screen.getByTestId('merge-coordination').textContent)).toEqual({ rtl: true, marker: 'kept' })
  })

  it('keeps update as an explicit replacement rather than turning it into a merge', () => {
    render(<ThemeProvider theme={{ ...createDashboardTheme(defaults), fixtureMarker: 'remove on replacement' }}><ReplacementProbe /></ThemeProvider>)
    expect(screen.getByTestId('replacement')).toHaveTextContent('false')
  })
})
