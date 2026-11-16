import React, { useEffect, useRef, useState } from 'react'

import { BuilderAppSettings as BuilderAppSettingsController, ToastType, useLanguage, useToast } from '../../../../../index'
import { CircleAlert, Image } from '../../Shared/Icon'
import { Button, EmptyState, Skeleton, TextField } from '../../Shared/Product'
import {
  BUILDER_COLORS_GROUP,
  COLOR_PATTERN,
  formatFileRules,
  getFileErrorMessage,
  getFileGroups,
  getPlatformLabel,
  getSettingGroupLabel,
  getValueErrorMessage
} from '../utils'
import './builder-app-edit.css'

// redesign B2: Appearance and Files on Product pieces (TextField, Buttons, Skeleton, EmptyState) and --od-* tokens. The
// color keeps main's native picker beside the text (P/ColorField waits 750 ms and has no typed value). The group chips stay native
// toggle buttons (aria-pressed). Same values, codes, toasts and texts as main.

/** #RGB and #RRGGBBAA as the #RRGGBB the native picker takes. */
const toPickerColor = (value) => {
  const hex = String(value || '').trim()
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) return `#${hex.slice(1).split('').map(c => c + c).join('')}`
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return hex.slice(0, 7)
  return '' // the native picker reads an empty value as black, as main's fallback
}

const SettingSource = ({ setting, t }) => (
  <span className='odc-be-muted'>
    {setting.customized ? t('BUILDER_CUSTOM_VALUE', 'Custom value') : t('BUILDER_BASE_VALUE', 'Base value')}
  </span>
)

const PlatformTag = ({ platform, t }) => (
  <span className='odc-be-tag'>{platform ? getPlatformLabel(platform) : t('BUILDER_ALL_PLATFORMS', 'All platforms')}</span>
)

/** A color or text setting, saved on its own row. */
const ValueSettingRow = (props) => {
  const { setting, saving, saveValue, resetSetting } = props
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [draft, setDraft] = useState(setting.value ?? '')
  const [error, setError] = useState(null)

  useEffect(() => {
    setDraft(setting.value ?? '')
    setError(null)
  }, [setting.value])

  const isColor = setting.kind === 'color'
  const dirty = draft !== (setting.value ?? '')
  const inputId = `builder-setting-${setting.id}`

  const handleSave = async () => {
    const value = draft.trim()
    if (isColor && !COLOR_PATTERN.test(value)) {
      setError(getValueErrorMessage(['value.regex'], 'color', t))
      return
    }
    if (!isColor && !value) {
      setError(getValueErrorMessage(['value.required'], 'text', t))
      return
    }
    const { setting: saved, errorCodes } = await saveValue(setting.id, value)
    if (saved) {
      showToast(ToastType.Success, t('BUILDER_SAVED_NEXT_BUILD', 'Saved. It applies on the next build.'))
      return
    }
    setError(getValueErrorMessage(errorCodes, setting.kind, t))
  }

  const handleReset = async () => {
    const { setting: saved } = await resetSetting(setting.id)
    if (saved) {
      showToast(ToastType.Success, t('BUILDER_RESTORED', '_name_ is back to the base value').replace('_name_', setting.name))
    } else {
      showToast(ToastType.Error, t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.'))
    }
  }

  return (
    <div className='odc-be-row'>
      <div className='odc-be-row-name'>
        <span className='odc-be-name'>
          <label htmlFor={inputId}>{setting.name}</label>
          {setting.required && <span className='odc-be-tag'>{t('BUILDER_REQUIRED', 'Required')}</span>}
          {setting.platform && <PlatformTag platform={setting.platform} t={t} />}
        </span>
        <SettingSource setting={setting} t={t} />
      </div>
      <div className='odc-be-value'>
        {isColor && (
          <input
            type='color'
            className='odc-be-swatch'
            aria-label={t('BUILDER_PICK_COLOR', 'Pick _name_').replace('_name_', setting.name)}
            value={toPickerColor(draft)}
            onChange={(e) => { setDraft(e.target.value.toUpperCase()); setError(null) }}
          />
        )}
        <TextField
          id={inputId}
          aria-label={setting.name}
          fieldClassName={isColor ? 'odc-be-color' : undefined}
          className={isColor ? 'odc-be-mono' : undefined}
          value={draft}
          maxLength={isColor ? 9 : 255}
          autoComplete='off'
          error={error || undefined}
          onChange={(value) => { setDraft(value); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && dirty) handleSave() }}
        />
      </div>
      <div className='odc-be-aside'>
        {dirty
          ? (
            <>
              <Button onClick={() => { setDraft(setting.value ?? ''); setError(null) }}>
                {t('CANCEL', 'Cancel')}
              </Button>
              <Button variant='primary' disabled={saving} onClick={handleSave}>
                {saving ? t('BUILDER_SAVING', 'Saving…') : t('SAVE', 'Save')}
              </Button>
            </>
            )
          : setting.customized && (
            <Button variant='link' disabled={saving} onClick={handleReset}>
              {t('BUILDER_RESTORE_BASE_VALUE', 'Restore base value')}
            </Button>
          )}
      </div>
    </div>
  )
}

/** An image or file setting: preview, rules, upload and restore. */
const FileSettingCard = (props) => {
  const { setting, saving, uploadFile, resetSetting } = props
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const inputRef = useRef(null)
  const [error, setError] = useState(null)
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => { setPreviewFailed(false) }, [setting.file_url])

  const hasFile = !!setting.file_url
  const accept = [].concat(setting.file_rules?.extension || []).flatMap(item => String(item).split(',')).map(item => `.${item.trim().replace(/^\./, '')}`).filter(item => item !== '.').join(',')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    const { setting: saved, errorCodes } = await uploadFile(setting.id, file)
    if (saved) {
      showToast(ToastType.Success, t('BUILDER_SAVED_NEXT_BUILD', 'Saved. It applies on the next build.'))
      return
    }
    setError(getFileErrorMessage(errorCodes, setting.file_rules, t))
  }

  const handleReset = async () => {
    setError(null)
    const { setting: saved } = await resetSetting(setting.id)
    if (saved) {
      showToast(ToastType.Success, t('BUILDER_RESTORED_FILE', '_name_ is back to the base file').replace('_name_', setting.name))
    } else {
      showToast(ToastType.Error, t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.'))
    }
  }

  return (
    <div className='odc-be-file' aria-busy={saving ? 'true' : 'false'}>
      <div className='odc-be-preview' data-missing={!hasFile && setting.required ? '' : undefined}>
        {hasFile && !previewFailed && (
          <img src={setting.file_url} alt={t('BUILDER_PREVIEW_OF', 'Preview of _name_').replace('_name_', setting.name)} onError={() => setPreviewFailed(true)} />
        )}
        {hasFile && previewFailed && (
          <span><Image className='odc-icon' aria-hidden='true' /><br />{t('BUILDER_NO_PREVIEW', 'No preview for this file')}</span>
        )}
        {!hasFile && (setting.required ? t('BUILDER_NO_FILE_REQUIRED', 'No file yet. Required.') : t('BUILDER_NO_FILE', 'No file yet'))}
      </div>
      <div className='odc-be-file-meta'>
        <span className='odc-be-name'>
          {setting.name}
          <PlatformTag platform={setting.platform} t={t} />
        </span>
        {formatFileRules(setting.file_rules, t) && <span>{formatFileRules(setting.file_rules, t)}</span>}
        {(setting.customized || hasFile) && (
          <span>{setting.customized ? t('BUILDER_YOUR_FILE', 'Your file') : t('BUILDER_BASE_FILE', 'Base file')}</span>
        )}
        {error && <span className='odc-be-error' role='alert'>{error}</span>}
      </div>
      <div className='odc-be-file-actions'>
        <Button disabled={saving} onClick={() => inputRef.current?.click()}>
          {saving ? t('BUILDER_SAVING', 'Saving…') : (setting.customized || hasFile) ? t('BUILDER_REPLACE', 'Replace') : t('BUILDER_UPLOAD', 'Upload')}
        </Button>
        <input
          ref={inputRef}
          type='file'
          hidden
          accept={accept || undefined}
          aria-label={t('BUILDER_UPLOAD_NAMED', 'Upload _name_').replace('_name_', setting.name)}
          onChange={handleFile}
        />
        {setting.customized && (
          <Button variant='link' disabled={saving} onClick={handleReset}>
            {t('BUILDER_RESTORE_BASE_FILE', 'Restore base file')}
          </Button>
        )}
      </div>
    </div>
  )
}

const SettingsStates = ({ settingsState, reloadSettings, empty, t }) => {
  if (settingsState.loading && !settingsState.settings.length) {
    return <LoadingRows />
  }
  if (settingsState.error) {
    return (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        titleAs='h2'
        title={t('BUILDER_SETTINGS_LOAD_ERROR', 'We couldn’t load these settings')}
        description={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
        action={<Button variant='primary' onClick={reloadSettings}>{t('BUILDER_RETRY', 'Try again')}</Button>}
      />
    )
  }
  if (empty) {
    return <EmptyState icon={Image} titleAs='h2' title={t('BUILDER_NOTHING_TO_EDIT', 'This base has nothing to edit here')} />
  }
  return null
}

/** Four rows of main's 64px while the first load runs. */
export const LoadingRows = ({ count = 4, block = 'var(--od-space-8)' }) => (
  <div className='odc-be-skeletons' aria-busy='true'>
    {Array.from({ length: count }, (_, index) => <Skeleton key={index} block={block} shape='box' />)}
  </div>
)

const BuilderAppColorsUI = (props) => {
  const { settingsState, reloadSettings } = props
  const [, t] = useLanguage()
  const colors = settingsState.settings.filter(item => item.group === BUILDER_COLORS_GROUP)
  const state = <SettingsStates settingsState={settingsState} reloadSettings={reloadSettings} empty={!colors.length} t={t} />
  if (settingsState.error || !colors.length) return state
  return (
    <div className='odc-be-list' role='group' aria-label={t('BUILDER_TAB_APPEARANCE', 'Appearance')}>
      {colors.map(setting => (
        <ValueSettingRow key={setting.id} {...props} setting={setting} saving={props.savingId === setting.id} />
      ))}
    </div>
  )
}

const BuilderAppFilesUI = (props) => {
  const { settingsState, reloadSettings, focusGroup } = props
  const [, t] = useLanguage()
  const groups = getFileGroups(settingsState.settings)
  const [group, setGroup] = useState(focusGroup || null)

  useEffect(() => {
    if (focusGroup) setGroup(focusGroup)
  }, [focusGroup])

  const current = groups.includes(group) ? group : groups[0]
  const items = settingsState.settings.filter(item => item.group === current)
  const values = items.filter(item => item.kind !== 'file')
  const files = items.filter(item => item.kind === 'file')

  const state = <SettingsStates settingsState={settingsState} reloadSettings={reloadSettings} empty={!groups.length} t={t} />
  if (settingsState.error || !groups.length) return state

  return (
    <>
      <div className='odc-be-chips' role='group' aria-label={t('BUILDER_GROUP', 'Group')}>
        {groups.map(item => (
          <button key={item} type='button' className='odc-be-chip' aria-pressed={item === current ? 'true' : 'false'} onClick={() => setGroup(item)}>
            {getSettingGroupLabel(item, t)}
          </button>
        ))}
      </div>
      {values.length > 0 && (
        <div className='odc-be-list'>
          {values.map(setting => (
            <ValueSettingRow key={setting.id} {...props} setting={setting} saving={props.savingId === setting.id} />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className='odc-be-files'>
          {files.map(setting => (
            <FileSettingCard key={setting.id} {...props} setting={setting} saving={props.savingId === setting.id} />
          ))}
        </div>
      )}
    </>
  )
}

/** Appearance tab: the app's colors. */
export const BuilderAppColors = (props) => (
  <BuilderAppSettingsController {...props} UIComponent={BuilderAppColorsUI} />
)

/** Images and files tab: every other setting group, one at a time. */
export const BuilderAppFiles = (props) => (
  <BuilderAppSettingsController {...props} UIComponent={BuilderAppFilesUI} />
)
