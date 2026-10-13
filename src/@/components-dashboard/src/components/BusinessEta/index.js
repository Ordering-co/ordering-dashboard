import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const BusinessEta = (props) => {
  const {
    business,
    UIComponent,
    handleUpdateBusinessState
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [selectedOption, setSelectedOption] = useState('status')
  const [formState, setFormState] = useState({ loading: false, changes: business?.eta_status_times || {}, error: null })

  const handleChangeInput = (e) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [e.target.name]: Number(e.target.value)
      }
    })
  }

  const hanldeUpdateBusinessEtaTimes = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ eta_status_times: JSON.stringify(formState.changes) })
      }

      const response = await fetch(`${ordering.root}/business/${business.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({
          ...formState,
          loading: false,
          error: null
        })
        const _business = { ...business, eta_status_times: formState.changes }
        handleUpdateBusinessState(_business)
        showToast(ToastType.Success, t('SAVED', 'Saved'))
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (error) {
      setFormState({
        ...formState,
        loading: false,
        error: [error.message]
      })
    }
  }

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            selectedOption={selectedOption}
            setSelectedOption={setSelectedOption}
            formState={formState}
            handleChangeInput={handleChangeInput}
            hanldeUpdateBusinessEtaTimes={hanldeUpdateBusinessEtaTimes}
          />
        )
      }
    </>
  )
}

BusinessEta.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
