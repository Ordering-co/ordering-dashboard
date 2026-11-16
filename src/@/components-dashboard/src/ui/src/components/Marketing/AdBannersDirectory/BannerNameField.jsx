import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { TextField } from '../../Shared/Product'
import './banner-panel.css'

// redesign AB-B3 (decision 2; defect M-AB07, auditor 1): the name of a banner, saved by itself as `main` does (750 ms after the last
// keystroke; no Save button, no new step) but honest about it:
//   - a live line says «Saving…» / «Saved», and a failure is the field's own error (role alert), translated;
//   - blank text is not saved and the field says so; a save pending for the text before it is cancelled (today it still fired);
//   - closing the panel (unmounting) with a save pending sends it at once, so nothing typed is lost (today the timer fired after
//     the panel was gone, with a stale closure);
//   - a new `name` from outside replaces the text only when the person has no unsaved edit.
// Props: `name`, `onSave(name) → Promise<{ ok, error }>` (a controller that resolves nothing counts as saved).

const SAVE_DEBOUNCE_MS = 750

/**
 * The text of an error of the API (a string, `{ message }`, or a list of either, nested), translated by its slug; `fallback` when it has
 * no text. Shared by the three pieces of the banner panel.
 */
export const apiErrorText = (t, error, fallback) => {
  const first = (Array.isArray(error) ? error.flat(Infinity) : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .find(item => typeof item === 'string' && item.trim())
  return translateApiMessage(t, first, fallback)
}

export const BannerNameField = ({ name, onSave }) => {
  const [, t] = useLanguage()
  const [text, setText] = useState(name ?? '')
  const [status, setStatus] = useState('idle') // idle | saving | saved | error | blank
  const [failure, setFailure] = useState(null)

  const textRef = useRef(name ?? '') // what is in the field
  const savedRef = useRef(name ?? '') // what the API has
  const pendingRef = useRef(null) // the text waiting for its pause, or null
  const timerRef = useRef(null)
  const queueRef = useRef(Promise.resolve()) // saves go out one after the other, so an old one never lands over a newer one
  const mounted = useRef(true)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const tRef = useRef(t)
  tRef.current = t

  const send = (value) => {
    setStatus('saving')
    setFailure(null)
    const run = async () => {
      let result
      try {
        result = await onSaveRef.current?.(value)
      } catch (error) {
        result = { ok: false, error: [error?.message] }
      }
      if (result && result.ok === false) {
        // the failure belongs to the text it was for: a newer edit has its own status
        if (mounted.current && textRef.current === value) {
          setStatus('error')
          setFailure(apiErrorText(tRef.current, result.error, tRef.current('AD_BANNERS_NAME_SAVE_FAILED', "We couldn't save the name. Try again.")))
        }
        return
      }
      savedRef.current = value
      if (mounted.current && textRef.current === value) setStatus('saved')
    }
    queueRef.current = queueRef.current.then(run)
  }

  const flush = () => {
    clearTimeout(timerRef.current)
    const value = pendingRef.current
    pendingRef.current = null
    if (value !== null) send(value)
  }

  const handleChange = (value) => {
    setText(value)
    textRef.current = value
    clearTimeout(timerRef.current)
    pendingRef.current = null // the save pending for the text before this one is cancelled
    setFailure(null)
    if (value.trim() === '') {
      setStatus('blank')
      return
    }
    setStatus('idle')
    if (value === savedRef.current) return
    pendingRef.current = value
    timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
  }

  // A new name from outside (the host merged an update, another control saved it) replaces the text only when nothing of the
  // person's is unsaved; either way it is now what the API has.
  useEffect(() => {
    const next = name ?? ''
    const unsaved = textRef.current !== savedRef.current
    savedRef.current = next
    if (!unsaved && textRef.current !== next) {
      textRef.current = next
      setText(next)
    }
  }, [name])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(timerRef.current)
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending !== null) {
        try {
          Promise.resolve(onSaveRef.current?.(pending)).catch(() => {})
        } catch (error) {
          // nothing left to tell: the panel is gone
        }
      }
    }
  }, [])

  const error = status === 'blank'
    ? t('AD_BANNERS_NAME_REQUIRED', 'Enter a name.')
    : status === 'error' ? failure : undefined
  // redesign (row 49, M-AB26): «Saved» is main's SAVED key (same text in every locale), not a banner-only copy
  const live = status === 'saving'
    ? t('AD_BANNERS_SAVING', 'Saving…')
    : status === 'saved' ? t('SAVED', 'Saved') : ''

  return (
    <div className='odc-root odc-banners-name-field'>
      <TextField
        label={t('NAME', 'Name')}
        value={text}
        onChange={handleChange}
        error={error}
        autoComplete='off'
      />
      <p className='odc-banners-status' aria-live='polite'>{live}</p>
    </div>
  )
}
