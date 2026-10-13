import React, { useState, useRef } from 'react'
import { useLanguage, DragAndDrop, ExamineClick, useUtils } from '../../../../../index'
import { Alert, Modal, ImageCrop, Confirm } from '../../Shared'
import { Button } from '../../../styles'
import { bytesConverter } from '../../../utils'
import BiImage from '@meronex/icons/bi/BiImage'

import {
  ImageContainer,
  ConfigImage,
  UploadImageIconContainer,
  UploadImageIcon,
  ImageActions
} from './styles'

export const SettingsImage = (props) => {
  const {
    config,
    saveConfig
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [cropState, setCropState] = useState({ name: null, data: null, open: false })
  const [baseData, setBaseData] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const configImageRef = useRef()

  const handleChangePhoto = (croppedImg) => {
    saveConfig(config.id, {
      image: croppedImg
    })
    setCropState({ ...cropState, data: croppedImg, open: false })
    setBaseData(croppedImg)
  }

  // Empty value: the dashboard falls back to its default image (on official
  // Ordering.co hosts, the brand logo and favicon)
  const hasImage = !!(baseData || config?.value)
  const handleReset = () => {
    setConfirmReset(false)
    saveConfig(config.id, { value: '' })
    setBaseData(null)
  }

  const handleFiles = (files) => {
    if (files.length === 1) {
      const type = files[0].type.split('/')[0]
      if (type !== 'image') {
        setAlertState({
          open: true,
          content: [t('ERROR_ONLY_IMAGES', 'Only images can be accepted')]
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
        setCropState({ name: 'images', data: reader.result, open: true })
      }
    }
  }

  return (
    <>
      <ImageContainer>
        <p>{config?.name}</p>
        <ConfigImage
          onClick={() => configImageRef.current.click()}
        >
          <ExamineClick
            onFiles={files => handleFiles(files)}
            childRef={(e) => { configImageRef.current = e }}
            accept='image/png, image/jpeg, image/jpg'
          >
            <DragAndDrop
              onDrop={dataTransfer => handleFiles(dataTransfer.files)}
              accept='image/png, image/jpeg, image/jpg'
            >
              {
                baseData
                  ? (<img src={baseData} alt='config image' loading='lazy' />)
                  : config?.value && (<img src={optimizeImage(config?.value, 'h_200,c_limit')} alt='config image' loading='lazy' />)
              }
              <UploadImageIconContainer>
                <UploadImageIcon>
                  <BiImage />
                  <span>{t('DRAG_DROP_IMAGE_HERE', 'Put your image here')}</span>
                </UploadImageIcon>
              </UploadImageIconContainer>
            </DragAndDrop>
          </ExamineClick>
        </ConfigImage>
        {hasImage && (
          <ImageActions>
            <Button
              type='button'
              outline
              color='primary'
              borderRadius='8px'
              onClick={() => setConfirmReset(true)}
            >
              {t('RESTORE_DEFAULT_IMAGE', 'Restore default')}
            </Button>
          </ImageActions>
        )}
      </ImageContainer>
      <Confirm
        title={config?.name}
        content={t('RESTORE_DEFAULT_IMAGE_CONFIRM', 'Remove this image and use the default one?')}
        acceptText={t('RESTORE_DEFAULT_IMAGE', 'Restore default')}
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onCancel={() => setConfirmReset(false)}
        onAccept={handleReset}
        closeOnBackdrop={false}
      />
      <Alert
        width='700px'
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
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
            photo={cropState?.data}
            handleChangePhoto={handleChangePhoto}
          />
        </Modal>
      )}
    </>
  )
}
