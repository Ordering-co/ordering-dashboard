import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useLanguage, ExamineClick, DragAndDrop, useToast, ToastType } from '../../../../../index'
import { bytesConverter, validImageSize } from '../../../utils'
import { Image as DumyPhoto } from 'react-bootstrap-icons'
import { ImageCrop, Modal, Alert } from '../../Shared'
import {
  ImageBoxContainer,
  UploadImageIconContainer,
  UploadImageIcon,
  ImgInfoWrapper
} from './styles'

export const ImageFormatContext = createContext(null)

export const ImageBox = (props) => {
  const formatContext = useContext(ImageFormatContext)
  props = { ...defaultProps, ...(formatContext || {}), ...props }
  const {
    id,
    isBig,
    title,
    ratio,
    photo,
    disableCrop,
    themeId,
    useAlertToast,
    isResetImg,
    path,
    fileSize,
    requireDimentions,
    extensionFile,
    mimeTypeAccept,
    editable,
    handleClick,
    handleChangePhoto
  } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const imageRef = useRef()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [cropState, setCropState] = useState({ name: null, data: null, open: false })
  const [picture, setPicture] = useState('')
  const childId = `examine-file-${id}`

  const handleChangeImage = (croppedImg) => {
    handleChangePhoto(croppedImg, path)
    setPicture(croppedImg)
    setCropState({ name: null, data: null, open: false })
  }

  const resetInputFile = () => document.getElementById(childId).value = ''

  const validateFileType = (file) => {
    const type = file.type.split('/')[0]
    return type !== 'image' ? t('ERROR_ONLY_IMAGES', 'Only images can be accepted') : null
  }

  const validateFileSize = (file, fileSize) => {
    const size = Number(fileSize) || 1024
    const sizeLabel = size >= 1024 ? `${size / 1024} MB` : `${size} KB`
    return bytesConverter(file?.size) > size
      ? t('ERROR_IMAGE_MAXIMUM_SIZE', 'The maximum image size is :size:').replace(':size:', sizeLabel)
      : null
  }

  const validateImageDimensions = async (file, requiredDimensions) => {
    if (!requiredDimensions) return null
    const isValid = await validImageSize({ ...requiredDimensions, file })
    return !isValid
      ? t('ERROR_IMAGE_DIMENTIONS', 'Sorry, this image doesn\'t look like the size we wanted.')
      : null
  }

  const handleFiles = async (files, name) => {
    if (files.length !== 1) return

    const selectedFile = files[0]
    const normalizeExt = (ext) => (ext === 'jpeg' ? 'jpg' : ext)
    const fileExtension = normalizeExt(selectedFile.name?.split('.').pop()?.toLowerCase())

    const allowedExtensions = extensionFile
      ? extensionFile.toLowerCase().split(',').map(ext => normalizeExt(ext.trim()))
      : []
    const isValidExtension = allowedExtensions.length === 0 || allowedExtensions.includes(fileExtension)

    if (extensionFile && fileExtension && !isValidExtension) {
      const errorMessage = t('ERROR_IMAGE_EXTENSION', 'Invalid file type. Allowed format is :ext:')
        .replace(':ext:', extensionFile.toUpperCase())

      if (!useAlertToast) {
        setAlertState({ open: true, content: [errorMessage] })
      } else {
        showToast(ToastType.Error, [errorMessage])
      }
      resetInputFile()
      return
    }

    const blob = selectedFile.slice(0, selectedFile.size, selectedFile.type)
    const fileCleaned = new File([blob], selectedFile.name, { type: selectedFile.type })
    const validDimensions = await validateImageDimensions(fileCleaned, requireDimentions)
    const validationResult = [validateFileType(fileCleaned), validateFileSize(fileCleaned, fileSize), validDimensions]

    const error = validationResult.find(result => result)
    if (error) {
      if (!useAlertToast) {
        setAlertState({ open: true, content: [error] })
      } else {
        showToast(ToastType.Error, [error])
      }
      resetInputFile()
      return
    }

    const reader = new window.FileReader()
    reader.readAsDataURL(fileCleaned)
    reader.onload = () => {
      if (!disableCrop) {
        setCropState({ name, data: reader.result, open: true })
      } else {
        handleChangePhoto(fileCleaned, path)
        setPicture(reader.result)
      }
    }
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  useEffect(() => {
    if (!photo) return
    setPicture(photo)
  }, [photo, isResetImg])

  return (
    <div>
      <ImageBoxContainer
        isBig={isBig}
        onClick={() => {
          editable && imageRef.current.click()
          handleClick && handleClick()
        }}
      >
        {editable
          ? <ExamineClick
            childId={childId}
            onFiles={files => handleFiles(files, 'logo')}
            childRef={(e) => { imageRef.current = e }}
            accept={mimeTypeAccept}
          >
            <DragAndDrop
              onDrop={dataTransfer => handleFiles(dataTransfer.files, 'logo')}
              accept={mimeTypeAccept}
            >
              {picture && <img src={picture} alt='logo image' loading='lazy' />}
              <UploadImageIconContainer bgimage={picture}>
                <UploadImageIcon>
                  <DumyPhoto />
                  <span>{t('DRAG_AND_DROP', 'Drag and drop')}</span>
                </UploadImageIcon>
              </UploadImageIconContainer>
            </DragAndDrop>
          </ExamineClick>
          : picture
            ? <img src={picture} alt='logo image' loading='lazy' />
            : <UploadImageIconContainer bgimage={picture}>
              <UploadImageIcon>
                <DumyPhoto />
              </UploadImageIcon>
            </UploadImageIconContainer>}
      </ImageBoxContainer>
      <ImgInfoWrapper>
        <h4>{title}</h4>
        <p>{ratio}</p>
        <p>{t('FORMAT', 'Format')}: {extensionFile.toUpperCase()}</p>
      </ImgInfoWrapper>
      {cropState?.open && (
        <Modal
          width='700px'
          height='80vh'
          padding='30px'
          title={t('IMAGE_CROP', 'Image crop')}
          open={cropState?.open}
          onRemove={() => setCropState({ ...cropState, open: false })}
        >
          <ImageCrop
            useCloudinaryUrl
            themeId={themeId}
            photo={cropState?.data}
            handleChangePhoto={handleChangeImage}
          />
        </Modal>
      )}
      <Alert
        title={t('ORDERING', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </div>
  )
}

const defaultProps = {
  editable: true,
  requireDimentions: null,
  fileSize: 3072,
  extensionFile: 'png',
  mimeTypeAccept: 'image/png, image/jpeg, image/jpg'
}
