import React, { useEffect, useId, useRef, useState } from 'react'

import {
  UserFormDetails as UserProfileController,
  useLanguage,
  DragAndDrop
} from '../../../../../index'

import { UserFormDetailsUI, userFormErrorText } from '../UserFormDetails'
import { Avatar, Button, Dialog, Skeleton } from '../../Shared/Product'
import { CircleAlert, Image } from '../../Shared/Icon'
import { ImageCrop } from '../../Shared/UI/ImageCrop'
import { bytesConverter } from '../../../utils'
import './user-profile-form.css'

// redesign UF-B3 (decision 3, M-UF3, M-UF16, M-UF17): the photo of the profile in Product. A 56px avatar (initials
// when there is no photo), a real «Change photo» button, the crop in a Product dialog, and ONE upload: the cropped image, when
// it is accepted (main uploaded the original at pick time and the crop again after it, and closing the crop kept the original).
// The checks of main stay (type, 2 MB) and their messages show under the avatar, not in an alert. Drag and drop keeps working
// through the same checks and the same crop.

const ACCEPT = 'image/png, image/jpeg, image/jpg'
const MAXIMUM_KILOBYTES = 2048

const UserProfileFormUI = (props) => {
  const {
    handleButtonUpdateClick,
    formState,
    userState,
    handleChangeSwtich
  } = props

  const [, t] = useLanguage()
  const hintId = useId()
  const fileRef = useRef(null)
  const buttonRef = useRef(null)
  const [fileMessage, setFileMessage] = useState(null)
  const [crop, setCrop] = useState({ open: false, photo: null })

  const user = userState?.result?.result
  const changes = formState?.changes ?? {}
  const uploading = !!formState?.loading && !!changes.photo
  const fullName = [user?.name, user?.lastname].filter(Boolean).join(' ')
  const justUploaded = changes.photo && !formState?.result?.error ? changes.photo : null

  // an upload that failed leaves its `photo` in the changes: its answer is the error under the avatar (never empty)
  const uploadError = !formState?.loading && formState?.result?.error && changes.photo
    ? userFormErrorText(t, formState.result.result)
    : null
  const photoError = fileMessage || uploadError

  const closeCrop = () => setCrop(current => ({ ...current, open: false }))

  const handleFiles = (files) => {
    if (!files || files.length !== 1) return
    const file = files[0]
    setFileMessage(null)
    if (file.type.split('/')[0] !== 'image') {
      setFileMessage(t('ERROR_ONLY_IMAGES', 'Only images can be accepted'))
      return
    }
    if (bytesConverter(file?.size) > MAXIMUM_KILOBYTES) {
      setFileMessage(t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes'))
      return
    }
    const reader = new window.FileReader()
    reader.onload = () => setCrop({ open: true, photo: reader.result })
    reader.readAsDataURL(file)
  }

  const handlePick = (event) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = '' // the same file can be picked again
    handleFiles(files)
  }

  const handleChangePhoto = (croppedImg) => {
    handleChangeSwtich('photo', croppedImg)
    closeCrop()
  }

  // The saved photo is what the cropped image becomes: the controller keeps it in `changes.photo` until the upload ends.
  useEffect(() => {
    if (formState.changes?.photo) {
      const isImage = true
      handleButtonUpdateClick(null, isImage)
    }
  }, [formState.changes?.photo])

  return (
    <div className='odc-uf-profile'>
      <DragAndDrop
        className='odc-uf-photo'
        onDrop={dataTransfer => handleFiles(dataTransfer.files)}
        disabled={formState.loading}
      >
        <div className='odc-uf-photo-row'>
          {uploading
            ? <Skeleton shape='round' size='var(--odc-uf-avatar)' block='var(--odc-uf-avatar)' />
            : <Avatar name={fullName} src={justUploaded || user?.photo} size='lg' className='odc-uf-photo-avatar' />}
          <div className='odc-uf-photo-actions'>
            <Button
              ref={buttonRef}
              icon={Image}
              disabled={!!formState.loading}
              aria-describedby={hintId}
              onClick={() => fileRef.current?.click()}
            >
              {t('USER_FORM_CHANGE_PHOTO', 'Change photo')}
            </Button>
            <p id={hintId} className='odc-uf-photo-hint'>
              {t('USER_FORM_PHOTO_HINT', 'JPG or PNG, up to 2 MB. Saved when you choose it.')}
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type='file'
          accept={ACCEPT}
          hidden
          tabIndex={-1}
          aria-hidden='true'
          disabled={!!formState.loading}
          onChange={handlePick}
        />
        {photoError && (
          <p className='odc-uf-photo-error' role='alert'>
            <CircleAlert className='odc-icon' aria-hidden='true' />
            <span>{photoError}</span>
          </p>
        )}
      </DragAndDrop>
      <UserFormDetailsUI
        {...props}
        userData={user}
      />
      <Dialog
        open={crop.open}
        onOpenChange={closeCrop}
        title={t('IMAGE_CROP', 'Image crop')}
        closeLabel={t('CLOSE', 'Close')}
        size='lg'
        returnFocus={buttonRef}
      >
        {crop.photo && (
          <ImageCrop
            photo={crop.photo}
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
