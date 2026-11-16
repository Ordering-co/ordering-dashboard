import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

// redesign stores 5.3 (; G2-15, G2-16, G2-17): the gallery of Store details › Images and Videos. Adding and deleting
// say how they went, `{ ok: true, result }` or `{ ok: false, error }` (the API's first message, or the network's), so the screens
// show each failure once, where it happened, and can upload several images one after another. Nothing throws. A failed delete is
// no longer silent. Same requests as before: POST /business/:id/gallery with { business_id, type, file | video } and DELETE
// /business/:id/gallery/:gid?business_id=; the shell refreshes its gallery through the same two callbacks.

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean) || null

export const BusinessGallery = (props) => {
  props = { ...defaultProps, ...props }
  const {
    business,
    isVideoGallery,
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [photos, setPhotos] = useState([])
  const [videos, setVideos] = useState([])
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  // The shell's callbacks append to (or filter) the gallery of the render they come from. Several uploads in a row await one
  // another, so each refresh goes through the latest callback: an old one would drop the image added just before (review 1).
  const latest = useRef(props)
  latest.current = props

  const request = async (url, options) => {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
      const content = await response.json()
      if (content?.error) return { ok: false, error: firstMessage(content.result) }
      return { ok: true, result: content?.result }
    } catch (err) {
      return { ok: false, error: err?.message || null }
    }
  }

  /**
   * Adds one item to the gallery: `{ file }` (a data URL) is an image, `{ video }` a video URL.
   * `silent` leaves the success notice to the caller (the images screen reports a batch at once).
   */
  const handleAddGalleryItem = async (item = {}, { silent = false } = {}) => {
    const isVideo = item.video != null
    const body = isVideo
      ? { business_id: business?.id, type: 2, video: item.video }
      : { business_id: business?.id, type: 1, file: item.file }
    setAdding(true)
    const result = await request(`${ordering.root}/business/${business?.id}/gallery`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
    if (mounted.current) setAdding(false)
    if (!result.ok) return result
    if (!silent) {
      showToast(ToastType.Success, isVideo || isVideoGallery
        ? t('GALLERY_VIDEO_ADDED', 'Business gallery video added')
        : t('GALLERY_IMAGE_ADDED', 'Business gallery image added'))
    }
    latest.current.handleSucessAddBusinessGallery?.(result.result)
    return result
  }

  /**
   * Deletes one gallery item.
   */
  const handleDeleteBusinessGallery = async (id) => {
    setDeletingId(id)
    const result = await request(`${ordering.root}/business/${business?.id}/gallery/${id}?business_id=${business?.id}`, {
      method: 'DELETE'
    })
    if (mounted.current) setDeletingId(null)
    if (!result.ok) return result
    showToast(ToastType.Success, t('GALLERY_ITEM_DELETED', 'Business gallery item deleted'))
    latest.current.handleSucessDeleteBusinessGallery?.(id)
    return { ok: true }
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
          businessPhotos={photos || []}
          businessVideos={videos || []}
          adding={adding}
          deletingId={deletingId}
          handleAddGalleryItem={handleAddGalleryItem}
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
