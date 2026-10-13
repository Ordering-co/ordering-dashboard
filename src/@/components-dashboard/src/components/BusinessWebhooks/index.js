import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to manage Busness webhook behavior without UI component
 */
export const BusinessWebhooks = (props) => {
  const {
    UIComponent,
    business,
    handleSuccessUpdate
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })

  /**
   * Default fuction to add a webhook
   */
  const handleUpdateAddClick = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState.changes)
      }
      const response = await fetch(`${ordering.root}/business/${business?.id}/webhooks`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setFormState({
          ...formState,
          changes: {},
          result: content,
          loading: false
        })
        const _webhooks = [...business.webhooks]
        _webhooks.push(content?.result)
        handleSuccessUpdate && handleSuccessUpdate({ ...business, webhooks: [..._webhooks] })
        showToast(ToastType.Success, t('WEBHOOK_ADDED', 'Webhook added'))
      } else {
        setFormState({
          ...formState,
          changes: formState.changes,
          result: content,
          loading: false
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  const handleChangeDelay = (value, webhook) => {
    const changes = {
      ...webhook,
      delay: value
    }
    updateWebhook(changes, webhook?.id)
  }

  /**
   * Function to update a webhook
   */
  const updateWebhook = async (changes, id) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business?.id}/webhooks/${id}`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setFormState({
          ...formState,
          result: content,
          loading: false
        })
        const _webhooks = business?.webhooks?.map(webhook => {
          if (webhook.id === content?.result?.id) {
            return {
              ...webhook,
              delay: content?.result?.delay
            }
          }
          return webhook
        })
        handleSuccessUpdate && handleSuccessUpdate({ ...business, webhooks: [..._webhooks] })
        showToast(ToastType.Success, t('WEBHOOK_UPDATED', 'Webhook updated'))
      } else {
        setFormState({
          ...formState,
          result: content,
          loading: false
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  /**
   * fuction to delete a webhook
   */
  const handleDeleteWebhook = async (id) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business?.id}/webhooks/${id}`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setFormState({
          ...formState,
          loading: false
        })
        const _webhooks = business?.webhooks?.filter(item => item.id !== id)
        const _business = { ...business, webhooks: [..._webhooks] }
        handleSuccessUpdate && handleSuccessUpdate(_business)
        showToast(ToastType.Success, t('WEBHOOK_DELETED', 'Webhook deleted'))
      } else {
        setFormState({
          ...formState,
          result: content,
          loading: false
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  /**
   * Update webhook data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    const currentChanges = {
      [e.target.name]: e.target.value
    }

    setFormState({
      ...formState,
      changes: { ...formState.changes, ...currentChanges }
    })
  }

  /**
   * Update webhook data
   * @param {string} value selected data from select
   * @param {string} name current hook name
   */
  const handleChangeSelect = (value, name) => {
    setFormState({
      ...formState,
      changes: { ...formState.changes, [name]: value }
    })
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessTypeFormState={formState}
          handleChangeInput={handleChangeInput}
          handleChangeSelect={handleChangeSelect}
          hookFormState={formState}
          handleUpdateAddClick={handleUpdateAddClick}
          handleDeleteWebhook={handleDeleteWebhook}
          handleChangeDelay={handleChangeDelay}
        />
      )}
    </>
  )
}

BusinessWebhooks.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Object for a business
   */
  business: PropTypes.object,
  /**
   * Function to set a business state
   */
  handleSuccessUpdate: PropTypes.func
}
