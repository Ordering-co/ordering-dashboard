import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const ApiKeysList = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ user, token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [apiKeysList, setApiKeysList] = useState({ keys: [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Method to get the Api keys from API
   */
  const getApiKeys = async () => {
    try {
      setApiKeysList({ ...apiKeysList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/users/${user?.id}/keys`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setApiKeysList({ ...apiKeysList, keys: content.result, loading: false })
      }
    } catch (err) {
      setApiKeysList({ ...apiKeysList, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to delete the Api key from API
   * @param {Number} keyId key id to delete
   */
  const handleDeleteApiKey = async (keyId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/users/${user?.id}/keys/${keyId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        const apiKeys = apiKeysList.keys.filter(key => key.id !== keyId)
        setApiKeysList({ ...apiKeysList, keys: apiKeys })
        showToast(ToastType.Success, t('APIKEY_REMOVED', 'API key removed'))
      } else {
        setActionState({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to add new Api key from API.
   */
  const handleAddApiKey = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/users/${user?.id}/keys`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        const apiKeys = [...apiKeysList.keys, content.result]
        setApiKeysList({ ...apiKeysList, keys: apiKeys })
        showToast(ToastType.Success, t('APIKEY_ADDED', 'API key added'))
      } else {
        setActionState({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    if (user?.level === 0 || user?.level === 2) {
      getApiKeys()
    }
  }, [user])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          apiKeysList={apiKeysList}
          actionState={actionState}
          handleDeleteApiKey={handleDeleteApiKey}
          handleAddApiKey={handleAddApiKey}
        />
      )}
    </>
  )
}

ApiKeysList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
