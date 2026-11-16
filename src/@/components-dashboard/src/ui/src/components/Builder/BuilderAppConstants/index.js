import React, { useEffect, useState } from 'react'

import { BuilderAppConstants as BuilderAppConstantsController, ToastType, useLanguage, useToast } from '../../../../../index'
import { CircleAlert, SlidersHorizontal } from '../../Shared/Icon'
import { Button, EmptyState, Switch, TextArea, TextField } from '../../Shared/Product'
import { LoadingRows } from '../BuilderAppSettings'
import { getValueErrorMessage } from '../utils'
import '../BuilderAppSettings/builder-app-edit.css'

// redesign B2: Constants on Product pieces (Switch, TextField, TextArea, Buttons, Skeleton, EmptyState) and --od-* tokens.
// The switch saves '1' or '0' at once and is disabled while it saves, as main's; the rest keeps main's checks, Enter, Cancel and Save.

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

  const fieldProps = {
    id: inputId,
    'aria-label': constant.name,
    className: 'odc-be-mono',
    value: draft,
    error: error || undefined,
    onChange: (value) => { setDraft(value); setError(null) }
  }

  return (
    <div className='odc-be-row'>
      <div className='odc-be-row-name'>
        <span className='odc-be-name'>
          <label htmlFor={inputId}>{constant.name}</label>
          {constant.required && <span className='odc-be-tag'>{t('BUILDER_REQUIRED', 'Required')}</span>}
        </span>
        <span className='odc-be-muted'>{[constant.group, source].filter(Boolean).join(' · ')}</span>
      </div>
      <div className='odc-be-value'>
        {isBoolean
          ? (
            <div className='odc-be-switch'>
              <div>
                <Switch
                  id={inputId}
                  label={constant.name}
                  checked={isTrue(stored)}
                  disabled={saving}
                  onCheckedChange={() => save(isTrue(stored) ? '0' : '1')}
                />
                <span>{isTrue(stored) ? t('BUILDER_ON', 'On') : t('BUILDER_OFF', 'Off')}</span>
              </div>
              {error && <span className='odc-be-error' role='alert'>{error}</span>}
            </div>
            )
          : constant.type === 'json'
            ? <TextArea {...fieldProps} spellCheck={false} />
            : (
              <TextField
                {...fieldProps}
                inputMode={constant.type === 'integer' ? 'numeric' : constant.type === 'decimal' ? 'decimal' : undefined}
                maxLength={constant.type === 'string' ? 255 : undefined}
                placeholder={constant.required && !stored ? t('BUILDER_REQUIRED', 'Required') : ''}
                autoComplete='off'
                onKeyDown={(e) => { if (e.key === 'Enter' && dirty) handleSave() }}
              />
              )}
      </div>
      <div className='odc-be-aside'>
        {!isBoolean && dirty
          ? (
            <>
              <Button onClick={() => { setDraft(stored); setError(null) }}>
                {t('CANCEL', 'Cancel')}
              </Button>
              <Button variant='primary' disabled={saving} onClick={handleSave}>
                {saving ? t('BUILDER_SAVING', 'Saving…') : t('SAVE', 'Save')}
              </Button>
            </>
            )
          : constant.customized && (
            <Button variant='link' disabled={saving} onClick={handleReset}>
              {t('BUILDER_RESTORE_BASE_VALUE', 'Restore base value')}
            </Button>
          )}
      </div>
    </div>
  )
}

const BuilderAppConstantsUI = (props) => {
  const { constantsState, reloadConstants, savingId } = props
  const [, t] = useLanguage()
  const { loading, constants, error } = constantsState

  if (loading && !constants.length) {
    return <LoadingRows />
  }
  if (error) {
    return (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        titleAs='h2'
        title={t('BUILDER_CONSTANTS_LOAD_ERROR', 'We couldn’t load the constants')}
        description={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
        action={<Button variant='primary' onClick={reloadConstants}>{t('BUILDER_RETRY', 'Try again')}</Button>}
      />
    )
  }
  if (!constants.length) {
    return <EmptyState icon={SlidersHorizontal} titleAs='h2' title={t('BUILDER_NOTHING_TO_EDIT', 'This base has nothing to edit here')} />
  }
  return (
    <div className='odc-be-list' role='group' aria-label={t('BUILDER_TAB_CONSTANTS', 'Constants')}>
      {constants.map(constant => (
        <ConstantRow key={constant.id} {...props} constant={constant} saving={savingId === constant.id} />
      ))}
    </div>
  )
}

/** Constants tab: keys and switches the app is built with. */
export const BuilderAppConstantsList = (props) => (
  <BuilderAppConstantsController {...props} UIComponent={BuilderAppConstantsUI} />
)
