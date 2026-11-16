import React, { useEffect, useRef, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { isNetworkFailure } from '../../utils/networkFailure'

// redesign UC-B1 (B1-4): the error of an outcome is the API result when it is an array of strings, else null; never an object
const outcomeError = (result) => Array.isArray(result) && result.every(item => typeof item === 'string') ? result : null

export const UserDetails = (props) => {
  props = { ...defaultProps, ...props }
  const {
    userId,
    propsToFetch,
    UIComponent,
    handleSuccessUpdate,
    handleSuccessDeleteUser
  } = props

  const [ordering, { configurations }] = useApi()
  const [session] = useSession()
  const [, { showToast, hideToast }] = useToast()
  const [, t] = useLanguage()
  const accessToken = session.token
  const [scheduleState, setScheduleState] = useState({ loading: false, error: false, change: [] })
  const [userState, setUserState] = useState({ user: null, loading: false, error: null })
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null })

  /**
   * Method to get user from API
   */
  const getUser = async () => {
    try {
      setUserState({
        ...userState,
        loading: true
      })
      let fetchEndpoint = null
      let content = {}

      if (session.user?.level !== 2) {
        fetchEndpoint = ordering.setAccessToken(session.token).users(userId).select(propsToFetch)
        const response = await fetchEndpoint.get()
        content = response.content
      } else {
        const requestOptions = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`
          }
        }
        fetchEndpoint = `${ordering.root}/professionals/${userId}`
        const response = await fetch(fetchEndpoint, requestOptions)
        content = await response.json()
      }
      const { result } = content

      const user = Array.isArray(result) ? null : result
      setUserState({
        ...userState,
        loading: false,
        user
      })
    } catch (err) {
      setUserState({
        ...userState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleScheduleState = (scheduleChanges) => {
    scheduleChanges?.length > 0 && setScheduleState({
      ...scheduleState,
      change: scheduleChanges
    })
  }

  /**
   * Method to delete users from API
   */
  const handleDeleteUser = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ loading: true, error: null })
      const { content } = await ordering.setAccessToken(session.token).users(userId).delete()
      setActionStatus({
        loading: false,
        error: content.error ? content.result : null
      })
      if (!content.error) {
        showToast(ToastType.Success, t('USER_DELETED', 'User deleted'))
        handleSuccessDeleteUser && handleSuccessDeleteUser(userState.user)
        props.onClose && props.onClose()
      }
      // redesign UC-B1 (B1-4): the caller learns the outcome
      return content.error ? { ok: false, error: outcomeError(content.result) } : { ok: true, error: null }
    } catch (err) {
      setActionStatus({ loading: false, error: [err.message] })
      return { ok: false, error: null }
    }
  }

  const handleScheduleUpdateUser = async () => {
    try {
      if (scheduleState?.change?.length > 0 && userState?.user?.id) {
        showToast(ToastType.Info, t('LOADING', 'Loading'))
        setScheduleState({ ...scheduleState, loading: true })

        const _change = { schedule: JSON.stringify(scheduleState?.change) }
        let content = {}
        if (session.user?.level !== 2) {
          const response = await ordering.users(userState?.user?.id).save(_change, {
            accessToken
          })
          content = response.content
        } else {
          const requestOptions = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.token}`
            },
            body: JSON.stringify(_change)
          }
          const response = await fetch(`${ordering.root}/professionals/${userState?.user?.id}`, requestOptions)
          content = await response.json()
        }

        const { result, error } = content

        if (!error) {
          setScheduleState({ ...scheduleState, change: [], loading: false, error: false })
          setUserState({
            ...userState,
            error: false,
            user: Object.assign(userState.user, result)
          })
          showToast(ToastType.Success, t('SCHEDULE_UPDATED', 'Schedule Updated'))
        } else {
          // redesign bugs-d row 60 (M-DL17): a failed save keeps the pending edits, so the panel stays dirty and the leave guard sees them
          setScheduleState({ ...scheduleState, change: scheduleState.change, loading: false, error: true })
          setUserState({
            ...userState,
            error: true
          })
          const apiMessage = typeof result === 'string' ? result : outcomeError(result)?.join(', ')
          showToast(ToastType.Error, apiMessage || t('SCHEDULE_UPDATED_FAILED', 'Schedule Update Failed'))
        }
      } else {
        showToast(ToastType.Info, t('NOT_CHANGED', 'Not Changed'))
      }
    } catch (err) {
      setScheduleState({ ...scheduleState, change: scheduleState.change, loading: false, error: true })
      setUserState({
        ...userState,
        loading: false,
        error: err?.message
      })
      showToast(ToastType.Error, err?.message)
    }
  }
  /**
   * Method to connect with Google calendar
   */
  const handleGoogleCalendarSync = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ loading: true, error: null })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      let response = null
      if (session.user?.level !== 2) {
        response = await fetch(`${ordering.root}/users/${userState.user?.id}/google/calendar/sync`, requestOptions)
      } else {
        response = await fetch(`${ordering.root}/professionals/${userState.user?.id}/google/calendar/sync`, requestOptions)
      }
      const content = await response.json()
      if (!content.error) {
        setActionStatus({ loading: false, error: null })
        showToast(ToastType.Success, t('YOUR_CALENDAR_WILL_BE_SYNCHRONIZED', 'Your calendar will be synchronized'))
      } else {
        hideToast?.() // a failure takes «Loading» down; the panel says why
        setActionStatus({ loading: false, error: content.result })
      }
    } catch (err) {
      // a request that never reached the server says it in words, not the browser's «Failed to fetch»
      hideToast?.()
      const message = isNetworkFailure(err?.message) ? t('PROFESSIONALS_CALENDAR_SYNC_ERROR', "We couldn't sync the calendar. Try again.") : err?.message
      setActionStatus({ loading: false, error: [message] })
    }
  }

  // redesign (PF-10): refs to the active link attempt (message listener and polling interval)
  const googleLinkListenerRef = useRef(null)
  const googleLinkIntervalRef = useRef(null)
  const removeGoogleLinkListener = () => {
    if (googleLinkListenerRef.current) {
      window.removeEventListener('message', googleLinkListenerRef.current)
      googleLinkListenerRef.current = null
    }
  }
  const clearGoogleLinkInterval = () => {
    if (googleLinkIntervalRef.current) {
      clearInterval(googleLinkIntervalRef.current)
      googleLinkIntervalRef.current = null
    }
  }

  // the link completes only when this session sends the code that the Google window handed to it
  const confirmGoogleLink = async ({ code, state }) => {
    try {
      const response = await fetch(`${ordering.root}/users/${userState.user?.id}/google/permissions/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({ code, state })
      })
      const content = await response.json()
      const message = outcomeError(content.result)?.join(', ')
      if (content.error) return { ok: false, message: message || t('NETWORK_ERROR', 'Network error, please reload the page') }
      return { ok: true, message }
    } catch (err) {
      return { ok: false, message: (isNetworkFailure(err?.message) ? null : err?.message) || t('NETWORK_ERROR', 'Network error, please reload the page') }
    }
  }

  /**
   * Method to link the Google account to the professional account
   */
  const handleGoogleAccountLink = async () => {
    // the window opens blank during the click (or it gets blocked) and goes to Google once the API answers (api-core
    // #3619); the session token goes in a header, never in a URL
    const connect = window.open('', '_blank', 'directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,clearcache=yes')
    // redesign (PF-10): a blocked popup creates no interval nor listener
    if (!connect) return { ok: false, reason: 'popup-blocked' }
    // set only when the API answered that this link waits for this session to confirm it
    let confirmMode = false
    let authUrl = null
    let error = null
    try {
      const response = await fetch(`${ordering.root}/users/${userState.user?.id}/google/permissions/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        // the callback saves nothing until this session confirms the code
        body: JSON.stringify({ name: 'calendar', confirm: true })
      })
      const content = await response.json()
      if (content.error) error = outcomeError(content.result)?.join(', ')
      else authUrl = content.result?.auth_url
      // an API without the confirm of ignores it and answers no confirm: the callback links as before
      confirmMode = content.result?.confirm === true
    } catch (err) {
      error = isNetworkFailure(err?.message) ? null : err?.message
    }
    if (!authUrl) {
      connect.close()
      showToast(ToastType.Error, error || t('NETWORK_ERROR', 'Network error, please reload the page'))
      return { ok: false, reason: 'request-failed' }
    }
    connect.location.href = authUrl
    // redesign (PF-10): one message listener per attempt
    removeGoogleLinkListener()
    clearGoogleLinkInterval()
    const interval = setInterval(function () {
      if (!connect.closed) {
        connect.postMessage('data', ordering.url)
      } else {
        clearInterval(interval)
        googleLinkIntervalRef.current = null
        removeGoogleLinkListener() // redesign (PF-10)
      }
    }, 200)
    googleLinkIntervalRef.current = interval
    let timeout = null
    // in confirm mode only the window this click opened, at the exact origin of the API, is heard
    const apiOrigin = confirmMode ? new URL(ordering.root).origin : null
    const onMessage = function (e) {
      const heard = confirmMode
        ? e.source === connect && e.origin === apiOrigin
        : e.origin.indexOf(`.${configurations?.subdomain}`) !== -1
      if (!heard) {
        return
      }
      clearInterval(interval)
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(async function () {
        // redesign (PF-10): the window may already be closed
        if (connect && !connect.closed) connect.postMessage('close', ordering.url)
        removeGoogleLinkListener() // redesign (PF-10)
        // in confirm mode a message without the code is the callback's error (an invalid or expired link)
        const outcome = !confirmMode
          ? { ok: true, message: e.data.message }
          : e.data?.confirm
            ? await confirmGoogleLink(e.data)
            : { ok: false, message: e.data?.message || t('NETWORK_ERROR', 'Network error, please reload the page') }
        showToast(outcome.ok ? ToastType.Success : ToastType.Error, outcome.message)
      }, 1000)
    }
    googleLinkListenerRef.current = onMessage
    window.addEventListener('message', onMessage)
    return { ok: true }
  }

  // redesign (PF-10): clean the pending link attempt on unmount
  useEffect(() => () => {
    removeGoogleLinkListener()
    clearGoogleLinkInterval()
  }, [])

  useEffect(() => {
    if (props.user) {
      setUserState({
        ...userState,
        user: props.user
      })
    } else {
      getUser()
    }
  }, [userId])

  const handleSuccessUserUpdate = (updatedUser) => {
    setUserState({
      ...userState,
      user: Object.assign(userState.user, updatedUser)
    })
    handleSuccessUpdate && handleSuccessUpdate(updatedUser)
  }

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            userState={userState}
            actionStatus={actionStatus}
            handleDeleteUser={handleDeleteUser}
            handleSuccessUserUpdate={handleSuccessUserUpdate}
            handleGoogleCalendarSync={handleGoogleCalendarSync}
            scheduleState={scheduleState}
            handleScheduleState={handleScheduleState}
            handleScheduleUpdateUser={handleScheduleUpdateUser}
            handleGoogleAccountLink={handleGoogleAccountLink}
          />
        )
      }
    </>
  )
}

UserDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string),
  /**
  * This must be contains userId to fetch
  */
  userId: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string
  ]),
  /**
  * User, this must be contains an object with all user info
  */
  user: PropTypes.object
}

const defaultProps = {
  propsToFetch: [
    'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'country_phone_code', 'city_id', 'city', 'address', 'external_id',
    'addresses', 'address_notes', 'driver_zone_restriction', 'mono_session', 'dropdown_option_id', 'dropdown_option', 'location', 'loyalty_level',
    'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname', 'phone_verified', 'email_verified', 'schedule', 'timezone', 'max_days_in_future',
    'occupation_id', 'occupation', 'session', 'push_tokens', 'businesses_agent', 'settings'
  ]
}
