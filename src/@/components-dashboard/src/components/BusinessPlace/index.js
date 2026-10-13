import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const BusinessPlace = (props) => {
  const {
    UIComponent,
    place,
    placeGroup,
    businessId,
    handleSuccessAddPlace,
    handleSuccessUpdatePlace,
    handleSuccessDeletePlace,
    handleUpdateSelectedPlace
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()

  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })

  const handleChangeInput = (e) => {
    const currentChanges = { ...formState?.changes, [e.target.name]: e.target.value }
    setFormState({
      ...formState,
      changes: currentChanges
    })
  }

  /**
   * Method to add new place from API
   */
  const handleAddPlace = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })
      const changes = { ...formState?.changes, place_group_id: placeGroup?.id }

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/business/${businessId}/places`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({ ...formState, loading: false, error: null })
        handleSuccessAddPlace && handleSuccessAddPlace({ ...content.result, enabled: true })
        showToast(ToastType.Success, t('OPTION_ADDED', 'Option added'))
        props.onClose && props.onClose()
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
   * Function to update place data
   */
  const handleUpdatePlace = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState?.changes)
      }

      const response = await fetch(`${ordering.root}/business/${businessId}/places/${place?.id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setFormState({ ...formState, loading: false, error: null, changes: {} })
        handleUpdateSelectedPlace && handleUpdateSelectedPlace(content.result)
        handleSuccessUpdatePlace && handleSuccessUpdatePlace(content.result)
        showToast(ToastType.Success, t('OPTION_SAVED', 'Option saved'))
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
   * Method to delete a place
   */
  const handleDeletePlace = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/places/${place?.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        handleSuccessDeletePlace && handleSuccessDeletePlace(place?.id)
        showToast(ToastType.Success, t('OPTION_DELETED', 'Option deleted'))
        setFormState({ ...formState, loading: false, error: null })
        props.onClose && props.onClose()
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

  useEffect(() => {
    setFormState({
      ...formState,
      changes: {}
    })
  }, [place?.id])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            formState={formState}
            handleChangeInput={handleChangeInput}
            handleAddPlace={handleAddPlace}
            handleUpdatePlace={handleUpdatePlace}
            handleDeletePlace={handleDeletePlace}
          />
        )
      }
    </>
  )
}

BusinessPlace.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
