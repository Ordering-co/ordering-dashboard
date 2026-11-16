import React from 'react'
import { useLanguage } from '../../../../../index'
import { SaveBar } from '../../Shared/Product/SaveBar'
import './settings-hub-form.css'

// redesign settings B (decision 4): the save bar every Settings form shares (SettingsList here, EmailSetting and
// NotificationSetting in batch D). redesign UF-B1b: the bar itself moved to `Shared/Product/SaveBar` when the profile
// form became its second surface; this adapter keeps Settings' props and texts (same keys and defaults) and hands the bar its strings.

const withCount = (text, count) => text.replace('_count_', String(count))

/**
 * @param {object} props
 * @param {number} props.count unsaved changes, counted by visible field
 * @param {string[]} [props.names] names of the changed fields
 * @param {boolean} [props.saving]
 * @param {{ kind: 'validation' | 'api' | 'partial', message?: string, invalidCount?: number, savedCount?: number, totalCount?: number, failedName?: string }} [props.error]
 * @param {boolean} [props.saved] a save just ended well (the form clears it after four seconds)
 * @param {() => void} props.onDiscard
 * @param {() => void} props.onSave
 */
export const SettingsSaveBar = ({ count = 0, names = [], saving = false, error = null, saved = false, onDiscard, onSave }) => {
  const [, t] = useLanguage()

  const countText = count === 1
    ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
    : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')

  let errorText = null
  if (error?.kind === 'validation') {
    const invalid = error.invalidCount ?? 0
    errorText = withCount(invalid === 1
      ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
      : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.'), invalid)
  } else if (error?.kind === 'partial') {
    const savedCount = error.savedCount ?? 0
    errorText = t('SETTINGS_SAVE_PARTIAL', 'Saved _saved_ of _total_. _field_ failed: _message_')
      .replace('_saved_', String(savedCount))
      .replace('_total_', String(error.totalCount ?? savedCount + count))
      .replace('_field_', error.failedName || '')
      .replace('_message_', error.message || '')
      .trim()
  } else if (error) {
    errorText = t('SETTINGS_SAVE_FAILED', 'We couldn\'t save your changes. _message_')
      .replace('_message_', error.message || '')
      .trim()
  }

  return (
    <SaveBar
      className='odc-hub-savebar'
      formSelector='.odc-hub-form'
      label={t('SAVE_CHANGES', 'Save changes')}
      count={count}
      countText={withCount(countText, count)}
      names={names}
      moreText={n => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
      saving={saving}
      errorText={errorText}
      saved={saved}
      savedText={t('SAVED', 'Saved')}
      discardLabel={t('DISCARD', 'Discard')}
      saveLabel={t('SAVE_CHANGES', 'Save changes')}
      onDiscard={onDiscard}
      onSave={onSave}
    />
  )
}
