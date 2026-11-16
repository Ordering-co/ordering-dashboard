import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { EmptyState, SaveBar, SecretField, useLeaveGuard } from '../../Shared/Product'
import './spoonity-api-key.css'

// redesign stores 5.16 (; G2-36, defect 5.16-A): the Spoonity key on Product.
// - Without a Spoonity config (`spoonityConfig.id`) the section says so; main drew the field and Save threw a TypeError.
// - The key is a P/SecretField (hidden by default, Show/Hide, how it ends), a local draft saved by the P/SaveBar (decision 4):
//   the bar only shows once the draft differs from the stored key; leaving with the draft asks (2.A, `useLeaveGuard`).
// - An empty key is not sent: the field says it is required. A failed save says why and never says «Saved».
// - Main's keypress filter stays: only letters and digits can be typed (a pasted key is trimmed, not filtered).
// - `handleUpdateSpoonityKey` answers `{ ok, result | error }`. The stored key is kept here: the config prop does not refresh after a save.

const SAVED_MS = 2500
const ALLOWED_KEY = /^[0-9a-zA-Z]$/

// the first message of what the controller answers (a string, `{ message }`, or a list of either), or null
const firstMessage = (error) => {
  const item = Array.isArray(error) ? error[0] : error
  const message = typeof item === 'string' ? item : item?.message
  return typeof message === 'string' && message.trim() ? message : null
}

// only a typed letter or digit goes in; shortcuts (Ctrl/Cmd/Alt) and named keys (Backspace, Enter, Tab, arrows) pass
const filterKey = (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key.length === 1 && !ALLOWED_KEY.test(event.key)) event.preventDefault()
}

export const SpoonityApiKey = (props) => {
  const { spoonityConfig, handleUpdateSpoonityKey } = props

  const [, t] = useLanguage()
  const configId = spoonityConfig?.id
  const [storedKey, setStoredKey] = useState(spoonityConfig?.value ?? '')
  const [draft, setDraft] = useState(spoonityConfig?.value ?? '')
  const [fieldError, setFieldError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const [saved, setSaved] = useState(false)
  const savingRef = useRef(false)
  const mounted = useRef(true)
  const savedTimer = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(savedTimer.current)
    }
  }, [])

  const changed = draft !== storedKey
  const count = changed ? 1 : 0
  const fieldLabel = t('API_KEY', 'Api key')

  const change = (next) => {
    setDraft(next)
    setFieldError(null)
    setErrorText(null)
    setSaved(false)
  }

  const discard = () => {
    setDraft(storedKey)
    setFieldError(null)
    setErrorText(null)
  }

  const save = async () => {
    if (savingRef.current) return { ok: false }
    if (!changed) return { ok: true }
    const key = draft.trim()
    if (!key) {
      const message = t('SPOONITY_KEY_REQUIRED', 'Spoonity key is required')
      setFieldError(message)
      return { ok: false, error: [message] }
    }
    savingRef.current = true
    setSaving(true)
    setFieldError(null)
    setErrorText(null)
    let result
    try {
      result = await handleUpdateSpoonityKey(key, configId)
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    savingRef.current = false
    if (!mounted.current) return result?.ok === true ? { ok: true } : { ok: false, error: result?.error }
    setSaving(false)
    if (result?.ok === true) {
      setStoredKey(key)
      setDraft(key)
      setSaved(true)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => { if (mounted.current) setSaved(false) }, SAVED_MS)
      return { ok: true }
    }
    setErrorText(translateApiMessage(t, firstMessage(result?.error), t('SPOONITY_KEY_ERROR', 'Spoonity key error')))
    return { ok: false, error: result?.error }
  }

  useLeaveGuard({ dirty: changed, count, save, discard })

  const title = <h1 className='odc-spoonity-title'>{t('SPOONITY_KEY', 'Spoonity key')}</h1>

  if (!configId) {
    return (
      <div className='odc-root odc-spoonity'>
        {title}
        <EmptyState
          title={t('SPOONITY_NOT_SET_UP', 'Spoonity is not set up for this store')}
          description={t('SPOONITY_NOT_SET_UP_HINT', 'Spoonity has to be set up for this store before you can add its key.')}
        />
      </div>
    )
  }

  const countText = (count === 1
    ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
    : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)

  const secretEnding = (ending) => {
    const [before, after] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
    return <>{before}{ending}{after}</>
  }

  return (
    <div className='odc-root odc-spoonity' tabIndex={-1}>
      {title}
      <form
        className='odc-spoonity-form'
        tabIndex={-1}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <SecretField
          fieldClassName='odc-spoonity-field'
          name='spoonity_key'
          label={fieldLabel}
          showLabel={t('SHOW', 'Show')}
          hideLabel={t('HIDE', 'Hide')}
          endingLabel={secretEnding}
          value={draft}
          onChange={change}
          onKeyDown={filterKey}
          error={fieldError}
          readOnly={saving}
        />
        <SaveBar
          label={t('SAVE_CHANGES', 'Save changes')}
          count={count}
          countText={countText}
          names={changed ? [fieldLabel] : []}
          moreText={n => t('SETTINGS_UNSAVED_MORE', '+_count_').replace('_count_', n)}
          saving={saving}
          errorText={errorText}
          onRetry={save}
          retryLabel={t('TRY_AGAIN', 'Try again')}
          saved={saved}
          savedText={t('SAVED', 'Saved')}
          discardLabel={t('DISCARD', 'Discard')}
          saveLabel={t('SAVE', 'Save')}
          saveType='submit'
          onDiscard={discard}
          formSelector='.odc-spoonity-form'
        />
      </form>
    </div>
  )
}
