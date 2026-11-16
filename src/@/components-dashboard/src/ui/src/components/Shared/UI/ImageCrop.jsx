import React, { useEffect, useId, useRef, useState } from 'react'
import Cropper from 'cropperjs'
import { useApi, useLanguage, useSession, useUtils } from '../../../../../index'
import { Button, IconButton } from '../../../styles/Buttons'
import { RotateCw as ArrowClockwise } from '../Icon'
import { useTheme } from 'styled-components'
import 'cropperjs/dist/cropper.css'
import {
  Container,
  ImageCropWrapper,
  ImageCropActionWrapper,
  RangeWrapper,
  ActionContentWrapper,
  ButtonWrapper,
  ActionAspectRatioBox,
  CropLoadingOverlay
} from './image-crop-styles'
import { Checkbox } from '../../../styles/Checkbox'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

export const ImageCrop = (props) => {
  const {
    photo: initialPhoto,
    handleChangePhoto,
    onClose,
    aspectRatio,
    showAspectRatioBox,
    useCloudinaryUrl,
    themeId,
    // optional. With `useCloudinaryUrl` and no `themeId` (the site is still to be created), it runs on «Crop» and gives
    // the theme id to upload to; no id (or a throw) keeps the crop open and emits nothing, never a `data:` URI.
    resolveThemeId
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [{ optimizeImage }] = useUtils()
  const [zoomValue, setZoomValue] = useState(50)
  const [loading, setLoading] = useState(false)
  const cropperElementRef = useRef(null)
  const cropperInstanceRef = useRef(null)
  const zoomId = useId()
  const aspectId = useId()

  const handleChangeZoom = (evt) => {
    const value = evt.target.value
    cropperInstanceRef.current?.scale(value / 50)
    setZoomValue(value)
  }

  const getOutputMimeType = () => {
    const mime = /^data:(image\/[a-zA-Z+]+);base64/.exec(initialPhoto || '')?.[1]
    return ['image/jpeg', 'image/webp'].includes(mime) ? mime : 'image/png'
  }

  const getCropData = async () => {
    const cropper = cropperInstanceRef.current
    const outputMaxWidth = 1920
    const outputMaxHeight = 1080
    const canvasOptions = {
      imageSmoothingQuality: 'high',
      maxWidth: outputMaxWidth,
      maxHeight: outputMaxHeight
    }
    const mimeType = getOutputMimeType()

    if (typeof cropper !== 'undefined' && cropper !== null) {
      let photo
      let uploadThemeId = themeId
      if (useCloudinaryUrl && !uploadThemeId && resolveThemeId) {
        setLoading(true)
        try {
          uploadThemeId = await resolveThemeId()
        } catch {
          uploadThemeId = null
        } finally {
          setLoading(false)
        }
        if (!uploadThemeId) return
      }
      if (useCloudinaryUrl && uploadThemeId) {
        setLoading(true)
        let result
        let error
        try {
          const response = await fetch(`${ordering.root}/themes/${uploadThemeId}/gallery`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            method: 'POST',
            body: JSON.stringify({
              type: 'image',
              file: cropper.getCroppedCanvas(canvasOptions).toDataURL(mimeType, 0.92)
            })
          })
          const responseBody = await response.json()
          result = responseBody.result
          error = responseBody.error
        } catch {
          return
        } finally {
          setLoading(false)
        }
        if (error) return
        photo = optimizeImage(result.image, 'f_auto,q_auto,w_2000,c_limit')
      } else {
        photo = cropper.getCroppedCanvas(canvasOptions).toDataURL(mimeType, 0.92)
      }
      handleChangePhoto(photo)
      onClose && onClose()
    }
  }

  const handleChangeRotate = () => {
    if (!initialPhoto) return
    cropperInstanceRef.current?.rotate(45)
  }

  const handleChangeAspectRatio = (checked) => {
    checked
      ? cropperInstanceRef.current?.setAspectRatio(18 / 9)
      : cropperInstanceRef.current?.setAspectRatio(aspectRatio)
  }

  useEffect(() => {
    const imageElement = cropperElementRef.current
    if (!imageElement || !initialPhoto) return undefined
    const cropperOptions = {
      ...(aspectRatio ? { aspectRatio } : {}),
      dragMode: 'move',
      zoomable: false,
      toggleDragModeOnDblclick: false,
      autoCropArea: 1
    }
    const cropper = new Cropper(imageElement, cropperOptions)
    cropperInstanceRef.current = cropper

    return () => {
      if (cropperInstanceRef.current === cropper) cropperInstanceRef.current = null
      cropper.destroy()
    }
  }, [initialPhoto, aspectRatio])

  return (
    <Container>
      <ImageCropWrapper data-loading={loading ? '' : undefined}>
        <img ref={cropperElementRef} src={initialPhoto} alt={t('CROP', 'Crop')} />
        {loading && (
          <CropLoadingOverlay aria-label={t('LOADING', 'Loading')}>
            <Skeleton style={{ height: 400 }} />
          </CropLoadingOverlay>
        )}
      </ImageCropWrapper>
      <ImageCropActionWrapper>
        <RangeWrapper>
          <label htmlFor={zoomId}>{t('RESIZE_IMAGE', 'Resize image')}</label>
          <input
            id={zoomId}
            min='0'
            type='range'
            step='0.01'
            value={zoomValue}
            onChange={handleChangeZoom}
            style={{ backgroundImage: `-webkit-gradient(linear, 0% 0%, ${zoomValue}% 0%, color-stop(100%, ${theme.colors.primary}), color-stop(100%, #F6F6FA))` }}
          />
          <output htmlFor={zoomId}>{parseInt(zoomValue * 2)} %</output>
        </RangeWrapper>
        <ActionContentWrapper>
          <IconButton type='button' aria-label={t('ROTATE', 'Rotate')} onClick={handleChangeRotate}>
            <span>{t('ROTATE', 'Rotate')}</span>
            <ArrowClockwise aria-hidden='true' />
          </IconButton>
        </ActionContentWrapper>
        {showAspectRatioBox && (
          <ActionAspectRatioBox as='label' htmlFor={aspectId}>
            <Checkbox
              id={aspectId}
              onChange={(e) => handleChangeAspectRatio(e.target.checked)}
            />
            <span>{t('USE_WEB_ASPECT_RATIO', 'Use web aspect ratio')}</span>
          </ActionAspectRatioBox>
        )}
      </ImageCropActionWrapper>
      <ButtonWrapper>
        <Button
          type='button'
          borderRadius='7.6px'
          color='primary'
          onClick={getCropData}
          disabled={loading}
        >
          {t('CROP', 'Crop')}
        </Button>
      </ButtonWrapper>
    </Container>
  )
}
