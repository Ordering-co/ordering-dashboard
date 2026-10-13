import React, { useMemo, useState } from 'react'
import { ExclamationCircle, Globe, Phone } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { SideBar } from '../../Shared/SideBar'
import { PlatformIcon, TypeGlyph } from '../BuilderShared'
import { BUILDER_KINDS, BUILDER_TYPE_OPTIONS, getNameMaxLength, getNameTooLongMessage, sortCatalogBases } from '../utils'
import {
  ErrorBanner,
  Field,
  FieldHelp,
  KindOption,
  KindSwitch,
  MutedText,
  PanelContainer,
  PanelFooter,
  TypeFieldset,
  TypeIcon,
  TypeOption,
  TypePlatforms,
  TypeText
} from '../styles'

/** The catalog entry's own key: the base of an app, the type of a website (its `id` is null). */
const getEntryKey = (entry) => entry.kind === 'web' ? `web-${entry.product_type}` : `app-${entry.id}`

/** Codes that mean no type, or two, reached the API. */
const isTypeCode = (code) => code.startsWith('builder_base_id.') || code === 'product_type.requiredwithout'

export const BuilderCreatePanel = (props) => {
  const { onClose, catalogState, createState, createProduct, onCreated } = props
  const [, t] = useLanguage()

  const [kindChoice, setKindChoice] = useState(null)
  const [entryKey, setEntryKey] = useState(null)
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [withdrawnBase, setWithdrawnBase] = useState(null)

  const entries = useMemo(() => sortCatalogBases(catalogState?.bases)
    .map(entry => ({ ...entry, kind: entry.kind === 'web' ? 'web' : 'app' })), [catalogState?.bases])
  // Only the kinds the catalog offers; the switch shows when there are two
  const kinds = BUILDER_KINDS.filter(item => entries.some(entry => entry.kind === item.value))
  const kind = kinds.some(item => item.value === kindChoice) ? kindChoice : (kinds[0]?.value ?? 'app')
  const kindEntries = entries.filter(entry => entry.kind === kind)
  const selected = kindEntries.find(entry => getEntryKey(entry) === entryKey) || null
  const isWeb = kind === 'web'
  const nameMaxLength = getNameMaxLength(kind)
  const trimmedName = name.trim()
  const apiCodes = createState?.errorCodes || []

  const typeError = (submitted && !selected) || apiCodes.some(isTypeCode)
  const typeUnavailable = apiCodes.includes('product_type.in')
  // Switching to apps keeps a longer name typed for a website: it is flagged, not cut
  const nameTooLong = name.length > nameMaxLength
  const nameError = submitted && !trimmedName
    ? 'required'
    : nameTooLong || apiCodes.includes('name.max') ? 'max' : apiCodes.includes('name.required') ? 'required' : null
  const nameMaxMessage = nameTooLong && !isWeb && kinds.length > 1
    ? t('BUILDER_APP_NAME_TOO_LONG_SWITCH', 'App names use _max_ characters or fewer. Shorten it, or switch back to Websites.').replace('_max_', nameMaxLength)
    : getNameTooLongMessage(kind, t)
  const showGenericError = !!createState?.error && !apiCodes.some(code =>
    code.startsWith('name.') || isTypeCode(code) || code === 'product_type.in' || code === 'builder_base.not_offered'
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitted(true)
    setWithdrawnBase(null)
    if (!selected || !trimmedName || nameTooLong) return
    const { product, errorCodes = [] } = await createProduct(isWeb
      ? { productType: selected.product_type, name: trimmedName }
      : { builderBaseId: selected.id, name: trimmedName })
    if (product) {
      onCreated(product)
    } else if (errorCodes.includes('builder_base.not_offered')) {
      // Withdrawn between listing and creating: say which one and let the person pick again
      setWithdrawnBase(selected.name)
      setEntryKey(null)
    }
  }

  const changeKind = (next) => {
    setKindChoice(next)
    // The type picked belongs to the other group
    setEntryKey(null)
  }

  const getTypeOption = (type) => BUILDER_TYPE_OPTIONS.find(option => option.value === type)

  const renderEntry = (entry) => {
    const option = getTypeOption(entry.product_type)
    const key = getEntryKey(entry)
    const checked = key === entryKey
    const web = entry.kind === 'web'
    return (
      <TypeOption key={key} selected={checked}>
        <input
          type='radio'
          name='builder-catalog'
          value={key}
          checked={checked}
          onChange={() => setEntryKey(key)}
        />
        <TypeIcon selected={checked}>
          <TypeGlyph type={entry.product_type} />
        </TypeIcon>
        <TypeText>
          <strong>{option ? option.label(t) : (entry.name || entry.product_type)}</strong>
          <span>
            {web
              ? option?.description(t)
              : <>{entry.name}{option && ` · ${option.description(t)}`}</>}
          </span>
        </TypeText>
        <TypePlatforms>
          {web
            ? <><Globe aria-hidden='true' /><span>{t('BUILDER_WEB', 'Web')}</span></>
            : (entry.platforms || []).map(platform => <PlatformIcon key={platform} platform={platform} />)}
        </TypePlatforms>
      </TypeOption>
    )
  }

  return (
    <SideBar
      open
      sidebarId='builder-create-panel'
      defaultSideBarWidth={500}
      moveDistance={0}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate style={{ height: '100%' }}>
        <PanelContainer>
          <h2 id='builder-create-title'>{t('BUILDER_NEW_PRODUCT', 'New app or website')}</h2>
          {withdrawnBase && (
            <ErrorBanner role='alert'>
              <ExclamationCircle aria-hidden='true' />
              <span>
                {t('BUILDER_BASE_NOT_OFFERED', '_name_ is no longer available. Choose another option.').replace('_name_', withdrawnBase)}
              </span>
            </ErrorBanner>
          )}
          {typeUnavailable && (
            <ErrorBanner role='alert'>
              <ExclamationCircle aria-hidden='true' />
              <span>{t('BUILDER_CREATE_TYPE_UNAVAILABLE', 'This type can’t be created here. Choose another one.')}</span>
            </ErrorBanner>
          )}
          {showGenericError && (
            <ErrorBanner role='alert'>
              <ExclamationCircle aria-hidden='true' />
              <span>{t('BUILDER_CREATE_PRODUCT_ERROR', 'We couldn’t create it. Try again.')}</span>
            </ErrorBanner>
          )}
          {kinds.length > 1 && (
            <KindSwitch>
              <legend className='sr-only'>{t('BUILDER_CREATE_KIND', 'What do you want to create?')}</legend>
              {kinds.map(item => (
                <KindOption key={item.value} selected={item.value === kind}>
                  <input
                    type='radio'
                    name='builder-create-kind'
                    value={item.value}
                    checked={item.value === kind}
                    onChange={() => changeKind(item.value)}
                  />
                  {item.value === 'web' ? <Globe aria-hidden='true' /> : <Phone aria-hidden='true' />}
                  {item.label(t)}
                </KindOption>
              ))}
            </KindSwitch>
          )}

          <Field invalid={!!nameError}>
            <label htmlFor='builder-app-name'>{t('BUILDER_NAME', 'Name')}</label>
            <Input
              id='builder-app-name'
              type='text'
              value={name}
              maxLength={nameMaxLength}
              autoComplete='off'
              placeholder={isWeb
                ? t('BUILDER_WEB_NAME_PLACEHOLDER', 'e.g. Burger Town website')
                : t('BUILDER_APP_NAME_PLACEHOLDER', 'e.g. Delivery drivers')}
              aria-invalid={nameError ? 'true' : 'false'}
              aria-describedby='builder-app-name-help'
              onChange={(e) => setName(e.target.value)}
            />
            <FieldHelp id='builder-app-name-help'>
              {nameError === 'required' && <span role='alert'>{t('BUILDER_ERROR_NAME_REQUIRED', 'Enter a name.')}</span>}
              {nameError === 'max' && <span role='alert'>{nameMaxMessage}</span>}
              {!nameError && <span>{t('BUILDER_APP_NAME_HELP', 'You can change it later.')}</span>}
              <span data-over={nameTooLong ? 'true' : undefined}>{name.length}/{nameMaxLength}</span>
            </FieldHelp>
          </Field>

          {kindEntries.length > 0 && (
            <TypeFieldset aria-describedby={typeError ? 'builder-type-error' : undefined}>
              <legend>{isWeb ? t('BUILDER_TYPE_OF_WEBSITE', 'Type of website') : t('BUILDER_TYPE_OF_APP', 'Type of app')}</legend>
              {kindEntries.map(renderEntry)}
              {isWeb && (
                <MutedText small>
                  {t('BUILDER_WEBSITE_ONLINE_NOTE', 'Websites go online right away at a temporary address, even as a draft. You can add your own domain, theme and stores later.')}
                </MutedText>
              )}
            </TypeFieldset>
          )}
          {typeError && (
            <FieldHelp>
              <span id='builder-type-error' role='alert'>{t('BUILDER_APP_TYPE_REQUIRED', 'Choose what you want to create.')}</span>
            </FieldHelp>
          )}

          <PanelFooter>
            <div>
              <Button type='button' color='secundary' borderRadius='8px' onClick={onClose}>
                {t('CANCEL', 'Cancel')}
              </Button>
              <Button type='submit' color='primary' borderRadius='8px' disabled={!!createState?.loading}>
                {createState?.loading
                  ? t('BUILDER_CREATING', 'Creating…')
                  : isWeb ? t('BUILDER_CREATE_WEBSITE', 'Create website') : t('BUILDER_CREATE_APP', 'Create app')}
              </Button>
            </div>
          </PanelFooter>
        </PanelContainer>
      </form>
    </SideBar>
  )
}
