import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

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

  /**
   * Method to update the business from the API
   */
  const handleUpdateSchedule = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
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
        showToast(ToastType.Success, t('SCHEDULE_UPDATED', 'Schedule updated'))
      } else {
        setFormState({
          changes: formState.changes,
          result: {
            error: false,
            result
          },
          loading: false
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: [err.message]
        },
        loading: false
      })
    }
  }

  const handleChangeScheduleState = (scheduleChanges) => {
    setFormState({
      ...formState,
      changes: {
        schedule: scheduleChanges
      }
    })
  }

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            formState={formState}
            handleChangeScheduleState={handleChangeScheduleState}
            handleUpdateSchedule={handleUpdateSchedule}
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
