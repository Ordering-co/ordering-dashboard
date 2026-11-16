// Batch-scoped harness entry. The shared harness entry (main.jsx) stays
// untouched while this batch runs in its own worktree; the exact fragment that
// registers this surface there is recorded in the batch integration notes.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import theme from '../../../src/theme.json'
import { createDashboardTheme } from '../../../src/brand/adapter'
import { ThemeProvider as DashboardThemeProvider } from '../../../src/@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { Delivery2StylesFixture } from './delivery-2-styles'
import '../../../src/brand/ordering.tokens.generated.css'

const query = new URLSearchParams(window.location.search)
const rtl = query.get('rtl') === 'true'
document.documentElement.dir = rtl ? 'rtl' : 'ltr'
document.documentElement.lang = query.get('locale') || (rtl ? 'ar' : 'en')

const fixtureTheme = { ...theme, rtl }
const dashboardFixtureTheme = createDashboardTheme(fixtureTheme, { mode: query.get('mode') || 'light' })

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={fixtureTheme}>
    <DashboardThemeProvider theme={dashboardFixtureTheme}>
      <Delivery2StylesFixture />
    </DashboardThemeProvider>
  </ThemeProvider>
)
