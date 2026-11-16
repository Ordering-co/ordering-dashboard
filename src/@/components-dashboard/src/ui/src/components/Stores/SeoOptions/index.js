import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, SaveBar, TextArea, TextField } from '../../Shared/Product'
import { ImageField } from '../../Shared/Product/ImageField'
import { bytesConverter } from '../../../utils'
import { StoreSlugField } from '../StoreSlugField'
import './seo-options.css'

// redesign stores 5.1b (decision 4; G2-04, G2-05, G2-19, G2-20, G2-26, G2-41): the SEO form of a store, a category and
// a product, on Product. One save model: the fields are held until «Save» in the save bar, which counts and names what changed,
// discards it, says why a save failed and «Saved» after it. Each consumer keeps its own state and its own request:
//  - the store (`isBusinessSeo`) writes into the editor's shared form, which the editor's leave guard already watches (2.A), and
//    saves it with the same request as before; its slug is the one store slug editor, `S/StoreSlugField`, saved with the rest;
//  - the category and the product merge their changes through `setFormState(changes)`, as their controllers expect, and save with
//    their `handleUpdateClick`.
// What counts as changed is a field whose value differs from the stored one, not a key in `changes` (the category keeps its whole
// record there). The image goes through `P/ImageField`: the crop happens before anything is held, so closing it leaves nothing.

const TITLE_RECOMMENDED = 60
const DESCRIPTION_RECOMMENDED = 160
const MAX_IMAGE_KB = 2048
const SAVED_NOTICE_MS = 4000
// the category's and the product's slug rule, as before (the store's is StoreSlugField's)
const SLUG_SPECIAL_CHARACTERS = /[ `!@#$%^&*()+\-=[\]{};':"\\|,.<>/?~]/

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const text = value => (value == null ? '' : String(value))

export const SeoOptions = (props) => {
  const {
    data,
    formState,
    setFormState,
    handleUpdateClick,
    isBusinessSeo,
    isProductSeo,
    isCategorySeo,
    cleanFormState
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const formRef = useRef(null)
  const slugRef = useRef(null)
  const mounted = useRef(true)
  const [errors, setErrors] = useState({})
  const [imageError, setImageError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      cleanFormState && cleanFormState({ changes: {} })
    }
  }, [])

  const changes = formState?.changes || {}
  const loading = !!formState?.loading
  // the product's and the category's controllers keep the answer of a save in `result`; the record they were given (`data`) is
  // not refreshed with it, so the answer is what is stored now. Only the answer about this record: the controllers keep it when
  // another category or product is opened (review R-1)
  const lastResult = formState?.result?.result
  const answer = !isBusinessSeo && !formState?.result?.error && lastResult && typeof lastResult === 'object' && !Array.isArray(lastResult) &&
    lastResult.id != null && lastResult.id === data?.id
    ? lastResult
    : null
  const storedValue = key => text(answer && key in answer ? answer[key] : data?.[key])
  const valueOf = key => (key in changes ? text(changes[key]) : storedValue(key))

  const keys = ['seo_image', 'seo_title', 'seo_description', ...(isProductSeo ? ['seo_keywords'] : []), 'slug']
  const labels = {
    seo_image: t('SEO_IMAGE', 'SEO Image'),
    seo_title: t('SEO_TITLE', 'SEO Title'),
    seo_description: t('SEO_DESCRIPTION', 'SEO Description'),
    seo_keywords: t('SEO_KEYWORDS', 'SEO Keywords'),
    slug: t('SLUG', 'Slug')
  }
  const changedKeys = keys.filter(key => key in changes && valueOf(key) !== storedValue(key))
  const count = changedKeys.length
  const dirty = count > 0

  // Holds a change: in the store's shared form a value back to the stored one is no change at all; the category and the product
  // merge it into theirs.
  const hold = (patch) => {
    setSaved(false)
    setSaveError(null)
    setErrors(current => {
      const next = { ...current }
      Object.keys(patch).forEach(key => { delete next[key] })
      return next
    })
    if (isBusinessSeo) {
      setFormState(prev => {
        const next = { ...prev?.changes }
        Object.entries(patch).forEach(([key, value]) => {
          if (text(value) === text(data?.[key])) delete next[key]
          else next[key] = value
        })
        return { ...prev, changes: next }
      })
    } else {
      setFormState(patch)
    }
  }

  // ---- image ----------------------------------------------------------------------------------------------------------------
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
  const imageChanged = changedKeys.includes('seo_image')
  const storedImage = storedValue('seo_image')
  const imageValue = imageChanged
    ? valueOf('seo_image')
    : (storedImage ? optimizeImage(storedImage, 'h_200,c_limit') : '')

  // ---- «Use the … name and description» (G2-19) -----------------------------------------------------------------------------
  // Fills the title and the description only; whatever else is pending stays, and a missing description writes nothing.
  const name = text(data?.name)
  const description = text(data?.description)
  const fillFromMain = () => {
    const patch = {}
    if (name) patch.seo_title = name
    if (description) patch.seo_description = description
    if (Object.keys(patch).length > 0) hold(patch)
  }
  const fillLabel = isBusinessSeo
    ? t('SEO_USE_STORE_INFORMATION', 'Use the store\'s name and description')
    : isCategorySeo
      ? t('SEO_USE_CATEGORY_INFORMATION', 'Use the category\'s name and description')
      : t('SEO_USE_PRODUCT_INFORMATION', 'Use the product\'s name and description')

  // ---- save, discard --------------------------------------------------------------------------------------------------------
  const withCount = (template, values) => Object.entries(values)
    .reduce((result, [key, value]) => result.replace(`_${key}_`, String(value)), template)

  const validate = () => {
    const found = {}
    if (isBusinessSeo) {
      if (slugRef.current?.problem) found.slug = slugRef.current.problem
    } else if (changedKeys.includes('slug') && SLUG_SPECIAL_CHARACTERS.test(valueOf('slug'))) {
      found.slug = t('SLUG_NOT_ALLOWED_SPECIAL_CHARACTERS', 'The slug is not allowed special characters.')
    }
    return found
  }

  const save = async () => {
    if (loading || submitting) return { ok: false }
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      formRef.current?.querySelector('[data-seo-field="slug"] input')?.focus()
      return { ok: false }
    }
    setSaved(false)
    setSaveError(null)
    setSubmitting(true)
    const result = await handleUpdateClick()
    if (!mounted.current) return result
    setSubmitting(false)
    if (result?.ok) setSaved(true)
    else if (result?.ok === false) {
      setSaveError(translateApiMessage(t, firstMessage(result?.error), t('SEO_SAVE_FAILED', 'The SEO options could not be saved.')))
    }
    return result
  }

  const discard = () => {
    if (isBusinessSeo) {
      setFormState(prev => {
        const next = { ...prev?.changes }
        keys.forEach(key => { delete next[key] })
        return { ...prev, changes: next }
      })
    } else if (isProductSeo && cleanFormState) {
      // the product sends only what changed: its SEO keys leave `changes` (review R-2), as in the store
      const next = { ...changes }
      keys.forEach(key => { delete next[key] })
      cleanFormState({ changes: next })
    } else {
      // the category keeps its whole record in `changes`: the changed fields go back to the stored values
      setFormState(Object.fromEntries(changedKeys.map(key => [key, answer && key in answer ? answer[key] : data?.[key] ?? null])))
    }
    setErrors({})
    setImageError(null)
    setSaveError(null)
    setResetKey(key => key + 1)
  }

  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [saved])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (dirty) save()
  }

  const invalidCount = Object.keys(errors).length
  const errorText = invalidCount > 0
    ? withCount(invalidCount === 1
      ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
      : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.'), { count: invalidCount })
    : saveError

  const lengthHint = (key, max) => withCount(t('SEO_LENGTH_HINT', '_count_ of _max_ characters recommended'), {
    count: valueOf(key).length,
    max
  })

  return (
    <form ref={formRef} className='odc-seo-form' tabIndex={-1} noValidate onSubmit={handleSubmit}>
      <div data-seo-field='seo_image' className='odc-seo-image'>
        <ImageField
          key={`seo-image-${resetKey}`}
          label={labels.seo_image}
          hint={t('STORE_IMAGE_HINT', 'PNG or JPG, up to 2 MB. Drag an image here or choose one.')}
          changeLabel={t('SEO_CHANGE_IMAGE', 'Change SEO image')}
          changeText={t('CHANGE', 'Change')}
          cropTitle={t('IMAGE_CROP', 'Image crop')}
          closeLabel={t('CLOSE', 'Close')}
          droppable
          tooManyFilesText={t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')}
          disabled={loading}
          value={imageValue}
          previewAlt={labels.seo_image}
          validateFile={validateImage}
          error={imageError}
          onChange={(image) => hold({ seo_image: image })}
        />
      </div>

      <div className='odc-seo-fill'>
        <Button
          variant='secondary'
          size='sm'
          disabled={loading || (!name && !description)}
          onClick={fillFromMain}
        >
          {fillLabel}
        </Button>
      </div>

      <div data-seo-field='seo_title'>
        <TextField
          label={labels.seo_title}
          hint={lengthHint('seo_title', TITLE_RECOMMENDED)}
          value={valueOf('seo_title')}
          onChange={(value) => hold({ seo_title: value })}
          disabled={loading}
          autoComplete='off'
        />
      </div>

      <div data-seo-field='seo_description'>
        <TextArea
          label={labels.seo_description}
          hint={lengthHint('seo_description', DESCRIPTION_RECOMMENDED)}
          rows={4}
          value={valueOf('seo_description')}
          onChange={(value) => hold({ seo_description: value })}
          disabled={loading}
        />
      </div>

      {isProductSeo && (
        <div data-seo-field='seo_keywords'>
          <TextField
            label={labels.seo_keywords}
            value={valueOf('seo_keywords')}
            onChange={(value) => hold({ seo_keywords: value })}
            disabled={loading}
            autoComplete='off'
          />
        </div>
      )}

      <div data-seo-field='slug'>
        {isBusinessSeo
          ? (
            <StoreSlugField
              ref={slugRef}
              savedSlug={data?.slug}
              formState={formState}
              setFormState={(update) => {
                setErrors(current => {
                  const { slug: _gone, ...rest } = current
                  return rest
                })
                setSaved(false)
                setFormState(update)
              }}
              disabled={loading}
            />
            )
          : (
            <TextField
              label={labels.slug}
              value={valueOf('slug')}
              onChange={(value) => hold({ slug: value })}
              error={errors.slug}
              disabled={loading}
              autoComplete='off'
              spellCheck={false}
            />
            )}
      </div>

      <SaveBar
        className='odc-seo-savebar'
        formSelector='.odc-seo-form'
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={withCount(count === 1
          ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
          : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), { count })}
        names={changedKeys.map(key => labels[key])}
        moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), { count: n })}
        saving={loading || submitting}
        errorText={errorText}
        onRetry={invalidCount === 0 && saveError && dirty ? () => save() : undefined}
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
