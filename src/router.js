import React from 'react'
import {
  BrowserRouter
} from 'react-router-dom'

import { App } from './App'
import { DashboardAnalytics } from './components/DashboardAnalytics'
import { ColorModeProvider } from '~ui/src/contexts/ColorModeContext'
import settings from './config'

export const Router = () => {
  return (
    <BrowserRouter>
      <DashboardAnalytics />
      {/* off (the default), the provider only renders the app. */}
      <ColorModeProvider enabled={settings.dashboard_dark_mode === true}>
        <App />
      </ColorModeProvider>
    </BrowserRouter>
  )
}
