// Batch-scoped entry. The shared compact registry in main.jsx stays untouched;
// integrate/ folds the delivery-3 surface into it from the batch integration
// notes. Theme wiring mirrors main.jsx so the fixture reads the same contract.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import theme from '../../../src/theme.json'
import { createDashboardTheme } from '../../../src/brand/adapter'
import { ThemeProvider as DashboardThemeProvider } from '../../../src/@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { Delivery3StylesFixture } from './delivery-3-styles'
import '../../../src/brand/ordering.tokens.generated.css'
import 'bootstrap/dist/css/bootstrap.css'

const query = new URLSearchParams(window.location.search)
const rtl = query.get('rtl') === 'true'
document.documentElement.dir = rtl ? 'rtl' : 'ltr'
document.documentElement.lang = query.get('locale') || (rtl ? 'ar' : 'en')

const fixtureTheme = { ...theme, rtl }
const dashboardFixtureTheme = createDashboardTheme(fixtureTheme, { mode: query.get('mode') || 'light' })

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={fixtureTheme}>
    <DashboardThemeProvider theme={dashboardFixtureTheme}>
      <Delivery3StylesFixture />
    </DashboardThemeProvider>
  </ThemeProvider>
)
