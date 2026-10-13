import React from 'react'
import {
  BrowserRouter
} from 'react-router-dom'

import { App } from './App'
import { DashboardAnalytics } from './components/DashboardAnalytics'

export const Router = () => {
  return (
    <BrowserRouter>
      <DashboardAnalytics />
      <App />
    </BrowserRouter>
  )
}
