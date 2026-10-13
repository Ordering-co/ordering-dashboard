import React, { useEffect, useMemo, useState } from 'react'
import { ExclamationCircle } from 'react-bootstrap-icons'

import { ToastType, useLanguage, useToast } from '../../../../../index'
import { Button, Input, TextArea } from '../../../styles'
import { SideBar } from '../../Shared/SideBar'
import { PlatformIcon } from '../BuilderShared'
import {
  getAppFieldError,
  getPlatformLabel,
  getPlatformRows,
  PACKAGE_PATTERN,
  VERSION_PATTERN
} from '../utils'
import {
  Card,
  ErrorBanner,
  Field,
  FieldHelp,
  FormActions,
  FormGrid,
  InheritedValue,
  LinkButton,
  MutedText,
  PanelContainer,
  PanelFooter,
  PlatformName,
  Table,
  TableCard
} from '../styles'

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
    const id = `${idPrefix}-${field}`
    const message = messages[field]
    const Control = field === 'description' ? TextArea : Input
    return (
      <Field key={field} invalid={!!message} className={field === 'description' ? 'full' : undefined}>
        <FieldHelp as='div'>
          <label htmlFor={id}>{labels[field]}</label>
          {onUseAppValue && !inherited[field] && (
            <LinkButton type='button' onClick={() => onUseAppValue(field)}>
              {t('BUILDER_USE_APP_VALUE', 'Use app value')}
            </LinkButton>
          )}
        </FieldHelp>
        <Control
          id={id}
          type={field === 'description' ? undefined : 'text'}
          rows={field === 'description' ? 3 : undefined}
          value={values[field]}
          placeholder={placeholders[field] || ''}
          autoComplete='off'
          aria-invalid={message ? 'true' : 'false'}
          aria-describedby={`${id}-help`}
          onChange={(e) => onChange(field, e.target.value)}
        />
        <FieldHelp id={`${id}-help`}>
          {message
            ? <span role='alert'>{message}</span>
            : <span>{inherited[field] ? t('BUILDER_USES_APP_VALUE', 'Uses the app value') : (help[field] || '')}</span>}
        </FieldHelp>
      </Field>
    )
  })
}

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

  return (
    <SideBar open sidebarId='builder-platform-panel' defaultSideBarWidth={480} moveDistance={0} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate style={{ height: '100%' }}>
        <PanelContainer>
          <h2>{t('BUILDER_PLATFORM_VALUES', '_platform_ values').replace('_platform_', getPlatformLabel(platform))}</h2>
          <MutedText>{t('BUILDER_PLATFORM_PANEL_HELP', 'Leave a field empty to use the app’s value. Changes apply on the next build.')}</MutedText>
          {failed && (
            <ErrorBanner role='alert'>
              <ExclamationCircle aria-hidden='true' />
              <span>{t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.')}</span>
            </ErrorBanner>
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
          <PanelFooter>
            <div>
              <Button type='button' color='secundary' borderRadius='8px' onClick={onClose}>{t('CANCEL', 'Cancel')}</Button>
              <Button type='submit' color='primary' borderRadius='8px' disabled={saving}>
                {saving ? t('BUILDER_SAVING', 'Saving…') : t('SAVE', 'Save')}
              </Button>
            </div>
          </PanelFooter>
        </PanelContainer>
      </form>
    </SideBar>
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

  return (
    <>
      <Card as='form' aria-labelledby='builder-app-heading' onSubmit={handleSubmit} noValidate>
        <header>
          <h2 id='builder-app-heading'>{t('BUILDER_APP', 'App')}</h2>
          <p>
            {t('BUILDER_APP_HELP', 'What people see in the App Store and Google Play.')}
            {app.base?.name && ` ${t('BUILDER_BASE_NAMED', 'Base: _name_.').replace('_name_', app.base.name)}`}
          </p>
        </header>
        {failed && (
          <div style={{ padding: '8px 24px 0' }}>
            <ErrorBanner role='alert'>
              <ExclamationCircle aria-hidden='true' />
              <span>{t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.')}</span>
            </ErrorBanner>
          </div>
        )}
        <FormGrid invalid={!!messages.description}>
          <AppFields idPrefix='builder-app' values={values} onChange={handleChange} messages={messages} t={t} />
        </FormGrid>
        {dirty && (
          <FormActions>
            <Button type='button' color='secundary' borderRadius='8px' onClick={handleDiscard}>{t('BUILDER_DISCARD', 'Discard')}</Button>
            <Button type='submit' color='primary' borderRadius='8px' disabled={saving}>
              {saving ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_SAVE_CHANGES', 'Save changes')}
            </Button>
          </FormActions>
        )}
      </Card>

      <Card aria-labelledby='builder-platforms-heading'>
        <header>
          <h2 id='builder-platforms-heading'>{t('BUILDER_PLATFORMS', 'Platforms')}</h2>
          <p>{t('BUILDER_PLATFORMS_HELP', 'Platforms you haven’t customized use the app’s name, version and package.')}</p>
        </header>
        <TableCard as='div' style={{ border: 0 }}>
          <Table>
            <thead>
              <tr>
                <th scope='col'>{t('BUILDER_PLATFORM', 'Platform')}</th>
                <th scope='col'>{t('BUILDER_STORE_NAME', 'Store name')}</th>
                <th scope='col'>{t('VERSION', 'Version')}</th>
                <th scope='col'>{t('BUILDER_PACKAGE', 'Package')}</th>
                <th scope='col'><span className='sr-only'>{t('ACTIONS', 'Actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {platformRows.map(row => (
                <tr key={row.platform} style={{ cursor: 'default' }}>
                  <td>
                    <PlatformName>
                      <PlatformIcon platform={row.platform} />
                      {getPlatformLabel(row.platform)}
                    </PlatformName>
                    {!row.customized && <MutedText small>{t('BUILDER_USES_APP_VALUES', 'Uses app values')}</MutedText>}
                  </td>
                  <td><InheritedValue inherited={!row.ownFields.name}>{row.name}</InheritedValue></td>
                  <td><InheritedValue inherited={!row.ownFields.version}>{row.version}</InheritedValue></td>
                  <td><InheritedValue inherited={!row.ownFields.package}>{row.package}</InheritedValue></td>
                  <td>
                    <Button
                      type='button'
                      color='primary'
                      outline
                      borderRadius='8px'
                      aria-label={t('BUILDER_EDIT_PLATFORM', 'Edit _platform_').replace('_platform_', getPlatformLabel(row.platform))}
                      onClick={() => setEditingPlatform(row.platform)}
                    >
                      {t('EDIT', 'Edit')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableCard>
      </Card>

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
