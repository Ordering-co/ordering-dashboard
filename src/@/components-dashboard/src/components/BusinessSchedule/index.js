import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { translateApiMessage } from '../../utils/translateApiMessage'

// The first message of an API error: a string, a list of strings or of { message }.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

export const BusinessSchedule = (props) => {
  const {
    business,
    UIComponent,
    handleSuccessUpdate
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })

  // redesign stores 1.A (G2-28): a schedule that is not saved says why, in the place of the "Loading" toast, and
  // stays pending. Returns `{ ok: true }` or `{ ok: false, error }`.
  const showSaveError = (error) => {
    showToast(ToastType.Error, translateApiMessage(t, firstMessage(error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
  }

  /**
   * Method to update the business from the API
   */
  // redesign stores 5.4: `options.inlineError` is for a screen that paints the failure itself (the store editor's
  // SaveBar): no «Loading» or error toast on top of it. The tutorial has no bar and keeps both.
  // redesign stores: `options.silentSuccess` also drops the «Schedule updated» toast (the SaveBar says «Saved»).
  const handleUpdateSchedule = async (options = {}) => {
    const inline = !!options?.inlineError
    // `silentSuccess`: the caller already says «Saved» itself (the SaveBar); only the success toast is left out, errors stay.
    const silentSuccess = !!options?.silentSuccess
    try {
      if (!inline) showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const changes = { ...formState.changes }
      if (changes?.schedule) {
        changes.schedule = JSON.stringify(changes?.schedule)
      }
      const { content: { error, result } } = await ordering.businesses(business.id).save(changes, {
        accessToken: session.token
      })
      if (!error) {
        setFormState({
          loading: false,
          changes: {},
          result: { error: false }
        })
        handleSuccessUpdate && handleSuccessUpdate(result)
        if (!silentSuccess) showToast(ToastType.Success, t('SCHEDULE_UPDATED', 'Schedule updated'))
        return { ok: true }
      }
      setFormState({
        changes: formState.changes,
        result: {
          error: true,
          result
        },
        loading: false
      })
      if (!inline) showSaveError(result)
      return { ok: false, error: result }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: [err.message]
        },
        loading: false
      })
      if (!inline) showSaveError(err.message)
      return { ok: false, error: [err.message] }
    }
  }

  // (P-3): a week equal to the saved one is not a change (K/Schedule reports it when the user puts the week back).
  const handleChangeScheduleState = (scheduleChanges) => {
    const isSaved = Array.isArray(business?.schedule) && JSON.stringify(scheduleChanges) === JSON.stringify(business.schedule)
    setFormState({
      ...formState,
      changes: isSaved ? {} : { schedule: scheduleChanges }
    })
  }

  // Throws away what was edited and not saved.
  const handleDiscardSchedule = () => setFormState(prev => ({ ...prev, changes: {}, result: { error: false } }))

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            formState={formState}
            handleChangeScheduleState={handleChangeScheduleState}
            handleUpdateSchedule={handleUpdateSchedule}
            handleDiscardSchedule={handleDiscardSchedule}
          />
        )
      }
    </>
  )
}

BusinessSchedule.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
  * Business, this must be contains an object with all business info
  */
  business: PropTypes.object
}
