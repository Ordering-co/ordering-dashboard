// Batch-scoped harness entry. The shared compact registry in main.jsx belongs to
// `integrate`; this entry mounts only the users-a2 fixture and mirrors the
// shared entry's theme, mode and direction handling.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import theme from '../../../src/theme.json'
import { createDashboardTheme } from '../../../src/brand/adapter'
import { ThemeProvider as DashboardThemeProvider } from '../../../src/@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { UsersA2StylesFixture } from './users-a2-styles'
import '../../../src/brand/ordering.tokens.generated.css'

const query = new URLSearchParams(window.location.search)
const rtl = query.get('rtl') === 'true'
const mode = query.get('mode') || 'light'

document.documentElement.dir = rtl ? 'rtl' : 'ltr'
document.documentElement.lang = query.get('locale') || (rtl ? 'ar' : 'en')

const fixtureTheme = { ...theme, rtl }
const dashboardFixtureTheme = createDashboardTheme(fixtureTheme, { mode })

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={fixtureTheme}>
    <DashboardThemeProvider theme={dashboardFixtureTheme}>
      <UsersA2StylesFixture />
    </DashboardThemeProvider>
  </ThemeProvider>
)
