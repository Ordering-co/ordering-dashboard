import React, { useEffect, useRef, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ExclamationCircle, Image } from 'react-bootstrap-icons'

import { BuilderAppSettings as BuilderAppSettingsController, ToastType, useLanguage, useToast } from '../../../../../index'
import { Button } from '../../../styles'
import { BuilderMessage } from '../BuilderShared'
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
import {
  Chip,
  ChipGroup,
  FileActions,
  FileCard,
  FileGrid,
  FileMeta,
  FilePreview,
  LinkButton,
  MonoInput,
  MutedText,
  RowAside,
  SettingList,
  SettingName,
  SettingRow,
  Tag,
  ValueEditor,
  ValueField
} from '../styles'

/** #RGB and #RRGGBBAA as the #RRGGBB the native picker takes. */
const toPickerColor = (value) => {
  const hex = String(value || '').trim()
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) return `#${hex.slice(1).split('').map(c => c + c).join('')}`
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return hex.slice(0, 7)
  return '#000000'
}

const SettingSource = ({ setting, t }) => (
  <MutedText small>
    {setting.customized ? t('BUILDER_CUSTOM_VALUE', 'Custom value') : t('BUILDER_BASE_VALUE', 'Base value')}
  </MutedText>
)

const PlatformTag = ({ platform, t }) => (
  <Tag>{platform ? getPlatformLabel(platform) : t('BUILDER_ALL_PLATFORMS', 'All platforms')}</Tag>
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
    <SettingRow>
      <div>
        <SettingName>
          <label htmlFor={inputId} style={{ margin: 0 }}>{setting.name}</label>
          {setting.required && <Tag>{t('BUILDER_REQUIRED', 'Required')}</Tag>}
          {setting.platform && <PlatformTag platform={setting.platform} t={t} />}
        </SettingName>
        <SettingSource setting={setting} t={t} />
      </div>
      <ValueEditor>
        <ValueField invalid={!!error}>
          <div>
            {isColor && (
              <input
                type='color'
                aria-label={t('BUILDER_PICK_COLOR', 'Pick _name_').replace('_name_', setting.name)}
                value={toPickerColor(draft)}
                onChange={(e) => { setDraft(e.target.value.toUpperCase()); setError(null) }}
              />
            )}
            <MonoInput
              id={inputId}
              type='text'
              mono={isColor}
              wide={!isColor}
              value={draft}
              maxLength={isColor ? 9 : 255}
              autoComplete='off'
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? `${inputId}-error` : undefined}
              onChange={(e) => { setDraft(e.target.value); setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && dirty) handleSave() }}
            />
          </div>
          {error && <span id={`${inputId}-error`} role='alert'>{error}</span>}
        </ValueField>
      </ValueEditor>
      <RowAside>
        {dirty
          ? (
            <>
              <Button type='button' color='secundary' borderRadius='8px' onClick={() => { setDraft(setting.value ?? ''); setError(null) }}>
                {t('CANCEL', 'Cancel')}
              </Button>
              <Button type='button' color='primary' borderRadius='8px' disabled={saving} onClick={handleSave}>
                {saving ? t('BUILDER_SAVING', 'Saving…') : t('SAVE', 'Save')}
              </Button>
            </>
            )
          : setting.customized && (
            <LinkButton type='button' disabled={saving} onClick={handleReset}>
              {t('BUILDER_RESTORE_BASE_VALUE', 'Restore base value')}
            </LinkButton>
          )}
      </RowAside>
    </SettingRow>
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
    <FileCard aria-busy={saving ? 'true' : 'false'}>
      <FilePreview missing={!hasFile && setting.required}>
        {hasFile && !previewFailed && (
          <img src={setting.file_url} alt={t('BUILDER_PREVIEW_OF', 'Preview of _name_').replace('_name_', setting.name)} onError={() => setPreviewFailed(true)} />
        )}
        {hasFile && previewFailed && (
          <span><Image aria-hidden='true' size={28} /><br />{t('BUILDER_NO_PREVIEW', 'No preview for this file')}</span>
        )}
        {!hasFile && (setting.required ? t('BUILDER_NO_FILE_REQUIRED', 'No file yet. Required.') : t('BUILDER_NO_FILE', 'No file yet'))}
      </FilePreview>
      <FileMeta>
        <SettingName>
          {setting.name}
          <PlatformTag platform={setting.platform} t={t} />
        </SettingName>
        {formatFileRules(setting.file_rules, t) && <span>{formatFileRules(setting.file_rules, t)}</span>}
        {(setting.customized || hasFile) && (
          <span>{setting.customized ? t('BUILDER_YOUR_FILE', 'Your file') : t('BUILDER_BASE_FILE', 'Base file')}</span>
        )}
        {error && <span role='alert'>{error}</span>}
      </FileMeta>
      <FileActions>
        <Button type='button' color='primary' outline borderRadius='8px' disabled={saving} onClick={() => inputRef.current?.click()}>
          {saving ? t('BUILDER_SAVING', 'Saving…') : (setting.customized || hasFile) ? t('BUILDER_REPLACE', 'Replace') : t('BUILDER_UPLOAD', 'Upload')}
        </Button>
        <input
          ref={inputRef}
          type='file'
          accept={accept || undefined}
          aria-label={t('BUILDER_UPLOAD_NAMED', 'Upload _name_').replace('_name_', setting.name)}
          onChange={handleFile}
        />
        {setting.customized && (
          <LinkButton type='button' disabled={saving} onClick={handleReset}>
            {t('BUILDER_RESTORE_BASE_FILE', 'Restore base file')}
          </LinkButton>
        )}
      </FileActions>
    </FileCard>
  )
}

const SettingsStates = ({ settingsState, reloadSettings, empty, t }) => {
  if (settingsState.loading && !settingsState.settings.length) {
    return <div aria-busy='true'><Skeleton height={64} count={4} style={{ marginBottom: 8 }} /></div>
  }
  if (settingsState.error) {
    return (
      <BuilderMessage
        role='alert'
        tone='error'
        icon={<ExclamationCircle aria-hidden='true' />}
        title={t('BUILDER_SETTINGS_LOAD_ERROR', 'We couldn’t load these settings')}
        text={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
      >
        <Button color='primary' borderRadius='8px' onClick={reloadSettings}>{t('BUILDER_RETRY', 'Try again')}</Button>
      </BuilderMessage>
    )
  }
  if (empty) {
    return <BuilderMessage icon={<Image aria-hidden='true' />} title={t('BUILDER_NOTHING_TO_EDIT', 'This base has nothing to edit here')} />
  }
  return null
}

const BuilderAppColorsUI = (props) => {
  const { settingsState, reloadSettings } = props
  const [, t] = useLanguage()
  const colors = settingsState.settings.filter(item => item.group === BUILDER_COLORS_GROUP)
  const state = <SettingsStates settingsState={settingsState} reloadSettings={reloadSettings} empty={!colors.length} t={t} />
  if (settingsState.error || !colors.length) return state
  return (
    <SettingList aria-label={t('BUILDER_TAB_APPEARANCE', 'Appearance')}>
      {colors.map(setting => (
        <ValueSettingRow key={setting.id} {...props} setting={setting} saving={props.savingId === setting.id} />
      ))}
    </SettingList>
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
      <ChipGroup role='group' aria-label={t('BUILDER_GROUP', 'Group')}>
        {groups.map(item => (
          <Chip key={item} type='button' active={item === current} aria-pressed={item === current ? 'true' : 'false'} onClick={() => setGroup(item)}>
            {getSettingGroupLabel(item, t)}
          </Chip>
        ))}
      </ChipGroup>
      {values.length > 0 && (
        <SettingList>
          {values.map(setting => (
            <ValueSettingRow key={setting.id} {...props} setting={setting} saving={props.savingId === setting.id} />
          ))}
        </SettingList>
      )}
      {files.length > 0 && (
        <FileGrid>
          {files.map(setting => (
            <FileSettingCard key={setting.id} {...props} setting={setting} saving={props.savingId === setting.id} />
          ))}
        </FileGrid>
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
