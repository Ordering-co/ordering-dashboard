import React, { useState, useEffect } from 'react'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { fetchAllPages } from '../../utils/fetchAllPages'

export const SidebarMenu = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [, { showToast }] = useToast()

  const [state, setState] = useState({ loading: false, error: null, result: null })
  const [productsState, setProductsState] = useState({ loading: true, error: null, apps: [] })
  const [aiModuleEnabled, setAiModuleEnabled] = useState(null)

  /**
   * Method to get billing token from core API
   */
  const getBillingToken = async () => {
    try {
      setState({ ...state, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const response = await fetch(`${ordering.root}/integrations/internal/tokens/current/`, requestOptions)
      const content = await response.json()
      setState({
        ...state,
        loading: false,
        result: content.error ? null : content.result,
        error: content.error ? content.result : null
      })
      content.error && showToast(ToastType.Error, content.result?.[0])
      return {
        result: content.result,
        error: content.error ? content.result : null
      }
    } catch (err) {
      setState({
        ...state,
        loading: false,
        error: err.message
      })
      err?.message && showToast(ToastType.Error, err?.message)
    }
  }

  const formatProduct = (app) => {
    const getType = (code) => {
      if (!code) return ''
      return code.includes('app') ? 'app' : code.includes('web') ? 'web' : ''
    }

    return {
      id: app.id,
      title: app.name,
      type: getType(app.base.code),
      enabled: true
    }
  }

  /**
  * Method to get Builder Apps from API
  */
  const getBuilderApps = async () => {
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const { error, result } = await fetchAllPages(`${ordering.root}/builder/apps`, requestOptions)

      setProductsState({
        ...productsState,
        loading: false,
        error: error ? result : null,
        apps: error ? [] : result.map(app => formatProduct(app))
      })
    } catch (err) {
      setProductsState({
        ...productsState,
        loading: false,
        error: err?.message ?? err
      })
    }
  }

  const getAiModuleAccess = async () => {
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    }
    const response = await fetch(`${ordering.root}/ai/agents?page=1&page_size=1&params=id`, requestOptions)
    if (response.status === 403) return false
    return response.ok ? true : null
  }

  useEffect(() => {
    getBuilderApps()
  }, [])

  useEffect(() => {
    setAiModuleEnabled(null)
    if (user?.level !== 0 || !token) return
    let active = true
    getAiModuleAccess()
      .then(enabled => active && setAiModuleEnabled(enabled))
      .catch(() => {})
    return () => { active = false }
  }, [ordering.root, token, user?.level])

  return (
    UIComponent && (
      <UIComponent
        {...props}
        state={state}
        productsState={productsState}
        getBillingToken={getBillingToken}
        aiModuleEnabled={aiModuleEnabled}
      />
    )
  )
}
