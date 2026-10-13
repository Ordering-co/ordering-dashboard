import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const BusinessGallery = (props) => {
  props = { ...defaultProps, ...props }
  const {
    business,
    isVideoGallery,
    isImageGallery,
    UIComponent,
    handleSucessAddBusinessGallery,
    handleSucessDeleteBusinessGallery
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })

  const [photos, setPhotos] = useState([])
  const [videos, setVideos] = useState([])

  /**
   * Clean formState
   */
  const cleanFormState = (values) => setFormState({ ...formState, ...values })

  /**
   * Update business photo data
   * @param {File} file Image to change business photo
   */
  const handlechangeImage = (file) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          business_id: business.id,
          file: reader.result,
          type: 1
        }
      })
    }
  }

  /**
   * Update business video path
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeBusinessVideo = (e) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        business_id: business?.id,
        type: 2,
        video: e.target.value
      }
    })
  }

  /**
   * Method to update the business
   */
  const handleUpdateBusinessGallery = async () => {
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

      const response = await fetch(`${ordering.root}/business/${business.id}/gallery`, requestOptions)
      const content = await response.json()

      setFormState({
        ...formState,
        changes: content.error ? formState.changes : {},
        result: content,
        loading: false
      })

      if (!content.error) {
        if (isVideoGallery) {
          showToast(ToastType.Success, t('GALLERY_VIDEO_ADDED'))
        }
        if (isImageGallery) {
          showToast(ToastType.Success, t('GALLERY_IMAGE_ADDED'))
        }
        if (handleSucessAddBusinessGallery) {
          handleSucessAddBusinessGallery(content.result)
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
   * Method to delete the business gallery image
   */
  const handleDeleteBusinessGallery = async (id) => {
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

      const response = await fetch(`${ordering.root}/business/${business.id}/gallery/${id}?business_id=${business.id}`, requestOptions)
      const content = await response.json()

      setFormState({
        ...formState,
        loading: false
      })

      if (!content.error) {
        showToast(ToastType.Success, t('GALLERY_ITEM_DELETED'))
        handleSucessDeleteBusinessGallery && handleSucessDeleteBusinessGallery(id)
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

  useEffect(() => {
    const photos = business?.gallery?.filter(item => item.file)
    const videos = business?.gallery?.filter(item => item.video)
    setPhotos(photos)
    setVideos(videos)
  }, [business])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessSchedule={business?.schedule || []}
          businessPhotos={photos || []}
          businessVideos={videos || []}
          formState={formState}
          handlechangeImage={handlechangeImage}
          cleanFormState={cleanFormState}
          handleChangeBusinessVideo={handleChangeBusinessVideo}
          handleUpdateBusinessGallery={handleUpdateBusinessGallery}
          handleDeleteBusinessGallery={handleDeleteBusinessGallery}
        />
      )}
    </>
  )
}

BusinessGallery.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Business, object with all data to render
   */
  business: PropTypes.object,
  /**
   * enable/disable business option of accordeon
   */
  optionToShow: PropTypes.string
}

const defaultProps = {
  business: {}
}
