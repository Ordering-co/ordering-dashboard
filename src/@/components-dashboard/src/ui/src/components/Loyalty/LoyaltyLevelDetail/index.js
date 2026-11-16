import React, { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useLanguage, useUtils, LoyaltyLevelDetail as LoyaltyLevelDetailController } from '../../../../../index'
import { Alert } from '../../Shared'
import { Ellipsis, Trash2 } from '../../Shared/Icon'
import { Button, ConfirmDialog, Menu, RadioGroup, TextField } from '../../Shared/Product'
import { ImageField } from '../../Shared/Product/ImageField'
import { bytesConverter } from '../../../utils'
import './loyalty-level-detail.css'

// the editor of one level in Product pieces. Same controller props, handlers, payloads, validations and alerts as main;
// the «⋯» menu is P/Menu, the delete question P/ConfirmDialog, the image P/ImageField (its own crop dialog), Save a primary P/Button.

const digitsOnly = (e) => {
  if (!/^[0-9]$/.test(e.key)) e.preventDefault()
}

const LoyaltyLevelDetailUI = (props) => {
  const {
    level,
    handleDeleteLevel,
    formState,
    handleChangeInput,
    handleChangeItem,
    addLevel,
    updateLevel,
    handlechangeImage,
    onDirtyChange
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const { handleSubmit } = useForm()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [expiration, setExpiration] = useState(null)
  const [maxValue, setMaxValue] = useState('')

  // a parent that guards leaving (the Settings hub) hears whether the open level holds values that differ from
  // the saved level; typing a value back to the saved one is clean. Without `onDirtyChange` nothing is reported.
  const changes = formState?.changes || {}
  const isDirty = Object.keys(changes).some(key => String(changes[key] ?? '') !== String(level?.[key] ?? ''))
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  useEffect(() => {
    onDirtyChangeRef.current && onDirtyChangeRef.current(isDirty)
  }, [isDirty])
  useEffect(() => () => {
    onDirtyChangeRef.current && onDirtyChangeRef.current(false)
  }, [])

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  // The controller reads `evt.target.name` and `evt.target.value`, as it did from the legacy inputs.
  const changeInput = name => value => handleChangeInput({ target: { name, value } })

  const handleConfirmDelete = () => {
    setConfirmOpen(false)
    handleDeleteLevel()
  }

  const handleChangeMaxValue = (value) => {
    setMaxValue(value)
    if (value) handleChangeItem({ expire_after_minutes: (value * 24 * 60) })
    else handleChangeItem({ expire_after_minutes: null })
  }

  const handleChangeExpirtation = (index) => {
    if (index) {
      setExpiration(index)
      return
    }
    setExpiration(null)
    handleChangeItem({ expire_after_minutes: null })
    setMaxValue('')
  }

  const onSubmit = () => {
    if (formState?.changes?.name === '') {
      setAlertState({
        open: true,
        content: t(
          'VALIDATION_ERROR_REQUIRED',
          'Value is required'
        ).replace('_attribute_', 'name')
      })
      return
    }
    if (formState?.changes?.accumulation_rate === '') {
      setAlertState({
        open: true,
        content: t(
          'VALIDATION_ERROR_REQUIRED',
          'Value is required'
        ).replace('_attribute_', 'accumulation_rate')
      })
      return
    }
    if (formState?.changes?.minimum_points === '') {
      setAlertState({
        open: true,
        content: t(
          'VALIDATION_ERROR_REQUIRED',
          'Value is required'
        ).replace('_attribute_', 'points_required')
      })
      return
    }
    if (level?.id) updateLevel()
    else addLevel()
  }

  // main's checks before the crop (type, then 2 MB), as alerts; a valid file is held at once, as main did, and the crop replaces it.
  const validateImage = (file) => {
    if (file?.type?.split('/')[0] !== 'image') {
      setAlertState({ open: true, content: [t('ERROR_ONLY_IMAGES', 'Only images can be accepted')] })
      return false
    }
    if (bytesConverter(file?.size) > 2048) {
      setAlertState({ open: true, content: [t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes')] })
      return false
    }
    handlechangeImage(file)
    return true
  }

  useEffect(() => {
    if (!formState.error) return
    setAlertState({
      open: true,
      content: formState.error
    })
  }, [formState?.error])

  useEffect(() => {
    if (level?.expire_after_minutes) {
      setMaxValue(level?.expire_after_minutes / (24 * 60))
      setExpiration('days')
    } else {
      setExpiration(null)
      setMaxValue('')
    }
  }, [level?.expire_after_minutes])

  const imageValue = (!formState.changes?.image || formState.error)
    ? (level?.image ? optimizeImage(level?.image, 'h_200,c_limit') : '')
    : formState?.changes?.image

  return (
    <>
      <div className='lld'>
        <div className='lld-head'>
          <h2 className='lld-title'>{level?.id ? (formState?.changes?.name ?? level?.name) : t('NEW_LEVEL', 'New level')}</h2>
          {level?.id && (
            <Menu
              icon={Ellipsis}
              label={t('ACTIONS', 'Actions')}
              items={[{ key: 'delete', label: t('DELETE', 'Delete'), icon: Trash2, tone: 'danger', onSelect: () => setConfirmOpen(true) }]}
            />
          )}
        </div>
        <form className='lld-form' noValidate onSubmit={handleSubmit(onSubmit)}>
          <ImageField
            className='lld-image'
            label={t('IMAGE', 'Image')}
            changeLabel={t('CHANGE', 'Change')}
            cropTitle={t('IMAGE_CROP', 'Image crop')}
            closeLabel={t('CLOSE', 'Close')}
            droppable
            tooManyFilesText={t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')}
            disabled={formState.loading}
            value={imageValue}
            validateFile={validateImage}
            // main sent the crop as handleChangeItem('image', crop), which spread the letters of «image» into the changes and dropped the crop
            onChange={(image) => handleChangeItem({ image })}
          />
          <TextField
            label={t('NAME', 'Name')}
            name='name'
            placeholder={t('Name', 'name')}
            value={formState?.changes?.name ?? level?.name ?? ''}
            onChange={changeInput('name')}
            disabled={formState.loading}
            autoComplete='off'
          />
          <TextField
            label={t('ACCUMULATION_RATE', 'Accumulation rate')}
            name='accumulation_rate'
            className='odc-figure'
            inputMode='numeric'
            value={String(formState?.changes?.accumulation_rate ?? level?.accumulation_rate ?? '')}
            onChange={changeInput('accumulation_rate')}
            disabled={formState.loading}
            autoComplete='off'
            onKeyPress={digitsOnly}
          />
          <TextField
            label={t('POINTS_REQUIRED', 'Points required')}
            name='minimum_points'
            className='odc-figure'
            inputMode='numeric'
            value={String(formState?.changes?.minimum_points ?? level?.minimum_points ?? '')}
            onChange={changeInput('minimum_points')}
            disabled={formState.loading}
            autoComplete='off'
            onKeyPress={digitsOnly}
          />
          <TextField
            label={t('MAXIMUM_OF_POINTS', 'Maximum of points')}
            name='maximum_accumulation_fixed'
            className='odc-figure'
            inputMode='numeric'
            value={String(formState?.changes?.maximum_accumulation_fixed ?? level?.maximum_accumulation_fixed ?? '')}
            onChange={changeInput('maximum_accumulation_fixed')}
            disabled={formState.loading}
            autoComplete='off'
            onKeyPress={digitsOnly}
          />
          <div className='lld-expiration'>
            <RadioGroup
              label={t('EXPIRATION', 'Expiration')}
              options={[
                { value: 'no', label: t('NO', 'No') },
                { value: 'days', label: t('EXPIRATION_IN_DAYS', 'Expiration in days') }
              ]}
              value={expiration ? 'days' : 'no'}
              onValueChange={value => handleChangeExpirtation(value === 'days' ? 'days' : null)}
            />
            {expiration && (
              <TextField
                className='odc-figure'
                fieldClassName='lld-days'
                label={t('DAYS', 'Days')}
                name='expire_after_minutes'
                inputMode='numeric'
                value={String(maxValue)}
                onChange={handleChangeMaxValue}
                onKeyPress={digitsOnly}
              />
            )}
          </div>
          <div className='lld-foot'>
            <Button
              variant='primary'
              type='submit'
              busy={Boolean(formState?.loading)}
              disabled={Object.keys(formState?.changes).length === 0}
            >
              {level?.id ? t('SAVE', 'Save') : t('ADD', 'Add')}
            </Button>
          </div>
        </form>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={t('QUESTION_DELETE_ITEM', 'Are you sure to delete this _item_?').replace('_item_', t('LEVEL', 'Level'))}
        confirmLabel={t('DELETE', 'Delete')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      <Alert
        title={t('LEVEL', 'Level')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const LoyaltyLevelDetail = (props) => {
  const loyaltyLevelDetailProps = {
    ...props,
    UIComponent: LoyaltyLevelDetailUI
  }
  return <LoyaltyLevelDetailController {...loyaltyLevelDetailProps} />
}
