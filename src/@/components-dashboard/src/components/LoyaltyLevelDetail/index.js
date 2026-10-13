import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const LoyaltyLevelDetail = (props) => {
  const {
    UIComponent,
    handleDeleteLevelList,
    handleUpdateLevelList,
    handleAddLevelList,
    level,
    setSelectedLevel,
    onClose
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [formState, setFormState] = useState({ loading: false, error: null, changes: {} })

  /**
   * Update level data
   * @param {EventTarget} evt Related HTML event
   */
  const handleChangeInput = (evt) => {
    const changes = { ...formState?.changes, [evt.target.name]: evt.target.value }
    setFormState({ ...formState, changes })
  }

  /**
   * Update business type image data
   * @param {File} file Image to change business type image
   */
  const handlechangeImage = (file) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          image: reader.result
        }
      })
    }
  }

  /**
   * Update level data
   * @param {object} changes Related HTML event
   */
  const handleChangeItem = (changes) => {
    const currentChanges = { ...formState?.changes, ...changes }
    setFormState({ ...formState, changes: currentChanges })
  }

  /**
   * Default fuction to delete a level
   */
  const handleDeleteLevel = async () => {
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
      const fetchEndpoint = `${ordering.root}/loyalty_levels/${level?.id}`
      const response = await fetch(fetchEndpoint, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('LEVEL_DELETED', 'Level deleted'))
        setFormState({ ...formState, loading: false, error: null, changes: {} })
        handleDeleteLevelList(result)
        onClose && onClose()
      } else {
        setFormState({ ...formState, loading: false, error: result })
      }
    } catch (error) {
      setFormState({ ...formState, loading: false, error: error.message })
    }
  }

  /**
   * Function to update a webhook
   */
  const updateLevel = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const changes = { ...formState?.changes }
      for (const key in changes) {
        if (!changes?.name && changes[key] === '') {
          changes[key] = null
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
      const response = await fetch(`${ordering.root}/loyalty_levels/${level?.id}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setFormState({ changes: {}, loading: false, error: null })
        handleUpdateLevelList(result)
        setSelectedLevel(result)
        showToast(ToastType.Success, t('LEVEL_UPDATED', 'Level updated'))
      } else {
        setFormState({ ...formState, loading: false, error: result })
      }
    } catch (error) {
      setFormState({ ...formState, loading: false, error: error.message })
    }
  }

  /**
   * Default fuction to add a level
   */
  const addLevel = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState.changes)
      }
      const fetchEndpoint = `${ordering.root}/loyalty_levels`
      const response = await fetch(fetchEndpoint, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('LEVEL_ADDED', 'Level added'))
        setFormState({ ...formState, loading: false, error: null, changes: {} })
        handleAddLevelList(result)
        onClose && onClose()
      } else {
        setFormState({ ...formState, loading: false, error: result })
      }
    } catch (error) {
      setFormState({ ...formState, loading: false, error: error.message })
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          handleDeleteLevel={handleDeleteLevel}
          handleChangeInput={handleChangeInput}
          updateLevel={updateLevel}
          addLevel={addLevel}
          handleChangeItem={handleChangeItem}
          handlechangeImage={handlechangeImage}
        />
      )}
    </>
  )
}

LoyaltyLevelDetail.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
