import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const RecoveryActionDetail = (props) => {
  const {
    action,
    actionId,
    recoveryActionList,
    UIComponent,
    handleSuccessUpdateRecoveryAction,
    handleSuccessAddRecoveryAction,
    handleSuccessDeleteRecoveryAction
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()

  const [recoveryActionState, setRecoveryActionState] = useState({ action, loading: !action, error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {} })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [isAddMode, setIsAddMode] = useState(false)
  const [cartRuleId, setCartRuleId] = useState(null)
  /**
   * Clean formState
   */
  const cleanFormState = () => setFormState({ loading: false, changes: {} })

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    setFormState({
      ...formState,
      changes: { ...formState.changes, [e.target.name]: e.target.value }
    })
  }

  /**
   * Update parameter data
   * @param {changes} changes parameters to change
   */
  const handleChangeItem = (changes) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        ...changes
      }
    })
  }

  /**
   * Method to remove the key of changes
   * @param {String} key
   */
  const handleRemoveKey = (key) => {
    const _changes = { ...formState?.changes }
    delete _changes[key]
    setFormState({
      ...formState,
      changes: _changes
    })
  }

  /**
   * Default fuction for recovery action workflow
   */
  const handleUpdateClick = async (channelBody) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const changes = { ...formState?.changes }
      for (const key in changes) {
        if ((typeof changes[key] === 'object' && changes[key] !== null) || Array.isArray(changes[key])) {
          changes[key] = JSON.stringify(changes[key])
        }
      }
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/event_rules/${cartRuleId || action.id}`, requestOptions)
      const content = await response.json()

      const updatedActions = recoveryActionList?.actions.filter(_action => {
        if (_action.id === action.id) {
          Object.assign(_action, content.result)
        }
        return true
      })

      if (!content.error) {
        if (cartRuleId) {
          await addChannel(channelBody, content)
          if (handleSuccessUpdateRecoveryAction) {
            handleSuccessUpdateRecoveryAction(updatedActions)
          }
          return
        }
        setRecoveryActionState({
          ...recoveryActionState,
          action: content.result
        })
        setActionState({ loading: false, error: null })
        if (handleSuccessUpdateRecoveryAction && !cartRuleId) {
          handleSuccessUpdateRecoveryAction(updatedActions)
        }
        cleanFormState()
        showToast(ToastType.Success, t('RECOVERY_ACTION_SAVED', 'Recovery action saved'))
      } else {
        setActionState({
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to add new recovery action from API
   */
  const handleAddRecoveryAction = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const changes = { ...formState?.changes }
      const channelBody = {
        enabled: true,
        channel: formState?.changes?.channel,
        body: formState?.changes?.body,
        title: formState?.changes?.title
      }
      delete changes?.channel
      delete changes?.body
      delete changes?.title
      if (cartRuleId) {
        channelBody.id = cartRuleId
        handleUpdateClick(channelBody)
        return
      }

      const eventRuleRequestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const eventRuleResponse = await fetch(`${ordering.root}/event_rules`, eventRuleRequestOptions)
      const eventContent = await eventRuleResponse.json()

      if (!eventContent.error) {
        setCartRuleId(eventContent?.result?.id)
        await addChannel(channelBody, eventContent)
        if (!cartRuleId) {
          handleSuccessAddRecoveryAction && handleSuccessAddRecoveryAction(eventContent.result)
        }
      } else {
        setActionState({
          loading: false,
          error: eventContent.result
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: err.message
      })
    }
  }

  const addChannel = async (channelBody, eventContent) => {
    try {
      const channelRequestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(channelBody)
      }
      const response = await fetch(`${ordering.root}/event_rules/${eventContent?.result?.id}/channels`, channelRequestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({ ...formState, changes: {} })
        setActionState({ loading: false, error: null })
        showToast(ToastType.Success, t('RECOVERY_ACTION_ADDED', 'Recovery action added'))
        props.onClose && props.onClose()
      } else {
        setActionState({
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to delete the recovery action
   */
  const handleDeleteRecoveryAction = async () => {
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
      const response = await fetch(`${ordering.root}/event_rules/${action.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        handleSuccessDeleteRecoveryAction && handleSuccessDeleteRecoveryAction(action.id)
        showToast(ToastType.Success, t('RECOVERY_ACTION_DELETED', 'Recovery action deleted'))
        props.onClose && props.onClose()
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get the recover action from API
   */
  const getRecoveryAction = async () => {
    try {
      setRecoveryActionState({
        ...recoveryActionState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/event_rules/${actionId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setRecoveryActionState({
          loading: false,
          action: content.result,
          error: null
        })
      } else {
        setRecoveryActionState({
          ...recoveryActionState,
          loading: false,
          error: content.result
        })
      }
    } catch (error) {
      setRecoveryActionState({
        ...recoveryActionState,
        loading: true,
        error: [error.message]
      })
    }
  }

  useEffect(() => {
    if (Object.keys(action || {}).length === 0) {
      if (actionId) {
        setIsAddMode(false)
        cleanFormState()
        getRecoveryAction()
      } else {
        setIsAddMode(true)
        setFormState({
          ...formState,
          changes: {
            enabled: true,
            launch_type: 'times',
            name: '',
            type: 'abandoned_cart'
          }
        })
      }
    } else {
      setIsAddMode(false)
      cleanFormState()
    }
    setRecoveryActionState({ ...recoveryActionState, action })
  }, [action, actionId])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            isAddMode={isAddMode}
            recoveryActionState={recoveryActionState}
            formState={formState}
            actionState={actionState}
            handleChangeItem={handleChangeItem}
            handleChangeInput={handleChangeInput}
            handleAddRecoveryAction={handleAddRecoveryAction}
            handleDeleteRecoveryAction={handleDeleteRecoveryAction}
            handleUpdateClick={handleUpdateClick}
            handleRemoveKey={handleRemoveKey}
          />
        )
      }
    </>
  )
}

RecoveryActionDetail.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
