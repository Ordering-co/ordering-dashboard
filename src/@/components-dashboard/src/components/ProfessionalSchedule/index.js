import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

/**
 * Component to manage ProfessionalSchedule behavior without UI component
 */
export const ProfessionalSchedule = (props) => {
  const {
    UIComponent,
    user,
    handleSuccessUpdate
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })

  /**
 * Default fuction for user profile workflow
 */
  const handleUpdateClick = async (changes) => {
    try {
      setFormState({ ...formState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      let content = {}
      if (changes) {
        formState.changes = { ...formState.changes, ...changes }
      }
      if (session.user?.level !== 2) {
        const response = await ordering.users(user?.id).save(formState.changes)
        content = response.content
      } else {
        const changes = { ...formState.changes }
        for (const key in changes) {
          if ((typeof changes[key] === 'object' && changes[key] !== null) || Array.isArray(changes[key])) {
            changes[key] = JSON.stringify(changes[key])
          }
        }
        const requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`
          },
          body: JSON.stringify(changes)
        }
        const response = await fetch(`${ordering.root}/professionals/${user?.id}`, requestOptions)
        content = await response.json()
      }
      const { result, error } = content

      setFormState({
        ...formState,
        changes: error ? formState.changes : {},
        result,
        loading: false
      })

      if (!error) {
        showToast(ToastType.Success, t('SCHEDULE_UPDATED', 'Schedule updated'))
        if (handleSuccessUpdate) {
          handleSuccessUpdate(result)
        }
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e, isMany) => {
    let currentChanges = {}
    if (isMany) {
      Object.values(e).map(obj => {
        currentChanges = {
          ...currentChanges,
          [obj.name]: obj.value
        }
      })
    } else {
      currentChanges = {
        [e.target.name]: e.target.value
      }
    }

    setFormState({
      ...formState,
      changes: { ...formState.changes, ...currentChanges }
    })
  }

  /**
 * Update credential data
 */
  const handleChangeItem = (changes) => {
    const currentChanges = { ...formState.changes, ...changes }

    setFormState({
      ...formState,
      changes: currentChanges
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

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          handleChangeInput={handleChangeInput}
          handleChangeItem={handleChangeItem}
          handleRemoveKey={handleRemoveKey}
          handleUpdateClick={handleUpdateClick}
        />
      )}
    </>
  )
}

ProfessionalSchedule.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
