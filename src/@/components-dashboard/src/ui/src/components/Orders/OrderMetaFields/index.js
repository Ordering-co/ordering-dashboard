import React, { useId, useState, useEffect, useRef } from 'react'
import { MetaFields as MetaFieldsController, useLanguage } from '../../../../../index'
import { useForm } from 'react-hook-form'
import { JsonEditor as Editor } from 'jsoneditor-react'
import 'jsoneditor-react/es/editor.min.css'
import { Button, ConfirmDialog, EmptyState, IconButton, Skeleton } from '../../Shared/Product'
import { Plus, Trash2, TriangleAlert } from '../../Shared/Icon'
import { Select } from '../../../styles/Select/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import '../OrderDetails/activity-tab.css'

// redesign F6a (D-15, C18): the two selects of the add form (the type and the boolean value) are the one dropdown of
// the orders surfaces whether or not the detail sits under OrdersManager (an overlay detail in /deliveries does not).
const FIELD_SELECT_SURFACE = { fitTrigger: true }

/**
 * Custom fields of an order (batch 5.3): a key-value table with visible labels and an add form,
 * in product tokens (styles in OrderDetails/activity-tab.css). Behavior is the one it had: same
 * controller handlers, same payload, same validation.
 * redesign W0-12 (T0-47, M-05; owner decision 25): deleting a field asks first (C8): the title names the field, the
 * body says it cannot be undone, the button says «Delete field» and the focus starts on Cancel. The DELETE goes out
 * once, only on confirm; cancel, Escape and the close button send nothing and return the focus to the delete button
 * (or to the neighbouring one when the field is gone). A refusal shows in the dialog and the field stays.
 */
const MetaFieldsUI = (props) => {
  const {
    orderId,
    metaFieldsList,
    actionState,
    handleDeleteMetaField,
    handeAddMetaField
  } = props
  const [, t] = useLanguage()
  const { handleSubmit, register, errors } = useForm()
  const typeLabelId = useId()
  const valueLabelId = useId()
  const typeSelectId = useId()
  const valueSelectId = useId()

  const [selectedMetaKey, setSelectedMetaKey] = useState('text')
  const [selectedBoolean, setSelectedBoolean] = useState('1')
  const [metaKey, setMetaKey] = useState('')
  const [metaValue, setMetaValue] = useState('')
  const [json, setJson] = useState({})

  // redesign W0-12 (T0-47): the field waiting for the answer of the confirmation. `target` outlives `open` so the
  // title does not empty while the dialog plays its exit.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteSentRef = useRef(false)
  const deleteButtonsRef = useRef(new Map())
  const deleteOpenerRef = useRef(null)
  const deleteNeighborRef = useRef(null)
  // redesign tramo A r2 (W0-PA1-05): the add form is emptied only when an ADD ends well. A delete also flips `loading`
  // and used to empty what the user had typed in «Add» even when the delete was refused.
  const addPendingRef = useRef(false)

  const metaTypeOptions = [
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

  const requiredMessage = (label) => t('VALIDATION_ERROR_REQUIRED', `${label} is required`).replace('_attribute_', label)
  const valueRules = {
    text: {
      required: requiredMessage(t('VALUE', 'Value'))
    },
    integer: {
      required: requiredMessage(t('VALUE', 'Value')),
      pattern: {
        value: /^\d+$/,
        message: t('VALIDATION_ERROR_INTEGER', 'Invalid integer').replace('_attribute_', t('VALUE', 'Value'))
      }
    },
    decimal: {
      required: requiredMessage(t('VALUE', 'Value')),
      pattern: {
        value: /^[+-]?\d*\.?\d+(?:[Ee][+-]?\d+)?$/,
        message: t('VALIDATION_ERROR_DECIMAL', 'Invalid decimal').replace('_attribute_', t('VALUE', 'Value'))
      }
    }
  }

  const onSubmit = () => {
    let value
    if (selectedMetaKey === 'json') {
      value = JSON.stringify(json)
    } else if (selectedMetaKey === 'boolean') {
      value = selectedBoolean
    } else {
      value = metaValue
    }
    addPendingRef.current = true // redesign tramo A r2 (W0-PA1-05)
    handeAddMetaField({
      key: metaKey,
      order_id: orderId,
      value,
      value_type: selectedMetaKey
    })
  }

  const clearInputs = () => {
    const keyInput = document.getElementById('meta_key')
    if (keyInput) keyInput.value = ''
    const valueInput = document.getElementById('meta_value')
    if (valueInput && valueInput.tagName === 'INPUT') valueInput.value = ''
  }

  useEffect(() => {
    clearInputs()
  }, [selectedMetaKey])

  useEffect(() => {
    if (actionState.loading) return
    // redesign tramo A r2 (W0-PA1-05)
    const addEnded = addPendingRef.current
    addPendingRef.current = false
    if (addEnded && !actionState.result?.error) clearInputs()
  }, [actionState])

  const fields = Array.isArray(metaFieldsList.metaFields) ? metaFieldsList.metaFields : []

  // redesign W0-12 (T0-47): opening the confirmation sends nothing.
  const askDelete = (metaField, index, opener) => {
    deleteOpenerRef.current = opener
    deleteNeighborRef.current = (fields[index + 1] ?? fields[index - 1])?.id ?? null
    deleteSentRef.current = false
    setDeleteTarget(metaField)
    setDeleteError('')
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
    setDeleteError('')
    let outcome
    try {
      outcome = await handleDeleteMetaField(deleteTarget.id)
    } catch (error) {
      outcome = { error: true, result: error?.message }
    }
    deleteSentRef.current = false
    setDeleteBusy(false)
    if (outcome?.error) {
      setDeleteError(translateApiMessage(t, outcome.result, t('CUSTOM_FIELD_DELETE_FAILED', "The field couldn't be deleted. Try again.")))
      return
    }
    // redesign tramo A r4 (W0-PA2-04): main emptied «Add» after ANY successful action, a delete among them; only a refused one keeps it
    clearInputs()
    setDeleteOpen(false)
  }

  // Where the focus goes when the dialog closes: the delete button that opened it; if its row is gone, the one of
  // the neighbouring field; if there is none, the key input of the add form.
  const deleteFinalFocus = () => {
    const opener = deleteOpenerRef.current
    if (opener?.isConnected) return opener
    const neighbor = deleteButtonsRef.current.get(deleteNeighborRef.current)
    if (neighbor?.isConnected) return neighbor
    return document.getElementById('meta_key') ?? true
  }
  const serverError = !actionState.loading && actionState.result?.error
    ? [].concat(actionState.result?.result || t('ERROR', 'Error'))
    : []
  const problems = [
    ...Object.values(errors).map(error => error.message),
    ...serverError
  ].filter(Boolean)

  if (metaFieldsList.loading) {
    return (
      <div className='odc-root odt-fld'>
        <div className='odt-fld-skeleton' aria-busy='true'>
          <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
          {['70%', '55%', '80%', '60%'].map((size, index) => <Skeleton key={index} size={size} />)}
        </div>
      </div>
    )
  }

  const renderValueControl = () => {
    if (selectedMetaKey === 'boolean') {
      return (
        <div role='group' aria-labelledby={valueLabelId}>
          <Select
            id={valueSelectId}
            ariaLabelledBy={`${valueLabelId} ${valueSelectId}`}
            className='odt-fld-select'
            defaultValue={selectedBoolean}
            options={booleanOptions}
            onChange={setSelectedBoolean}
          />
        </div>
      )
    }
    if (selectedMetaKey === 'json') {
      return (
        <div className='odt-fld-json'>
          <Editor value={json} onChange={(value) => setJson(value)} />
        </div>
      )
    }
    return (
      <input
        key={selectedMetaKey}
        type='text'
        name='value'
        id='meta_value'
        className='odt-fld-control'
        onChange={(event) => setMetaValue(event.target.value)}
        ref={register(valueRules[selectedMetaKey])}
      />
    )
  }

  return (
    <SelectSurfaceContext.Provider value={FIELD_SELECT_SURFACE}>
    <div className='odc-root odt-fld'>
      {fields.length > 0
        ? (
          <table className='odt-fld-table'>
            <caption className='odc-sr-only'>{t('CUSTOM_FIELDS', 'Custom fields')}</caption>
            <thead>
              <tr>
                <th scope='col'>{t('KEY', 'Key')}</th>
                <th scope='col'>{t('VALUE', 'Value')}</th>
                <th scope='col'>{t('TYPE', 'Type')}</th>
                <th scope='col'><span className='odc-sr-only'>{t('ACTIONS', 'Actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((metaField, index) => (
                <tr key={metaField.id}>
                  <td className='odt-fld-key'><span className='odc-mono' dir='ltr'>{metaField.key}</span></td>
                  <td>
                    {metaField.value_type === 'boolean'
                      ? (metaField.value === '0' ? t('FALSE', 'false') : t('TRUE', 'true'))
                      : metaField.value_type === 'json'
                        ? <span className='odc-mono' dir='ltr'>{metaField.value}</span>
                        : metaField.value}
                  </td>
                  <td className='odt-fld-type'>{metaField.value_type}</td>
                  <td className='odt-fld-actions'>
                    <IconButton
                      icon={Trash2}
                      size='sm'
                      label={`${t('DELETE', 'Delete')} ${metaField.key}`}
                      ref={(node) => {
                        if (node) deleteButtonsRef.current.set(metaField.id, node)
                        else deleteButtonsRef.current.delete(metaField.id)
                      }}
                      onClick={(event) => askDelete(metaField, index, event.currentTarget)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )
        : (
          <EmptyState
            title={t('NO_CUSTOM_FIELDS_YET', 'No custom fields yet')}
            description={t('NO_CUSTOM_FIELDS_HINT', 'Add a key and a value to keep your own data on this order.')}
          />
          )}

      <form className='odt-fld-form' onSubmit={handleSubmit(onSubmit)} noValidate>
        <h3 className='odt-fld-form-title'>{t('ADD_CUSTOM_FIELD', 'Add custom field')}</h3>
        <div className='odt-fld-field'>
          <span id={typeLabelId} className='odt-fld-label'>{t('TYPE', 'Type')}</span>
          <div role='group' aria-labelledby={typeLabelId}>
            <Select
              id={typeSelectId}
              ariaLabelledBy={`${typeLabelId} ${typeSelectId}`}
              className='odt-fld-select'
              defaultValue={selectedMetaKey}
              options={metaTypeOptions}
              onChange={setSelectedMetaKey}
            />
          </div>
        </div>
        <div className='odt-fld-field'>
          <label htmlFor='meta_key'>{t('KEY', 'Key')}</label>
          <input
            type='text'
            name='key'
            id='meta_key'
            className='odt-fld-control'
            dir='ltr'
            onChange={(event) => setMetaKey(event.target.value)}
            ref={register({ required: requiredMessage(t('KEY', 'Key')) })}
          />
        </div>
        <div className='odt-fld-field' data-wide={selectedMetaKey === 'json' ? '' : undefined}>
          {selectedMetaKey === 'boolean'
            ? <span id={valueLabelId} className='odt-fld-label'>{t('VALUE', 'Value')}</span>
            : <label htmlFor='meta_value'>{t('VALUE', 'Value')}</label>}
          {renderValueControl()}
        </div>
        <div className='odt-fld-field'>
          <Button type='submit' icon={Plus} busy={!!actionState.loading}>
            {t('ADD', 'Add')}
          </Button>
        </div>
      </form>

      {problems.length > 0 && (
        <ul className='odt-fld-alert' role='alert'>
          {problems.map((problem, index) => (
            <li key={index}><TriangleAlert className='odc-icon' /> {problem}</li>
          ))}
        </ul>
      )}

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
        {t('CUSTOM_FIELD_DELETE_CONSEQUENCE', "It will be removed from this order. This can't be undone.")}
        {deleteError && <p className='odt-fld-alert' role='alert'>{deleteError}</p>}
      </ConfirmDialog>
    </div>
    </SelectSurfaceContext.Provider>
  )
}

export const OrderMetaFields = (props) => {
  const MetaFieldsProps = {
    ...props,
    asDashboard: true,
    UIComponent: MetaFieldsUI
  }
  return <MetaFieldsController {...MetaFieldsProps} />
}
