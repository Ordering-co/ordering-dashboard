import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const UploadAudio = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [formState, setFormState] = useState({ loading: true, changes: {}, error: null })

  /**
   * Function to add custom sounds from API
   */
  const handleUploadAudio = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const payload = {
        type: 2,
        source: formState?.changes?.file ?? formState?.changes?.url
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
      const response = await fetch(`${ordering.root}/files`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          error: null
        })
        showToast(ToastType.Success, t('YOUR_AUDIO_FILE_UPLOADED', 'Your audio file has been uploaded successfully'))
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: result
        })
        showToast(ToastType.Error, result)
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
      showToast(ToastType.Error, err.message)
    }
  }

  /**
   * Function to get custom sounds from API
   */
  const getAudioFiles = async () => {
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/files`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const file = result?.find(item => item?.type === 2 && item?.owner_id === user.id)
        const changes = {}
        if (file) {
          if (file.source.includes('http')) changes.url = file.source
          else changes.file = file.source
        }
        setFormState({
          ...formState,
          loading: false,
          error: null,
          changes
        })
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: result
        })
        showToast(ToastType.Error, result)
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const changeFormState = (changes) => {
    setFormState({
      ...formState,
      changes: {
        ...formState?.changes,
        ...changes
      }
    })
  }

  useEffect(() => {
    getAudioFiles()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          handleUploadAudio={handleUploadAudio}
          formState={formState}
          changeFormState={changeFormState}
        />
      )}
    </>
  )
}

UploadAudio.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
