import React, { useEffect, useId, useReducer, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLanguage, ImporterForm as ImporterFormController } from '../../../../../index'
import { Button, Field, IconButton, InlineNotice, TextField } from '../../Shared/Product'
import { useLeaveGuard } from '../../Shared/Product/LeaveGuard'
import { Plus, Trash2, TriangleAlert, X } from '../../Shared/Icon'
import { ChildMapplingList } from '../ChildMapplingList'
import './importer-form.css'

// redesign stores 3.C: the importer form is the content of a level of the Importers panel (ImportersPane), not of a
// SideBar. The level says what it is («Add importer», «Edit importer», «Advanced Options», «Add mapping», «Edit mapping») and brings the
// way back, so the form has no title; `headerTitle` is read by ChildMapplingList (it is the title of the level it opens), not here.
// It does what it did: the same fields under the same conditions (`importType`, `isAdvanedOptions`, `isMapping`, `isDefaultImporter`,
// `noAdvancedTypes`), the same calls to the controller and the same values. Only the expression changes (Product fields, a Save button at
// the foot, the error inline).
//
// Things the controller (ImporterForm/index.js in components/) still does by id, so these ids stay: `importer-form` (clearMappingForm),
// `field-form` (clearFieldForm, also called after adding a metafield) and `meta-field-form`. The add rows are controlled here and clear on
// the form's `reset` event, so a reset the controller asks for reaches them too.
//
// Unsaved work (P/LeaveGuard). `dirty` is the same rule that enables the button (`changes` has more than one key: the controller puts the
// `type` in `changes` on mount) AND the user has changed something since the form was filled. The second part is not decoration: opening
// an importer to edit it already puts name, type and mapping in `changes` (three keys), so the bare rule would ask «Save your changes?» for
// an importer nobody touched. `touched` is set by the user's own handlers (inputs, the type select, fields, metafields, the list of mappings)
// and cleared when the form is filled with another importer. A form that cannot be saved (`isDefaultImporter`) is never dirty.
// `save` runs the button's submit and waits for the controller's answer: `formState.result` arrives with an error → `{ ok: false }`
// (the error is on screen and the user stays), without → `{ ok: true }`. A mapping (handleCustomEditImporter / handleCustomAddImporter) answers
// nothing (it hands the changes to ChildMapplingList and returns), so it is `{ ok: true }` at once. `discard` does nothing: the level closes.

const digitsOnly = (event) => {
  if (!/^[0-9]$/.test(event.key)) event.preventDefault()
}

const LISTED_TYPES = ['sync_businesses', 'sync_categories', 'sync_products', 'sync_extra_products', 'sync_extras', 'sync_extra_options', 'sync_extra_option_suboptions', 'sync_multiple']
const UNLISTED_TYPE = 9
const isUnlistedType = (type) => Boolean(type) && !LISTED_TYPES.includes(type)
const initialImportType = (importer) => {
  if (!importer?.type) return 1
  return isUnlistedType(importer.type) ? UNLISTED_TYPE : LISTED_TYPES.indexOf(importer.type) + 1
}

const lineOf = (item) => (typeof item === 'string' ? item : (item?.message ?? JSON.stringify(item)))

/** Fields and MetaFields: the name/number pairs already there (each with its remove button), then the row that adds one. */
const PairSection = ({
  formId,
  legend,
  entries,
  disabled,
  loading,
  keyValue,
  valueValue,
  onKeyChange,
  onValueChange,
  onSubmit,
  onReset,
  onRemove,
  removeLabel,
  addLabel,
  nameLabel,
  valueLabel
}) => (
  <fieldset className='odc-imp-form-group' disabled={disabled}>
    <legend className='odc-imp-form-legend'>{legend}</legend>
    <div className='odc-imp-form-group-body'>
      {entries.length > 0 && (
        <ul className='odc-imp-form-pair-list'>
          {entries.map(([name, value]) => (
            <li key={name} className='odc-imp-form-pair'>
              <span className='odc-imp-form-pair-name'>{name}</span>
              <span className='odc-imp-form-pair-value odc-figure'>{value}</span>
              <IconButton icon={Trash2} label={removeLabel.replace('_name_', name)} onClick={() => onRemove(name)} />
            </li>
          ))}
        </ul>
      )}
      <form id={formId} className='odc-imp-form-pair-add' onSubmit={onSubmit} onReset={onReset}>
        <TextField
          name='key'
          aria-label={nameLabel}
          placeholder={nameLabel}
          value={keyValue}
          onChange={onKeyChange}
          disabled={loading}
          autoComplete='off'
        />
        <TextField
          name='value'
          type='number'
          min={0}
          inputMode='numeric'
          aria-label={valueLabel}
          placeholder='0'
          value={valueValue}
          onChange={onValueChange}
          onKeyPress={digitsOnly}
          disabled={loading}
          autoComplete='off'
        />
        <IconButton
          type='submit'
          icon={Plus}
          label={addLabel}
          disabled={loading || String(keyValue).trim() === '' || String(valueValue).trim() === ''}
        />
      </form>
    </div>
  </fieldset>
)

export const ImporterFormUI = (props) => {
  const {
    isAdvanedOptions,
    formState,
    handleChangeInput,
    handleChangeSelect,
    handleCreateImporter,
    handleChangeMappingInput,
    handleEditState,
    addNewField,
    removeField,
    fieldList,
    addNewMetaField,
    removeMetaField,
    metafieldList,
    onClose,
    selectedImporter,
    clearImorterForm,
    setIsEdit,
    editState,
    editImporter,
    downloadCSV,
    openMappingDetails,
    setOpenMappingDetails,
    isMapping,
    handleUpdateMultipleMapping,
    defaultImporter,
    mappingState,
    handleCustomEditImporter,
    handleCustomAddImporter
  } = props

  const [, t] = useLanguage()
  // review (3.C): the controller resets `#importer-form` from the DOM (clearMappingForm and the like). A reset puts the controlled
  // fields (the Type select, the mapping ids) back to their HTML defaults while their state did not change; one render after it
  // writes the state into them again (the legacy Select was not a form field, so it never showed «Store» for a Multiple importer).
  const [, syncAfterReset] = useReducer(tick => tick + 1, 0)
  // bugs E row 8a: a change of Type makes the controller reset the form to clear the mapping ids. Name and Slug are not
  // controlled (they keep `defaultValue`), so the reset blanked them on screen while `changes` still had them: they are put back.
  const keptText = useRef(null)
  const onMainReset = (event) => {
    const form = event.currentTarget
    const kept = keptText.current
    keptText.current = null
    setTimeout(() => {
      syncAfterReset()
      if (!kept) return
      ;['name', 'slug'].forEach(name => {
        const input = form.elements.namedItem(name)
        if (input && kept[name] !== undefined) input.value = kept[name]
      })
    }, 0)
  }
  const formMethods = useForm()
  const fieldMethods = useForm()
  const metafieldMethods = useForm()
  // bugs E row 7: an importer whose type is not one of the 8 below (`sync_users`, «Import Users») gets an option of its own
  // (value UNLISTED_TYPE), so the select shows its type and the form never tells the controller another one. The form starts on the type
  // of the importer it edits, so editing never sends Store first.
  const [importType, setImportType] = useState(() => initialImportType(selectedImporter))
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [filedKey, setFiledKey] = useState('')
  const [filedValue, setFiledValue] = useState('')
  const [metafiledKey, setMetaFiledKey] = useState('')
  const [metafiledValue, setMetaFiledValue] = useState('')
  const touched = useRef(false)
  const pendingSave = useRef(null)
  const mappingHeadingId = useId()

  const defaultImporterSlugs = [
    'sync_businesses_default', 'sync_categories_default', 'sync_products_default',
    'sync_extras_default', 'sync_extra_options_default', 'sync_extra_option_suboptions_default',
    'sync_extra_products_default', 'sync_full_menu_default'
  ]

  const noAdvancedTypes = ['sync_extras', 'sync_extra_options', 'sync_extra_option_suboptions']

  const isDefaultImporter = defaultImporterSlugs.includes(selectedImporter?.slug) || defaultImporter

  const listedTypes = [
    { value: 1, content: t('STORE', 'Store'), sync_name: 'sync_businesses' },
    { value: 2, content: t('CATEGORY', 'Category'), sync_name: 'sync_categories' },
    { value: 3, content: t('PRODUCT', 'Product'), sync_name: 'sync_products' },
    { value: 4, content: t('EXTRA_PRODUCTS', 'Extra products'), sync_name: 'sync_extra_products' },
    { value: 5, content: t('EXTRAS', 'Extras'), sync_name: 'sync_extras' },
    { value: 6, content: t('EXTRA_OPTIONS', 'Extra options'), sync_name: 'sync_extra_options' },
    { value: 7, content: t('EXTRA_OPTION_SUBOPTIONS', 'extra option suboptions'), sync_name: 'sync_extra_option_suboptions' },
    { value: 8, content: t('MULTIPLE', 'Multiple'), sync_name: 'sync_multiple' }
  ]
  const unlistedType = isUnlistedType(selectedImporter?.type) ? selectedImporter.type : null
  const importypeOptions = unlistedType
    ? [...listedTypes, { value: UNLISTED_TYPE, content: unlistedType === 'sync_users' ? t('USERS', 'Users') : unlistedType, sync_name: unlistedType }]
    : listedTypes

  const isEditing = Object.keys(selectedImporter).length > 0
  const hasChanges = Object.keys(formState?.changes).length > 1

  const onSubmit = () => {
    if (Object.keys(formState.changes).length === 0) return
    if (isEditing) editImporter()
    else handleCreateImporter()
  }

  const onNewFiledSubmit = () => {
    addNewField(filedKey, filedValue)
    setFiledKey('')
    setFiledValue('')
  }

  const onNewMetaFiledSubmit = () => {
    addNewMetaField(metafiledKey, metafiledValue)
    setMetaFiledKey('')
    setMetaFiledValue('')
  }

  const handleSelectOption = (val) => {
    if (!val) return
    setImportType(val)
  }

  // what the user does (as opposed to what the controller fills in) marks the form as touched, for the leave guard
  const touch = () => { touched.current = true }

  // The controller reads `e.target.name` and `e.target.value`; the Product fields give the value, so the event is built here.
  const onTextChange = (name) => (value) => {
    touch()
    handleChangeInput({ target: { name, value } })
  }

  const onMappingChange = (name) => (value) => {
    touch()
    handleChangeMappingInput({ target: { name, value } })
  }

  const onTypeChange = (event) => {
    touch()
    const form = event.target.form
    keptText.current = form ? { name: form.elements.namedItem('name')?.value, slug: form.elements.namedItem('slug')?.value } : null
    handleSelectOption(Number(event.target.value))
  }

  const save = () => new Promise((resolve) => {
    if (Object.keys(formState.changes).length === 0) {
      resolve({ ok: true })
      return
    }
    if (isEditing ? handleCustomEditImporter : handleCustomAddImporter) {
      onSubmit()
      resolve({ ok: true })
      return
    }
    pendingSave.current = resolve
    onSubmit()
  })

  useLeaveGuard({
    dirty: () => !isDefaultImporter && touched.current && hasChanges,
    save,
    discard: () => {}
  })

  useEffect(() => () => {
    // the level went away while the save was running: the controller closed it after saving
    pendingSave.current?.({ ok: true })
    pendingSave.current = null
  }, [])

  useEffect(() => {
    if (importType) {
      const _target = (importypeOptions?.filter(options => options.value === importType))[0]
      handleChangeSelect('type', _target.sync_name)
    }
  }, [importType])

  useEffect(() => {
    const result = formState.result
    if (result?.error && Object.keys(result).length > 0) {
      setNoticeOpen(true)
    }
    if (!result?.error && result?.result?.id) {
      onClose && onClose()
    }
    if (pendingSave.current) {
      const done = pendingSave.current
      pendingSave.current = null
      done({ ok: !result?.error })
    }
  }, [formState.result])

  useEffect(() => {
    clearImorterForm()
    touched.current = false
    if (Object.keys(selectedImporter).length === 0) {
      const _target = (importypeOptions?.filter(options => options.value === 1))[0]
      handleChangeSelect('type', _target.sync_name)
    }
    if (Object.keys(selectedImporter).length > 0) {
      setIsEdit(true)
      handleEditState(selectedImporter)
      handleSelectOption(initialImportType(selectedImporter))
    }
  }, [selectedImporter])

  const showMappingIds = importType !== 8 && !(isAdvanedOptions && noAdvancedTypes.includes(selectedImporter?.type))
  const showNotice = noticeOpen && Boolean(formState.result?.error)
  const errorLines = showNotice ? [].concat(formState.result?.result ?? []).map(lineOf) : []

  const mappingGroups = [
    {
      show: true,
      ids: [
        ['business_id', t('MAPPING_BUSINESS_ID', 'Business ID')],
        ['external_business_id', t('MAPPING_EXTERNAL_BUSINESS_ID', 'External business ID')]
      ]
    },
    {
      show: importType === 2 || importType === 3 || importType === 4,
      ids: [
        ['category_id', t('MAPPING_CATEGORY_ID', 'Category ID')],
        ['external_category_id', t('MAPPING_EXTERNAL_CATEGORY_ID', 'External category ID')],
        ['external_parent_category_id', t('MAPPING_EXTERNAL_PARENT_CATEGORY_ID', 'External parent category ID')]
      ]
    },
    {
      show: importType === 3 || importType === 4,
      ids: [
        ['product_id', t('MAPPING_PRODUCT_ID', 'Product ID')],
        ['external_product_id', t('MAPPING_EXTERNAL_PRODUCT_ID', 'External product ID')]
      ]
    },
    {
      show: importType === 4 || importType === 5 || importType === 6 || importType === 7,
      ids: [
        ['extra_id', t('MAPPING_EXTRA_ID', 'Extra ID')],
        ['external_extra_id', t('MAPPING_EXTERNAL_EXTRA_ID', 'External extra ID')]
      ]
    },
    {
      show: importType === 6 || importType === 7,
      ids: [
        ['extra_option_id', t('MAPPING_EXTRA_OPTION_ID', 'Extra option ID')],
        ['external_extra_option_id', t('MAPPING_EXTERNAL_EXTRA_OPTION_ID', 'External extra option ID')]
      ]
    },
    {
      show: importType === 7,
      ids: [
        ['extra_option_suboption_id', t('MAPPING_EXTRA_OPTION_SUBOPTION_ID', 'Extra option suboption ID')],
        ['external_extra_option_suboption_id', t('MAPPING_EXTERNAL_EXTRA_OPTION_SUBOPTION_ID', 'External extra option suboption ID')]
      ]
    }
  ]

  const typeLabel = importypeOptions.find(option => option.sync_name === selectedImporter?.type)?.content

  return (
    <div className='odc-root odc-imp-form'>
      <form onSubmit={formMethods.handleSubmit(onSubmit)} onReset={onMainReset} id='importer-form' className='odc-imp-form-main'>
        {!isMapping && (
          <>
            <TextField
              name='name'
              label={t('NAME', 'Name')}
              placeholder={t('NAME', 'Name')}
              defaultValue={editState?.name}
              onChange={onTextChange('name')}
              disabled={formState.loading || isAdvanedOptions || isDefaultImporter}
              autoComplete='off'
            />
            <TextField
              name='slug'
              label={t('SLUG', 'Slug')}
              placeholder={t('SLUG', 'Slug')}
              defaultValue={editState?.slug}
              onChange={onTextChange('slug')}
              disabled={formState.loading || isAdvanedOptions || isDefaultImporter}
              autoComplete='off'
              onKeyPress={e => {
                if (e.which === 32 || e.key === ' ') { e.preventDefault() }
              }}
            />
          </>
        )}

        {!isAdvanedOptions && (
          isDefaultImporter
            ? <TextField label={t('TYPE', 'Type')} value={typeLabel ?? ''} readOnly />
            : (
              <Field label={t('TYPE', 'Type')}>
                <select
                  name='type'
                  className='odc-field-input odc-imp-form-select'
                  value={importType}
                  onChange={onTypeChange}
                >
                  {importypeOptions.map(option => <option key={option.value} value={option.value}>{option.content}</option>)}
                </select>
              </Field>
              )
        )}

        {(!isMapping || showMappingIds) && (
          <div className='odc-imp-form-mapping'>
            {!isMapping && (
              <>
                <span id={mappingHeadingId} className='odc-imp-form-heading'>{t('MAPPING', 'Mapping')}</span>
                {isEditing && (
                  <p className='odc-imp-form-csv'>
                    <span>{t('CSV_FILE_EXAMPLE', 'CSV file example')}</span>
                    <Button variant='link' onClick={() => downloadCSV()}>{`${editState?.type}.csv`}</Button>
                  </p>
                )}
              </>
            )}
            {showMappingIds && (
              <fieldset
                className='odc-imp-form-group'
                disabled={isDefaultImporter}
                aria-label={isMapping ? t('MAPPING', 'Mapping') : undefined}
                aria-labelledby={isMapping ? undefined : mappingHeadingId}
              >
                <div className='odc-imp-form-group-body'>
                  {mappingGroups.filter(group => group.show).map(group => (
                    <div key={group.ids[0][0]} className='odc-imp-form-ids'>
                      {group.ids.map(([name, text]) => (
                        <TextField
                          key={name}
                          name={name}
                          label={text}
                          type='number'
                          min={0}
                          inputMode='numeric'
                          placeholder='0'
                          onKeyPress={digitsOnly}
                          onChange={onMappingChange(name)}
                          disabled={formState.loading}
                          autoComplete='off'
                          value={mappingState?.[name] || ''}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        )}
      </form>

      {importType !== 8 && (
        <PairSection
          formId='field-form'
          legend={t('FIELDS', 'Fields')}
          entries={Object.entries(fieldList)}
          disabled={isDefaultImporter}
          loading={formState.loading}
          keyValue={filedKey}
          valueValue={filedValue}
          onKeyChange={setFiledKey}
          onValueChange={setFiledValue}
          onSubmit={fieldMethods.handleSubmit(onNewFiledSubmit)}
          onReset={() => { setFiledKey(''); setFiledValue('') }}
          onRemove={(name) => { touch(); removeField(name) }}
          removeLabel={t('IMPORTER_FIELD_REMOVE', 'Remove _name_')}
          addLabel={t('IMPORTER_FIELD_ADD', 'Add field')}
          nameLabel={t('NAME', 'Name')}
          valueLabel={t('VALUE', 'Value')}
        />
      )}

      {showMappingIds && importType !== 8 && (
        <PairSection
          formId='meta-field-form'
          legend={t('META_FIELDS', 'MetaFields')}
          entries={Object.entries(metafieldList || {})}
          disabled={isDefaultImporter}
          loading={formState.loading}
          keyValue={metafiledKey}
          valueValue={metafiledValue}
          onKeyChange={setMetaFiledKey}
          onValueChange={setMetaFiledValue}
          onSubmit={metafieldMethods.handleSubmit(onNewMetaFiledSubmit)}
          onReset={() => { setMetaFiledKey(''); setMetaFiledValue('') }}
          onRemove={(name) => { touch(); removeMetaField(name) }}
          removeLabel={t('IMPORTER_FIELD_REMOVE', 'Remove _name_')}
          addLabel={t('IMPORTER_METAFIELD_ADD', 'Add metafield')}
          nameLabel={t('NAME', 'Name')}
          valueLabel={t('VALUE', 'Value')}
        />
      )}

      {importType === 8 && (
        <ChildMapplingList
          mappingList={editState?.mapping || []}
          importypeOptions={importypeOptions}
          openMappingDetails={openMappingDetails}
          setOpenMappingDetails={setOpenMappingDetails}
          handleUpdateMultipleMapping={(updatedMapping) => { touch(); handleUpdateMultipleMapping(updatedMapping) }}
          defaultImporter={isDefaultImporter}
        />
      )}

      {(!isDefaultImporter || showNotice) && (
        <div className='odc-imp-form-foot'>
          {showNotice && (
            <InlineNotice
              tone='danger'
              icon={TriangleAlert}
              role='alert'
              action={<IconButton icon={X} size='sm' label={t('CLOSE', 'Close')} onClick={() => setNoticeOpen(false)} />}
            >
              <span className='odc-imp-form-errors'>
                {(errorLines.length ? errorLines : [t('ERROR', 'Error')]).map((line, index) => <span key={index}>{line}</span>)}
              </span>
            </InlineNotice>
          )}
          {!isDefaultImporter && (
            <Button
              variant='primary'
              busy={Boolean(formState?.loading)}
              disabled={!hasChanges}
              onClick={() => onSubmit()}
            >
              {isEditing ? t('SAVE', 'Save') : isMapping ? t('ADD', 'Add') : t('ADD_IMPORTER', 'Add importer')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export const ImporterForm = (props) => {
  const addImporterProps = {
    ...props,
    UIComponent: ImporterFormUI
  }
  return <ImporterFormController {...addImporterProps} />
}
