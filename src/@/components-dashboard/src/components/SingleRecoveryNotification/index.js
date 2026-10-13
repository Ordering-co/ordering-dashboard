import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const SingleRecoveryNotification = (props) => {
  const {
    action,
    UIComponent,
    handleAddNotifications,
    handleUpdateNotifications,
    handleDeleteNotifications,
    onClose
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  const [, { showToast }] = useToast()

  /**
   * Clean formState
   */
  const cleanFormState = () => {
    setFormState({ ...formState, changes: {} })
  }

  /**
   * Update channel
   * @param {EventTarget} evt Related HTML event
   */
  const handleChangeInput = (evt) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [evt.target.name]: evt.target.value
      }
    })
  }

  /**
   * Update parameter data
   * @param {changes} changes parameters to change
   */
  const handleChangeItems = (changes) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        ...changes
      }
    })
  }

  /**
   * Method to update channel field
   * @param {String} name params key of channel
   * @param {String} val params key of channel
   */
  const handleChangeSelect = (name, val) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [name]: val
      }
    })
  }

  /**
   * Default fuction to add a channel
   */
  const handleClickAddBtn = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const changes = { ...formState?.changes, enabled: true }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/event_rules/${action?.id}/channels`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setFormState({
          ...formState,
          changes: {},
          loading: false,
          error: null
        })
        handleAddNotifications(content.result)
        showToast(ToastType.Success, t('NOTIFICATION_ADDED', 'Notification added'))
        onClose && onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Default fuction to update a channel
   */
  const handleUpdateClick = async (channelId, changes) => {
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

      const response = await fetch(`${ordering.root}/event_rules/${action?.id}/channels/${channelId}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setFormState({
          ...formState,
          changes: {},
          loading: false,
          error: null
        })
        handleUpdateNotifications && handleUpdateNotifications(content.result)
        cleanFormState()
        showToast(ToastType.Success, t('NOTIFICATION_SAVED', 'Notification saved'))
        onClose && onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Default fuction to delete a channel
   */
  const handleDeleteClick = async (channelId) => {
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

      const response = await fetch(`${ordering.root}/event_rules/${action?.id}/channels/${channelId}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setFormState({
          ...formState,
          changes: {},
          loading: false,
          error: null
        })
        handleDeleteNotifications && handleDeleteNotifications(content.result)
        cleanFormState()
        showToast(ToastType.Success, t('NOTIFICATION_DELETED', 'Notification deleted'))
        onClose && onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err.message
      })
    }
  }

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            formState={formState}
            cleanFormState={cleanFormState}
            handleChangeInput={handleChangeInput}
            handleChangeSelect={handleChangeSelect}
            handleUpdateClick={handleUpdateClick}
            handleDeleteClick={handleDeleteClick}
            handleClickAddBtn={handleClickAddBtn}
            handleChangeItems={handleChangeItems}
          />
        )
      }
    </>
  )
}

SingleRecoveryNotification.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
