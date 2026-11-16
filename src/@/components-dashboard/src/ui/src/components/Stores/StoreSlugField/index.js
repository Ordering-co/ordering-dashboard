import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'

import { useLanguage } from '~components'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, TextField } from '../../Shared/Product'
import { isValidSlug } from '../BusinessDetails/storeOverviewModel'

// redesign stores 5.1b (decision 4, G2-20): the one editor of a store's slug. Extracted as it was in the Overview
// (4.B) so the Overview, Store details › SEO and Ordering channels › Custom slug (5.15a) follow one rule:
//  - only letters and numbers can be typed or pasted; a stored slug older than that rule is left as it is and the field says it;
//  - empty is said («Slug is required») and the slug cannot be saved like that;
//  - the slug typed is held by the shared form (`formState.changes.slug`) until it is saved, so leaving the editor asks (2.A);
//    going back to the stored slug leaves nothing pending.
// With `onSave` the field has its own «Save» (Enter too) that saves the slug alone, says the API's error under the field and
// «Saved» after it: the Overview. Without it the slug goes with the form around it (SEO), which reads `problem` through the ref.
//
// @param {object}   props
// @param {string}   [props.savedSlug]      The stored slug.
// @param {object}   props.formState        The store editor's shared form.
// @param {Function} props.setFormState     Its setter; takes an updater.
// @param {Function} [props.onSave]         `(slug) => Promise<{ ok, error }>`: draws «Save» and «Saved».
// @param {string}   [props.hint]           Under the field while the slug is the stored one (the public address).
// @param {string}   [props.fieldClassName]
// @param {React.ReactNode} [props.children] Drawn after «Save», before «Saved» (the Overview's preview button).

const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

export const StoreSlugField = React.forwardRef(function StoreSlugField ({
  savedSlug: storedSlug,
  formState,
  setFormState,
  onSave,
  hint,
  fieldClassName,
  disabled,
  children
}, ref) {
  const [, t] = useLanguage()
  const inputRef = useRef(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const savedSlug = storedSlug || ''
  const [slug, setSlug] = useState(() => formState?.changes?.slug ?? savedSlug)
  const [slugState, setSlugState] = useState({ saving: false, error: null, saved: false })
  // a save from elsewhere (the leave dialog's «Save and continue», the form around it) lands here as the new stored slug
  useEffect(() => {
    if (formState?.changes?.slug === undefined) setSlug(savedSlug)
  }, [savedSlug])
  // a discard of the shared form (the leave dialog, the form's «Discard») drops what was typed here too
  const pending = formState?.changes?.slug
  useEffect(() => {
    if (pending === undefined && slug !== savedSlug) setSlug(savedSlug)
  }, [pending])

  const slugDirty = slug !== savedSlug
  const slugProblem = !slugDirty
    ? null
    : slug === ''
      ? t('SLUG_REQUIRED', 'Slug is required')
      : !isValidSlug(slug)
          ? t('STORE_SLUG_ALLOWED_CHARACTERS', 'Use only letters, numbers and underscores (_).')
          : null

  // Only letters, numbers and «_» can be typed or pasted (main's field took letters and numbers; bugs C, the add makes
  // slugs with «_»; a paste used to get through). A stored slug with other characters (older than that rule) is left as it is:
  // the field says it, and nothing is changed for the person.
  const changeSlug = (value) => {
    const next = slug === '' || isValidSlug(slug) ? value.replace(/[^0-9a-zA-Z_]/g, '') : value
    setSlug(next)
    setSlugState({ saving: false, error: null, saved: false })
    // the shared form holds it until it is saved, so leaving the editor with it asks first
    setFormState(prev => {
      const changes = { ...prev?.changes }
      if (next === savedSlug) delete changes.slug
      else changes.slug = next
      return { ...prev, changes }
    })
  }

  const saveSlug = async () => {
    if (!onSave || !slugDirty || slugProblem || slugState.saving) return
    setSlugState({ saving: true, error: null, saved: false })
    const result = await onSave(slug)
    if (!mounted.current) return
    if (result?.ok) requestAnimationFrame(() => inputRef.current?.focus())
    setSlugState(result?.ok
      ? { saving: false, error: null, saved: true }
      : { saving: false, error: translateApiMessage(t, firstMessage(result?.error), t('STORES_CHANGE_FAILED', 'We couldn\'t save the change.')), saved: false })
  }

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    problem: slugProblem
  }), [slugProblem])

  return (
    <>
      <TextField
        ref={inputRef}
        fieldClassName={fieldClassName}
        label={t('SLUG', 'Slug')}
        value={slug}
        onChange={changeSlug}
        error={slugState.error || slugProblem || undefined}
        hint={!slugDirty ? hint : undefined}
        disabled={disabled}
        autoComplete='off'
        spellCheck={false}
        onKeyDown={onSave
          ? (event) => {
              if (event.key === 'Enter') saveSlug()
            }
          : undefined}
      />
      {onSave && (
        <Button
          variant={slugDirty ? 'primary' : 'secondary'}
          busy={slugState.saving}
          disabled={!slugDirty || !!slugProblem}
          onClick={saveSlug}
        >
          {t('SAVE', 'Save')}
        </Button>
      )}
      {children}
      {onSave && slugState.saved && !slugDirty && (
        <span role='status' className='odc-se-saved'>{t('SAVED', 'Saved')}</span>
      )}
    </>
  )
})
