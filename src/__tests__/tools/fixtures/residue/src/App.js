// redesign W0-8a (T0-30) fixture for residueScan.test.js
import React from 'react'
import { Switch, Route, Redirect } from 'react-router-dom'
import { ProtectedRoute } from '~ui'
import { Good } from './pages/Good'
import { Clean } from './pages/Clean'
import { Pkg } from './pages/Pkg'
import { Lazy } from './pages/Lazy'
import { Ns } from './pages/Ns'

export const App = () => (
  <Switch>
    <Route exact path='/'>
      <Redirect to='/good' />
    </Route>
    <ProtectedRoute path='/good' allowedLevels={[0]}>
      <Good />
    </ProtectedRoute>
    <ProtectedRoute path='/clean' allowedLevels={[0]}>
      <Clean />
    </ProtectedRoute>
    <ProtectedRoute path='/pkg' allowedLevels={[0]}>
      <Pkg />
    </ProtectedRoute>
    <ProtectedRoute path='/lazy' allowedLevels={[0]}>
      {window.__ready ? <Lazy /> : <Redirect to='/clean' />}
    </ProtectedRoute>
    <Route path='/ns' component={Ns} />
  </Switch>
)
