import React, { useEffect, useId, useRef, useState } from 'react'
import { JsonEditor as Editor } from 'jsoneditor-react'
import 'jsoneditor-react/es/editor.min.css'
import { useLanguage, UserMetaFields as UserMetaFieldsController } from '../../../../../index'
import { Button, ConfirmDialog, EmptyState, Field, IconButton, InlineNotice, Skeleton, TextField, useFieldFrame } from '../../Shared/Product'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { ListChecks, Plus, Trash2 } from '../../Shared/Icon'
import { toAlertContent } from '../../../../../utils/alertContent'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import './user-meta-fields.css'

// redesign UF-B5 (decision 5 A, M-UF7, M-UF8): custom fields as readable rows and an add form with labels, all Product.
// The requests and their bodies are the ones the legacy UI sent (`handeAddMetaField({ key, user_id, value, value_type })`,
// `handleDeleteMetaField(id)`).
// redesign D-10 (owner, 2026-10-19; P-UF2, C8): deleting a field asks first, as the order's custom fields do: the title
// names the field, the body says it cannot be undone, the focus starts on «Keep field». The DELETE goes out once, only on confirm;
// cancel, Escape and the close button send nothing and give the focus back to the delete button. A refusal shows in the dialog
// and the field stays. The controller answers through `actionState` and the list, not through a return value, so the dialog
// closes when the row is gone.

const INTEGER_PATTERN = /^\d+$/
const DECIMAL_PATTERN = /^[+-]?\d*\.?\d+(?:[Ee][+-]?\d+)?$/
// redesign UF-B5: the select is the Product anatomy (C18); the list is drawn in the layer host so the dialog, the legacy modal
// or the side bar that holds this form never clips it.
const FIT_TRIGGER = { fitTrigger: true }
const SKELETON_ROWS = 4

/** A dropdown tied to the label of its Field: the trigger names itself «label + current value» (C18). */
const FramedSelect = ({ label, options, value, onChange }) => {
  const frame = useFieldFrame()
  return (
    <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
      <FirstSelect
        ariaLabelledBy={frame?.labelId || undefined}
        ariaLabel={label}
        options={options}
        defaultValue={value}
        onChange={onChange}
        portal
      />
    </SelectSurfaceContext.Provider>
  )
}

/** The JSON editor of today (jsoneditor-react), named by the label of its Field. */
const JsonValue = ({ json, onChange }) => {
  const frame = useFieldFrame()
  return (
    <div className='odc-uf-meta-json' role='group' aria-labelledby={frame?.labelId || undefined}>
      <Editor value={json} onChange={onChange} />
    </div>
  )
}

const UserMetaFieldsUI = (props) => {
  const {
    userId,
    metaFieldsList,
    actionState,
    handleDeleteMetaField,
    handeAddMetaField
  } = props
  const [, t] = useLanguage()
  const headingId = useId()

  const [type, setType] = useState('text')
  const [metaKey, setMetaKey] = useState('')
  const [metaValue, setMetaValue] = useState('')
  const [selectedBoolean, setSelectedBoolean] = useState('1')
  const [json, setJson] = useState({})
  const [errors, setErrors] = useState({})
  const [apiLines, setApiLines] = useState([])
  // true from the moment an add is sent until the controller answers: only an add empties the form (M-UF8)
  const addPending = useRef(false)
  // redesign UF-R1 (F3, F4): where the focus goes after a failed add (a request counter) and after a delete (the row it left)
  const [focusRequest, setFocusRequest] = useState(0)
  const formRef = useRef(null)
  const listRef = useRef(null)
  const pendingDelete = useRef(null)
  // redesign D-10: the field waiting for the answer of the confirmation. `target` outlives `open` so the title does not
  // empty while the dialog plays its exit.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteLines, setDeleteLines] = useState([])
  const deleteSentRef = useRef(false)
  const deleteOpenerRef = useRef(null)
  const deleteIndexRef = useRef(0)

  const genericError = t('USER_SAVE_ERROR', 'We couldn\'t save the changes. Try again.')
  const linesOf = (result) => toAlertContent(result, genericError).map(line => translateApiMessage(t, line, genericError))
  const deleteFailed = t('CUSTOM_FIELD_DELETE_FAILED', 'The field couldn\'t be deleted. Try again.')
  const deleteLinesOf = (result) => toAlertContent(result, deleteFailed).map(line => translateApiMessage(t, line, deleteFailed))

  const typeOptions = [
    { value: 'integer', content: t('INTEGER', 'integer') },
    { value: 'decimal', content: t('DECIMAL', 'decimal') },
    { value: 'boolean', content: t('BOOLEAN', 'boolean') },
    { value: 'text', content: t('TEXT', 'text') },
    { value: 'json', content: t('JSON', 'json') }
  ]
  const booleanOptions = [
    { value: '1', content: t('TRUE', 'true') },
    { value: '0', content: t('FALSE', 'false') }
  ]

  const changeType = (next) => {
    setType(next)
    setMetaValue('')
    setErrors(current => ({ ...current, value: undefined }))
  }

  const resetForm = () => {
    setMetaKey('')
    setMetaValue('')
    setSelectedBoolean('1')
    setJson({})
    setErrors({})
  }

  const validate = () => {
    const found = {}
    // redesign UF-R1 (F4): the catalog text of VALIDATION_ERROR_REQUIRED is «Value is required», which is not what Key's message says
    if (metaKey === '') found.key = t('USER_FORM_KEY_REQUIRED', 'Key is required')
    if (type === 'text' || type === 'integer' || type === 'decimal') {
      if (metaValue === '') found.value = t('VALIDATION_ERROR_REQUIRED', 'Value is required').replace('_attribute_', t('VALUE', 'Value'))
      else if (type === 'integer' && !INTEGER_PATTERN.test(metaValue)) {
        found.value = t('VALIDATION_ERROR_INTEGER', 'Invalid integer').replace('_attribute_', t('VALUE', 'Value'))
      } else if (type === 'decimal' && !DECIMAL_PATTERN.test(metaValue)) {
        found.value = t('VALIDATION_ERROR_DECIMAL', 'Invalid decimal').replace('_attribute_', t('VALUE', 'Value'))
      }
    }
    return found
  }

  const onSubmit = (event) => {
    event.preventDefault()
    if (actionState?.loading) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      // redesign UF-R1 (F4, decision 2 A): the focus goes to the first invalid control (Key, else Value), once the errors are drawn
      setFocusRequest(current => current + 1)
      return
    }
    let value
    if (type === 'json') value = JSON.stringify(json)
    else if (type === 'boolean') value = selectedBoolean
    else value = metaValue
    addPending.current = true
    setApiLines([])
    handeAddMetaField({
      key: metaKey,
      user_id: userId,
      value,
      value_type: type
    })
  }

  // redesign UF-R1 (F4): after a failed add the focus goes to the first invalid control (Key comes before Value in the form)
  useEffect(() => {
    if (!focusRequest) return
    formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [focusRequest])

  // redesign UF-R1 (F3): the delete button goes with its row, and with it the focus. Once the row is gone the focus goes to the delete
  // button of the row that now sits in its place, else the previous row's, else the Key input of the add form.
  // redesign D-10: the row going is also the answer to the confirmation (the dialog closes), and the dialog hands the
  // focus over on its way out (`deleteFinalFocus`), because the focus is trapped in it until then.
  const currentFields = metaFieldsList.metaFields
  useEffect(() => {
    const pending = pendingDelete.current
    if (!pending) return
    if (Array.isArray(currentFields) && currentFields.some(item => item.id === pending.id)) return
    pendingDelete.current = null
    deleteIndexRef.current = pending.index
    setDeleteOpen(false)
  }, [currentFields])

  const deleteFinalFocus = () => {
    const opener = deleteOpenerRef.current
    if (opener?.isConnected) return opener
    const rows = listRef.current ? [...listRef.current.querySelectorAll('.odc-uf-meta-row')] : []
    const row = rows[deleteIndexRef.current] ?? rows[deleteIndexRef.current - 1]
    return row?.querySelector('button') ?? formRef.current?.querySelector('input[name="key"]') ?? true
  }

  // redesign D-10: opening the confirmation sends nothing.
  const askDelete = (metaField, index, opener) => {
    deleteOpenerRef.current = opener
    deleteIndexRef.current = index
    deleteSentRef.current = false
    setDeleteTarget(metaField)
    setDeleteLines([])
    setDeleteOpen(true)
  }

  const cancelDelete = () => {
    if (deleteBusy) return
    setDeleteOpen(false)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleteSentRef.current) return
    deleteSentRef.current = true
    setDeleteBusy(true)
    setDeleteLines([])
    pendingDelete.current = { id: deleteTarget.id, index: deleteIndexRef.current }
    try {
      await handleDeleteMetaField(deleteTarget.id)
    } catch (error) {
      pendingDelete.current = null
      setDeleteLines(deleteLinesOf(error?.message))
    }
    deleteSentRef.current = false
    setDeleteBusy(false)
  }

  useEffect(() => {
    if (actionState?.loading) return
    if (actionState?.result?.error) {
      addPending.current = false
      // a delete that was refused leaves its row, and the focus, where they were; it says why in the dialog that asked
      if (pendingDelete.current) {
        pendingDelete.current = null
        setDeleteLines(deleteLinesOf(actionState.result.result))
        return
      }
      setApiLines(linesOf(actionState.result.result))
      return
    }
    setApiLines([])
    if (addPending.current) {
      addPending.current = false
      resetForm()
    }
  }, [actionState])

  const loadError = !metaFieldsList.loading && metaFieldsList.error ? linesOf(metaFieldsList.error) : []
  const notices = [...loadError, ...apiLines]

  if (metaFieldsList.loading) {
    return (
      <div className='odc-uf-meta' aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <div className='odc-uf-meta-skeleton'>
          {[...Array(SKELETON_ROWS).keys()].map(index => (
            <div key={index} className='odc-uf-meta-skeleton-row'>
              <Skeleton size='60%' />
              <Skeleton size='80%' />
              <Skeleton size='70%' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const fields = Array.isArray(metaFieldsList.metaFields) ? metaFieldsList.metaFields : []

  return (
    <div className='odc-uf-meta'>
      {fields.length > 0
        ? (
          <ul ref={listRef} className='odc-uf-meta-list' aria-busy={actionState?.loading || undefined}>
            {fields.map((metaField, index) => (
              <li key={metaField.id} className='odc-uf-meta-row'>
                <span className='odc-uf-meta-type'>{metaField.value_type}</span>
                <span className='odc-uf-meta-key'>{metaField.key}</span>
                <span className='odc-uf-meta-value'>
                  {metaField.value_type === 'boolean'
                    ? (metaField.value === '0' ? t('FALSE', 'false') : t('TRUE', 'true'))
                    : metaField.value}
                </span>
                <span className='odc-uf-meta-delete'>
                  <IconButton
                    icon={Trash2}
                    size='sm'
                    label={t('USER_FORM_DELETE_FIELD', 'Delete _key_').replace('_key_', metaField.key)}
                    onClick={(event) => askDelete(metaField, index, event.currentTarget)}
                  />
                </span>
              </li>
            ))}
          </ul>
          )
        : (
          <EmptyState icon={ListChecks} title={t('USER_FORM_NO_CUSTOM_FIELDS', 'No custom fields yet')} />
          )}

      <form ref={formRef} className='odc-uf-meta-form' onSubmit={onSubmit} aria-labelledby={headingId} noValidate>
        <h3 id={headingId} className='odc-uf-meta-heading'>{t('USER_FORM_ADD_FIELD', 'Add field')}</h3>
        <div className='odc-uf-meta-inputs'>
          <Field label={t('TYPE', 'Type')}>
            <FramedSelect label={t('TYPE', 'Type')} options={typeOptions} value={type} onChange={changeType} />
          </Field>
          <TextField
            label={t('KEY', 'Key')}
            name='key'
            required
            requiredLabel={t('REQUIRED', 'Required')}
            autoComplete='off'
            value={metaKey}
            error={errors.key}
            onChange={(next) => {
              setMetaKey(next)
              setErrors(current => ({ ...current, key: undefined }))
            }}
          />
          {(type === 'text' || type === 'integer' || type === 'decimal') && (
            <TextField
              label={t('VALUE', 'Value')}
              name='value'
              required
              requiredLabel={t('REQUIRED', 'Required')}
              autoComplete='off'
              value={metaValue}
              error={errors.value}
              onChange={(next) => {
                setMetaValue(next)
                setErrors(current => ({ ...current, value: undefined }))
              }}
            />
          )}
          {type === 'boolean' && (
            <Field label={t('VALUE', 'Value')}>
              <FramedSelect label={t('VALUE', 'Value')} options={booleanOptions} value={selectedBoolean} onChange={setSelectedBoolean} />
            </Field>
          )}
          {type === 'json' && (
            <Field label={t('VALUE', 'Value')}>
              <JsonValue json={json} onChange={setJson} />
            </Field>
          )}
        </div>
        {notices.map((line, index) => (
          <InlineNotice key={`${index}-${line}`} tone='danger' role='alert'>{line}</InlineNotice>
        ))}
        <div className='odc-uf-meta-actions'>
          <Button type='submit' variant='primary' icon={Plus} busy={Boolean(actionState?.loading)}>
            {t('USER_FORM_ADD_FIELD', 'Add field')}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={deleteOpen}
        title={t('CUSTOM_FIELD_DELETE_TITLE', 'Delete custom field “_key_”?').replace('_key_', deleteTarget?.key ?? '')}
        confirmLabel={t('CUSTOM_FIELD_DELETE_CONFIRM', 'Delete field')}
        cancelLabel={t('CUSTOM_FIELD_DELETE_KEEP', 'Keep field')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        finalFocus={deleteFinalFocus}
      >
        {t('USER_CUSTOM_FIELD_DELETE_CONSEQUENCE', 'It will be removed from this user. This can\'t be undone.')}
        {deleteLines.map((line, index) => (
          <InlineNotice key={`${index}-${line}`} tone='danger' role='alert'>{line}</InlineNotice>
        ))}
      </ConfirmDialog>
    </div>
  )
}

export const UserMetaFields = (props) => {
  const MetaFieldsProps = {
    ...props,
    asDashboard: true,
    UIComponent: UserMetaFieldsUI
  }
  return <UserMetaFieldsController {...MetaFieldsProps} />
}
