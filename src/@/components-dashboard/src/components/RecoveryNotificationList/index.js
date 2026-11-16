import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { CHANNELS_PAGE_SIZE, fetchAllPages } from '../../utils/recoveryRules'

export const RecoveryNotificationList = (props) => {
  const {
    action,
    UIComponent,
    // redesign RA-B1: the page hears every change as (ruleId, channels) and keeps the list row in step
    onChannelsChange
  } = props

  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ token }] = useSession()

  const [notificationListState, setNotificationListState] = useState({ loading: false, notifications: [], error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  // redesign RA-B1: the latest list, so two changes in a row read what the first one left; the sequence drops stale answers
  const notificationsRef = useRef([])
  const requestSeq = useRef(0)

  const requestHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  })

  /**
   * redesign RA-B1: the one way the list changes. It never mutates the previous items and tells the page.
   * @param {Function} update receives the current list and answers the next one
   */
  const commitNotifications = (update) => {
    const next = update(notificationsRef.current)
    notificationsRef.current = next
    setNotificationListState(prev => ({ ...prev, notifications: next }))
    onChannelsChange && onChannelsChange(action?.id, next)
  }

  /**
   * Method to change multi orders status from API
   */
  const getNotificationList = async () => {
    const seq = ++requestSeq.current
    try {
      setNotificationListState(prev => ({ ...prev, loading: true }))
      const requestOptions = {
        method: 'GET',
        headers: requestHeaders()
      }
      // the API paginates the channels: read every page, not just the first 10
      const content = await fetchAllPages(async (page) => {
        const response = await fetch(`${ordering.root}/event_rules/${action?.id}/channels?page=${page}&page_size=${CHANNELS_PAGE_SIZE}`, requestOptions)
        return response.json()
      })
      // redesign RA-B1: the answer of a rule that is no longer open is dropped
      if (seq !== requestSeq.current) return
      if (!content.error) {
        notificationsRef.current = content.result
        setNotificationListState({
          loading: false,
          notifications: content.result,
          error: null
        })
        // redesign R2-F1 (R1-02): the page hears what was read too (the row of a rule just created has none yet), not only what was written
        onChannelsChange && onChannelsChange(action?.id, content.result)
      } else {
        setNotificationListState(prev => ({
          ...prev,
          loading: false,
          error: content.result
        }))
      }
    } catch (err) {
      if (seq !== requestSeq.current) return
      setNotificationListState(prev => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  /**
   * redesign RA-B1: one request on the channels of this rule; resolves { ok, error, result } and never throws
   * @param {String} method HTTP method
   * @param {Number} channelId Channel to act on (none for the collection)
   * @param {Object} body Payload
   */
  const requestChannel = async (method, channelId, body) => {
    try {
      const requestOptions = {
        method,
        headers: requestHeaders(),
        ...(body ? { body: JSON.stringify(body) } : {})
      }
      const path = channelId === undefined || channelId === null ? '' : `/${channelId}`
      const response = await fetch(`${ordering.root}/event_rules/${action?.id}/channels${path}`, requestOptions)
      const content = await response.json()
      if (!content.error) return { ok: true, error: null, result: content.result }
      return { ok: false, error: content.result, result: null }
    } catch (err) {
      return { ok: false, error: [err.message], result: null }
    }
  }

  /**
   * Method to add the notification in the notification list
   * @param {Object} result notification to add
   */
  const handleAddNotifications = (result) => {
    commitNotifications(notifications => [...notifications, result])
  }

  /**
   * Method to update the notification in the notification list
   * redesign RA-B1: the item is replaced by a copy
   * @param {Object} result notification to update
   */
  const handleUpdateNotifications = (result) => {
    commitNotifications(notifications => notifications.map(_notification => _notification.id === result.id ? { ..._notification, ...result } : _notification))
  }

  /**
   * Method to delete the notification in the notification list
   * @param {Object} result notification to delete
   */
  const handleDeleteNotifications = (result) => {
    commitNotifications(notifications => notifications.filter(_notification => _notification.id !== result.id))
  }

  /**
   * Default fuction to update a notification
   * redesign RA-B1 (M-RA17): resolves { ok, error, channel }; the switch that asked paints the failure
   */
  const handleUpdateClick = async (channelId, changes) => {
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    setActionState({ ...actionState, loading: true })
    const outcome = await requestChannel('PUT', channelId, changes)
    if (outcome.ok) {
      setActionState({ loading: false, error: null })
      handleUpdateNotifications(outcome.result)
      showToast(ToastType.Success, t('NOTIFICATION_SAVED', 'Notification saved'))
      return { ok: true, error: null, channel: outcome.result }
    }
    setActionState({ loading: false, error: outcome.error })
    return { ok: false, error: outcome.error }
  }

  /**
   * redesign RA-B1 (decision 5): POST /event_rules/:id/channels. Duplicated channels are allowed.
   * @param {Object} data { channel, title, body, enabled: true }
   */
  const handleAddChannel = async ({ channel, title, body, enabled = true }) => {
    const outcome = await requestChannel('POST', null, { enabled, channel, title, body })
    if (!outcome.ok) return { ok: false, error: outcome.error }
    handleAddNotifications(outcome.result)
    showToast(ToastType.Success, t('NOTIFICATION_ADDED', 'Notification added'))
    return { ok: true, error: null, channel: outcome.result }
  }

  /**
   * redesign RA-B1 (decision 5): PUT /event_rules/:id/channels/:channelId with the title and the message
   * @param {Number} channelId Channel to save
   * @param {Object} data { title, body }
   */
  const handleSaveChannel = async (channelId, { title, body }) => {
    const outcome = await requestChannel('PUT', channelId, { title, body })
    if (!outcome.ok) return { ok: false, error: outcome.error }
    handleUpdateNotifications(outcome.result)
    showToast(ToastType.Success, t('NOTIFICATION_SAVED', 'Notification saved'))
    return { ok: true, error: null, channel: outcome.result }
  }

  /**
   * redesign RA-B1 (decision 5): DELETE /event_rules/:id/channels/:channelId
   * @param {Number} channelId Channel to delete
   */
  const handleDeleteChannel = async (channelId) => {
    const outcome = await requestChannel('DELETE', channelId)
    if (!outcome.ok) return { ok: false, error: outcome.error }
    handleDeleteNotifications({ id: channelId })
    showToast(ToastType.Success, t('NOTIFICATION_DELETED', 'Notification deleted'))
    return { ok: true, error: null }
  }

  // redesign RA-B1 (M-RA16): the panel's «Retry» asks again; the error stays in notificationListState.error until it answers
  const reload = () => getNotificationList()

  // redesign RA-B1: keyed by the rule id, not by the object: a toggle on the list gives the rule a new object and must not refetch
  useEffect(() => {
    getNotificationList()
  }, [action?.id])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            actionState={actionState}
            notificationListState={notificationListState}
            handleAddNotifications={handleAddNotifications}
            handleUpdateNotifications={handleUpdateNotifications}
            handleDeleteNotifications={handleDeleteNotifications}
            handleUpdateClick={handleUpdateClick}
            handleAddChannel={handleAddChannel}
            handleSaveChannel={handleSaveChannel}
            handleDeleteChannel={handleDeleteChannel}
            reload={reload}
          />
        )
      }
    </>
  )
}

RecoveryNotificationList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Called as (ruleId, channels) after every change of the channels of the rule
   */
  onChannelsChange: PropTypes.func
}
