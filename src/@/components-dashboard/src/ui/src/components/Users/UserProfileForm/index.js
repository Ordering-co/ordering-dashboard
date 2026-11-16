import React, { useEffect, useId, useRef, useState } from 'react'

import {
  UserFormDetails as UserProfileController,
  useLanguage,
  DragAndDrop
} from '../../../../../index'

import { UserFormDetailsUI, profileApiErrorText } from '../UserFormDetails'
import { Avatar, Button, Dialog, Skeleton } from '../../Shared/Product'
import { CircleAlert, Image } from '../../Shared/Icon'
import { ImageCrop } from '../../Shared/UI/ImageCrop'
import { bytesConverter } from '../../../utils'
import './user-profile-form.css'

// redesign UF-B2 (decision 3 A, M-UF3, M-UF16, M-UF17): the photo of the profile is a 56px avatar with «Change photo» next
// to it, in place of the 216px clickable square. The image is validated, cropped in a Product dialog and uploaded ONCE, the crop,
// when the dialog is accepted (the old flow also uploaded the uncropped original on pick). Cancelling the crop writes nothing.
// Drag and drop goes through the same checks and the same crop as the button.

const PHOTO_ACCEPT = 'image/png, image/jpeg, image/jpg'
// KB, as bytesConverter gives them
const PHOTO_MAX_KB = 2048

const UserProfileFormUI = (props) => {
  const {
    handleButtonUpdateClick,
    formState,
    isHiddenAddress,
    userState,
    handleChangeSwtich,
    isService
  } = props

  const [, t] = useLanguage()
  const [cropState, setCropState] = useState({ data: null, open: false })
  const [fileError, setFileError] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const inputRef = useRef(null)
  const changeRef = useRef(null)
  const photoSaveRef = useRef(false)
  const hintId = useId()
  const messageId = useId()

  const user = userState?.result?.result
  const loading = !!formState?.loading
  const failed = !!formState?.result?.error
  const uploading = loading && !!formState?.changes?.photo
  const fullName = [user?.name, user?.lastname].filter(Boolean).join(' ')
  // the saved photo, or the one just chosen while it is on its way and nothing has failed
  const photoSrc = (!failed && formState?.changes?.photo) || user?.photo || undefined

  const handleFiles = (files) => {
    if (files?.length !== 1) return
    const file = files[0]
    setFileError(null)
    if (file.type.split('/')[0] !== 'image') {
      setFileError(t('ERROR_ONLY_IMAGES', 'Only images can be accepted'))
      return
    }
    if (bytesConverter(file.size) > PHOTO_MAX_KB) {
      setFileError(t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes'))
      return
    }
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setCropState({ data: reader.result, open: true })
    }
  }

  const closeCrop = () => setCropState(current => ({ ...current, open: false }))

  // accepting the crop is the only thing that writes the photo
  const handleChangePhoto = (croppedImg) => {
    handleChangeSwtich('photo', croppedImg)
    closeCrop()
  }

  useEffect(() => {
    if (formState.changes?.photo) {
      const isImage = true
      photoSaveRef.current = true
      handleButtonUpdateClick(null, isImage)
    }
  }, [formState.changes?.photo])

  // The error of an upload is said under the avatar; the save bar keeps the errors of the form.
  useEffect(() => {
    if (formState.loading) {
      if (!photoSaveRef.current) setUploadError(null)
      return
    }
    if (!photoSaveRef.current) return
    photoSaveRef.current = false
    setUploadError(formState.result?.error ? profileApiErrorText(t, formState.result?.result) : null)
  }, [formState.loading])

  const shownUploadError = failed ? uploadError : null
  const message = fileError || shownUploadError

  return (
    <div className='odc-root odc-uf-profile' data-calc-height={!isService ? '' : undefined}>
      <DragAndDrop
        onDrop={dataTransfer => handleFiles(dataTransfer.files)}
        disabled={loading}
        className='odc-uf-photo'
      >
        <div className='odc-uf-avatar' aria-busy={uploading || undefined}>
          {uploading
            ? <Skeleton shape='round' size='100%' block='100%' />
            : <Avatar name={fullName} src={photoSrc} size='lg' label={t('USER_FORM_PHOTO', 'Profile photo')} />}
        </div>
        <div className='odc-uf-photo-actions'>
          <Button
            ref={changeRef}
            icon={Image}
            disabled={loading}
            aria-describedby={message ? `${hintId} ${messageId}` : hintId}
            onClick={() => inputRef.current?.click()}
          >
            {t('USER_FORM_CHANGE_PHOTO', 'Change photo')}
          </Button>
          <p id={hintId} className='odc-uf-photo-hint'>
            {t('USER_FORM_PHOTO_HINT', 'JPG or PNG, up to 2 MB. Saved when you choose it.')}
          </p>
          {message && (
            <p id={messageId} className='odc-uf-photo-error' role='alert'>
              <CircleAlert className='odc-icon odc-uf-photo-error-icon' aria-hidden='true' />
              <span>{message}</span>
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type='file'
          accept={PHOTO_ACCEPT}
          hidden
          tabIndex={-1}
          aria-hidden='true'
          disabled={loading}
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = '' // the same file can be picked again
          }}
        />
      </DragAndDrop>
      <div className='odc-uf-profile-form'>
        <UserFormDetailsUI
          {...props}
          userData={user}
          isHiddenAddress={isHiddenAddress}
          suppressApiError={!!shownUploadError}
          onDirtyChange={props.onDirtyChange} // redesign UC-B6 (auditor #16): opt-in, undefined keeps today's behavior
        />
      </div>
      <Dialog
        open={cropState.open}
        onOpenChange={(open) => { if (!open) closeCrop() }}
        title={t('IMAGE_CROP', 'Image crop')}
        closeLabel={t('CLOSE', 'Close')}
        size='lg'
        returnFocus={changeRef}
      >
        {cropState.data && (
          <ImageCrop
            photo={cropState.data}
            handleChangePhoto={handleChangePhoto}
            onClose={closeCrop}
          />
        )}
      </Dialog>
    </div>
  )
}

export const UserProfileForm = (props) => {
  const UserProfileProps = {
    ...props,
    useSessionUser: false,
    UIComponent: UserProfileFormUI
  }

  return (
    <UserProfileController {...UserProfileProps} />
  )
}
