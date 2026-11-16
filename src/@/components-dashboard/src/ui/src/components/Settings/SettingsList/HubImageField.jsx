import React, { useState } from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { ImageField } from '../../Shared/Product/ImageField'
import { ConfirmDialog } from '../../Shared/Product/Dialog'
import { bytesConverter } from '../../../utils/bytesConverter'

const MAX_IMAGE_KB = 2048

/**
 * an image config (type 5) inside the Settings hub, on P/ImageField instead of SettingsImage's grey drop box. Same
 * behaviour as SettingsImage with `onPick` / `onRestore` (n.º 1, D-56 a): the cropped image and «Restore default» are pending changes
 * of the hub's save bar; nothing is saved here. Only images of up to 2 MB are taken, as before; the reason is the field's error.
 * Outside the hub, SettingsList keeps SettingsImage.
 */
export const HubImageField = ({ config, hint, error, onPick, onRestore }) => {
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [fileError, setFileError] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const name = config?.name || config?.key
  const value = config?.value || ''
  const restoreText = t('RESTORE_DEFAULT_IMAGE', 'Restore default')

  const validateFile = (file) => {
    if (file.type.split('/')[0] !== 'image') {
      setFileError(t('ERROR_ONLY_IMAGES', 'Only images can be accepted'))
      return false
    }
    if (bytesConverter(file.size) > MAX_IMAGE_KB) {
      setFileError(t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes'))
      return false
    }
    setFileError(null)
    return true
  }

  return (
    <>
      <ImageField
        label={name}
        hint={hint}
        error={error || fileError}
        // empty: the dashboard falls back to its default image
        value={value ? optimizeImage(value, 'h_200,c_limit') : undefined}
        previewAlt={name}
        changeLabel={`${t('CHANGE', 'Change')}: ${name}`}
        changeText={t('CHANGE', 'Change')}
        removeLabel={`${restoreText}: ${name}`}
        removeText={restoreText}
        onChange={onPick}
        onRemove={() => setConfirmReset(true)}
        validateFile={validateFile}
        cropTitle={t('IMAGE_CROP', 'Image crop')}
        closeLabel={t('CLOSE', 'Close')}
        droppable
        tooManyFilesText={t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')}
      />
      <ConfirmDialog
        open={confirmReset}
        title={name}
        confirmLabel={restoreText}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => {
          setConfirmReset(false)
          onRestore()
        }}
        onCancel={() => setConfirmReset(false)}
      >
        {t('RESTORE_DEFAULT_IMAGE_CONFIRM', 'Remove this image and use the default one?')}
      </ConfirmDialog>
    </>
  )
}
