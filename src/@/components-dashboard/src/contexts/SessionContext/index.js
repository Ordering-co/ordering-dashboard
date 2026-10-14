import React, { createContext, useContext, useEffect, useState } from 'react'
import { useApi } from '../ApiContext'
import { getDashboardStorageKey } from '../../../../../utils/local-tenant'
import { getSessionStorageSyncAction } from './sessionStorageSync'
import { getSessionCheckAction, getSessionCheckUrl } from './sessionCheck'
import { getDocsConnectMode } from '../../components/DocsConnection/mode'
/**
 * Create SessionContext
 * This context will manage the session internally and provide an easy interface
 */
export const SessionContext = createContext()

export const getSessionStorageValues = async (strategy, expectedProject) => {
  const project = await strategy.getItem('project')
  if (expectedProject && project !== expectedProject) {
    return { auth: null, token: null, project: expectedProject, user: null }
  }
  const token = await strategy.getItem('token')
  const user = await strategy.getItem('user', true)

  if (token && (!user || typeof user !== 'object' || Array.isArray(user))) {
    await strategy.removeItem('token')
    await strategy.removeItem('user')
    return { auth: null, token: null, project, user: null }
  }

  return { auth: token, token, project, user }
}

/**
 * Custom provider to session manager
 * This provider has a reducer for manage session state
 * @param {props} props
 */
export const SessionProvider = ({ children, strategy, settings }) => {
  const [ordering] = useApi()
  const [state, setState] = useState({
    auth: null,
    token: null,
    project: null,
    user: null,
    loading: true
  })

  const checkStoredSession = async (token) => {
    try {
      const response = await fetch(getSessionCheckUrl(ordering.root), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      const content = await response.json().catch(() => null)
      return getSessionCheckAction({ status: response.status, content })
    } catch (error) {
      return 'keep'
    }
  }

  const setValuesFromLocalStorage = async () => {
    const { auth, token, project, user } = await getSessionStorageValues(strategy, settings?.local_project_pin)

    if (token) {
      const action = await checkStoredSession(token)
      if (action !== 'keep') {
        await logout()
        const isBillingUser = user?.user_system_id && settings?.billing_url
        // Keep the docs/MCP popup on this origin so it can sign in and finish its bridge.
        const isDocsConnection = getDocsConnectMode(window.location.search).active
        action === 'billing' && isBillingUser && !isDocsConnection && window.location.replace(settings?.billing_url)
        return
      }
    }
    setState({
      ...state,
      auth,
      token,
      project,
      user,
      loading: false
    })
  }

  const login = async (values) => {
    if (settings?.local_project_pin && values.project !== settings.local_project_pin) return
    await strategy.setItem('token', values.token)
    await strategy.setItem('user', values.user, true)
    await strategy.setItem('project', values.project)
    setState({
      ...state,
      auth: true,
      user: values.user,
      token: values.token,
      project: values.project,
      loading: false
    })
  }

  const logout = async () => {
    try {
      let userToClean = state?.user
      if (!userToClean) {
        userToClean = await strategy.getItem('user', true)
      }

      if (userToClean?.level === 5 && userToClean?.id) {
        const storageKey = getDashboardStorageKey(settings, `drivers_cache_${userToClean.id}`)
        localStorage.removeItem(storageKey)
      }
    } catch (error) {
      console.error('Error clearing driver cache on logout:', error)
    }

    await strategy.removeItem('token')
    await strategy.removeItem('user')
    const userCustomer = await strategy.getItem('user-customer')
    if (userCustomer) {
      await strategy.removeItem('user-customer')
    }
    setState({
      ...state,
      auth: false,
      user: null,
      token: null,
      project: null,
      loading: false
    })
  }

  const changeUser = async (user) => {
    await strategy.setItem('user', user, true)
    setState({
      ...state,
      user,
      loading: false
    })
  }

  const checkLocalStorage = async () => {
    const { token, project, user } = await getSessionStorageValues(strategy, settings?.local_project_pin)
    const action = getSessionStorageSyncAction({
      storageToken: token,
      sessionToken: state.token,
      storageProject: project,
      sessionProject: ordering.project
    })

    if (action === 'reload') {
      window.location.reload()
      return
    }

    if (action === 'login') {
      login({
        user,
        token,
        project
      })
      return
    }

    if (action === 'logout') {
      logout()
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      checkLocalStorage()
    }, 1000)
    return () => clearInterval(interval)
  }, [state])

  useEffect(() => {
    setValuesFromLocalStorage()
  }, [])

  const functions = {
    login,
    logout,
    changeUser
  }

  return (
    <SessionContext.Provider value={[state, functions]}>
      {children}
    </SessionContext.Provider>
  )
}

/**
 * Hook to get and update session state
 */
export const useSession = () => {
  const sessionManager = useContext(SessionContext)
  return sessionManager || [{}, () => {}]
}
