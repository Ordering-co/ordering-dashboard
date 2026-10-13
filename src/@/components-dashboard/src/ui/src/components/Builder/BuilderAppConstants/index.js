import React, { useEffect, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ExclamationCircle, Sliders } from 'react-bootstrap-icons'

import { BuilderAppConstants as BuilderAppConstantsController, ToastType, useLanguage, useToast } from '../../../../../index'
import { Button } from '../../../styles'
import { BuilderMessage } from '../BuilderShared'
import { getValueErrorMessage } from '../utils'
import {
  JsonInput,
  LinkButton,
  MonoInput,
  MutedText,
  RowAside,
  SettingList,
  SettingName,
  SettingRow,
  Switch,
  Tag,
  ValueEditor,
  ValueField
} from '../styles'

const isTrue = (value) => value === true || value === 1 || ['1', 'true'].includes(String(value).toLowerCase())

/** The client checks of each constant type; the API runs the same ones. */
const validateConstant = (type, value) => {
  const text = String(value).trim()
  if (!text) return ['value.required']
  if (type === 'integer' && !/^-?\d+$/.test(text)) return ['value.integer']
  if (type === 'decimal' && (Number.isNaN(Number(text)) || !/\d/.test(text))) return ['value.numeric']
  if (type === 'json') {
    try {
      JSON.parse(text)
    } catch (e) {
      return ['value.json']
    }
  }
  if ((type === 'string' || !type) && text.length > 255) return ['value.max']
  return null
}

const ConstantRow = (props) => {
  const { constant, saving, saveConstant, resetConstant } = props
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const stored = constant.value ?? ''
  const [draft, setDraft] = useState(stored)
  const [error, setError] = useState(null)

  useEffect(() => {
    setDraft(constant.value ?? '')
    setError(null)
  }, [constant.value])

  const inputId = `builder-constant-${constant.id}`
  const dirty = draft !== stored
  const isBoolean = constant.type === 'boolean'

  const save = async (value) => {
    const { constant: saved, errorCodes } = await saveConstant(constant.id, value)
    if (saved) {
      showToast(ToastType.Success, t('BUILDER_SAVED_NEXT_BUILD', 'Saved. It applies on the next build.'))
      return
    }
    setError(getValueErrorMessage(errorCodes, constant.type, t))
  }

  const handleSave = () => {
    const invalid = validateConstant(constant.type, draft)
    if (invalid) {
      setError(getValueErrorMessage(invalid, constant.type, t))
      return
    }
    save(draft.trim())
  }

  const handleReset = async () => {
    const { constant: saved } = await resetConstant(constant.id)
    if (saved) {
      showToast(ToastType.Success, t('BUILDER_RESTORED', '_name_ is back to the base value').replace('_name_', constant.name))
    } else {
      showToast(ToastType.Error, t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.'))
    }
  }

  const source = constant.customized
    ? t('BUILDER_CUSTOM_VALUE', 'Custom value')
    : stored === '' && constant.required
      ? t('BUILDER_NOT_SET', 'Not set')
      : t('BUILDER_BASE_VALUE', 'Base value')

  return (
    <SettingRow>
      <div>
        <SettingName>
          <label htmlFor={inputId} style={{ margin: 0 }}>{constant.name}</label>
          {constant.required && <Tag>{t('BUILDER_REQUIRED', 'Required')}</Tag>}
        </SettingName>
        <MutedText small>{[constant.group, source].filter(Boolean).join(' · ')}</MutedText>
      </div>
      <ValueEditor>
        {isBoolean
          ? (
            <ValueField invalid={!!error}>
              <div>
                <Switch
                  id={inputId}
                  type='button'
                  role='switch'
                  checked={isTrue(stored)}
                  aria-checked={isTrue(stored) ? 'true' : 'false'}
                  disabled={saving}
                  onClick={() => save(isTrue(stored) ? '0' : '1')}
                />
                <span>{isTrue(stored) ? t('BUILDER_ON', 'On') : t('BUILDER_OFF', 'Off')}</span>
              </div>
              {error && <span role='alert'>{error}</span>}
            </ValueField>
            )
          : (
            <ValueField invalid={!!error}>
              <div>
                {constant.type === 'json'
                  ? (
                    <JsonInput
                      id={inputId}
                      value={draft}
                      spellCheck={false}
                      aria-invalid={error ? 'true' : 'false'}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      onChange={(e) => { setDraft(e.target.value); setError(null) }}
                    />
                    )
                  : (
                    <MonoInput
                      id={inputId}
                      type='text'
                      wide
                      inputMode={constant.type === 'integer' ? 'numeric' : constant.type === 'decimal' ? 'decimal' : undefined}
                      value={draft}
                      maxLength={constant.type === 'string' ? 255 : undefined}
                      placeholder={constant.required && !stored ? t('BUILDER_REQUIRED', 'Required') : ''}
                      autoComplete='off'
                      aria-invalid={error ? 'true' : 'false'}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      onChange={(e) => { setDraft(e.target.value); setError(null) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && dirty) handleSave() }}
                    />
                    )}
              </div>
              {error && <span id={`${inputId}-error`} role='alert'>{error}</span>}
            </ValueField>
            )}
      </ValueEditor>
      <RowAside>
        {!isBoolean && dirty
          ? (
            <>
              <Button type='button' color='secundary' borderRadius='8px' onClick={() => { setDraft(stored); setError(null) }}>
                {t('CANCEL', 'Cancel')}
              </Button>
              <Button type='button' color='primary' borderRadius='8px' disabled={saving} onClick={handleSave}>
                {saving ? t('BUILDER_SAVING', 'Saving…') : t('SAVE', 'Save')}
              </Button>
            </>
            )
          : constant.customized && (
            <LinkButton type='button' disabled={saving} onClick={handleReset}>
              {t('BUILDER_RESTORE_BASE_VALUE', 'Restore base value')}
            </LinkButton>
          )}
      </RowAside>
    </SettingRow>
  )
}

const BuilderAppConstantsUI = (props) => {
  const { constantsState, reloadConstants, savingId } = props
  const [, t] = useLanguage()
  const { loading, constants, error } = constantsState

  if (loading && !constants.length) {
    return <div aria-busy='true'><Skeleton height={64} count={4} style={{ marginBottom: 8 }} /></div>
  }
  if (error) {
    return (
      <BuilderMessage
        role='alert'
        tone='error'
        icon={<ExclamationCircle aria-hidden='true' />}
        title={t('BUILDER_CONSTANTS_LOAD_ERROR', 'We couldn’t load the constants')}
        text={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
      >
        <Button color='primary' borderRadius='8px' onClick={reloadConstants}>{t('BUILDER_RETRY', 'Try again')}</Button>
      </BuilderMessage>
    )
  }
  if (!constants.length) {
    return <BuilderMessage icon={<Sliders aria-hidden='true' />} title={t('BUILDER_NOTHING_TO_EDIT', 'This base has nothing to edit here')} />
  }
  return (
    <SettingList aria-label={t('BUILDER_TAB_CONSTANTS', 'Constants')}>
      {constants.map(constant => (
        <ConstantRow key={constant.id} {...props} constant={constant} saving={savingId === constant.id} />
      ))}
    </SettingList>
  )
}

/** Constants tab: keys and switches the app is built with. */
export const BuilderAppConstantsList = (props) => (
  <BuilderAppConstantsController {...props} UIComponent={BuilderAppConstantsUI} />
)
