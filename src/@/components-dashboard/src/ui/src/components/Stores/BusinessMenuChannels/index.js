import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { SearchBar } from '../../Shared'
import { Button, Checkbox, SaveBar } from '../../Shared/Product'
import './business-menu-channels.css'

// redesign stores 5.5a (S7, G3-15, G3-17): the sites of a menu. The search ignores case; saving is the P/SaveBar of the
// section (count, Discard, Save, the error with Retry): nothing to save, no active Save. The checkboxes and Select all / none are
// the controller's, as before.

const SAVED_MS = 2500

// the first message of what the controller answers (a string or a list of them), or null
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

export const BusinessMenuChannels = (props) => {
  const {
    formState,
    handleUpdateBusinessMenuOption,
    sitesState,
    handleChangeMenuSite,
    menu,
    handleSelectAllChannels,
    handleSelectNoneChannels,
    pendingChangeKeys,
    discardChanges
  } = props
  const [, t] = useLanguage()
  const [searchValue, setSearchValue] = useState('')
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

  // the saved sites, and the ones the form asks for (none asked: the saved ones)
  const savedIds = (menu?.sites || []).map(site => site?.id)
  const draftIds = Array.isArray(formState?.changes?.sites) ? formState.changes.sites : null
  const checkedIds = draftIds ?? savedIds
  const differs = draftIds != null && (draftIds.length !== savedIds.length || draftIds.some(id => !savedIds.includes(id)))
  // The menu is one form across its tabs: Save sends every pending change of the menu (as the Save of main did), so the bar counts
  // them all, not only the sites.
  const count = Array.isArray(pendingChangeKeys) ? pendingChangeKeys.length : (differs ? 1 : 0)

  const needle = searchValue.trim().toLowerCase()
  const sites = (sitesState?.sites || []).filter(site => (site?.name || '').toLowerCase().includes(needle))

  const touched = () => {
    setErrorText(null)
    setSaved(false)
  }

  const toggleSite = (id) => {
    touched()
    handleChangeMenuSite(id)
  }

  const selectAll = () => {
    touched()
    handleSelectAllChannels()
  }

  const selectNone = () => {
    touched()
    handleSelectNoneChannels()
  }

  const discard = () => {
    touched()
    discardChanges?.()
  }

  const save = async () => {
    if (savingRef.current) return { ok: false }
    savingRef.current = true
    setSaving(true)
    setErrorText(null)
    let result
    try {
      result = await handleUpdateBusinessMenuOption()
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    savingRef.current = false
    if (!mounted.current) return result?.ok === false ? { ok: false, error: result.error } : { ok: true }
    setSaving(false)
    if (result?.ok === false) {
      setErrorText(translateApiMessage(t, firstMessage(result.error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
      return { ok: false, error: result.error }
    }
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => { if (mounted.current) setSaved(false) }, SAVED_MS)
    return { ok: true }
  }

  const countText = (count === 1
    ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
    : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)

  return (
    <div className='odc-bmc' tabIndex={-1}>
      <SearchBar
        placeholder={t('SEARCH', 'Search')}
        isCustomLayout
        search={searchValue}
        onSearch={val => setSearchValue(val)}
      />
      <div className='odc-bmc-bulk'>
        <Button onClick={selectAll}>{t('SELECT_ALL', 'Select all')}</Button>
        <Button onClick={selectNone}>{t('SELECT_NONE', 'Select none')}</Button>
      </div>
      <div className='odc-bmc-list'>
        {sites.map(site => (
          <Checkbox
            key={site.id}
            checked={checkedIds.includes(site.id)}
            onCheckedChange={() => toggleSite(site.id)}
          >
            {site.name}
          </Checkbox>
        ))}
      </div>
      <SaveBar
        label={t('SAVE_CHANGES', 'Save changes')}
        formSelector='.odc-bmc'
        count={count}
        countText={countText}
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
