import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, InlineNotice, TextArea, TextField } from '../../Shared/Product'
import { useKeepFocus } from './useKeepFocus'
import './app-sections.css'

// redesign my-products B3 (D3, D6, M-MP-01): App › General. The same four fields, the same `changes` and the same rule for
// Save as main's General tab, with the three things main did not say:
// - a failed save shows a notice and KEEPS what was typed (main sent `changes: {}` also on an error and never painted `error`);
// - a good save says «Saved» for 3 s (a status line, so a screen reader hears it);
// - Save is a P/Button with `busy` while it saves;
// - the focus does not fall on <body> when it ends (R1-02): it goes back to Save if Save can take it again (an error with changes), or
//   to the «Saved» line / the notice (`tabIndex={-1}`) when it cannot.
// The title is the editor's, not ours. The call is the controller's (`updateProductApp(changes)`, same endpoint).

const SAVED_MS = 3000

// the messages of what the API answers (a string, `{ message }`, or a list of either), translated and joined; '' without text
const messagesOf = (t, result) => {
  const list = Array.isArray(result) ? result : [result]
  return list
    .map(item => translateApiMessage(t, typeof item === 'string' ? item : item?.message, ''))
    .filter(Boolean)
    .join(' ')
}

export const GeneralSection = (props) => {
  const { app, updateProductApp, updateAppValues } = props

  const [, t] = useLanguage()
  const [changes, setChanges] = useState({})
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const [saved, setSaved] = useState(false)
  const mounted = useRef(true)
  const savedTimer = useRef(null)
  const statusRef = useRef(null)
  const errorRef = useRef(null)
  const { remember, restore } = useKeepFocus()

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(savedTimer.current)
    }
  }, [])

  const handleChange = (name, value) => {
    setChanges(current => ({ ...current, [name]: value }))
    setSaved(false)
  }

  const showError = (message) => {
    const text = t('SETTINGS_SAVE_FAILED', "We couldn't save your changes. _message_").replace('_message_', () => message)
    setErrorText(text.trim())
  }

  const handleSave = async () => {
    remember()
    setLoading(true)
    setErrorText(null)
    setSaved(false)
    let failed = false
    try {
      const { error, result } = await updateProductApp(changes)
      if (!mounted.current) return
      if (error) {
        // the changes stay: the owner retries, or corrects, without typing it all again
        failed = true
        showError(messagesOf(t, result))
      } else {
        updateAppValues(result)
        setChanges({})
        setSaved(true)
        clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => { if (mounted.current) setSaved(false) }, SAVED_MS)
      }
    } catch (err) {
      if (!mounted.current) return
      failed = true
      showError(translateApiMessage(t, err?.message, ''))
    }
    if (!mounted.current) return
    setLoading(false)
    // redesign my-products R1-02: Save was disabled while it saved, so the focus fell on <body>
    restore(failed ? errorRef : statusRef, { preferFallback: failed })
  }

  const values = Object.values(changes)
  const canSave = !loading && values.length > 0 && values.every(Boolean)

  return (
    <div className='odc-aps'>
      <div className='odc-aps-grid'>
        <TextField
          name='name'
          label={t('NAME', 'Name')}
          placeholder={t('CUSTOMER_APP', 'Customer App')}
          value={changes.name ?? app?.name ?? ''}
          onChange={value => handleChange('name', value)}
        />
        <div className='odc-aps-row'>
          <TextField
            name='package'
            label={t('PACKAGE_APP', 'Package')}
            placeholder={t('NAME', 'Name')}
            value={changes.package ?? app?.package ?? ''}
            onChange={value => handleChange('package', value)}
          />
          <TextField
            name='version'
            label={t('VERSION_APP', 'Version')}
            placeholder='0.0.0'
            value={changes.version ?? app?.version ?? ''}
            onChange={value => handleChange('version', value)}
          />
        </div>
        <TextArea
          name='description'
          label={t('DESCRIPTION', 'Description')}
          placeholder={t('DESCRIPTION', 'Description')}
          value={changes.description ?? app?.description ?? ''}
          onChange={value => handleChange('description', value)}
        />
      </div>
      {errorText && (
        <div ref={errorRef} tabIndex={-1} className='odc-aps-result'>
          <InlineNotice tone='danger'>{errorText}</InlineNotice>
        </div>
      )}
      <div className='odc-aps-foot'>
        <Button variant='primary' busy={loading} disabled={!canSave} onClick={handleSave}>
          {t('SAVE', 'Save')}
        </Button>
        <p role='status' ref={statusRef} tabIndex={-1} className='odc-aps-status'>{saved ? t('SAVED', 'Saved') : ''}</p>
      </div>
    </div>
  )
}
