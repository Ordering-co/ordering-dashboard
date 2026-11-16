import React, { useEffect, useRef, useState } from 'react'
import {
  useLanguage,
  useUtils,
  BusinessBrandGENDetail as BusinessBrandGENDetailContorller
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { RadioGroup, SaveBar, Switch, TextField, useLeaveGuard } from '../../Shared/Product'
import { ColorField } from '../../Shared/Product/ColorField'
import { ImageField } from '../../Shared/Product/ImageField'
import { bytesConverter, shape, ribbonValues, stringToSlug } from '../../../utils'
import './brand-general.css'

// redesign SB-B3 (; decision 3, G5-30, G5-46, M-SB5, auditor 4, 10 and 14): the General tab of one brand (or the create form),
// inside the record panel of `S/BusinessBrandListing`. One form held until «Save» in the save bar (counts and names what changed,
// Discard, the reason of a failed save, «Saved»), with the leave guard: another brand, the close or Esc ask first when something is
// unsaved (`onDirtyChange(dirty)` tells the panel).
// - The logo goes through P/ImageField: crop, 2 MB and «Only images» as before (`validateFile`), drag and drop (auditor 4). While a
//   save fails the preview keeps the pending logo (M-SB5): it is drawn from `changes`, which the controller keeps on a failure.
// - The ribbon shapes are a P/RadioGroup of cards (arrows, Home/End), not clickable `div`s (G5-30).
// - G5-46: the name only fills the slug when creating. A saved brand keeps its slug whatever the name says.
// - The ribbon text is validated as in `main` (only a text emptied by hand blocks the save), but the error is said in the field.
// - Auditor 14: ColorPicker reports a picked color 750 ms after the last change (as in `main`); Discard and another brand remount the
//   field, which cancels a report still pending.
// Same requests as `main` (the controller): `POST /franchises` and `POST /franchises/:id`.

const MAX_IMAGE_KB = 2048
const SAVED_NOTICE_MS = 4000
const ACCEPT = 'image/png, image/jpeg, image/jpg'

const FIELD_KEYS = ['logo', 'name', 'slug', 'ribbon', 'ribbonText', 'color', 'shape']

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const sameColor = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()

const BusinessBrandGENDetailUI = (props) => {
  const {
    brand,
    brandFormState,
    handleUpdateClick,
    handleChangeItem,
    handleChangeRibbon,
    handleDiscard,
    onDirtyChange
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const isNew = !brand?.id
  const changes = brandFormState?.changes || {}
  const ribbonChanges = changes.ribbon || {}
  const storedRibbon = brand?.ribbon
  const loading = !!brandFormState?.loading
  const result = brandFormState?.result

  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const formRef = useRef(null)

  const [textError, setTextError] = useState(null)
  const [imageError, setImageError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [hiddenResult, setHiddenResult] = useState(null)
  const [resetKey, setResetKey] = useState(0)

  // ── Values: what is held over what is saved ──
  const storedName = brand?.name ?? ''
  const storedSlug = brand?.slug ?? ''
  const name = 'name' in changes ? String(changes.name ?? '') : storedName
  const slug = 'slug' in changes ? String(changes.slug ?? '') : storedSlug
  const ribbonEnabled = typeof ribbonChanges.enabled !== 'undefined' ? !!ribbonChanges.enabled : !!storedRibbon?.enabled
  // redesign bugs C: no default text: «ribbon» used to stand in for a text nobody wrote, and reached the customers
  const storedText = storedRibbon?.text ?? ''
  const storedColor = storedRibbon?.color ?? ribbonValues.color
  const storedShape = storedRibbon?.shape ?? ribbonValues.shape
  const ribbonText = ribbonChanges.text ?? storedText
  const ribbonColor = ribbonChanges.color ?? storedColor
  const ribbonShape = ribbonChanges.shape ?? storedShape

  const labels = {
    logo: t('LOGO', 'Logo'),
    name: t('NAME', 'Name'),
    slug: t('SLUG', 'Slug'),
    ribbon: t('RIBBON', 'Ribbon'),
    ribbonText: t('RIBBON_TEXT', 'Ribbon text'),
    color: t('COLOR', 'Color'),
    shape: t('SHAPE', 'Shape')
  }
  // The seeded defaults of a ribbon turned on are not edits: only what differs from them (or from what is saved) counts.
  const changed = {
    logo: 'logo' in changes,
    name: 'name' in changes && name !== storedName,
    slug: !isNew && 'slug' in changes && slug !== storedSlug,
    ribbon: typeof ribbonChanges.enabled !== 'undefined' && !!ribbonChanges.enabled !== !!storedRibbon?.enabled,
    ribbonText: ribbonEnabled && 'text' in ribbonChanges && ribbonChanges.text !== storedText,
    color: ribbonEnabled && 'color' in ribbonChanges && !sameColor(ribbonChanges.color, storedColor),
    shape: ribbonEnabled && 'shape' in ribbonChanges && ribbonChanges.shape !== storedShape
  }
  const changedKeys = FIELD_KEYS.filter(key => changed[key])
  const count = changedKeys.length
  const dirty = count > 0

  const withCount = (template, value) => template.replace('_count_', String(value))

  const latest = useRef({})
  latest.current = { handleUpdateClick, count, loading }

  const touch = () => {
    setSaved(false)
    setHiddenResult(result ?? null)
  }

  const onColor = (hex) => {
    touch()
    handleChangeRibbon({ color: hex })
  }

  // ── Image ──
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

  // ── Handlers ──
  const changeName = (value) => {
    touch()
    // G5-46: only a brand that does not exist yet takes its slug from the name
    handleChangeItem(isNew ? { name: value, slug: stringToSlug(value) } : { name: value })
  }

  const changeRibbon = (value) => {
    touch()
    setTextError(null)
    if (!value) {
      handleChangeRibbon({ enabled: false })
      return
    }
    // a ribbon turned on needs its text, color and shape: the color and the shape not saved take the defaults (`ribbonValues`, as
    // before); the text is asked for (bugs C, it used to be «ribbon»)
    const seeded = { enabled: true }
    if (storedRibbon?.color == null && ribbonChanges.color == null) seeded.color = ribbonValues.color
    if (storedRibbon?.shape == null && ribbonChanges.shape == null) seeded.shape = ribbonValues.shape
    handleChangeRibbon(seeded)
  }

  const save = async () => {
    const current = latest.current
    if (current.loading) return { ok: false }
    // a ribbon turned on, or a text typed, needs a text that is not blank; a saved ribbon left as it is does not block the save
    if (ribbonEnabled && ribbonText.trim() === '' && (changed.ribbon || 'text' in ribbonChanges)) {
      setTextError(t('VALIDATION_ERROR_REQUIRED', 'Value is required').replace('_attribute_', labels.ribbonText)) //
      return { ok: false }
    }
    setSaved(false)
    setHiddenResult(null)
    const answer = await current.handleUpdateClick()
    if (!mounted.current) return answer
    if (answer?.ok) setSaved(true)
    return answer
  }

  const discard = () => {
    handleDiscard?.()
    setTextError(null)
    setImageError(null)
    setHiddenResult(null)
    setSaved(false)
    // remounting the image and color fields drops what they still hold (a crop in progress, the picker's pending report)
    setResetKey(key => key + 1)
  }

  useLeaveGuard({
    dirty: () => latest.current.count > 0,
    count: Math.max(count, 1),
    save,
    discard
  })

  // the panel's own guard asks about the form through this
  const dirtyRef = useRef(onDirtyChange)
  dirtyRef.current = onDirtyChange
  useEffect(() => { dirtyRef.current?.(dirty) }, [dirty])
  useEffect(() => () => { dirtyRef.current?.(false) }, [])

  // another brand: nothing of the last one stays in the form
  const brandId = brand?.id
  const firstBrand = useRef(true)
  useEffect(() => {
    if (firstBrand.current) {
      firstBrand.current = false
      return
    }
    setTextError(null)
    setImageError(null)
    setHiddenResult(null)
    setSaved(false)
    setResetKey(key => key + 1)
  }, [brandId])

  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [saved])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (dirty || isNew) save()
  }

  const storedLogo = brand?.logo
  const logoValue = 'logo' in changes ? changes.logo : (storedLogo ? optimizeImage(storedLogo, 'h_200,c_limit') : '')

  const apiError = result?.error && result !== hiddenResult
    ? translateApiMessage(t, firstMessage(result?.result), t('BRAND_SAVE_FAILED', 'The brand could not be saved.'))
    : null
  const errorText = textError ? withCount(t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.'), 1) : apiError
  const countText = count > 0
    ? withCount(count === 1
      ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
      : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)
    : undefined

  const shapeOptions = [
    { value: shape.rectangle, label: t('RIBBON_SHAPE_RECTANGLE', 'Rectangle') },
    { value: shape.rectangleRound, label: t('RIBBON_SHAPE_ROUNDED_RECTANGLE', 'Rounded rectangle') },
    { value: shape.capsuleShape, label: t('RIBBON_SHAPE_CAPSULE', 'Capsule') }
  ].map(option => ({
    ...option,
    media: <span className='odc-brand-shape' data-shape={option.value} />
  }))

  return (
    <form ref={formRef} className='odc-brand-general' tabIndex={-1} noValidate onSubmit={handleSubmit}>
      <ImageField
        key={`brand-logo-${resetKey}`}
        label={labels.logo}
        hint={t('STORE_IMAGE_HINT', 'PNG or JPG, up to 2 MB. Drag an image here or choose one.')}
        changeLabel={`${t('CHANGE', 'Change')} ${labels.logo}`}
        changeText={t('CHANGE', 'Change')}
        cropTitle={t('IMAGE_CROP', 'Image crop')}
        closeLabel={t('CLOSE', 'Close')}
        accept={ACCEPT}
        droppable
        tooManyFilesText={t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')}
        disabled={loading}
        value={logoValue}
        previewAlt={labels.logo}
        validateFile={validateImage}
        error={imageError}
        onChange={(logo) => {
          touch()
          handleChangeItem({ logo })
        }}
      />
      <TextField
        label={labels.name}
        value={name}
        onChange={changeName}
        placeholder={t('WRITE_A_NAME', 'Write a name')}
        disabled={loading}
        autoComplete='off'
      />
      {!isNew && (
        <TextField
          label={labels.slug}
          hint={t('BRAND_SLUG_HINT', 'Renaming the brand keeps this slug.')}
          value={slug}
          onChange={(value) => {
            touch()
            handleChangeItem({ slug: value })
          }}
          placeholder={t('WRITE_A_SLUG', 'Write a slug')}
          disabled={loading}
          autoComplete='off'
          onKeyDown={(event) => {
            if (event.key === ' ') event.preventDefault()
          }}
        />
      )}
      <Switch checked={ribbonEnabled} onCheckedChange={changeRibbon} disabled={loading}>
        {labels.ribbon}
      </Switch>
      {ribbonEnabled && (
        <div className='odc-brand-ribbon'>
          <TextField
            label={labels.ribbonText}
            required
            requiredLabel={t('REQUIRED', 'Required')}
            value={ribbonText}
            onChange={(value) => {
              touch()
              setTextError(null)
              handleChangeRibbon({ text: value })
            }}
            error={textError}
            disabled={loading}
            autoComplete='off'
          />
          <ColorField
            key={`brand-color-${resetKey}`}
            label={labels.color}
            value={ribbonColor}
            onChange={onColor}
            disabled={loading}
          />
          <RadioGroup
            variant='cards'
            orientation='horizontal'
            label={labels.shape}
            options={shapeOptions}
            value={ribbonShape}
            onValueChange={(next) => {
              touch()
              handleChangeRibbon({ shape: next })
            }}
            disabled={loading}
          />
        </div>
      )}
      <SaveBar
        className='odc-brand-savebar'
        formSelector='.odc-brand-general'
        label={t('SAVE_CHANGES', 'Save changes')}
        count={isNew ? Math.max(count, 1) : count}
        countText={countText}
        names={changedKeys.map(key => labels[key])}
        moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
        saving={loading}
        errorText={errorText}
        onRetry={!textError && apiError && (dirty || isNew) ? () => save() : undefined}
        retryLabel={t('TRY_AGAIN', 'Try again')}
        saved={saved}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={isNew ? t('CREATE_BRAND', 'Create brand') : t('SAVE_CHANGES', 'Save changes')}
        saveType='submit'
        onDiscard={discard}
      />
    </form>
  )
}

export const BusinessBrandGENDetail = (props) => {
  const businessBrandGENDetailProps = {
    ...props,
    UIComponent: BusinessBrandGENDetailUI
  }
  return <BusinessBrandGENDetailContorller {...businessBrandGENDetailProps} />
}
