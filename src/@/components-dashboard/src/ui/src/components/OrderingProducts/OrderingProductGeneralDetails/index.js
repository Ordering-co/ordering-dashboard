import React, { useEffect, useId, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, InlineNotice, SaveBar, TextArea, TextField, useLeaveGuard } from '../../Shared/Product'
import { SiteImageField } from './SiteImageField'
import './ordering-product-general.css'

// redesign (lot C, decisions 3, 4, 5, 6 | OP-01, OP-06, OP-08, OP-17): the General tab of a site on Product, in place of the
// react-hook-form + styled-components form of main. The same 13 fields, in three groups (Basics · Images · URL templates), with
// controlled values (`changes[name] ?? site[name] ?? ''`, so nothing hangs on the DOM and a tab switch loses nothing), the same
// checks as main (without the /g flag), the errors under their field and in the bar (no Alert), one SaveBar and the leave guard.
// «Fill from Website» sits with the Images it fills and says its notices inline.

const WRITE_OPTIONS = { inlineError: true }
const ORDERING_PRICING_URL = 'https://www.ordering.co/pricing/'
const SAVED_NOTICE_MS = 4000
const NO_REGISTER = () => () => {} // redesign (review r1, Q-03): see the leave guard below

// redesign (OP-06): the patterns of main, as constants and WITHOUT the /g flag. A global regex remembers where its last
// match ended (`lastIndex`), so checking the same text twice gave opposite answers.
const URL_PATTERN = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/
const BUSINESS_PATTERN = /(^\/)(store)?((\/?:business_slug$)|(\/?\?[a-zA-Z]+=:business_slug$))$/
const CATEGORY_PATTERN = /(store\/)?((:business_slug\/:category_slug$)|(:category_slug\?[a-zA-Z]+=:business_slug$))$/
const PRODUCT_PATTERN = /(^\/)(store\/)?((:business_slug\/:category_slug\/:product_slug$)|(:category_slug\/:product_slug\?[a-zA-Z]+=:business_slug$)|(:business_slug\?[a-zA-Z]+=:category_id&[a-zA-Z]+=:product_id$))$/

// the formats main listed behind the ⓘ, now a visible hint
const BUSINESS_FORMATS = ['/:business_slug', '/store/:business_slug', '/store?<any>=:business_slug']
const CATEGORY_FORMATS = [
  'store/:business_slug/:category_slug',
  'store/:category_slug?<any>=:business_slug',
  ':business_slug/:category_slug',
  ':category_slug?<any>=:business_slug'
]
const PRODUCT_FORMATS = [
  '/store/:business_slug/:category_slug/:product_slug',
  '/store/:category_slug/:product_slug?<any>=:business_slug',
  '/store/:business_slug?<any>=:category_id&<any>=:product_id',
  '/:business_slug/:category_slug/:product_slug',
  '/:business_slug?<any>=:category_id&<any>=:product_id'
]

// the order of the form (the bar names the changed fields in it)
const FIELD_ORDER = [
  'name',
  'code',
  'url',
  'description',
  'header',
  'logo',
  'social_share',
  'image',
  'business_url_template',
  'category_url_template',
  'product_url_template',
  'cart_url_template',
  'checkout_url_template',
  'profile_url_template',
  'reset_password_url_template',
  'track_order_url_template'
]

// the fields main registered with react-hook-form: the only ones it checked
const CHECKED_FIELDS = ['name', 'code', 'url', 'business_url_template', 'category_url_template', 'product_url_template']

// the fields «Fill from Website» may copy from the site «website» (the same as main)
const FIELDS_TO_SYNC = [
  'url',
  'business_url_template',
  'cart_url_template',
  'category_url_template',
  'checkout_url_template',
  'image',
  'logo',
  'header',
  'social_share',
  'profile_url_template',
  'product_url_template',
  'reset_password_url_template',
  'track_order_url_template'
]

const fill = (text, token, value) => text.replace(token, () => value)

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

/** The label of each field (also the name the bar gives to a changed one). */
const fieldLabels = (t) => ({
  name: t('NAME', 'Name'),
  code: t('CODE', 'Code'),
  url: t('URL', 'URL'),
  description: t('DESCRIPTION', 'Description'),
  header: t('HEADER', 'Header'),
  logo: t('LOGO', 'Logo'),
  social_share: t('SOCIAL_SHARE', 'Social share'),
  image: t('IMAGE', 'Image'),
  business_url_template: t('BUSINESS_URL_TEMPLATE', 'Business url template'),
  category_url_template: t('CATEGORY_URL_TEMPLATE', 'Category url template'),
  product_url_template: t('PRODUCT_URL_TEMPLATE', 'Product url template'),
  cart_url_template: t('CART_URL_TEMPLATE', 'Cart url template'),
  checkout_url_template: t('CHECKOUT_URL_TEMPLATE', 'Checkout url template'),
  profile_url_template: t('PROFILE_URL_TEMPLATE', 'Profile url template'),
  reset_password_url_template: t('RESET_PASSWORD_URL_TEMPLATE', 'Reset password url template'),
  track_order_url_template: t('TRACK_ORDER_URL_TEMPLATE', 'Track order url template')
})

/**
 * The check of one field, as main made it (required, then pattern, then validate). `read(name)` gives the value of any field, so the
 * product template can be set against the business one. Returns the message, or null when the field is fine.
 */
const checkField = (name, read, t) => {
  const value = String(read(name) ?? '')
  const invalidUrl = (label) => fill(t('VALIDATION_ERROR_ACTIVE_URL', 'The _attribute_ is not a valid URL.'), '_attribute_', label)
  switch (name) {
    case 'name':
      return value === '' ? fill(t('VALIDATION_ERROR_REQUIRED', 'The name field is required.'), '_attribute_', t('NAME', 'Name')) : null
    case 'code':
      return value === '' ? fill(t('VALIDATION_ERROR_REQUIRED', 'The code field is required.'), '_attribute_', t('CODE', 'Code')) : null
    case 'url':
      return value !== '' && !URL_PATTERN.test(value) ? invalidUrl(t('URL', 'Url')) : null
    case 'business_url_template':
      return value !== '' && !BUSINESS_PATTERN.test(value) ? invalidUrl(t('BUSINESS_URL_TEMPLATE', 'Business url template')) : null
    case 'category_url_template':
      return value !== '' && !CATEGORY_PATTERN.test(value) ? invalidUrl(t('CATEGORY_URL_TEMPLATE', 'Category url template')) : null
    case 'product_url_template': {
      // (ordering-products P-2): the field is optional, so an empty product template is fine. main set it against the
      // business template even when empty, so a business template with no product template blocked saving the whole site.
      if (value === '') return null
      if (!PRODUCT_PATTERN.test(value)) return invalidUrl(t('PRODUCT_URL_TEMPLATE', 'Product url template'))
      const business = String(read('business_url_template') ?? '')
      const mismatch = t('VALIDATE_PRODUCT_TEMPLATE_URL', 'The product url template do not match with business url template')
      if (business.includes('?')) {
        const [before, after] = business.split('?')
        return value.indexOf(before) === 0 && value.includes(after) ? null : mismatch
      }
      return value.indexOf(business) === 0 ? null : mismatch
    }
    default:
      return null
  }
}

export const OrderingProductGeneralDetails = (props) => {
  const {
    siteState,
    formState,
    isAddMode,
    handleChangeInput,
    handlechangeImage,
    handleUpdateSite,
    handleAddSite,
    resetChanges,
    sitesList,
    enableAutoFillFromWebsite,
    onInvalid
  } = props

  const [, t] = useLanguage()
  const adding = Boolean(isAddMode)
  const site = siteState?.site ?? {}
  const changes = formState?.changes ?? {}
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  // redesign (review r1, Q-05): the add form opens with the focus on Name (the panel mounts with a key, so this runs once per add)
  useEffect(() => {
    if (adding) nameRef.current?.focus({ preventScroll: true })
  }, [])

  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState(null)
  const formRef = useRef(null)
  const nameRef = useRef(null)
  const uid = useId()
  const ids = { basics: `${uid}-basics`, images: `${uid}-images`, templates: `${uid}-templates` }

  const busy = saving || Boolean(formState?.loading)
  const labels = fieldLabels(t)
  const valueOf = (name) => changes[name] ?? site[name] ?? ''

  // redesign (OP-08): «changed» is what the user sees changed; a field typed and put back is not counted
  const changedKeys = FIELD_ORDER.filter(key => key in changes && String(changes[key] ?? '') !== String(site[key] ?? ''))
  const count = changedKeys.length
  const dirty = count > 0

  const invalidCount = Object.keys(errors).length
  const withCount = (template, value) => fill(template, '_count_', String(value))
  const fixErrors = invalidCount === 1
    ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
    : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.')
  const errorText = invalidCount > 0 ? withCount(fixErrors, invalidCount) : saveError

  // a change by the user clears the old reason of a failed save and the «Saved» notice
  const touch = () => {
    setSaved(false)
    setSaveError(null)
  }

  // an edit checks again the field that had an error (and the product template when the business one changes, M-OP3)
  const change = (name, value) => {
    touch()
    handleChangeInput?.({ target: { name, value } })
    const related = name === 'business_url_template' ? [name, 'product_url_template'] : [name]
    if (!related.some(key => errors[key])) return
    const read = (key) => (key === name ? value : valueOf(key))
    setErrors((current) => {
      const next = { ...current }
      for (const key of related) {
        if (!current[key]) continue
        const message = checkField(key, read, t)
        if (message) next[key] = message
        else delete next[key]
      }
      return next
    })
  }

  const focusFirstError = () => {
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
    })
  }

  const save = async () => {
    if (busy) return { ok: false }
    // redesign (OP-06): the checks run on save, as in main; the errors are said under their field
    const found = {}
    for (const name of CHECKED_FIELDS) {
      const message = checkField(name, valueOf, t)
      if (message) found[name] = message
    }
    if (Object.keys(found).length > 0) {
      setErrors(found)
      // review r2 (N-02): a save asked from elsewhere (the leave question on the Theme tab) brings the tab with the errors to the front
      onInvalid?.()
      focusFirstError()
      return { ok: false }
    }
    setErrors({})
    setSaved(false)
    setSaveError(null)
    setSaving(true)
    let result
    try {
      result = adding ? await handleAddSite?.(undefined, WRITE_OPTIONS) : await handleUpdateSite?.(undefined, WRITE_OPTIONS)
    } catch (error) {
      result = { error: true, result: [error?.message] }
    }
    if (!mounted.current) return { ok: !result?.error && result != null }
    setSaving(false)
    if (!result || result.error) {
      setSaveError(translateApiMessage(t, firstMessage(result?.result), t('ORDERING_PRODUCTS_SAVE_ERROR', 'The product could not be saved.')))
      return { ok: false }
    }
    setSaved(true)
    return { ok: true }
  }

  const discard = () => {
    resetChanges?.()
    setErrors({})
    setSaveError(null)
    setSaved(false)
  }

  // redesign (OP-08): General registers its guard in the host; the panel's close, Esc and a change of site ask before dropping
  // the draft. Review r1 (Q-03): it does NOT register a close guard of its own in the SplitView (`NO_REGISTER`): OrderingProductDetails
  // registers one for the whole panel, so the question covers General and Theme together.
  useLeaveGuard({ dirty, count, label: t('GENERAL', 'General'), save, discard, registerCloseGuard: NO_REGISTER }) // N-04: the dialog names the tab

  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [saved])

  const submit = (event) => {
    event.preventDefault()
    if (dirty) save()
  }

  // ---- Fill from Website: the logic of main (the site «website», else the one kept in the browser), its notices inline ----
  const getSourceSite = () => {
    const currentId = site.id
    let source = Array.isArray(sitesList) && sitesList.length > 0 ? sitesList.find(item => item?.code === 'website') : null
    let parseError = false
    if (!source || source?.id === currentId) {
      const stored = window.localStorage.getItem('website_site_details')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed?.id !== currentId) source = parsed
        } catch (error) {
          parseError = true
        }
      }
    }
    return { source: source ?? null, parseError }
  }

  const fillFromWebsite = () => {
    if (adding || busy || syncing) return
    setNotice(null)
    const { source, parseError } = getSourceSite()
    if (parseError) {
      setNotice({ tone: 'warning', text: t('ERROR_PARSING_WEBSITE_DETAILS', 'Error parsing website site details') })
      return
    }
    if (!source) {
      setNotice({ tone: 'info', text: t('NO_SOURCE_SITE_FOUND', 'No source site found to sync from.') })
      return
    }
    const toApply = FIELDS_TO_SYNC.reduce((acc, name) => {
      if (valueOf(name)) return acc
      const value = source[name]
      if (value === null || value === undefined || value === '') return acc
      acc[name] = value
      return acc
    }, {})
    if (Object.keys(toApply).length === 0) {
      setNotice({ tone: 'info', text: t('NOTHING_TO_SYNC', 'Nothing to sync. All fields already have values.') })
      return
    }
    try {
      setSyncing(true)
      for (const [name, value] of Object.entries(toApply)) change(name, value)
    } finally {
      setSyncing(false)
    }
  }
  const canFill = Boolean(enableAutoFillFromWebsite) && !adding && site.code !== 'website'

  // (#481): «Contact us» opens the Ordering.co pricing page for every project (had kept a subdomain page)
  const contactUs = () => window.open(
    ORDERING_PRICING_URL,
    '_blank',
    'noopener,noreferrer'
  )

  // ---- the fields ----
  // explicit props, no spread (ruleset l6-d1 pins every JSX spread)
  const text = (name, { placeholder, hint, required: isRequired = false, requiredLabel, inputRef } = {}) => (
    <TextField
      ref={inputRef}
      name={name}
      label={labels[name]}
      value={String(valueOf(name))}
      onChange={value => change(name, value)}
      error={errors[name]}
      disabled={busy}
      autoComplete='off'
      placeholder={placeholder}
      hint={hint}
      required={isRequired}
      requiredLabel={requiredLabel}
    />
  )
  const template = (name, formats) => text(name, {
    placeholder: t('URL', 'Url'),
    ...(formats ? { hint: `${t('AVAILABLE_FORMATS', 'Available Formats')}: ${formats.join(' · ')}` } : {})
  })
  const required = { required: true, requiredLabel: t('REQUIRED', 'Required') }
  const image = (name, { aspect, hint } = {}) => (
    <SiteImageField
      label={labels[name]}
      value={valueOf(name)}
      disabled={busy}
      onFile={(file) => {
        touch()
        handlechangeImage?.(file, name)
      }}
      aspect={aspect}
      hint={hint}
    />
  )

  return (
    <div className='odc-op-general'>
      {!adding && (
        <InlineNotice
          className='odc-op-notice'
          tone='info'
          action={<Button size='sm' onClick={contactUs}>{t('CONTACT_US', 'Contact us')}</Button>}
        >
          {t('NEED_HELP_WITH_SET_UP', 'Do you need help with the setup?')}
        </InlineNotice>
      )}
      <form ref={formRef} className='odc-op-form' tabIndex={-1} noValidate onSubmit={submit}>
        <section className='odc-op-section' aria-labelledby={ids.basics}>
          <div className='odc-op-section-head'>
            <h3 id={ids.basics}className='odc-op-section-title'>{t('BASICS', 'Basics')}</h3>
          </div>
          <div className='odc-op-fields'>
            <div className='odc-op-pair'>
              {text('name', { ...required, placeholder: labels.name, inputRef: nameRef })}
              {text('code', { ...required, placeholder: labels.code })}
            </div>
            {text('url', { placeholder: t('URL', 'Url') })}
            <TextArea
              name='description'
              label={labels.description}
              rows={4}
              placeholder={t('SHORT_PROMOTION_ABOUT', 'Write a little description')}
              value={String(valueOf('description'))}
              onChange={value => change('description', value)}
              disabled={busy}
            />
          </div>
        </section>

        <section className='odc-op-section' aria-labelledby={ids.images}>
          <div className='odc-op-section-head'>
            <h3 id={ids.images}className='odc-op-section-title'>{t('IMAGES', 'Images')}</h3>
            {canFill && (
              <Button size='sm' busy={syncing} disabled={busy} onClick={fillFromWebsite}>
                {t('FILL_FROM_WEBSITE', 'Fill from Website')}
              </Button>
            )}
          </div>
          {notice && <InlineNotice className='odc-op-notice' tone={notice.tone}>{notice.text}</InlineNotice>}
          <div className='odc-op-fields'>
            {/* redesign (review r1, Q-06): only when editing; `handleAddSite` does not sync the header with the logo */}
            {image('header', { aspect: 'wide', hint: adding ? undefined : t('SITE_HEADER_FOLLOWS_LOGO', 'A new logo also replaces it.') })}
            <div className='odc-op-pair'>
              {image('logo')}
              {image('social_share')}
            </div>
          </div>
        </section>

        <section className='odc-op-section' aria-labelledby={ids.templates}>
          <div className='odc-op-section-head'>
            <h3 id={ids.templates}className='odc-op-section-title'>{t('URL_TEMPLATES', 'URL templates')}</h3>
          </div>
          <div className='odc-op-fields'>
            {template('business_url_template', BUSINESS_FORMATS)}
            {template('category_url_template', CATEGORY_FORMATS)}
            {template('product_url_template', PRODUCT_FORMATS)}
            {template('cart_url_template')}
            {template('checkout_url_template')}
            {template('profile_url_template')}
            {template('reset_password_url_template')}
            {template('track_order_url_template')}
          </div>
        </section>

        <SaveBar
          className='odc-op-savebar'
          formSelector='.odc-op-form'
          label={t('SAVE_CHANGES', 'Save changes')}
          count={count}
          countText={withCount(count === 1
            ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
            : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
          names={changedKeys.map(key => labels[key])}
          moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
          saving={saving}
          errorText={errorText}
          onRetry={saveError && invalidCount === 0 && dirty ? () => save() : undefined}
          retryLabel={t('TRY_AGAIN', 'Try again')}
          saved={saved}
          savedText={t('SAVED', 'Saved')}
          discardLabel={t('DISCARD', 'Discard')}
          saveLabel={adding ? t('ADD_PRODUCT', 'Add product') : t('SAVE_CHANGES', 'Save changes')}
          saveType='submit'
          onDiscard={discard}
        />
      </form>
    </div>
  )
}
