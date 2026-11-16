import React, { useMemo, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { CircleAlert, Globe } from '../../Shared/Icon'
import { Button, ConfirmDialog, InlineNotice, RadioGroup, Sheet, TextField } from '../../Shared/Product'
import { PlatformIcon, TypeGlyph } from '../BuilderShared'
import { BUILDER_KINDS, BUILDER_TYPE_OPTIONS, getNameMaxLength, getNameTooLongMessage, sortCatalogBases } from '../utils'
import '../BuilderProductsList/builder-list.css'

// redesign B1: the create panel on P/Sheet, P/TextField and P/RadioGroup (cards). Same catalog, checks, codes and texts
// as main. The sheet is a dialog: focus starts in it and is kept there. main's SideBar never closed on an outside click (Escape only
// from 1000px), so a typed name was never lost by accident: Escape, the scrim, the X and Cancel ask before dropping one, and nothing
// closes while it creates (its answer would land on a closed panel). The pattern of GiftCardsCatalogUI and DriversListing.

const FORM_ID = 'builder-create-form'

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
  const [discard, setDiscard] = useState(false)

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

  // P/Button `busy` ignores clicks but, unlike main's disabled button, still submits its form (a second click, Enter): one create at a time
  const creating = useRef(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (creating.current || createState?.loading) return
    setSubmitted(true)
    setWithdrawnBase(null)
    if (!selected || !trimmedName || nameTooLong) return
    creating.current = true
    let response
    try {
      response = await createProduct(isWeb
        ? { productType: selected.product_type, name: trimmedName }
        : { builderBaseId: selected.id, name: trimmedName })
    } finally {
      creating.current = false
    }
    const { product, errorCodes = [] } = response
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

  const dirty = name.trim() !== ''
  const requestClose = () => {
    if (createState?.loading || creating.current) return
    if (dirty) setDiscard(true)
    else onClose()
  }

  const getTypeOption = (type) => BUILDER_TYPE_OPTIONS.find(option => option.value === type)

  const typeOptions = kindEntries.map(entry => {
    const option = getTypeOption(entry.product_type)
    const web = entry.kind === 'web'
    return {
      value: getEntryKey(entry),
      media: <TypeGlyph type={entry.product_type} />,
      label: option ? option.label(t) : (entry.name || entry.product_type),
      description: (
        <>
          <span>{web ? option?.description(t) : <>{entry.name}{option && ` · ${option.description(t)}`}</>}</span>
          <span className='odc-builder-option-platforms'>
            {web
              ? <><Globe className='odc-icon' /><span>{t('BUILDER_WEB', 'Web')}</span></>
              : (entry.platforms || []).map(platform => <PlatformIcon key={platform} platform={platform} />)}
          </span>
        </>
      )
    }
  })

  const nameHelp = nameError === 'required'
    ? t('BUILDER_ERROR_NAME_REQUIRED', 'Enter a name.')
    : nameError === 'max' ? nameMaxMessage : null

  const footer = (
    <>
      <Button disabled={!!createState?.loading} onClick={requestClose}>{t('CANCEL', 'Cancel')}</Button>
      <Button type='submit' form={FORM_ID} variant='primary' busy={!!createState?.loading}>
        {createState?.loading
          ? t('BUILDER_CREATING', 'Creating…')
          : isWeb ? t('BUILDER_CREATE_WEBSITE', 'Create website') : t('BUILDER_CREATE_APP', 'Create app')}
      </Button>
    </>
  )

  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => { if (!open) requestClose() }}
        title={t('BUILDER_NEW_PRODUCT', 'New app or website')}
        closeLabel={t('CLOSE', 'Close')}
        footer={footer}
      >
        <form id={FORM_ID} className='odc-builder-create' onSubmit={handleSubmit} noValidate>
          {withdrawnBase && (
            <InlineNotice tone='danger' icon={CircleAlert} role='alert'>
              {t('BUILDER_BASE_NOT_OFFERED', '_name_ is no longer available. Choose another option.').replace('_name_', withdrawnBase)}
            </InlineNotice>
          )}
          {typeUnavailable && (
            <InlineNotice tone='danger' icon={CircleAlert} role='alert'>
              {t('BUILDER_CREATE_TYPE_UNAVAILABLE', 'This type can’t be created here. Choose another one.')}
            </InlineNotice>
          )}
          {showGenericError && (
            <InlineNotice tone='danger' icon={CircleAlert} role='alert'>
              {t('BUILDER_CREATE_PRODUCT_ERROR', 'We couldn’t create it. Try again.')}
            </InlineNotice>
          )}
          {kinds.length > 1 && (
            <RadioGroup
              label={t('BUILDER_CREATE_KIND', 'What do you want to create?')}
              hideLabel
              orientation='horizontal'
              value={kind}
              onValueChange={changeKind}
              options={kinds.map(item => ({ value: item.value, label: item.label(t) }))}
            />
          )}

          <TextField
            id='builder-app-name'
            label={t('BUILDER_NAME', 'Name')}
            value={name}
            onChange={(value) => setName(value)}
            maxLength={nameMaxLength}
            autoComplete='off'
            placeholder={isWeb
              ? t('BUILDER_WEB_NAME_PLACEHOLDER', 'e.g. Burger Town website')
              : t('BUILDER_APP_NAME_PLACEHOLDER', 'e.g. Delivery drivers')}
            error={nameHelp || undefined}
            hint={nameHelp ? undefined : t('BUILDER_APP_NAME_HELP', 'You can change it later.')}
            // the counter is read with the field, as main's help block (the field keeps a description of its own)
            aria-describedby='builder-app-name-count'
          />
          <span id='builder-app-name-count' className='odc-builder-count odc-figure' data-over={nameTooLong ? 'true' : undefined}>{name.length}/{nameMaxLength}</span>

          {kindEntries.length > 0 && (
            <RadioGroup
              label={isWeb ? t('BUILDER_TYPE_OF_WEBSITE', 'Type of website') : t('BUILDER_TYPE_OF_APP', 'Type of app')}
              variant='cards'
              value={selected ? getEntryKey(selected) : null}
              onValueChange={setEntryKey}
              options={typeOptions}
              aria-describedby={typeError ? 'builder-type-error' : undefined}
            />
          )}
          {isWeb && kindEntries.length > 0 && (
            <p className='odc-builder-note'>
              {t('BUILDER_WEBSITE_ONLINE_NOTE', 'Websites go online right away at a temporary address, even as a draft. You can add your own domain, theme and stores later.')}
            </p>
          )}
          {typeError && (
            <p id='builder-type-error' className='odc-builder-error' role='alert'>{t('BUILDER_APP_TYPE_REQUIRED', 'Choose what you want to create.')}</p>
          )}
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
