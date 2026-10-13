import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const PaymentOptionStripeLink = (props) => {
  const {
    UIComponent,
    business,
    handleSuccessUpdate
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [configsState, setConfigsState] = useState({ configs: business?.configs || [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  const getConfigs = async () => {
    try {
      setConfigsState({ ...configsState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/configs`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setConfigsState({
          ...configsState,
          loading: false,
          configs: content.result
        })
      } else {
        setConfigsState({ ...configsState, loading: false, error: content.result })
      }
    } catch (err) {
      setConfigsState({
        ...configsState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleUpdateConfigs = async (configId, params) => {
    try {
      setActionState({ ...actionState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(params)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/configs/${configId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ loading: false, error: null })
        const configs = configsState.configs.map(wallet => {
          if (wallet.id === content.result?.id) return content.result
          return wallet
        })
        setConfigsState({ ...configsState, configs })
        handleSuccessUpdate && handleSuccessUpdate({ ...business, configs })
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      } else {
        setActionState({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
    }
  }

  useEffect(() => {
    if (business?.configs) return
    getConfigs()
  }, [business?.configs])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            configsState={configsState}
            actionState={actionState}
            handleUpdateConfigs={handleUpdateConfigs}
          />
        )
      }
    </>
  )
}

PaymentOptionStripeLink.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
