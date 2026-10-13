import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const BusinessPickupDetails = (props) => {
  const {
    business,
    UIComponent,
    handleUpdateBusinessState
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })

  /**
   * Method to update the business from the API
   */
  const handlePickupStateSave = async () => {
    try {
      setFormState({ ...formState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const { content: { error, result } } = await ordering.businesses(business.id).save(formState.changes, {
        accessToken: session.token
      })

      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          changes: {},
          error: null
        })
        handleUpdateBusinessState(result)
        showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
      } else {
        setFormState({
          ...formState,
          loading: false,
          error
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleChangeForm = (updateChange) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        ...updateChange
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
            handleChangeForm={handleChangeForm}
            handlePickupStateSave={handlePickupStateSave}
          />
        )
      }
    </>
  )
}

BusinessPickupDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
