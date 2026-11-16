import React, { useEffect, useRef, useState } from 'react'
import { JsonEditor as Editor } from 'jsoneditor-react'
import 'jsoneditor-react/es/editor.min.css'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import {
  Button,
  ConfirmDialog,
  Field,
  IconButton,
  InlineNotice,
  Skeleton,
  TextField,
  useFieldFrame,
  useLeaveGuard
} from '../../Shared/Product'
import { CircleAlert, Trash2 } from '../../Shared/Icon'
import './meta-fields-editor.css'

// redesign stores 5.14 (K-1): promoted from S/BusinessMenuCustomFields (5.6) so the menu and the promotions share one
// custom-fields editor. It has no controller and no dialog: the host passes the data and the three actions and decides where it sits
// (the menu mounts it inside its Dialog, the promotions inline in a detail).
//
//  - `fields` (array of `{ id, key, value, value_type }`), `loading` (bool) and `error` (a string, a list of them, or null) draw the
//    list: a skeleton while it loads, the error with «Retry» (`onReload()`) apart from the empty state, then one row per field.
//  - `onAdd(body) → Promise<{ ok, error? }>` receives `{ ...extraBody, key, value, value_type }`: the host's ids travel in `extraBody`
//    (the menu `{ business_id, menu_id }`, a promotion `{ business_id, offer_id }`); the piece never names them. A refusal (`ok: false`)
//    shows its message under the form; a success empties the form and focuses Key.
//  - `onDelete(id) → Promise<{ ok, error? }>` runs after a C8 confirmation; if it refuses, the confirmation stays and says why.
//    Optional `deletion` (the result of `useMetaFieldDelete({ onDelete })`): the host owns the delete flow and draws
//    `<MetaFieldDeleteConfirm {...deletion.confirm} />` itself, so the editor does not. A host with a Dialog around the editor must do
//    this and draw the confirmation as a sibling of the Dialog, or Base UI takes it for a nested dialog and skips its scrim.
//  - The add form registers in the nearest LeaveGuardContext (the host's) and, when `registerCloseGuard` comes, in that one too
//    (a SectionSplit's, as S/BusinessMarkups/MarkupDetail does). Save is the add, Discard empties the form.
//  - `className` goes on the root. Texts and i18n keys are the menu's, so the menu does not change.

const TYPES = ['integer', 'decimal', 'boolean', 'text', 'json']
const INTEGER_PATTERN = /^\d+$/
const DECIMAL_PATTERN = /^[+-]?\d*\.?\d+(?:[Ee][+-]?\d+)?$/
const SKELETON_ROWS = 3

// the first message of what the host answers (a string or a list of them), or null
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

/** The JSON editor of today (jsoneditor-react), named by the label of its Field. */
const JsonValue = ({ json, onChange }) => {
  const frame = useFieldFrame()
  return (
    <div className='odc-mfe-json' role='group' aria-labelledby={frame?.labelId || undefined}>
      <Editor value={json} onChange={onChange} />
    </div>
  )
}

/** The add form. It registers in the leave guard: Save is the add, Discard empties the form. */
const AddForm = ({ extraBody, onAdd, registerCloseGuard, typeLabels }) => {
  const [, t] = useLanguage()
  const [type, setType] = useState('text')
  const [metaKey, setMetaKey] = useState('')
  const [metaValue, setMetaValue] = useState('')
  const [selectedBoolean, setSelectedBoolean] = useState('1')
  const [json, setJson] = useState({})
  // the editor is remounted when the form empties, so it does not keep the old document
  const [jsonVersion, setJsonVersion] = useState(0)
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const formRef = useRef(null)
  const keyRef = useRef(null)
  const busyRef = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const validate = () => {
    const found = {}
    if (metaKey.trim() === '') found.key = t('STORES_MENU_FIELD_KEY_REQUIRED', 'Enter a key.')
    if (type === 'text' || type === 'integer' || type === 'decimal') {
      if (metaValue.trim() === '') found.value = t('STORES_MENU_FIELD_VALUE_REQUIRED', 'Enter a value.')
      else if (type === 'integer' && !INTEGER_PATTERN.test(metaValue)) found.value = t('STORES_MENU_FIELD_INTEGER', 'Enter a whole number.')
      else if (type === 'decimal' && !DECIMAL_PATTERN.test(metaValue)) found.value = t('STORES_MENU_FIELD_DECIMAL', 'Enter a number.')
    }
    return found
  }
  // after the first attempt the errors follow what is typed, so they go away as the user fixes them
  const errors = attempted ? validate() : {}

  const clear = () => {
    setMetaKey('')
    setMetaValue('')
    setSelectedBoolean('1')
    setJson({})
    setJsonVersion(version => version + 1)
    setAttempted(false)
    setApiError(null)
  }

  const changeType = (next) => {
    setType(next)
    setMetaValue('')
    setApiError(null)
  }

  // Adds the field. Answers `{ ok: false }` when the form is not valid or the API refuses, so the leave guard keeps the user here.
  const add = async () => {
    if (busyRef.current) return { ok: false }
    setAttempted(true)
    if (Object.keys(validate()).length > 0) return { ok: false, invalid: true }
    let value
    if (type === 'json') value = JSON.stringify(json)
    else if (type === 'boolean') value = selectedBoolean
    else value = metaValue
    busyRef.current = true
    setBusy(true)
    setApiError(null)
    let result
    try {
      result = await onAdd({ ...extraBody, key: metaKey, value, value_type: type })
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    busyRef.current = false
    if (!mounted.current) return result?.ok === false ? { ok: false } : { ok: true }
    setBusy(false)
    if (result?.ok === false) {
      setApiError(translateApiMessage(t, firstMessage(result.error), t('STORES_MENU_FIELD_ADD_ERROR', "We couldn't add this field. Try again.")))
      return { ok: false }
    }
    clear()
    keyRef.current?.focus()
    return { ok: true }
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    const result = await add()
    // the focus goes to the first invalid control, once the errors are drawn
    if (result.invalid) setFocusRequest(current => current + 1)
  }

  useEffect(() => {
    if (!focusRequest) return
    formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [focusRequest])

  const hasJson = type === 'json' && JSON.stringify(json) !== '{}'
  const hasValue = metaValue !== '' || hasJson
  const dirty = metaKey !== '' || hasValue
  useLeaveGuard({
    dirty,
    count: Math.max(1, (metaKey !== '' ? 1 : 0) + (hasValue ? 1 : 0)),
    save: add,
    discard: clear,
    registerCloseGuard
  })

  const required = t('REQUIRED', 'Required')
  const valueLabel = t('STORES_MENU_FIELD_VALUE', 'Value')
  const typedValue = type === 'text' || type === 'integer' || type === 'decimal'

  return (
    <form ref={formRef} className='odc-mfe-form' noValidate onSubmit={onSubmit} aria-label={t('STORES_MENU_FIELD_ADD', 'Add field')}>
      <Field label={t('STORES_MENU_FIELD_TYPE', 'Type')}>
        <select
          className='odc-field-input odc-mfe-select'
          value={type}
          onChange={event => changeType(event.target.value)}
        >
          {TYPES.map(item => <option key={item} value={item}>{typeLabels[item]}</option>)}
        </select>
      </Field>
      <TextField
        ref={keyRef}
        label={t('STORES_MENU_FIELD_KEY', 'Key')}
        name='key'
        required
        requiredLabel={required}
        autoComplete='off'
        dir='auto'
        value={metaKey}
        error={errors.key}
        onChange={(next) => {
          setMetaKey(next)
          setApiError(null)
        }}
      />
      {typedValue && (
        <TextField
          fieldClassName='odc-mfe-value-field'
          label={valueLabel}
          name='value'
          required
          requiredLabel={required}
          autoComplete='off'
          dir='auto'
          inputMode={type === 'integer' ? 'numeric' : (type === 'decimal' ? 'decimal' : undefined)}
          value={metaValue}
          error={errors.value}
          onChange={(next) => {
            setMetaValue(next)
            setApiError(null)
          }}
        />
      )}
      {type === 'boolean' && (
        <Field label={valueLabel} className='odc-mfe-value-field'>
          <select
            className='odc-field-input odc-mfe-select'
            value={selectedBoolean}
            onChange={event => setSelectedBoolean(event.target.value)}
          >
            <option value='1'>{t('TRUE', 'True')}</option>
            <option value='0'>{t('FALSE', 'False')}</option>
          </select>
        </Field>
      )}
      {type === 'json' && (
        <Field label={valueLabel} className='odc-mfe-value-field'>
          <JsonValue key={jsonVersion} json={json} onChange={setJson} />
        </Field>
      )}
      <div className='odc-mfe-actions'>
        <Button type='submit' variant='primary' busy={busy}>{t('STORES_MENU_FIELD_ADD', 'Add field')}</Button>
      </div>
      {apiError && (
        <InlineNotice tone='danger' icon={CircleAlert} role='alert'>{apiError}</InlineNotice>
      )}
    </form>
  )
}

/**
 * The delete flow of the editor, apart from it so a host can draw the confirmation where it must. `onDelete(id)` is the host's
 * action. Returns `askDelete(field, index, event)` (the delete button's click), `confirm` (the props of `MetaFieldDeleteConfirm`) and
 * the two refs (`rootRef` for the editor's root, `listRef` for its list) that the final focus reads. Pass the whole result to
 * `<MetaFieldsEditor deletion={…} />` and draw `<MetaFieldDeleteConfirm {...deletion.confirm} />` as a SIBLING of whatever Dialog the
 * editor sits in: inside that Dialog's React tree Base UI takes it for a nested dialog and does not draw its scrim.
 */
export const useMetaFieldDelete = ({ onDelete } = {}) => {
  const [, t] = useLanguage()
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const deleteOpener = useRef(null)
  const mounted = useRef(true)
  const [deleteState, setDeleteState] = useState({ open: false, field: null, busy: false, error: null })

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const askDelete = (field, index, event) => {
    deleteOpener.current = { element: event.currentTarget, index }
    setDeleteState({ open: true, field, busy: false, error: null })
  }

  const closeDelete = () => {
    if (deleteState.busy) return
    setDeleteState(current => ({ ...current, open: false, error: null }))
  }

  const confirmDelete = async () => {
    if (deleteState.busy || !deleteState.field) return
    const { field } = deleteState
    setDeleteState(current => ({ ...current, busy: true, error: null }))
    let result
    try {
      result = await onDelete(field.id)
    } catch (failure) {
      result = { ok: false, error: failure?.message }
    }
    if (!mounted.current) return
    if (result?.ok === false) {
      setDeleteState(current => ({
        ...current,
        busy: false,
        error: translateApiMessage(t, firstMessage(result.error), t('STORES_MENU_FIELD_DELETE_ERROR', "We couldn't delete this field. Try again."))
      }))
      return
    }
    setDeleteState(current => ({ ...current, open: false, busy: false, error: null }))
  }

  // Where the focus goes when the confirmation closes: the delete button it came from, or, if the row left with the delete, the one
  // that took its place (else the previous one, else the Key input).
  const deleteFinalFocus = () => {
    const opener = deleteOpener.current
    if (opener?.element?.isConnected) return opener.element
    const buttons = listRef.current ? [...listRef.current.querySelectorAll('.odc-mfe-delete button')] : []
    return buttons[opener?.index] ?? buttons[(opener?.index ?? 0) - 1] ?? rootRef.current?.querySelector('input[name="key"]') ?? true
  }

  return {
    askDelete,
    rootRef,
    listRef,
    confirm: {
      open: deleteState.open,
      busy: deleteState.busy,
      error: deleteState.error,
      field: deleteState.field,
      finalFocus: deleteFinalFocus,
      onCancel: closeDelete,
      onConfirm: confirmDelete
    }
  }
}

/** The C8 confirmation of a delete. Its props are `useMetaFieldDelete().confirm`; its texts are the menu's. */
export const MetaFieldDeleteConfirm = ({ open, busy, error, field, finalFocus, onCancel, onConfirm }) => {
  const [, t] = useLanguage()
  return (
    <ConfirmDialog
      open={open}
      tone='danger'
      busy={busy}
      title={t('STORES_MENU_FIELD_DELETE_TITLE', 'Delete field "_key_"?').replace('_key_', field?.key ?? '')}
      confirmLabel={t('STORES_MENU_FIELD_DELETE_CONFIRM', 'Delete field')} // redesign tanda AB (S-5): verb + object
      cancelLabel={t('CANCEL', 'Cancel')}
      closeLabel={t('CLOSE', 'Close')}
      finalFocus={finalFocus}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className='odc-mfe-delete-body'>{t('STORES_MENU_DELETE_BODY', "This can't be undone.")}</p>
      {error && (
        <InlineNotice tone='danger' icon={CircleAlert} role='alert' className='odc-mfe-delete-error'>
          {error}
        </InlineNotice>
      )}
    </ConfirmDialog>
  )
}

export const MetaFieldsEditor = ({
  fields,
  loading,
  error,
  onReload,
  onAdd,
  onDelete,
  deletion,
  extraBody,
  registerCloseGuard,
  className
}) => {
  const [, t] = useLanguage()
  // Without `deletion` the editor owns the delete flow and draws its confirmation (promotions: no Dialog around it). With it, the host
  // owns the flow and draws the confirmation beside its own Dialog (the menu).
  const ownDeletion = useMetaFieldDelete({ onDelete })
  const { askDelete, rootRef, listRef } = deletion ?? ownDeletion

  const typeLabels = {
    integer: t('INTEGER', 'Integer'),
    decimal: t('DECIMAL', 'Decimal'),
    boolean: t('BOOLEAN', 'Boolean'),
    text: t('TEXT', 'Text'),
    json: t('JSON', 'JSON')
  }

  const rows = Array.isArray(fields) ? fields : []
  const isLoading = Boolean(loading)
  const loadError = !isLoading && error ? error : null

  let list
  if (isLoading) {
    list = (
      <div className='odc-mfe-skeleton' aria-busy='true'>
        <span role='status' className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        {[...Array(SKELETON_ROWS).keys()].map(index => (
          <div key={index} className='odc-mfe-skeleton-row'>
            <Skeleton size='60%' />
            <Skeleton size='80%' />
            <Skeleton size='70%' />
          </div>
        ))}
      </div>
    )
  } else if (loadError) {
    list = (
      <InlineNotice
        tone='danger'
        icon={CircleAlert}
        role='alert'
        action={<Button size='sm' onClick={() => onReload?.()}>{t('RETRY', 'Retry')}</Button>}
      >
        {translateApiMessage(t, firstMessage(loadError), t('STORES_MENU_FIELDS_LOAD_ERROR', "We couldn't load the custom fields."))}
      </InlineNotice>
    )
  } else if (rows.length === 0) {
    list = <p className='odc-mfe-empty'>{t('STORES_MENU_FIELDS_EMPTY', 'No custom fields yet.')}</p>
  } else {
    list = (
      <ul ref={listRef} className='odc-mfe-list'>
        {rows.map((field, index) => (
          <li key={field.id} className='odc-mfe-row'>
            <span className='odc-mfe-type'>{typeLabels[field.value_type] ?? field.value_type}</span>
            <span className='odc-mfe-key' dir='auto'>{field.key}</span>
            <span className='odc-mfe-value' dir='auto'>
              {field.value_type === 'boolean'
                ? (field.value === '0' ? t('FALSE', 'False') : t('TRUE', 'True'))
                : field.value}
            </span>
            <span className='odc-mfe-delete'>
              <IconButton
                icon={Trash2}
                size='sm'
                label={t('STORES_MENU_FIELD_DELETE_LABEL', 'Delete field _key_').replace('_key_', field.key)}
                onClick={event => askDelete(field, index, event)}
              />
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <div ref={rootRef} className={className ? `odc-mfe ${className}` : 'odc-mfe'}>
        {list}
        <AddForm extraBody={extraBody} onAdd={onAdd} registerCloseGuard={registerCloseGuard} typeLabels={typeLabels} />
      </div>
      {!deletion && <MetaFieldDeleteConfirm {...ownDeletion.confirm} />}
    </>
  )
}
