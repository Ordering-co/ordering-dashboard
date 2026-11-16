import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { bytesConverter } from '../../../utils'
import { Ellipsis, Trash2, TriangleAlert } from '../../Shared/Icon'
import { AsyncSwitch, Button, ConfirmDialog, InlineNotice, Menu, NumberField, TextField } from '../../Shared/Product'
import { ImageField } from '../../Shared/Product/ImageField'
import '../GiftCards/gift-cards-catalog.css'

// redesign GC-C (; D6, GC-06, GC-08, GC-09, GC-12, GC-13, GC-17, GC-18): the card of one gift card for sale, on Product.
// It lives inside the sheet of the catalog (GiftCardsCatalogUI), which owns the title, the way back and the discard guard: this part
// tells it, through `onDirtyChange`, whether the form holds changes that are not saved.
//
// - The Enabled switch saves at once, as in `main` (AsyncSwitch: it waits for the API and goes back if the save fails).
// - Name and Amount are required; the error shows in its own field, with the field's visible name, and the focus goes to the first.
// - The image is only changed by a confirmed crop (`main` saved the original when the crop was cancelled, GC-17).
// - The controller's own toasts stay. Errors travel through `{ silent: true }` and are shown here, translated.

const MAX_IMAGE_KB = 2048 // 2 MB, as `main` (bytesConverter gives kilobytes)
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg']
const AMOUNT_FORMAT = { minimumFractionDigits: 0, maximumFractionDigits: 2 }

// The first text of an API error: a string, `{ message }`, or a list of either.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))

// redesign GC-D (R4): the delete dialog hands the focus back to the menu item that opened it, which is gone (the menu closed), and
// the sheet around it ends up taking the focus to its first «Close». Once the dialog has left, the focus is put where the person was:
// «More actions». It waits for the dialog to be gone (its exit transition, and the focus it hands back) and takes the focus after.
const FOCUS_AFTER_DIALOG_FRAMES = 90
const focusAfterDialog = (getTarget) => {
  let frames = 0
  const step = () => {
    frames++
    if (document.querySelector('[role="alertdialog"]') && frames < FOCUS_AFTER_DIALOG_FRAMES) return nextFrame(step)
    nextFrame(() => nextFrame(() => getTarget()?.focus({ preventScroll: true })))
  }
  nextFrame(step)
}

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(number) ? number : null
}

export const GiftCardEditorUI = (props) => {
  const {
    product,
    formState,
    handleChangeItem,
    handleAddProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    onDirtyChange
  } = props

  const [, t] = useLanguage()
  const isNew = !product?.id
  const changes = formState?.changes || {}
  const busy = formState?.loading === true

  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [imageError, setImageError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)
  const amountRef = useRef(null)
  const rootRef = useRef(null)

  const name = changes.name ?? product?.name ?? ''
  // an emptied Amount is `null` in the changes: it must not fall back to the stored price
  const amount = toNumber('price' in changes ? changes.price : product?.price)
  const image = changes.image ?? product?.image

  // What really differs from the stored card: typing the stored value back is not a change.
  const dirty = ('name' in changes && (changes.name ?? '') !== (product?.name ?? '')) ||
    ('price' in changes && toNumber(changes.price) !== toNumber(product?.price)) ||
    ('image' in changes && changes.image !== product?.image)

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty])
  useEffect(() => () => onDirtyChange?.(false), [])

  const requiredText = (label) => t('VALIDATION_ERROR_REQUIRED', 'Value is required').replace('_attribute_', label)

  const handleName = (value) => {
    handleChangeItem({ name: value })
    setErrors(prev => ({ ...prev, name: undefined }))
    setSaveError(null)
  }

  const handleAmount = (value) => {
    handleChangeItem({ price: value })
    setErrors(prev => ({ ...prev, price: undefined }))
    setSaveError(null)
  }

  const validateImage = (file) => {
    if (!IMAGE_TYPES.includes(file?.type)) {
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

  // Only the confirmed crop changes the image
  const handleImage = (dataUrl) => {
    setImageError(null)
    setSaveError(null)
    handleChangeItem({ image: dataUrl })
  }

  const toggleEnabled = (next) => handleUpdateProduct({ enabled: next }, { silent: true })

  const submit = async (event) => {
    event?.preventDefault?.()
    if (busy || !dirty) return
    const nextErrors = {}
    if (String(name).trim() === '') nextErrors.name = requiredText(t('NAME', 'Name'))
    if (amount === null) nextErrors.price = requiredText(t('AMOUNT', 'Amount'))
    setErrors(nextErrors)
    if (nextErrors.name || nextErrors.price) {
      const first = nextErrors.name ? nameRef.current : amountRef.current
      first?.focus()
      return
    }
    setSaveError(null)
    setSaving(true)
    const result = isNew
      ? await handleAddProduct('gift_card', { silent: true })
      : await handleUpdateProduct(undefined, { silent: true })
    setSaving(false)
    if (result && result.ok === false) {
      setSaveError(translateApiMessage(t, firstMessage(result.error), t('GIFT_CARD_SAVE_ERROR', "The gift card wasn't saved. Try again.")))
    }
  }

  const moreActions = () => rootRef.current?.querySelector('[data-gcc-more]')
  const askDelete = () => setConfirmDelete(true)
  // Cancel, Escape and the X of the dialog: nothing is deleted and the person is back on «More actions» (R4)
  const cancelDelete = () => {
    setConfirmDelete(false)
    focusAfterDialog(moreActions)
  }
  const doDelete = async () => {
    setDeleting(true)
    const result = await handleDeleteProduct({ silent: true })
    setDeleting(false)
    if (result && result.ok === false) {
      setConfirmDelete(false)
      focusAfterDialog(moreActions) // R4: the error shows in the foot; the focus is where the person was
      setSaveError(translateApiMessage(t, firstMessage(result.error), t('GIFT_CARD_DELETE_ERROR', "The gift card wasn't deleted. Try again.")))
    }
  }

  const deleteTitle = t('GIFT_CARD_DELETE_TITLE', 'Delete _name_?').replace('_name_', product?.name ?? '')

  return (
    <div ref={rootRef} className='odc-root odc-gcc-editor'>
      {!isNew && (
        <div className='odc-gcc-editor-bar'>
          <AsyncSwitch
            checked={product.enabled === true}
            failureText={t('GIFT_CARD_TOGGLE_ERROR', "The gift card didn't change. Try again.")}
            onToggle={toggleEnabled}
          >
            {t('ENABLED', 'Enabled')}
          </AsyncSwitch>
          <Menu
            label={t('MORE_ACTIONS', 'More actions')}
            icon={Ellipsis}
            triggerProps={{ 'data-gcc-more': '' }}
            items={[{
              key: 'delete',
              label: t('DELETE', 'Delete'),
              icon: Trash2,
              tone: 'danger',
              onSelect: askDelete
            }]}
          />
        </div>
      )}

      <form className='odc-gcc-form' noValidate onSubmit={submit}>
        <div className='odc-gcc-fields'>
          <ImageField
            label={t('IMAGE', 'Image')}
            hint={t('STORE_IMAGE_HINT', 'PNG or JPG, up to 2 MB. Drag an image here or choose one.')}
            changeLabel={t('GIFT_CARD_CHANGE_IMAGE', 'Change gift card image')}
            changeText={t('CHANGE', 'Change')}
            cropTitle={t('IMAGE_CROP', 'Image crop')}
            closeLabel={t('CLOSE', 'Close')}
            droppable
            tooManyFilesText={t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')}
            disabled={busy}
            value={image}
            previewAlt={product?.name || t('NEW_GIFT_CARD', 'New gift card')}
            validateFile={validateImage}
            error={imageError}
            onChange={handleImage}
          />
          <TextField
            ref={nameRef}
            name='name'
            label={t('NAME', 'Name')}
            required
            requiredLabel={t('REQUIRED', 'Required')}
            autoComplete='off'
            disabled={busy}
            value={name}
            error={errors.name}
            onChange={handleName}
          />
          <NumberField
            ref={amountRef}
            name='price'
            label={t('AMOUNT', 'Amount')}
            required
            requiredLabel={t('REQUIRED', 'Required')}
            autoComplete='off'
            min={0}
            step={0.01}
            format={AMOUNT_FORMAT}
            disabled={busy}
            value={amount}
            error={errors.price}
            onChange={handleAmount}
          />
        </div>

        <div className='odc-gcc-foot'>
          {saveError && (
            <InlineNotice tone='danger' icon={TriangleAlert} role='alert' className='odc-gcc-foot-note'>
              {saveError}
            </InlineNotice>
          )}
          <Button type='submit' variant='primary' busy={saving} disabled={!dirty}>
            {isNew ? t('ADD', 'Add') : t('SAVE', 'Save')}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title={deleteTitle}
        confirmLabel={t('DELETE', 'Delete')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleting}
        onConfirm={doDelete}
        onCancel={cancelDelete}
      >
        {t('DRIVERS_GROUPS_CANT_UNDO', "This can't be undone.")}
      </ConfirmDialog>
    </div>
  )
}
