import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useConfig } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { RadioGroup, SaveBar, useLeaveGuard } from '../../Shared/Product'
import { LayoutPreview } from './LayoutPreview'
import './front-layout.css'

// redesign stores 5.15b (; decision 4, G5-15, G5-16): the layout of the store's website.
// - The two layouts are a P/RadioGroup of cards (arrows, Home/End, one Tab stop, aria-checked); main drew `div onClick` tiles with
//   no keyboard and the choice told only by a border.
// - The choice is a local draft saved by the P/SaveBar, which only shows once it differs from what is stored. Save sends ONLY
//   `front_layout` (`keepPendingChanges`): main replaced the whole `formState.changes` with it, dropping what another field had
//   pending. Leaving with the draft asks (2.A, `useLeaveGuard`).
// - Groceries needs `use_parent_category` on, as in main. A store already on Groceries with it off sees Groceries chosen, with
//   the reason, and can move to Food (main showed no card chosen). It is not `disabled`: the checked radio is the group's only
//   Tab stop, so a disabled one would take the whole group out of the keyboard (review 5.15b R1). Choosing it again only
//   returns to what is stored, so nothing new can be saved with it.

const SAVED_MS = 2500

// the first message of what the controller answers (a string, `{ message }`, or a list of either), or null
const firstMessage = (error) => {
  const item = Array.isArray(error) ? error[0] : error
  const message = typeof item === 'string' ? item : item?.message
  return typeof message === 'string' && message.trim() ? message : null
}

export const BusinessFrontLayout = (props) => {
  const { business, handleUpdateBusinessClick } = props

  const [, t] = useLanguage()
  const [configState] = useConfig()
  const [draft, setDraft] = useState(null)
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

  const groceriesAllowed = configState?.configs?.use_parent_category?.value === '1'
  const stored = business?.front_layout ?? null
  const value = draft ?? stored
  const changed = draft !== null && draft !== stored
  const count = changed ? 1 : 0

  const options = [
    {
      value: 'food',
      label: t('FOOD', 'Food'),
      description: t('STORE_LAYOUT_FOOD_DESC', 'Categories along the top and products in a list, with the cart beside them. For restaurants.'),
      media: <LayoutPreview kind='food' />
    }
  ]
  if (groceriesAllowed || stored === 'groceries') {
    options.push({
      value: 'groceries',
      label: t('GROCERIES', 'Groceries'),
      description: groceriesAllowed
        ? t('STORE_LAYOUT_GROCERIES_DESC', 'Parent categories in a side list and products in a grid. For stores with many products.')
        : t('STORE_LAYOUT_GROCERIES_OFF', 'Needs parent categories turned on for the project. Choose Food to change it.'),
      media: <LayoutPreview kind='groceries' />
    })
  }

  const choose = (next) => {
    setDraft(next === stored ? null : next)
    setErrorText(null)
    setSaved(false)
  }

  const discard = () => {
    setDraft(null)
    setErrorText(null)
  }

  const save = async () => {
    if (savingRef.current) return { ok: false }
    if (!changed) return { ok: true }
    savingRef.current = true
    setSaving(true)
    setErrorText(null)
    let result
    try {
      result = await handleUpdateBusinessClick({ front_layout: draft }, { keepPendingChanges: true })
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    savingRef.current = false
    if (!mounted.current) return result?.ok === true ? { ok: true } : { ok: false, error: result?.error }
    setSaving(false)
    if (result?.ok === true) {
      setDraft(null)
      setSaved(true)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => { if (mounted.current) setSaved(false) }, SAVED_MS)
      return { ok: true }
    }
    setErrorText(translateApiMessage(t, firstMessage(result?.error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
    return { ok: false, error: result?.error }
  }

  useLeaveGuard({ dirty: changed, count, save, discard })

  const countText = (count === 1
    ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
    : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)

  return (
    <div className='odc-root odc-front-layout' tabIndex={-1}>
      <h1 className='odc-front-layout-title'>{t('LAYOUT', 'Layout')}</h1>
      <RadioGroup
        variant='cards'
        label={t('STORE_LAYOUT_CHOOSE', 'Layout of the store\'s website')}
        options={options}
        value={value}
        onValueChange={choose}
        disabled={saving}
      />
      <SaveBar
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={countText}
        names={changed ? [t('LAYOUT', 'Layout')] : []}
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
        formSelector='.odc-front-layout'
      />
    </div>
  )
}
