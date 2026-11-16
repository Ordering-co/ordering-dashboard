import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Checkbox, Field, InlineNotice, TextArea, TextField } from '../../Shared/Product'
import { constantsUtilities } from '../BasicAppSettings/utils'
import { SelectBusiness } from '../OrderingWebsite/SelectBusiness'
import { useKeepFocus } from './useKeepFocus'
import './app-sections.css'

// redesign my-products B3 (D3, D6, M-MP-02, M-MP-11): App › Constants. The same controls, the same autosave and the same
// body as main's Constants tab: text and json wait 750 ms, text loses its spaces (M-MP-11 stays), the checkbox and
// the business save at once and one field saves at a time. What changes:
// - json keeps its spaces (main stripped them, so «My store» inside the json became «Mystore»), and leaving before the
//   750 ms still saves what was typed last (main dropped it);
// - a failed save shows its message in THAT field and keeps what was typed (main never painted `error`); typing again clears it;
// - a good save updates the constant in a NEW list (main mutated `app.baseConstants`);
// - the label of a checkbox is its text (the whole row toggles);
// - M-MP-15: the text and json fields are NOT disabled while a save runs (main disabled every field, so what was typed meanwhile was
//   lost). One save at a time is kept by a queue: the next waits for the one in flight and sends the value typed by then. Only the
//   checkbox and the business, which save at once, stay disabled while a save runs;
// - R1-02: the focus does not fall on <body> when that happens: when the saves end it goes back to the field that was being edited.
// The title is the editor's, not ours. Nothing is painted without constants.

const { typeDictionary } = constantsUtilities()
const DELAY_MS = 750

// the messages of what the API answers (a string, `{ message }`, or a list of either), translated and joined; '' without text
const messagesOf = (t, result) => {
  const list = Array.isArray(result) ? result : [result]
  return list
    .map(item => translateApiMessage(t, typeof item === 'string' ? item : item?.message, ''))
    .filter(Boolean)
    .join(' ')
}

const sanitize = (value) => (value === null ? null : value?.replace?.(/\s+/g, ''))

// One constant: it keeps what was typed (so an error does not take it back) and decides when to save.
const ConstantField = ({ constant, label, disabled, error, businessesList, onSave, onTyping }) => {
  const type = typeDictionary[constant.type]
  const isBusiness = constant.code === 'business_slug' && !!businessesList
  const [value, setValue] = useState(constant.value ?? '')
  const timer = useRef(null)
  // what waits for the timer, so leaving the page before it fires still saves it
  const pending = useRef(undefined)
  // the latest handlers, for the timer: it fires after a render that may have changed them
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  useEffect(() => () => {
    clearTimeout(timer.current)
    if (pending.current !== undefined) saveRef.current(constant.id, pending.current)
  }, [])

  const typed = (next) => {
    const clean = type === 'textarea' ? next : sanitize(next)
    setValue(clean)
    onTyping(constant.id)
    clearTimeout(timer.current)
    pending.current = clean
    timer.current = setTimeout(() => {
      pending.current = undefined
      saveRef.current(constant.id, clean)
    }, DELAY_MS)
  }
  const now = (next) => {
    setValue(next)
    clearTimeout(timer.current)
    pending.current = undefined
    saveRef.current(constant.id, next)
  }

  if (type === 'checkbox') {
    const checked = typeof value === 'string' ? !!parseInt(value, 10) : !!value
    return (
      <div className='odc-aps-check'>
        <Checkbox checked={checked} disabled={disabled} onCheckedChange={next => now(next)}>{label}</Checkbox>
        {error && <InlineNotice tone='danger'>{error}</InlineNotice>}
      </div>
    )
  }
  if (isBusiness) {
    return (
      <Field label={label} error={error || undefined} disabled={disabled}>
        <SelectBusiness
          defaultValue={value ?? null}
          businessesList={businessesList}
          onChange={next => now(next === 'none' ? null : next)}
          showNoOption
        />
      </Field>
    )
  }
  if (type === 'textarea') {
    return (
      <TextArea
        name={constant.code}
        label={label}
        placeholder={constant.name}
        rows={3}
        autoComplete='off'
        error={error || undefined}
        value={value ?? ''}
        onChange={typed}
      />
    )
  }
  if (type === 'text' || type === 'number') {
    return (
      <TextField
        name={constant.code}
        label={label}
        placeholder={constant.name}
        type={type}
        error={error || undefined}
        value={value ?? ''}
        onChange={typed}
      />
    )
  }
  return null
}

export const ConstantsSection = (props) => {
  const { app, updateBaseContants, updateAppValues, businessesList } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [loading, setLoading] = useState(false)
  // M-MP-15: the saves run one after another; `queued` counts those waiting or in flight, so `loading` ends with the last one
  const chain = useRef(Promise.resolve())
  const queued = useRef(0)
  const [errors, setErrors] = useState({})
  const mounted = useRef(true)
  const { remember, restore } = useKeepFocus()
  // the app as it is when the answer arrives: a save started a moment ago must not write over a newer list
  const appRef = useRef(app)
  appRef.current = app

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const setError = (id, message) => setErrors(current => {
    if (!message && !current[id]) return current
    const next = { ...current }
    if (message) next[id] = message
    else delete next[id]
    return next
  })

  const save = async (id, value) => {
    setError(id, null)
    try {
      const { error, result } = await updateBaseContants({ id, body: { value } })
      // a save on leave answers after this section is gone, but the editor still holds the app: it gets the new
      // value (or the section shows the old one when it opens again); only this section's own state is skipped
      if (!error) {
        const list = appRef.current?.baseConstants
        const index = list?.findIndex(item => Number(item.id) === Number(result?.id))
        if (index !== undefined && index !== -1) {
          updateAppValues({ baseConstants: list.map((item, i) => (i === index ? { ...item, ...result } : item)) })
        }
        showToast(ToastType.Success, t('CORRECTLY_SAVED_CONSTANTS', 'Correctly saved constant'))
      }
      if (!mounted.current) return
      if (error) setError(id, messagesOf(t, result) || t('ERROR', 'Error'))
    } catch (err) {
      if (!mounted.current) return
      setError(id, translateApiMessage(t, err?.message, t('ERROR', 'Error')))
    }
  }

  const handleSave = (id, value) => {
    remember()
    queued.current += 1
    setLoading(true)
    // the list is read when the answer arrives (appRef), so each save updates the list the previous one left
    chain.current = chain.current
      .then(() => save(id, value))
      .catch(() => {})
      .then(() => {
        queued.current -= 1
        if (!mounted.current || queued.current > 0) return
        setLoading(false)
        // redesign my-products R1-02: the checkbox and the business are disabled while it saves, so the focus fell on <body>
        restore()
      })
    return chain.current
  }

  const constants = app?.baseConstants
  if (!constants?.length) return null

  return (
    <div className='odc-aps'>
      <div className='odc-aps-grid'>
        {constants.map(constant => (
          <ConstantField
            key={constant.id}
            constant={constant}
            label={t(`CONSTANT_${constant.code.toUpperCase()}`, constant.name)}
            disabled={loading}
            error={errors[constant.id]}
            businessesList={businessesList}
            onSave={handleSave}
            onTyping={id => setError(id, null)}
          />
        ))}
      </div>
    </div>
  )
}
