import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, BusinessFormDetails as BusinessFormDetailsController, useConfig, useSession, useToast, ToastType } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { AsyncSwitch, Field, RadioGroup, SaveBar, Switch, TextField, useLeaveGuard } from '../../Shared/Product'
import { ImageField } from '../../Shared/Product/ImageField'
import { ColorField } from '../../Shared/Product/ColorField'
import { bytesConverter, shape, ribbonValues } from '../../../utils'
import { BUSINESS_VERTICALS } from '../../../../../constants/school'
import {
  SOCIAL_NETWORKS,
  FIELD_ORDER,
  changedFieldNames,
  disabledReasonOptions,
  effectiveRibbon,
  priceLevels,
  socialHandle,
  socialValue,
  validateInformation,
  valueOf
} from './informationModel'
import './business-information.css'

// redesign stores 5.1a (decision 4 of Stores): Information on Product. One way to save: every field waits for the
// sticky «Save» of P/SaveBar, and leaving with unsaved work asks (P/LeaveGuard). The two export switches (Eatstreet, Restaurant
// Direct) still save at once, as P/AsyncSwitch, controlled by the stored value. Same fields, conditions and request as main
// (`ordering.businesses(id).save(changes)` through BusinessFormDetails); the rules live in informationModel.js.

const SAVED_NOTICE_MS = 4000
const MAX_IMAGE_KB = 2048

// The first text of an API error: a string, `{ message }`, or a list of either.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const BusinessInformationUI = (props) => {
  const {
    formState,
    businessState,
    handleChangeInput,
    handleButtonUpdateClick,
    handleDiscardChanges,
    handleChangeSwtich,
    handleChangeRibbon,
    handleChangeSelectedOption,
    isGoogleRedirectPluginActive,
    googleRedirectPluginRoot,
    googleRedirectPluginLoading,
    feedInclusionLoading,
    isSecondaryIncluded,
    onGoogleFeedToggle,
    isPrimaryIncluded,
    onGoogleFeedPrimaryToggle
  } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ configs }] = useConfig()
  const [{ user }] = useSession()
  const isAdmin = user?.level === 0
  const business = businessState?.business || {}
  const changes = formState?.changes || {}
  const loading = !!formState?.loading

  const [errors, setErrors] = useState({})
  const [imageErrors, setImageErrors] = useState({})
  const [socialDrafts, setSocialDrafts] = useState({})
  const [saved, setSaved] = useState(false)
  // review F7: the bar stays «saving» from the press to the answer, so it never goes away for a render in between (it would hand
  // the focus to the form) and «Saved» arrives in the same render the saving ends
  const [submitting, setSubmitting] = useState(false)
  // review F6: Discard also clears what the image fields hold of their own (a «one image at a time» message)
  const [resetKey, setResetKey] = useState(0)
  const formRef = useRef(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const clearError = (...keys) => setErrors(current => {
    if (!keys.some(key => key in current)) return current
    const next = { ...current }
    keys.forEach(key => { delete next[key] })
    return next
  })

  const change = (name, value) => {
    handleChangeInput({ target: { name, value } })
    clearError(name)
  }

  // ---- labels (the save bar names the changed fields with them) ----------------------------------------------------------------
  const labels = {
    header: t('STORE_HEADER_IMAGE', 'Header image'),
    logo: t('LOGO', 'Logo'),
    name: t('NAME', 'Name'),
    vertical: t('VERTICAL', 'Vertical'),
    // redesign tanda AB (S-4b): own key; the live catalogue's EXTERNAL_ID reads «External Id»
    external_id: t('STORE_EXTERNAL_ID', 'External ID'),
    description: t('SHORT_DESCRIPTION', 'Short description'),
    phone: t('PHONE_NUMBER', 'Phone number'),
    cellphone: t('MOBILE_NUMBER', 'Mobile number'),
    featured: t('FEATURED', 'Featured'),
    disabled_reason: t('DISABLED_REASON', 'Disabled reason'),
    price_level: t('PRICE_FILTER', 'Price filter'),
    ribbon: t('RIBBON', 'Ribbon'),
    ...Object.fromEntries(SOCIAL_NETWORKS.map(network => [network.key, t(network.labelKey, network.label)]))
  }
  const names = changedFieldNames(changes, key => labels[key], business)
  const count = names.length
  const dirty = count > 0

  // ---- images (G2-05: nothing is pending until the crop is accepted; G2-26: several files are refused) --------------------------
  const validateImage = (name) => (file) => {
    let message = null
    if (file?.type?.split('/')[0] !== 'image') message = t('ERROR_ONLY_IMAGES', 'Only images can be accepted')
    else if (bytesConverter(file.size) > MAX_IMAGE_KB) message = t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes')
    setImageErrors(current => ({ ...current, [name]: message }))
    return message == null
  }

  // ---- ribbon (main's handler: a store with no ribbon gets main's defaults when it is switched) ----------------------------------
  const ribbon = effectiveRibbon(changes, business)
  const ribbonOn = !!ribbon.enabled
  const handleRibbonSwitch = (value) => {
    clearError('ribbon_text', 'ribbon_color', 'ribbon_shape')
    // (main): a store with no ribbon takes main's defaults on either switch, keeping what was already chosen before
    // saving, so the first enable shows a valid color, text and shape
    if (!business?.ribbon) {
      handleChangeRibbon({ ...ribbonValues, ...changes?.ribbon, enabled: value })
      return
    }
    handleChangeRibbon({ enabled: value })
  }
  const shapeOptions = [
    { value: shape.rectangle, label: t('RIBBON_SHAPE_RECTANGLE', 'Rectangle') },
    { value: shape.rectangleRound, label: t('RIBBON_SHAPE_ROUNDED_RECTANGLE', 'Rounded rectangle') },
    { value: shape.capsuleShape, label: t('RIBBON_SHAPE_CAPSULE', 'Capsule') }
  ]

  // ---- social networks: the field keeps what is typed; the store gets `base + user` (D4) ----------------------------------------
  const socialText = (network) => socialDrafts[network.key] ?? socialHandle(valueOf(changes, business, network.key))
  const changeSocial = (network, typed) => {
    setSocialDrafts(current => ({ ...current, [network.key]: typed }))
    handleChangeSwtich(network.key, socialValue(network.base, typed))
    clearError(network.key)
  }
  const settleSocial = (network) => setSocialDrafts(current => {
    if (!(network.key in current)) return current
    const { [network.key]: _gone, ...rest } = current
    return rest
  })

  // ---- save, discard and the leave guard --------------------------------------------------------------------------------------
  // review F11: from the leave dialog the page is inert for a few frames and the dialog gives the focus back to what opened it, so
  // the focus is put on the first invalid control as soon as it can take it (for up to 60 frames)
  const focusFirstError = (found) => {
    const first = FIELD_ORDER.find(key => key in found)
    let frames = 0
    const attempt = () => {
      const control = formRef.current?.querySelector(`[data-bi-field="${first}"] :is(input, select, button):not([disabled])`)
      if (!control) return
      control.focus()
      if (document.activeElement === control) {
        control.scrollIntoView?.({ block: 'nearest' })
        return
      }
      if (frames++ < 60) window.requestAnimationFrame(attempt)
    }
    attempt()
  }

  const save = async () => {
    if (loading || submitting) return { ok: false }
    const found = validateInformation(changes, business, t)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      focusFirstError(found)
      return { ok: false }
    }
    setSaved(false)
    setSubmitting(true)
    const result = await handleButtonUpdateClick()
    if (!mounted.current) {
      // review F9: «Save and continue» (or a way out while it saved) left the form: the answer is told where it can still be seen
      if (result?.ok) showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
      else showToast(ToastType.Error, translateApiMessage(t, firstMessage(result?.error), t('STORE_INFORMATION_SAVE_FAILED', 'The store could not be saved.')))
      return result
    }
    setSubmitting(false)
    if (result?.ok) {
      setSocialDrafts({})
      setSaved(true)
    }
    return result
  }

  const discard = () => {
    handleDiscardChanges()
    setErrors({})
    setImageErrors({})
    setSocialDrafts({})
    setResetKey(key => key + 1)
  }

  // review F9: «Save and continue» leaves right after a save that worked, so its answer is a toast (the bar goes with the form);
  // when it fails the user stays and the bar says why
  const saveAndLeave = async () => {
    const result = await save()
    if (result?.ok) showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
    return result
  }

  useLeaveGuard({ dirty: () => dirty && !loading, count, save: saveAndLeave, discard })

  // «Saved» for a few seconds after a save that ended well.
  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [saved])

  const withCount = (text, n) => text.replace('_count_', String(n))
  const invalidCount = Object.keys(errors).length
  let errorText = null
  if (invalidCount > 0) {
    errorText = withCount(invalidCount === 1
      ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
      : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.'), invalidCount)
  } else if (formState?.result?.error && !loading) {
    // review F10: also when nothing is pending any more (the second ribbon request failed after the first one was stored)
    errorText = translateApiMessage(t, firstMessage(formState.result.result), t('STORE_INFORMATION_SAVE_FAILED', 'The store could not be saved.'))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (dirty) save()
  }

  // ---- values -----------------------------------------------------------------------------------------------------------------
  const text = (key) => valueOf(changes, business, key) ?? ''
  const reasons = disabledReasonOptions(t, valueOf(changes, business, 'disabled_reason'))
  const prices = priceLevels(configs?.format_number_currency?.value)
  const showExport = isGoogleRedirectPluginActive && googleRedirectPluginRoot && business?.id && isAdmin
  const exportLoading = googleRedirectPluginLoading || feedInclusionLoading
  const requiredLabel = t('REQUIRED', 'Required')
  const cropTitle = t('IMAGE_CROP', 'Image crop')
  const closeLabel = t('CLOSE', 'Close')
  const changeText = t('CHANGE', 'Change')
  const imageHint = t('STORE_IMAGE_HINT', 'PNG or JPG, up to 2 MB. Drag an image here or choose one.')
  const tooManyFilesText = t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')

  return (
    <form ref={formRef} className='odc-bi-form' tabIndex={-1} noValidate onSubmit={handleSubmit}>
      <section className='odc-bi-group' aria-labelledby='odc-bi-images'>
        <h2 id='odc-bi-images' className='odc-bi-heading'>{t('IMAGES', 'Images')}</h2>
        <div className='odc-bi-images'>
          <ImageField
            cropTitle={cropTitle}
            closeLabel={closeLabel}
            changeText={changeText}
            hint={imageHint}
            droppable
            tooManyFilesText={tooManyFilesText}
            disabled={loading}
            key={`header-${resetKey}`}
            data-bi-field='header'
            label={labels.header}
            changeLabel={t('STORE_CHANGE_HEADER_IMAGE', 'Change header image')}
            value={valueOf(changes, business, 'header')}
            previewAlt={labels.header}
            validateFile={validateImage('header')}
            error={imageErrors.header}
            onChange={(image) => handleChangeSwtich('header', image)}
          />
          <ImageField
            cropTitle={cropTitle}
            closeLabel={closeLabel}
            changeText={changeText}
            hint={imageHint}
            droppable
            tooManyFilesText={tooManyFilesText}
            disabled={loading}
            key={`logo-${resetKey}`}
            data-bi-field='logo'
            label={labels.logo}
            changeLabel={t('STORE_CHANGE_LOGO', 'Change logo')}
            value={valueOf(changes, business, 'logo')}
            previewAlt={labels.logo}
            validateFile={validateImage('logo')}
            error={imageErrors.logo}
            onChange={(image) => handleChangeSwtich('logo', image)}
          />
        </div>
      </section>

      {showExport && (
        <section className='odc-bi-group' aria-labelledby='odc-bi-export'>
          <h2 id='odc-bi-export' className='odc-bi-heading'>{t('STORE_EXPORT', 'Export')}</h2>
          <AsyncSwitch
            checked={exportLoading ? false : !!isPrimaryIncluded}
            disabled={exportLoading}
            onToggle={(next) => onGoogleFeedPrimaryToggle?.(next)}
            failureText={t('STORE_EXPORT_FAILED', 'The export could not be changed.')}
          >
            {t('EXPORT_TO_EATSTREET', 'Export to Eatstreet')}
          </AsyncSwitch>
          <AsyncSwitch
            checked={exportLoading ? false : !!isSecondaryIncluded}
            disabled={exportLoading}
            onToggle={(next) => onGoogleFeedToggle?.(next)}
            failureText={t('STORE_EXPORT_FAILED', 'The export could not be changed.')}
          >
            {t('EXPORT_TO_RESTAURANT_DIRECT', 'Export to Restaurant Direct')}
          </AsyncSwitch>
        </section>
      )}

      <section className='odc-bi-group' aria-labelledby='odc-bi-store'>
        <h2 id='odc-bi-store' className='odc-bi-heading'>{t('STORE_NAME_AND_CONTACT', 'Name and contact')}</h2>
        <div data-bi-field='name'>
          <TextField
            label={labels.name}
            required
            requiredLabel={requiredLabel}
            value={text('name')}
            onChange={(value) => change('name', value)}
            error={errors.name}
            disabled={loading}
            autoComplete='off'
          />
        </div>
        <div data-bi-field='vertical'>
          <Field label={labels.vertical} disabled={loading}>
            <select
              className='odc-field-input odc-bi-select'
              value={valueOf(changes, business, 'vertical') ?? 'store'}
              disabled={loading}
              onChange={(event) => handleChangeSelectedOption('vertical', event.target.value)}
            >
              {BUSINESS_VERTICALS.map(vertical => (
                <option key={vertical.value} value={vertical.value}>
                  {t(`BUSINESS_VERTICAL_${vertical.value.toUpperCase()}`, vertical.name)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div data-bi-field='external_id'>
          <TextField
            label={labels.external_id}
            value={text('external_id')}
            onChange={(value) => change('external_id', value)}
            // redesign bugs C: any text, as the API keeps it (main took digits only while typing, so a stored ID with
            // letters could not be typed again)
            disabled={loading}
            autoComplete='off'
          />
        </div>
        <div data-bi-field='description'>
          <TextField
            label={labels.description}
            placeholder={t('TYPE_BUSINESS_SHORT_DESCRIPTION', 'Write a little description')}
            value={text('description')}
            onChange={(value) => change('description', value)}
            disabled={loading}
            autoComplete='off'
          />
        </div>
        <div className='odc-bi-pair'>
          <div data-bi-field='phone'>
            <TextField
              type='tel'
              label={labels.phone}
              placeholder='(000) 0000 000'
              value={text('phone')}
              onChange={(value) => change('phone', value)}
              disabled={loading}
              autoComplete='off'
            />
          </div>
          <div data-bi-field='cellphone'>
            <TextField
              type='tel'
              label={labels.cellphone}
              hint={t('OPTIONAL', 'Optional')}
              placeholder='(000) 0000 000'
              value={text('cellphone')}
              onChange={(value) => change('cellphone', value)}
              disabled={loading}
              autoComplete='off'
            />
          </div>
        </div>
      </section>

      <section className='odc-bi-group' aria-labelledby='odc-bi-listing'>
        <h2 id='odc-bi-listing' className='odc-bi-heading'>{t('STORE_LISTING', 'Listing')}</h2>
        {/* main: only an administrator features a store */}
        {isAdmin && (
          <div data-bi-field='featured'>
            <Switch
              checked={!!valueOf(changes, business, 'featured')}
              disabled={loading}
              onCheckedChange={(value) => handleChangeSwtich('featured', value)}
            >
              {labels.featured}
            </Switch>
          </div>
        )}
        {business?.enabled === false && (
          <div data-bi-field='disabled_reason'>
            <Field label={labels.disabled_reason} disabled={loading}>
              <select
                className='odc-field-input odc-bi-select'
                value={reasons.selected}
                disabled={loading}
                onChange={(event) => handleChangeSelectedOption('disabled_reason', event.target.value)}
              >
                {reasons.selected === '' && <option value='' disabled>{t('SELECT_OPTION', 'Select an option')}</option>}
                {reasons.options.map(option => <option key={option.key} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>
        )}
        <div data-bi-field='price_level'>
          <RadioGroup
            // review F1: mounted again once the store arrives, so the tab stop is the stored level, not the first one
            key={`price-${business?.id ?? 'none'}`}
            label={labels.price_level}
            orientation='horizontal'
            options={prices}
            value={valueOf(changes, business, 'price_level') ?? null}
            disabled={loading}
            onValueChange={(value) => handleChangeSwtich('price_level', value)}
          />
        </div>
      </section>

      <section className='odc-bi-group' aria-labelledby='odc-bi-ribbon'>
        <h2 id='odc-bi-ribbon' className='odc-bi-heading'>{labels.ribbon}</h2>
        <div data-bi-field='ribbon'>
          <Switch checked={ribbonOn} disabled={loading} onCheckedChange={handleRibbonSwitch}>
            {t('STORE_SHOW_RIBBON', 'Show a ribbon on the store')}
          </Switch>
        </div>
        {ribbonOn && (
          <>
            <div data-bi-field='ribbon_text'>
              <TextField
                label={t('TEXT', 'Text')}
                required
                requiredLabel={requiredLabel}
                value={ribbon.text ?? ''}
                onChange={(value) => {
                  handleChangeRibbon({ text: value })
                  clearError('ribbon_text')
                }}
                error={errors.ribbon_text}
                disabled={loading}
                autoComplete='off'
              />
            </div>
            <div data-bi-field='ribbon_color'>
              <ColorField
                label={t('COLOR', 'Color')}
                required
                requiredLabel={requiredLabel}
                value={ribbon.color}
                error={errors.ribbon_color}
                disabled={loading}
                onChange={(color) => {
                  handleChangeRibbon({ color })
                  clearError('ribbon_color')
                }}
              />
            </div>
            <div data-bi-field='ribbon_shape'>
              <RadioGroup
                label={t('SHAPE', 'Shape')}
                // redesign bugs F row 38: informationModel requires the shape while the ribbon is on, as its neighbours say
                required
                requiredLabel={requiredLabel}
                orientation='horizontal'
                options={shapeOptions}
                value={ribbon.shape ?? null}
                disabled={loading}
                aria-invalid={errors.ribbon_shape ? true : undefined}
                aria-describedby={errors.ribbon_shape ? 'odc-bi-shape-error' : undefined}
                onValueChange={(value) => {
                  handleChangeRibbon({ shape: value })
                  clearError('ribbon_shape')
                }}
              />
              {errors.ribbon_shape && <p id='odc-bi-shape-error' className='odc-field-error odc-bi-error' role='alert'>{errors.ribbon_shape}</p>}
            </div>
          </>
        )}
      </section>

      <section className='odc-bi-group' aria-labelledby='odc-bi-social'>
        <h2 id='odc-bi-social' className='odc-bi-heading'>{t('SOCIAL_NETWORKS', 'Social networks')}</h2>
        {SOCIAL_NETWORKS.map(network => (
          <div key={network.key} data-bi-field={network.key}>
            <TextField
              label={labels[network.key]}
              hint={network.base}
              placeholder={network.key === 'whatsapp_number' ? t('PHONE_NUMBER', 'Phone number') : t('USER_OR_URL', 'User or url')}
              value={socialText(network)}
              onChange={(value) => changeSocial(network, value)}
              onBlur={() => settleSocial(network)}
              error={errors[network.key]}
              disabled={loading}
              autoComplete='off'
              inputMode={network.key === 'whatsapp_number' ? 'tel' : undefined}
            />
          </div>
        ))}
      </section>

      <SaveBar
        className='odc-bi-savebar'
        formSelector='.odc-bi-form'
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={withCount(count === 1
          ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
          : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
        names={names}
        moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
        saving={loading || submitting}
        errorText={errorText}
        onRetry={invalidCount === 0 && errorText && dirty ? () => save() : undefined}
        retryLabel={t('TRY_AGAIN', 'Try again')}
        saved={saved}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={t('SAVE_CHANGES', 'Save changes')}
        saveType='submit'
        onDiscard={discard}
      />
    </form>
  )
}

export const BusinessInformation = (props) => {
  const businessInformationProps = {
    ...props,
    UIComponent: BusinessInformationUI
  }
  // D7: the save bar is the feedback, so the controller's «Loading» and «Business updated» toasts are off here
  return <BusinessFormDetailsController {...businessInformationProps} silentToasts />
}
