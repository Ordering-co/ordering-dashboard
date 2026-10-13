import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const WebhookList = (props) => {
  const {
    UIComponent
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [webhookListState, setWebhookListState] = useState({ webhooks: [], loading: false, error: null })
  const [isAddMode, setIsAddMode] = useState(false)
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [changesState, setChangesState] = useState({
    delay: '0'
  })

  /**
   * Method to get the plugins from API
   */
  const getWebhooks = async () => {
    try {
      setWebhookListState({ ...webhookListState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/webhooks`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setWebhookListState({ ...webhookListState, webhooks: content.result, loading: false })
      }
    } catch (err) {
      setWebhookListState({ ...webhookListState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to add new plugin from API
   */
  const handleAddNewWebhook = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changesState)
      }
      const response = await fetch(`${ordering.root}/webhooks`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        const webhooks = [...webhookListState.webhooks, content.result]
        setWebhookListState({ ...webhookListState, webhooks })
        showToast(ToastType.Success, t('WEBHOOK_ADDED', 'Webhook added'))
        setIsAddMode(false)
        setChangesState({ delay: '0' })
      } else {
        setActionState({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to change state for adding new webhook
   * @param {String} key filed
   * @param {String} val value
   */
  const handleChangeAddState = (key, val) => {
    setChangesState({
      ...changesState,
      [key]: val
    })
  }

  /**
   * Method to delete the webhook from API
   * @param {Number} webhookId webhook id to delete
   */
  const handleDeleteWebhook = async (webhookId) => {
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
      const response = await fetch(`${ordering.root}/webhooks/${webhookId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        const webhooks = webhookListState.webhooks.filter(webhook => webhook.id !== webhookId)
        setWebhookListState({ ...webhookListState, webhooks })
        showToast(ToastType.Success, t('WEBHOOK_REMOVED', 'Webhook removed'))
        setIsAddMode(false)
        setChangesState({ delay: '0' })
      } else {
        setActionState({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    getWebhooks()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          webhookListState={webhookListState}
          isAddMode={isAddMode}
          setIsAddMode={setIsAddMode}
          handleAddNewWebhook={handleAddNewWebhook}
          changesState={changesState}
          actionState={actionState}
          handleChangeAddState={handleChangeAddState}
          handleDeleteWebhook={handleDeleteWebhook}
        />
      )}
    </>
  )
}

WebhookList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
