import React, { useEffect, useRef, useState } from 'react'
import {
  useLanguage,
  useUtils,
  BusinessGallery as BusinessGalleryController
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { bytesConverter } from '../../../utils'
import { Image as ImageIcon, Trash2, Upload } from '../../Shared/Icon'
import { Button, ConfirmDialog, EmptyState, IconButton, InlineNotice } from '../../Shared/Product'
import './business-images.css'

// redesign stores 5.3 (; G2-15, G2-16, G2-17, G2-26 in the gallery, G2-42): the store's image gallery on Product. Adding
// is immediate, as before (no Save): «Add images» (a named button, D5) or a drop on the zone takes one or several files, which go
// up one after another with the same request per file, with progress, and end in one summary: how many were added and, per file,
// why one was not (type, size or the API). Each thumbnail has an alt; delete asks first (P/ConfirmDialog) and a failed delete says
// why. Every notice is tied to the action that caused it, so none re-opens on an unrelated change.

const MAX_IMAGE_KB = 2048
const ACCEPT = 'image/png, image/jpeg, image/jpg'

const withCount = (template, values) => Object.entries(values)
  .reduce((result, [key, value]) => result.split(`_${key}_`).join(String(value)), template)

const readAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new window.FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const BusinessImagesUI = (props) => {
  const {
    businessPhotos,
    deletingId,
    handleAddGalleryItem,
    handleDeleteBusinessGallery
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()

  const inputRef = useRef(null)
  const dragDepth = useRef(0)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(null)
  const [summary, setSummary] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const uploading = progress != null

  const reasonFor = (file) => {
    if (file?.type?.split('/')[0] !== 'image') return t('ERROR_ONLY_IMAGES', 'Only images can be accepted')
    if (bytesConverter(file?.size) > MAX_IMAGE_KB) return t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes')
    return null
  }

  const upload = async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0 || uploading) return
    setSummary(null)
    setDeleteError(null)
    let added = 0
    const failures = []
    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      if (mounted.current) setProgress({ current: index + 1, total: files.length })
      const reason = reasonFor(file)
      if (reason) {
        failures.push({ name: file?.name || '', reason })
        continue
      }
      let dataUrl
      try {
        dataUrl = await readAsDataUrl(file)
      } catch {
        failures.push({ name: file?.name || '', reason: t('GALLERY_IMAGE_READ_FAILED', 'The file could not be read.') })
        continue
      }
      const result = await handleAddGalleryItem({ file: dataUrl }, { silent: true })
      if (result?.ok) added += 1
      else {
        failures.push({
          name: file?.name || '',
          reason: translateApiMessage(t, result?.error, t('GALLERY_IMAGE_ADD_FAILED', 'The image could not be added.'))
        })
      }
    }
    if (!mounted.current) return
    setProgress(null)
    setSummary({ added, failures })
  }

  const openPicker = () => {
    if (!uploading) inputRef.current?.click()
  }

  const handlePicked = (event) => {
    const files = event.target.files
    upload(files)
    // the same files can be picked again after a failure
    event.target.value = ''
  }

  const isFileDrag = event => Array.from(event.dataTransfer?.types || []).includes('Files')
  const handleDragEnter = (event) => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }
  const handleDragOver = (event) => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = uploading ? 'none' : 'copy'
  }
  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  const handleDrop = (event) => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (!uploading) upload(event.dataTransfer?.files)
  }

  const confirmDelete = async () => {
    const id = confirmId
    const result = await handleDeleteBusinessGallery(id)
    if (!mounted.current) return
    setConfirmId(null)
    if (!result?.ok) {
      setDeleteError(translateApiMessage(t, result?.error, t('GALLERY_IMAGE_DELETE_FAILED', 'The image could not be deleted.')))
    }
  }

  const imageAlt = (index) => withCount(t('GALLERY_IMAGE_ALT', 'Image _number_ of _total_'), {
    number: index + 1,
    total: businessPhotos.length
  })
  const deleteLabel = (index) => withCount(t('GALLERY_DELETE_IMAGE_N', 'Delete image _number_'), { number: index + 1 })
  const confirmIndex = businessPhotos.findIndex(photo => photo.id === confirmId)
  const confirmPhoto = confirmIndex >= 0 ? businessPhotos[confirmIndex] : null

  const addedText = summary && summary.added > 0
    ? withCount(summary.added === 1
      ? t('GALLERY_IMAGES_ADDED_ONE', '_count_ image added')
      : t('GALLERY_IMAGES_ADDED_OTHER', '_count_ images added'), { count: summary.added })
    : null
  const failedText = summary && summary.failures.length > 0
    ? withCount(summary.failures.length === 1
      ? t('GALLERY_IMAGES_FAILED_ONE', '_count_ image could not be added:')
      : t('GALLERY_IMAGES_FAILED_OTHER', '_count_ images could not be added:'), { count: summary.failures.length })
    : null

  return (
    <div className='odc-gallery'>
      <div
        className='odc-gallery-drop'
        data-dragging={dragging || undefined}
        data-busy={uploading || undefined}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ImageIcon aria-hidden='true' className='odc-gallery-drop-icon' />
        <p className='odc-gallery-drop-title'>{t('DRAG_DROP', 'Drag and Drop')}</p>
        <p className='odc-gallery-drop-hint' id='odc-gallery-hint'>
          {t('GALLERY_IMAGES_HINT', 'PNG or JPG, up to 2 MB each. You can add several at once.')}
        </p>
        <Button
          variant='secondary'
          icon={Upload}
          onClick={openPicker}
          disabled={uploading}
          aria-describedby='odc-gallery-hint'
        >
          {t('GALLERY_ADD_IMAGES', 'Add images')}
        </Button>
        <input
          ref={inputRef}
          type='file'
          accept={ACCEPT}
          multiple
          hidden
          tabIndex={-1}
          onChange={handlePicked}
          data-testid='gallery-file-input'
        />
      </div>

      <div className='odc-gallery-notices' aria-live='polite'>
        {uploading && (
          <p role='status' className='odc-gallery-status'>
            {withCount(t('GALLERY_UPLOADING', 'Uploading _current_ of _total_…'), progress)}
          </p>
        )}
        {addedText && !failedText && (
          <p role='status' className='odc-gallery-status' data-tone='success'>{addedText}</p>
        )}
        {failedText && (
          <InlineNotice tone='danger'>
            {addedText && <span className='odc-gallery-added'>{addedText}. </span>}
            <span>{failedText}</span>
            <ul className='odc-gallery-failures'>
              {summary.failures.map((failure, index) => (
                <li key={`${failure.name}-${index}`}>
                  {failure.name ? <bdi className='odc-gallery-file'>{failure.name}</bdi> : null}
                  {failure.name ? ': ' : ''}
                  {failure.reason}
                </li>
              ))}
            </ul>
          </InlineNotice>
        )}
        {deleteError && <InlineNotice tone='danger'>{deleteError}</InlineNotice>}
      </div>

      {businessPhotos.length === 0
        ? (
          <EmptyState
            icon={ImageIcon}
            title={t('GALLERY_NO_IMAGES', 'No images yet')}
            description={t('GALLERY_NO_IMAGES_HINT', 'Images you add here show in the store\'s gallery.')}
          />
          )
        : (
          <ul className='odc-gallery-grid' aria-label={t('IMAGES', 'Images')}>
            {businessPhotos.map((photo, index) => (
              <li key={photo.id} className='odc-gallery-item' data-busy={deletingId === photo.id || undefined}>
                <img src={optimizeImage(photo.file, 'h_200,c_limit')} alt={imageAlt(index)} loading='lazy' />
                <IconButton
                  className='odc-gallery-delete'
                  icon={Trash2}
                  label={deleteLabel(index)}
                  variant='secondary'
                  size='sm'
                  disabled={deletingId != null}
                  onClick={() => { setDeleteError(null); setConfirmId(photo.id) }}
                />
              </li>
            ))}
          </ul>
          )}

      <ConfirmDialog
        open={confirmPhoto != null}
        title={t('GALLERY_DELETE_IMAGE_TITLE', 'Delete this image?')}
        confirmLabel={t('AD_BANNERS_DELETE_IMAGE', 'Delete image')} // redesign tanda AB (S-5): verb + object
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deletingId != null}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmId(null)}
      >
        {confirmPhoto && (
          <div className='odc-gallery-confirm'>
            <img src={optimizeImage(confirmPhoto.file, 'h_200,c_limit')} alt={imageAlt(confirmIndex)} />
            <p>{t('GALLERY_DELETE_IMAGE_BODY', 'It is removed from the store\'s gallery right away.')}</p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

export const BusinessImages = (props) => {
  const businessGalleryProps = {
    ...props,
    isImageGallery: true,
    UIComponent: BusinessImagesUI
  }
  return <BusinessGalleryController {...businessGalleryProps} />
}
