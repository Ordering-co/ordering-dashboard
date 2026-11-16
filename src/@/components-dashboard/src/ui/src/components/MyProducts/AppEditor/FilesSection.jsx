import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, Field, InlineNotice } from '../../Shared/Product'
import { InputFile } from '../BasicAppSettings/InputFile'
import { useKeepFocus } from './useKeepFocus'
import './app-sections.css'

// redesign my-products B3 (D3, D6, M-MP-03): App › Files. One InputFile per file of `app.baseActions` with group `files`, the
// same limits, the same FormData (`source_file`) and one `updateBaseActions({ id, body })` per file, all at once
// (main's Files tab). What changes (M-MP-03):
// - each saved file replaces ITS entry in a NEW `baseActions` list: main tested `if (indexToUpdate)`, which skipped index 0 and wrote
//   at index -1 when the id was not found, and mutated the list of the app;
// - a file that fails says so (toast with the API's messages) and stays selected: only the saved ones are cleared;
// - the extension is a hint under the field, not a suffix of the label.
// - R1-02: the focus does not fall on <body> when Save ends. The toasts stay (as in main) and the section also says how it went on a line
//   that can take the focus: «Saved» (a status) or the notice with the messages. Focus goes back to Save if it is enabled again (a file
//   failed and stays selected), or to that line when it is not.
// The title is the editor's, not ours. Nothing is painted without files.

const SAVED_MS = 3000

// the messages of what the API answers (a string, `{ message }`, or a list of either), translated
const messagesOf = (t, result) => {
  const list = Array.isArray(result) ? result : [result]
  return list
    .map(item => translateApiMessage(t, typeof item === 'string' ? item : item?.message, ''))
    .filter(Boolean)
}

export const FilesSection = (props) => {
  const { app, updateBaseActions, updateAppValues } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [changes, setChanges] = useState({})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const mounted = useRef(true)
  const savedTimer = useRef(null)
  const statusRef = useRef(null)
  const errorRef = useRef(null)
  const { remember, restore } = useKeepFocus()
  // the app as it is when the answers arrive, so the list written is the newest one
  const appRef = useRef(app)
  appRef.current = app

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(savedTimer.current)
    }
  }, [])

  const files = app?.baseActions?.filter(item => item?.group === 'files') ?? []
  if (!files.length) return null

  const handleChange = (id, file) => {
    setSaved(false)
    setChanges(current => {
      if (file === null) {
        const { [id]: removed, ...rest } = current
        return rest
      }
      return { ...current, [id]: file }
    })
  }

  const showError = (message) => {
    const text = t('SETTINGS_SAVE_FAILED', "We couldn't save your changes. _message_").replace('_message_', () => message)
    setErrorText(text.trim())
  }

  const showSaved = () => {
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => { if (mounted.current) setSaved(false) }, SAVED_MS)
  }

  const handleSave = async () => {
    remember()
    setLoading(true)
    setErrorText(null)
    setSaved(false)
    let failedSave = false
    const sent = Object.keys(changes).map(id => ({ id, file: changes[id] }))
    try {
      const outcomes = await Promise.all(sent.map(async ({ id, file }) => {
        const body = new FormData()
        body.append('source_file', file)
        try {
          const { error, result } = await updateBaseActions({ id, body })
          return { id, error: !!error, result }
        } catch (err) {
          return { id, error: true, result: [err?.message] }
        }
      }))
      if (!mounted.current) return
      const done = outcomes.filter(item => !item.error)
      const failed = outcomes.filter(item => item.error)
      if (done.length) {
        // each answer replaces its own entry, found by id (`!== -1`, and index 0 is a valid one), in a new list
        const list = appRef.current?.baseActions ?? []
        let next = list
        done.forEach(({ id, result }) => {
          const target = Number(result?.id ?? id)
          const index = next.findIndex(item => Number(item.id) === target)
          if (index !== -1) next = next.map((item, i) => (i === index ? { ...item, ...result } : item))
        })
        updateAppValues({ baseActions: next })
        showToast(ToastType.Success, t('CORRECTLY_SAVED_FILES', 'Correctly saved files'))
      }
      if (failed.length) {
        const messages = failed.flatMap(item => messagesOf(t, item.result))
        showToast(ToastType.Error, messages.join('\n') || t('ERROR', 'Error'))
        failedSave = true
        showError(messages.join(' '))
      } else if (done.length) {
        showSaved()
      }
      // only what was saved is cleared: a file that failed stays selected, so Save retries just that one
      const kept = new Set(failed.map(item => item.id))
      setChanges(current => Object.fromEntries(Object.entries(current).filter(([id]) => kept.has(id))))
    } catch (err) {
      if (!mounted.current) return
      const message = translateApiMessage(t, err?.message, t('ERROR', 'Error'))
      showToast(ToastType.Error, message)
      failedSave = true
      showError(message)
    }
    if (!mounted.current) return
    setLoading(false)
    // redesign my-products R1-02: Save was disabled while it saved, so the focus fell on <body>
    restore(failedSave ? errorRef : statusRef, { preferFallback: failedSave })
  }

  const acceptedHint = (extension) => {
    const [before, after] = t('ACCEPTED_FILE_FORMATS', 'Accepted formats: _formats_').split('_formats_')
    return <>{before}<span className='odc-figure'>{`.${extension}`}</span>{after}</>
  }

  const hasChanges = Object.values(changes).some(Boolean)

  return (
    <div className='odc-aps'>
      <div className='odc-aps-grid'>
        {files.map(item => (
          <Field
            key={item.id}
            label={item.name}
            hint={item?.file_rules?.extension ? acceptedHint(item.file_rules.extension) : undefined}
          >
            <InputFile
              name={item.name}
              maxFileSize={Math.max(item?.file_rules?.max_size || 0, 1024)}
              accept={'.' + item?.file_rules?.extension}
              defaultValue={item?.source_path}
              updateInput={file => handleChange(String(item.id), file)}
            />
          </Field>
        ))}
      </div>
      {errorText && (
        <div ref={errorRef} tabIndex={-1} className='odc-aps-result'>
          <InlineNotice tone='danger'>{errorText}</InlineNotice>
        </div>
      )}
      <div className='odc-aps-foot'>
        <Button variant='primary' busy={loading} disabled={loading || !hasChanges} onClick={handleSave}>
          {t('SAVE', 'Save')}
        </Button>
        <p role='status' ref={statusRef} tabIndex={-1} className='odc-aps-status'>{saved ? t('SAVED', 'Saved') : ''}</p>
      </div>
    </div>
  )
}
