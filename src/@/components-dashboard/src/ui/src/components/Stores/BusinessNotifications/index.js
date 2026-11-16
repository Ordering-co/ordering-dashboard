import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { SaveBar, useLeaveGuard } from '../../Shared/Product'

import { BusinessEmail } from '../BusinessEmail'
import { BusinessGprsPrinters } from '../BusinessGprsPrinters'
import './notifications.css'

// redesign stores 5.4: the section is one form with one Save. The draft (email, use_printer, printer_id) lives
// here and goes to the two children as controlled props; nothing is written while typing. Save sends ONLY the keys that changed.

const SAVED_MS = 2500
// the same pattern the email field used before (an empty email is valid: it clears the address)
const EMAIL_PATTERN = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

// the first message of what the controller answers (a string or a list of them), or null
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

export const BusinessNotifications = (props) => {
  const { business, handleUpdateBusinessClick } = props

  const [, t] = useLanguage()
  const [draft, setDraft] = useState({})
  const [emailError, setEmailError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const [saved, setSaved] = useState(false)
  const savingRef = useRef(false)
  const mounted = useRef(true)
  const savedTimer = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(savedTimer.current)
    }
  }, [])

  // the saved values, in the same shape as the draft
  const savedValues = {
    email: business?.email ?? '',
    use_printer: !!business?.use_printer,
    printer_id: business?.printer_id ?? ''
  }
  const valueOf = (key) => (key in draft ? draft[key] : savedValues[key])
  const isChanged = (key) => key in draft && String(draft[key]) !== String(savedValues[key])

  const labels = {
    email: t('EMAIL_RECEIVE_ORDERS', 'Email to receive orders'),
    use_printer: t('ACCEPT_GPRS_PRINTER', 'Accept GPRS printer'),
    printer_id: t('PRINTER_MODEL', 'Printer model')
  }
  const changedKeys = ['email', 'use_printer', 'printer_id'].filter(isChanged)
  const count = changedKeys.length

  const change = (key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }))
    setErrorText(null)
    setSaved(false)
    if (key === 'email') setEmailError(null)
  }

  const discard = () => {
    setDraft({})
    setEmailError(null)
    setErrorText(null)
  }

  const save = async () => {
    if (savingRef.current) return { ok: false }
    if (isChanged('email')) {
      const email = String(draft.email)
      if (email.trim() !== '' && !EMAIL_PATTERN.test(email)) {
        setEmailError(t('STORE_EMAIL_INVALID', 'Enter a valid email, or leave it empty.'))
        // review 5.4: the field may be off screen (Save is in the sticky bar)
        requestAnimationFrame(() => {
        // centred, not just reached: at the bottom edge the sticky SaveBar covers it
          const field = rootRef.current?.querySelector('[aria-invalid="true"]')
          field?.focus({ preventScroll: true })
          field?.scrollIntoView?.({ block: 'center' })
        })
        return { ok: false }
      }
    }
    const changes = {}
    for (const key of changedKeys) {
      changes[key] = key === 'email' && String(draft.email).trim() === '' ? '' : draft[key]
    }
    if (!Object.keys(changes).length) return { ok: true }

    savingRef.current = true
    setSaving(true)
    setErrorText(null)
    let result
    try {
      result = await handleUpdateBusinessClick(changes, { keepPendingChanges: true })
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    savingRef.current = false
    if (!mounted.current) return result?.ok === true ? { ok: true } : { ok: false, error: result?.error }
    setSaving(false)
    if (result?.ok === true) {
      setDraft({})
      setSaved(true)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => { if (mounted.current) setSaved(false) }, SAVED_MS)
      return { ok: true }
    }
    setErrorText(translateApiMessage(t, firstMessage(result?.error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
    return { ok: false, error: result?.error }
  }

  useLeaveGuard({ dirty: count > 0, count, save, discard })

  const countText = (count === 1
    ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
    : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)

  return (
    <div ref={rootRef} className='odc-root odc-store-notif'>
      <h1 className='odc-store-notif-title'>{t('NOTIFICATIONS', 'Notifications')}</h1>
      <BusinessEmail
        business={business}
        email={valueOf('email')}
        emailError={emailError}
        onChangeEmail={(value) => change('email', value)}
      />
      <BusinessGprsPrinters
        business={business}
        usePrinter={valueOf('use_printer')}
        printerId={valueOf('printer_id')}
        onChangeUsePrinter={(checked) => change('use_printer', checked)}
        onChangePrinterId={(value) => change('printer_id', value)}
      />
      <SaveBar
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={countText}
        names={changedKeys.map(key => labels[key])}
        moreText={n => t('SETTINGS_UNSAVED_MORE', '+_count_').replace('_count_', n)}
        saving={saving}
        errorText={errorText}
        onRetry={save}
        retryLabel={t('RETRY', 'Retry')}
        saved={saved}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={t('SAVE', 'Save')}
        onDiscard={discard}
        onSave={save}
      />
    </div>
  )
}
