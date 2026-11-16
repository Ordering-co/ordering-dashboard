import React, { useEffect, useRef, useState } from 'react'
import {
  useLanguage,
  useUtils,
  BusinessTypeDetail as BusinessTypeDetailController
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { TriangleAlert } from '../../Shared/Icon'
import { ConfirmDialog, InlineNotice, SaveBar, TextField, useLeaveGuard, useSectionSplit } from '../../Shared/Product'
import { ImageField } from '../../Shared/Product/ImageField'
import { bytesConverter } from '../../../utils'
import './business-type-detail.css'

// redesign stores 5.2 (; decisions 4, 5, D7, D9; G2-05, G2-09, G2-10, G2-26): the detail of one business type, inside the
// P/SectionSplit of `S/BusinessTypes` (which draws its title, X / «‹ Back» and the «⋯» menu). One form, held until «Save» in the save
// bar (counts and names what changed, Discard, the reason of a failed save, «Saved»), with the editor's leave guard: another type, the
// close, another subsection or section ask first when something is unsaved.
// - The image goes through P/ImageField: the crop happens before anything is held, so closing it leaves nothing pending.
// - Delete exists only for a type that is saved; `deleteRef.current()` (the «⋯» item of the host) asks first, and the question says the
//   type is deleted for the whole project, from every store that uses it.
// Same requests as `main` (the controller): `POST /business_types/:id`, `POST /business_types`, `DELETE /business_types/:id`.

const MAX_IMAGE_KB = 2048
const SAVED_NOTICE_MS = 4000

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const BusinessTypeDetailUI = (props) => {
  const {
    businessTypeState,
    typeFormState,
    handleChangeItem,
    handleUpdateProductType,
    handleAddProductType,
    handleDeleteProductType,
    cleanChanges,
    deleteRef
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const businessType = businessTypeState?.businessType
  const isNew = !businessType?.id
  const changes = typeFormState?.changes || {}
  const loading = !!typeFormState?.loading
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const [nameError, setNameError] = useState(null)
  const [imageError, setImageError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [deleting, setDeleting] = useState({ open: false, busy: false, error: null })

  const storedName = businessType?.name ?? ''
  const name = 'name' in changes ? String(changes.name ?? '') : storedName
  const labels = { image: t('IMAGE', 'Image'), name: t('NAME', 'Name') }
  const changedKeys = ['image', 'name'].filter(key => key in changes && (key !== 'name' || name !== storedName))
  const count = changedKeys.length
  const dirty = count > 0

  const withCount = (template, value) => template.replace('_count_', String(value))

  const validateImage = (file) => {
    if (file?.type?.split('/')[0] !== 'image') {
      setImageError(t('ERROR_ONLY_IMAGES', 'Only images can be accepted'))
      return false
    }
    if (bytesConverter(file?.size) > MAX_IMAGE_KB) {
      setImageError(t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes'))
      return false
    }
    setImageError(null)
    return true
  }

  // review r1-5: a failed delete is said until the user goes on with the form
  const clearDeleteError = () => setDeleting(previous => (previous.error ? { ...previous, error: null } : previous))

  const hold = (key, value) => {
    setSaved(false)
    setSaveError(null)
    clearDeleteError()
    if (key === 'name') setNameError(null)
    handleChangeItem(key, value)
  }

  const save = async () => {
    if (loading) return { ok: false }
    if (!name.trim()) {
      setNameError(t('BUSINESS_TYPE_NAME_REQUIRED', 'Enter a name for the category.'))
      return { ok: false }
    }
    clearDeleteError()
    setSaved(false)
    setSaveError(null)
    const result = isNew ? await handleAddProductType() : await handleUpdateProductType()
    if (!mounted.current) return result
    if (result?.ok) setSaved(true)
    else setSaveError(translateApiMessage(t, firstMessage(result?.error), t('BUSINESS_TYPE_SAVE_FAILED', 'The category could not be saved.')))
    return result
  }

  const discard = () => {
    cleanChanges()
    setNameError(null)
    setImageError(null)
    setSaveError(null)
    setResetKey(key => key + 1)
  }

  useLeaveGuard({
    dirty,
    count,
    save,
    discard,
    registerCloseGuard: useSectionSplit().registerCloseGuard
  })

  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [saved])

  // ── Delete (the «⋯» of the host calls it) ──
  useEffect(() => {
    if (!deleteRef) return undefined
    deleteRef.current = isNew ? null : () => setDeleting({ open: true, busy: false, error: null })
    return () => { deleteRef.current = null }
  })

  const confirmDelete = async () => {
    setDeleting(previous => ({ ...previous, busy: true, error: null }))
    const result = await handleDeleteProductType()
    if (!mounted.current) return
    if (result?.ok) {
      setDeleting({ open: false, busy: false, error: null })
      return
    }
    setDeleting({
      open: false,
      busy: false,
      error: translateApiMessage(t, firstMessage(result?.error), t('BUSINESS_TYPE_DELETE_FAILED', 'The category could not be deleted.'))
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (dirty) save()
  }

  const storedImage = businessType?.image
  const imageValue = 'image' in changes ? changes.image : (storedImage ? optimizeImage(storedImage, 'h_200,c_limit') : '')
  const errorText = nameError ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.').replace('_count_', '1') : saveError

  return (
    <>
      <form className='odc-bt-form' tabIndex={-1} noValidate onSubmit={handleSubmit}>
        {deleting.error && (
          <InlineNotice tone='warning' icon={TriangleAlert}>{deleting.error}</InlineNotice>
        )}
        <ImageField
          key={`type-image-${resetKey}`}
          label={labels.image}
          hint={t('STORE_IMAGE_HINT', 'PNG or JPG, up to 2 MB. Drag an image here or choose one.')}
          changeLabel={t('BUSINESS_TYPE_CHANGE_IMAGE', 'Change category image')}
          changeText={t('CHANGE', 'Change')}
          cropTitle={t('IMAGE_CROP', 'Image crop')}
          closeLabel={t('CLOSE', 'Close')}
          droppable
          tooManyFilesText={t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')}
          disabled={loading}
          value={imageValue}
          previewAlt={labels.image}
          validateFile={validateImage}
          error={imageError}
          onChange={(image) => hold('image', image)}
        />
        <TextField
          label={labels.name}
          required
          requiredLabel={t('REQUIRED', 'Required')}
          value={name}
          onChange={(value) => hold('name', value)}
          error={nameError}
          disabled={loading}
          autoComplete='off'
        />
        <SaveBar
          className='odc-bt-savebar'
          formSelector='.odc-bt-form'
          label={t('SAVE_CHANGES', 'Save changes')}
          count={count}
          countText={withCount(count === 1
            ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
            : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
          names={changedKeys.map(key => labels[key])}
          moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
          saving={loading}
          errorText={errorText}
          onRetry={!nameError && saveError && dirty ? () => save() : undefined}
          retryLabel={t('TRY_AGAIN', 'Try again')}
          saved={saved}
          savedText={t('SAVED', 'Saved')}
          discardLabel={t('DISCARD', 'Discard')}
          saveLabel={isNew ? t('ADD_CATEGORY', 'Add category') : t('SAVE_CHANGES', 'Save changes')}
          saveType='submit'
          onDiscard={discard}
        />
      </form>
      <ConfirmDialog
        open={deleting.open}
        tone='danger'
        busy={deleting.busy}
        title={t('BUSINESS_TYPE_DELETE_TITLE', 'Delete _name_ for the whole project?').replace('_name_', storedName)}
        confirmLabel={t('DELETE_CATEGORY', 'Delete category')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setDeleting(previous => (previous.busy ? previous : { ...previous, open: false }))}
        onConfirm={confirmDelete}
      >
        {t('BUSINESS_TYPE_DELETE_BODY', 'It is removed from every store that uses it, not only from this one. This can\'t be undone.')}
      </ConfirmDialog>
    </>
  )
}

export const BusinessTypeDetail = (props) => {
  const businessTypeDetailProps = {
    ...props,
    UIComponent: BusinessTypeDetailUI
  }
  return <BusinessTypeDetailController {...businessTypeDetailProps} />
}
