// Batch-owned harness entry. The shared compact registry in main.jsx stays
// untouched so parallel L3 sessions never contend for the same file.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import theme from '../../../src/theme.json'
import { createDashboardTheme } from '../../../src/brand/adapter'
import { ThemeProvider as DashboardThemeProvider } from '../../../src/@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { CreateCustomOrder1StylesFixture } from './create-custom-order-1-styles'
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
      <CreateCustomOrder1StylesFixture />
    </DashboardThemeProvider>
  </ThemeProvider>
)
