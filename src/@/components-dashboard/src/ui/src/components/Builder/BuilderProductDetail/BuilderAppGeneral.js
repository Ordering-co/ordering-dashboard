import React, { useEffect, useMemo, useState } from 'react'

import { ToastType, useLanguage, useToast } from '../../../../../index'
import { CircleAlert } from '../../Shared/Icon'
import { Button, ConfirmDialog, DataTable, InlineNotice, Sheet, TextArea, TextField } from '../../Shared/Product'
import { PlatformIcon } from '../BuilderShared'
import {
  getAppFieldError,
  getPlatformLabel,
  getPlatformRows,
  PACKAGE_PATTERN,
  VERSION_PATTERN
} from '../utils'
import '../BuilderAppSettings/builder-app-edit.css'

// redesign B2: the General tab on Product pieces (TextField/TextArea, Buttons, InlineNotice, DataTable, Sheet). Same
// checks, codes, payloads, toasts and texts as main. main's SideBar never closed on an outside click (Escape only from 1000px): the
// platform sheet asks before dropping its changes (Escape, the scrim, the X, Cancel) and closes at once with none, as the create
// panel of /builder (coordinator's review of #430); nothing closes while it saves.

const PLATFORM_FORM_ID = 'builder-platform-form'

const APP_FIELDS = ['name', 'version', 'package', 'description']

/** Client checks that mirror the API, so most mistakes never leave the form. */
const validate = (values, { allowEmpty = false } = {}) => {
  const errors = {}
  const name = values.name.trim()
  if (!allowEmpty && !name) errors.name = 'required'
  if (name.length > 255) errors.name = 'max'
  if (values.description.length > 500) errors.description = 'max'
  const version = values.version.trim()
  if ((!allowEmpty || version) && !VERSION_PATTERN.test(version)) errors.version = 'format'
  const pkg = values.package.trim()
  if ((!allowEmpty || pkg) && !PACKAGE_PATTERN.test(pkg)) errors.package = 'format'
  return errors
}

const fieldMessage = (field, clientError, apiCodes, t) => {
  if (clientError) {
    return getAppFieldError(field, [`${field}.${clientError === 'required' ? 'required' : clientError === 'max' ? 'max' : 'regex'}`], t)
  }
  return getAppFieldError(field, apiCodes, t)
}

const toValues = (source) => ({
  name: source?.name ?? '',
  description: source?.description ?? '',
  version: source?.version ?? '',
  package: source?.package ?? ''
})

const AppFields = ({ idPrefix, values, onChange, messages, placeholders = {}, inherited = {}, onUseAppValue, t }) => {
  const labels = {
    name: t('BUILDER_NAME_IN_STORES', 'Name in the stores'),
    version: t('VERSION', 'Version'),
    package: t('BUILDER_PACKAGE', 'Package'),
    description: t('DESCRIPTION', 'Description')
  }
  const help = {
    version: t('BUILDER_VERSION_HELP', 'Like 1.2.0'),
    package: t('BUILDER_PACKAGE_HELP', 'Reverse domain, like com.brand.app')
  }
  return APP_FIELDS.map(field => {
    const message = messages[field]
    const Control = field === 'description' ? TextArea : TextField
    return (
      <div key={field} className='odc-be-field' data-full={field === 'description' ? '' : undefined}>
        {/* before the field, as main's: in the label line, reached by Tab before the input */}
        {onUseAppValue && !inherited[field] && (
          <Button variant='link' size='sm' className='odc-be-field-action' onClick={() => onUseAppValue(field)}>
            {t('BUILDER_USE_APP_VALUE', 'Use app value')}
          </Button>
        )}
        <Control
          id={`${idPrefix}-${field}`}
          label={labels[field]}
          value={values[field]}
          placeholder={placeholders[field] || ''}
          autoComplete='off'
          error={message || undefined}
          hint={message ? undefined : (inherited[field] ? t('BUILDER_USES_APP_VALUE', 'Uses the app value') : help[field])}
          onChange={(value) => onChange(field, value)}
        />
      </div>
    )
  })
}

/** A platform's value; one it inherits from the app is muted, as main's. */
const ValueCell = ({ row, field }) => (
  <span className='odc-be-value-cell' data-inherited={row.ownFields[field] ? undefined : ''}>{row[field]}</span>
)

const BuilderPlatformPanel = (props) => {
  const { app, platform, onClose, updatePlatform } = props
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const own = (app.platforms || []).find(item => item.platform === platform) || null
  const initial = useMemo(() => toValues(own), [own])
  const [values, setValues] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiCodes, setApiCodes] = useState([])
  const [failed, setFailed] = useState(false)
  const [discard, setDiscard] = useState(false)

  // both trimmed: a saved value ending in a space or a line is not a change (review of #433)
  const changed = APP_FIELDS.some(field => values[field].trim() !== initial[field].trim())
  const requestClose = () => {
    if (saving) return
    if (changed) setDiscard(true)
    else onClose()
  }

  const inherited = Object.fromEntries(APP_FIELDS.map(field => [field, !values[field].trim()]))
  const clientErrors = submitted ? validate(values, { allowEmpty: true }) : {}
  const messages = Object.fromEntries(APP_FIELDS.map(field => [field, fieldMessage(field, clientErrors[field], apiCodes, t)]))

  const handleChange = (field, value) => {
    setValues(prev => ({ ...prev, [field]: value }))
    setApiCodes(codes => codes.filter(code => !code.startsWith(`${field}.`)))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitted(true)
    setFailed(false)
    if (Object.keys(validate(values, { allowEmpty: true })).length) return
    // Only what changed; an emptied field goes back to the app's value (null)
    const changes = {}
    APP_FIELDS.forEach(field => {
      const next = values[field].trim()
      if (next !== initial[field]) changes[field] = next || null
    })
    if (!Object.keys(changes).length) {
      onClose()
      return
    }
    setSaving(true)
    const { ok, errorCodes } = await updatePlatform(platform, changes)
    setSaving(false)
    if (ok) {
      showToast(ToastType.Success, t('BUILDER_SAVED_NEXT_BUILD', 'Saved. It applies on the next build.'))
      onClose()
      return
    }
    setApiCodes(errorCodes)
    if (!errorCodes.some(code => APP_FIELDS.some(field => code.startsWith(`${field}.`)))) setFailed(true)
  }

  const footer = (
    <>
      <Button onClick={requestClose}>{t('CANCEL', 'Cancel')}</Button>
      <Button type='submit' form={PLATFORM_FORM_ID} variant='primary' disabled={saving}>
        {saving ? t('BUILDER_SAVING', 'Saving…') : t('SAVE', 'Save')}
      </Button>
    </>
  )

  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => { if (!open) requestClose() }}
        title={t('BUILDER_PLATFORM_VALUES', '_platform_ values').replace('_platform_', getPlatformLabel(platform))}
        closeLabel={t('CLOSE', 'Close')}
        footer={footer}
      >
        <form id={PLATFORM_FORM_ID} className='odc-be-panel' onSubmit={handleSubmit} noValidate>
          <p>{t('BUILDER_PLATFORM_PANEL_HELP', 'Leave a field empty to use the app’s value. Changes apply on the next build.')}</p>
          {failed && (
            <InlineNotice tone='danger' icon={CircleAlert} role='alert'>
              {t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.')}
            </InlineNotice>
          )}
          <AppFields
            idPrefix={`builder-platform-${platform}`}
            values={values}
            onChange={handleChange}
            messages={messages}
            placeholders={toValues(app)}
            inherited={inherited}
            onUseAppValue={(field) => handleChange(field, '')}
            t={t}
          />
        </form>
      </Sheet>
      <ConfirmDialog
        open={discard}
        title={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => {
          setDiscard(false)
          onClose()
        }}
        onCancel={() => setDiscard(false)}
      >
        {t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}

/** The General tab: the app's store listing and the values of each platform. */
export const BuilderAppGeneral = (props) => {
  const { app, updateApp, updatePlatform } = props
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const initial = useMemo(() => toValues(app), [app.name, app.description, app.version, app.package])
  const [values, setValues] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiCodes, setApiCodes] = useState([])
  const [failed, setFailed] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState(null)

  useEffect(() => {
    setValues(initial)
  }, [initial])

  const dirty = APP_FIELDS.some(field => values[field] !== initial[field])
  const clientErrors = submitted ? validate(values) : {}
  const messages = Object.fromEntries(APP_FIELDS.map(field => [field, fieldMessage(field, clientErrors[field], apiCodes, t)]))
  const platformRows = getPlatformRows(app)

  const handleChange = (field, value) => {
    setValues(prev => ({ ...prev, [field]: value }))
    setApiCodes(codes => codes.filter(code => !code.startsWith(`${field}.`)))
  }

  const handleDiscard = () => {
    setValues(initial)
    setSubmitted(false)
    setApiCodes([])
    setFailed(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitted(true)
    setFailed(false)
    if (Object.keys(validate(values)).length) return
    const changes = {}
    APP_FIELDS.forEach(field => {
      const next = values[field].trim()
      if (next !== initial[field]) changes[field] = field === 'description' ? (next || null) : next
    })
    setSaving(true)
    const { ok, errorCodes } = await updateApp(changes)
    setSaving(false)
    if (ok) {
      setSubmitted(false)
      showToast(ToastType.Success, t('BUILDER_SAVED_NEXT_BUILD', 'Saved. It applies on the next build.'))
      return
    }
    setApiCodes(errorCodes)
    if (!errorCodes.some(code => APP_FIELDS.some(field => code.startsWith(`${field}.`)))) setFailed(true)
  }

  const columns = [
    {
      id: 'platform',
      header: t('BUILDER_PLATFORM', 'Platform'),
      cell: (row) => (
        <span className='odc-be-platform'>
          <span className='odc-be-platform-name'>
            <PlatformIcon platform={row.platform} />
            {getPlatformLabel(row.platform)}
          </span>
          {!row.customized && <span className='odc-be-muted'>{t('BUILDER_USES_APP_VALUES', 'Uses app values')}</span>}
        </span>
      )
    },
    { id: 'name', header: t('BUILDER_STORE_NAME', 'Store name'), cell: (row) => <ValueCell row={row} field='name' /> },
    { id: 'version', header: t('VERSION', 'Version'), cell: (row) => <ValueCell row={row} field='version' /> },
    { id: 'package', header: t('BUILDER_PACKAGE', 'Package'), cell: (row) => <ValueCell row={row} field='package' /> },
    {
      id: 'actions',
      header: null,
      srHeader: t('ACTIONS', 'Actions'),
      align: 'end',
      cell: (row) => (
        <Button
          aria-label={t('BUILDER_EDIT_PLATFORM', 'Edit _platform_').replace('_platform_', getPlatformLabel(row.platform))}
          onClick={() => setEditingPlatform(row.platform)}
        >
          {t('EDIT', 'Edit')}
        </Button>
      )
    }
  ]

  return (
    <>
      <form className='odc-be-card' aria-labelledby='builder-app-heading' onSubmit={handleSubmit} noValidate>
        <header>
          <h2 id='builder-app-heading'>{t('BUILDER_APP', 'App')}</h2>
          <p>
            {t('BUILDER_APP_HELP', 'What people see in the App Store and Google Play.')}
            {app.base?.name && ` ${t('BUILDER_BASE_NAMED', 'Base: _name_.').replace('_name_', app.base.name)}`}
          </p>
        </header>
        {failed && (
          <InlineNotice tone='danger' icon={CircleAlert} role='alert'>
            {t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.')}
          </InlineNotice>
        )}
        <div className='odc-be-grid'>
          <AppFields idPrefix='builder-app' values={values} onChange={handleChange} messages={messages} t={t} />
        </div>
        {dirty && (
          <div className='odc-be-actions'>
            <Button onClick={handleDiscard}>{t('BUILDER_DISCARD', 'Discard')}</Button>
            {/* disabled, not busy, while it saves: as main, Enter in a field can't send it twice */}
            <Button type='submit' variant='primary' disabled={saving}>
              {saving ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_SAVE_CHANGES', 'Save changes')}
            </Button>
          </div>
        )}
      </form>

      <section className='odc-be-card' aria-labelledby='builder-platforms-heading'>
        <header>
          <h2 id='builder-platforms-heading'>{t('BUILDER_PLATFORMS', 'Platforms')}</h2>
          <p>{t('BUILDER_PLATFORMS_HELP', 'Platforms you haven’t customized use the app’s name, version and package.')}</p>
        </header>
        <div className='odc-be-table'>
          <DataTable
            label={t('BUILDER_PLATFORMS', 'Platforms')}
            columns={columns}
            rows={platformRows}
            getRowId={(row) => row.platform}
          />
        </div>
      </section>

      {editingPlatform && (
        <BuilderPlatformPanel
          app={app}
          platform={editingPlatform}
          updatePlatform={updatePlatform}
          onClose={() => setEditingPlatform(null)}
        />
      )}
    </>
  )
}
