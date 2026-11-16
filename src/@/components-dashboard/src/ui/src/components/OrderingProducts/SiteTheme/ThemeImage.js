import React, { useState, useRef } from 'react'
import { useLanguage, DragAndDrop, ExamineClick, useToast, ToastType } from '../../../../../index'
import { Alert, ImageCrop, Modal } from '../../Shared'
import { Button, Skeleton } from '../../Shared/Product'
import { bytesConverter } from '../../../utils'
import './site-theme.css'

// redesign (lot D, decision 7): the same logic as in `main` (JPG/WEBP, 2 MB, crop, upload to the gallery, the Alert of the
// upload errors); only the zone changes: a real button named «Choose image» and the tile and the hint drawn with tokens
// (site-theme.css). Dropping a file on the zone still works. `label` (optional) names the group the zone belongs to.

export const ThemeImage = (props) => {
  const {
    label,
    valueObject,
    handleAddThemeGallery,
    handleChangeValue
  } = props

  const [, t] = useLanguage()
  const imageRef = useRef(null)
  const [, { showToast }] = useToast()

  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [cropState, setCropState] = useState({ name: null, data: null, open: false })
  const [imageUploadState, setImageUploadState] = useState({ loading: false, image: null })

  const handleClickImage = () => {
    imageRef.current?.click()
  }

  const handleFiles = (files) => {
    if (files.length === 1) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/webp']
      if (!allowedTypes.includes(files[0].type)) {
        setAlertState({
          open: true,
          content: [t('ERROR_ONLY_JPG_WEBP_IMAGES', 'Only JPG and WEBP images can be accepted')]
        })
        return
      }

      if (bytesConverter(files[0]?.size) > 2048) {
        setAlertState({
          open: true,
          content: [t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes')]
        })
        return
      }
      const reader = new window.FileReader()
      reader.readAsDataURL(files[0])
      reader.onload = () => {
        setCropState({ name: 'photo', data: reader.result, open: true })
      }
    }
  }

  const handleChangePhoto = async (croppedImg) => {
    try {
      setImageUploadState({
        ...imageUploadState,
        loading: true
      })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setCropState({ name: null, data: null, open: false })
      const { error, result } = await handleAddThemeGallery(croppedImg)
      if (!error) {
        showToast(ToastType.Success, t('IMAGE_SAVED', 'Image saved'))
        handleChangeValue(result?.image)
      } else {
        setAlertState({
          open: true,
          content: result
        })
      }
      setImageUploadState({
        loading: false,
        image: error ? null : result?.image
      })
    } catch (error) {
      setImageUploadState({
        ...imageUploadState,
        loading: false
      })
      setAlertState({
        open: true,
        content: [error.message]
      })
    }
  }

  const preview = imageUploadState.image || valueObject

  return (
    <>
      <div className='odc-op-theme-image' role={label ? 'group' : undefined} aria-label={label || undefined}>
        <ExamineClick
          onFiles={files => handleFiles(files)}
          childRef={(e) => { imageRef.current = e }}
          accept='image/jpeg, image/jpg, image/webp'
          disabled={imageUploadState.loading}
        >
          <DragAndDrop
            onDrop={dataTransfer => handleFiles(dataTransfer.files)}
            accept='image/jpeg, image/jpg, image/webp'
            disabled={imageUploadState.loading}
            className='odc-op-theme-image-zone'
          >
            <div className='odc-op-theme-image-tile' data-empty={!imageUploadState.loading && !preview ? '' : undefined}>
              {imageUploadState.loading && <Skeleton block='100%' />}
              {!imageUploadState.loading && preview && (
                <img src={preview} alt='image' loading='lazy' />
              )}
            </div>
            <div className='odc-op-theme-image-actions'>
              <Button size='sm' busy={imageUploadState.loading} disabled={imageUploadState.loading} onClick={handleClickImage}>
                {t('CHOOSE_IMAGE', 'Choose image')}
              </Button>
              <span className='odc-op-theme-image-hint'>{t('DRAG_AND_DROP', 'Drag and drop')}</span>
            </div>
          </DragAndDrop>
        </ExamineClick>
      </div>
      <Alert
        title={t('ORDERING_PRODUCTS', 'Ordering products')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
      {cropState?.open && (
        <Modal
          width='var(--od-x-dialog-lg)' /* was 700px: the literal guard wants tokens (720px) */
          height='80vh'
          padding='var(--od-space-5)' /* was 30px (24px) */
          title={t('IMAGE_CROP', 'Image crop')}
          open={cropState?.open}
          onRemove={() => setCropState({ ...cropState, open: false })}
        >
          <ImageCrop
            photo={cropState?.data}
            handleChangePhoto={handleChangePhoto}
          />
        </Modal>
      )}
    </>
  )
}
