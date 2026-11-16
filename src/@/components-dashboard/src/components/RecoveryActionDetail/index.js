import React, { useEffect, useRef, useState } from 'react'
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
  // redesign RA-B1 (decision 6): the rule handleCreateRule made in this panel, so a retry only creates the channel
  const createdRuleRef = useRef(null)
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

  // redesign RA-B1: the rule this panel shows (the list row, else the one fetched by `?id=`)
  const currentRuleId = action?.id ?? recoveryActionState.action?.id ?? actionId

  /**
   * Method to delete the recovery action
   * redesign RA-B1 (M-RA6): resolves { ok, error }; an API error leaves loading false with the messages
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
      const response = await fetch(`${ordering.root}/event_rules/${currentRuleId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        handleSuccessDeleteRecoveryAction && handleSuccessDeleteRecoveryAction(currentRuleId)
        showToast(ToastType.Success, t('RECOVERY_ACTION_DELETED', 'Recovery action deleted'))
        props.onClose && props.onClose()
        return { ok: true, error: null }
      }
      setActionState({ loading: false, error: content.result })
      return { ok: false, error: content.result }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Saves only what changed in the rule: PUT /event_rules/:id, arrays and objects encoded like handleUpdateClick
   * redesign RA-B1 (decision 3): resolves { ok, error, rule }; the failure is for the caller to paint
   * @param {Object} changes e.g. { name, description, times: [260] }
   */
  const handleSaveRule = async (changes) => {
    try {
      setActionState({ loading: true, error: null })
      const body = { ...changes }
      for (const key in body) {
        if ((typeof body[key] === 'object' && body[key] !== null) || Array.isArray(body[key])) {
          body[key] = JSON.stringify(body[key])
        }
      }
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      }
      const response = await fetch(`${ordering.root}/event_rules/${currentRuleId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const rule = { ...(recoveryActionState.action ?? action), ...content.result }
        setRecoveryActionState(prev => ({ ...prev, action: { ...(prev.action ?? action), ...content.result } }))
        setActionState({ loading: false, error: null })
        if (handleSuccessUpdateRecoveryAction && Array.isArray(recoveryActionList?.actions)) {
          handleSuccessUpdateRecoveryAction(recoveryActionList.actions.map(_action => _action.id === currentRuleId ? { ..._action, ...content.result } : _action))
        }
        showToast(ToastType.Success, t('RECOVERY_ACTION_SAVED', 'Recovery action saved'))
        return { ok: true, error: null, rule }
      }
      setActionState({ loading: false, error: null })
      return { ok: false, error: content.result, rule: null }
    } catch (err) {
      setActionState({ loading: false, error: null })
      return { ok: false, error: [err.message], rule: null }
    }
  }

  /**
   * Creates a rule on, with its first message (POST /event_rules, then POST /event_rules/:id/channels)
   * redesign RA-B1 (decision 6; M-RA12): once the rule exists in this panel it is remembered, and a second call
   * only retries the channel, never another POST /event_rules.
   * Resolves { ok: true, error: null, rule, channel }, { ok: false, stage: 'rule', error } or { ok: false, stage: 'channel', rule, error }
   * @param {Object} data { rule: { name, description, times: [n] }, channel: { channel, title, body } }
   */
  const handleCreateRule = async ({ rule, channel }) => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
    setActionState({ loading: true, error: null })
    let created = createdRuleRef.current
    if (!created) {
      try {
        const times = rule?.times === undefined ? undefined : (Array.isArray(rule.times) ? rule.times : [rule.times])
        const response = await fetch(`${ordering.root}/event_rules`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            enabled: true,
            launch_type: 'times',
            type: 'abandoned_cart',
            name: rule?.name,
            description: rule?.description,
            times
          })
        })
        const content = await response.json()
        if (content.error) {
          setActionState({ loading: false, error: null })
          return { ok: false, stage: 'rule', error: content.result }
        }
        created = content.result
        createdRuleRef.current = created
        handleSuccessAddRecoveryAction && handleSuccessAddRecoveryAction(created)
      } catch (err) {
        setActionState({ loading: false, error: null })
        return { ok: false, stage: 'rule', error: [err.message] }
      }
    }
    try {
      const response = await fetch(`${ordering.root}/event_rules/${created.id}/channels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled: true, channel: channel?.channel, title: channel?.title, body: channel?.body })
      })
      const content = await response.json()
      setActionState({ loading: false, error: null })
      if (content.error) return { ok: false, stage: 'channel', rule: created, error: content.result }
      showToast(ToastType.Success, t('RECOVERY_ACTION_ADDED', 'Recovery action added'))
      return { ok: true, error: null, rule: created, channel: content.result }
    } catch (err) {
      setActionState({ loading: false, error: null })
      return { ok: false, stage: 'channel', rule: created, error: [err.message] }
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
      // redesign RA-B1 (M-RA15): a failed load stops loading and says why
      setRecoveryActionState({
        ...recoveryActionState,
        loading: false,
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
            handleSaveRule={handleSaveRule}
            handleCreateRule={handleCreateRule}
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
