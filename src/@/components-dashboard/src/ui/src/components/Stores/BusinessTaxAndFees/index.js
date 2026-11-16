import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useToast } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { EDITOR_PANEL_WIDE_FROM } from '../../../../../utils/editorPanel'
import { Plus, Trash2, TriangleAlert } from '../../Shared/Icon'
import {
  Button,
  Checkbox,
  ConfirmDialog,
  IconButton,
  InlineNotice,
  NumberField,
  SaveBar,
  SearchField,
  SectionSplit,
  SegmentedControl,
  Skeleton,
  Switch,
  Tabs,
  useLeaveGuard
} from '../../Shared/Product'
import { EditTaxManager } from '../EditTaxManager'
import { CustomerFees } from '../CustomerFees'
import './business-tax-and-fees.css'

// redesign stores 5.12 (; decisions 4, 5, 12d, B-1…B-8; G4-11, G4-12, G4-13, G4-14, G4-28). Tax & fees of a store.
// - Tabs Tax | Fees (P/Tabs). One P/SaveBar for the section, under both tabs, holds what is saved on the store
//   (`POST /business/:id`, as the old global Save): the simple tax fields, the taxes that apply to the store and the legacy
//   service fee. It sends only what changed, through `handleUpdateBusinessClick` with `keepPendingChanges`, so the editor's
//   shared form is neither sent nor emptied; a failure is said in the bar. The editor's leave guard asks before leaving with changes.
// - Simple / Advanced is a P/SegmentedControl. Going back to Simple while advanced taxes apply asks first (12d): «Remove from this
//   store» leaves them out (pending until Save; they stay in the project), «Keep advanced taxes» stays in Advanced (G4-12).
// - Advanced: every tax of the project, one row each: a checkbox named by the tax (does it apply to this store?), the name opens
//   its editor (S/EditTaxManager, layout 'panel') in P/SectionSplit, and a delete button. A tax is the project's (`GET /taxes`):
//   the delete question says so, and the store's selection only changes once the delete worked (G4-11).
// - Fees: S/CustomerFees, with the legacy `service_fee` field kept in view while a value is saved (G4-14).
// - Percentages are P/NumberField, 0 to 100, checked under the field before saving (G4-13).

const TAX = 'tax'
const FEES = 'fees'
const SIMPLE = 'simple'
const ADVANCED = 'advanced'
const NEW = 'new'
const SAVED_MS = 2500
const PERCENT_KEYS = ['tax', 'delivery_tax_rate', 'service_fee']
const FIELD_ORDER = ['tax_type', 'tax', 'delivery_tax_type', 'delivery_tax_rate', 'taxes', 'service_fee']

const toIds = (list) => (Array.isArray(list) ? list : [])
  .map(item => Number(typeof item === 'object' && item !== null ? item.id : item))
  .filter(id => !Number.isNaN(id))

// the taxes stored on the store: `taxes` (objects or ids), else the old single `tax_id`
const storedTaxIdsOf = (business) => {
  if (Array.isArray(business?.taxes) && business.taxes.length > 0) return toIds(business.taxes)
  if (business?.tax_id) return toIds([business.tax_id])
  return []
}

const sameIds = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).every((id, i) => id === [...b].sort((x, y) => x - y)[i])

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

// «cafe» finds «Café»
const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

export const BusinessTaxAndFees = (props) => {
  const {
    business,
    handleUpdateBusinessClick,
    taxes = {},
    taxCatalogState,
    getTaxes,
    handleSaveTax,
    handleChangeTax,
    formTaxChanges,
    setFormTaxChanges,
    formTaxState,
    handleDeleteTax,
    setIsExtendExtraOpen
  } = props

  const [, t] = useLanguage()
  const [, { hideToast } = {}] = useToast()
  const splitRef = useRef(null)
  const rootRef = useRef(null)
  const mounted = useRef(true)
  const savingRef = useRef(false)
  const savedTimer = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(savedTimer.current)
    }
  }, [])

  const [tab, setTab] = useState(TAX)
  const [draft, setDraft] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [errorText, setErrorText] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [openKey, setOpenKey] = useState(null) // a tax id, NEW, or null
  const [feeOpen, setFeeOpen] = useState(false) // a customer fee is open in its editor
  const [query, setQuery] = useState('')
  const [askSimple, setAskSimple] = useState(false)
  const [deleting, setDeleting] = useState({ tax: null, busy: false })
  const [notice, setNotice] = useState(null)

  // ── What is stored and what is pending ──
  const taxList = Object.values(taxes || {}).filter(tax => tax?.id != null)
  // review P2: the ids are kept as stored, also the ones the project no longer lists (main sent them back on Save); only the
  // rows of the list come from the project's taxes
  const storedTaxIds = storedTaxIdsOf(business)
  const stored = {
    tax_type: business?.tax_type === 1 ? 1 : 2,
    tax: toNumber(business?.tax),
    delivery_tax_type: business?.delivery_tax_type === 1 ? 1 : 2,
    delivery_tax_rate: toNumber(business?.delivery_tax_rate),
    taxes: storedTaxIds,
    service_fee: toNumber(business?.service_fee)
  }
  const valueOf = (key) => (draft[key] !== undefined ? draft[key] : stored[key])
  const selectedIds = valueOf('taxes')

  const isChanged = (key) => {
    if (draft[key] === undefined) return false
    if (key === 'taxes') return !sameIds(draft.taxes, stored.taxes)
    return draft[key] !== stored[key]
  }
  const changedKeys = FIELD_ORDER.filter(isChanged)
  const count = changedKeys.length
  const dirty = count > 0

  const [mode, setMode] = useState(() => (storedTaxIdsOf(business).length > 0 ? ADVANCED : SIMPLE))

  const labels = {
    tax_type: t('TAX_INCLUDED', 'Tax included on price'),
    tax: t('TAX_PERCENTAGE_PERCENT', 'Tax percentage (%)'),
    delivery_tax_type: t('DELIVERY_TAX_INCLUDED_ON_DELIVERY_FEE', 'Delivery tax included on delivery fee'),
    delivery_tax_rate: t('DELIVERY_TAX_PERCENTAGE_PERCENT', 'Delivery tax percentage (%)'),
    taxes: t('TAXES_OF_THIS_STORE', 'Taxes of this store'),
    service_fee: t('SERVICE_FEE_PERCENT', 'Service fee (%)')
  }

  const setField = (key, value) => {
    setDraft(current => ({ ...current, [key]: value }))
    setFieldErrors(current => {
      if (!current[key]) return current
      const { [key]: _gone, ...rest } = current // eslint-disable-line no-unused-vars
      return rest
    })
    setSaved(false)
    setErrorText(null)
  }

  const rangeText = t('ENTER_PERCENTAGE_0_TO_100', 'Enter a percentage from 0 to 100.')
  const validate = () => {
    const errors = {}
    PERCENT_KEYS.forEach(key => {
      if (!isChanged(key)) return
      const value = draft[key]
      if (value === null || value < 0 || value > 100) errors[key] = rangeText
    })
    return errors
  }

  // ── The section's save: only what changed, on the store ──
  const save = async () => {
    if (savingRef.current) return { ok: false }
    if (!dirty) return { ok: true }
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setErrorText(null)
      // the field may be off screen (Save is in the sticky bar): the focus goes to the first wrong one, centred
      requestAnimationFrame(() => {
        const field = rootRef.current?.querySelector('[aria-invalid="true"]')
        field?.focus({ preventScroll: true })
        field?.scrollIntoView?.({ block: 'center' })
      })
      return { ok: false }
    }
    const payload = {}
    changedKeys.forEach(key => { payload[key] = draft[key] })
    savingRef.current = true
    setSaving(true)
    setSaved(false)
    setErrorText(null)
    let result
    try {
      result = await handleUpdateBusinessClick(payload, { keepPendingChanges: true })
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    savingRef.current = false
    if (!mounted.current) return result?.ok ? { ok: true } : { ok: false, error: result?.error }
    setSaving(false)
    if (!result?.ok) {
      // with keepPendingChanges the controller toasts no error; its «Loading» goes now and the reason is said in the bar
      hideToast?.()
      setErrorText(translateApiMessage(t, firstMessage(result?.error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
      return { ok: false, error: result?.error }
    }
    setDraft({})
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => { if (mounted.current) setSaved(false) }, SAVED_MS)
    return { ok: true }
  }

  const discard = () => {
    setDraft({})
    setFieldErrors({})
    setErrorText(null)
    setResetKey(key => key + 1)
    setMode(stored.taxes.length > 0 ? ADVANCED : SIMPLE)
  }

  useLeaveGuard({ dirty, count, save, discard })

  useEffect(() => {
    if (!saved) return undefined
    return () => clearTimeout(savedTimer.current)
  }, [saved])

  // ── The tax editor beside the list ──
  const openTax = openKey === NEW ? null : taxList.find(tax => String(tax.id) === String(openKey)) ?? null
  const isOpen = openKey === NEW || !!openTax

  const showDetail = (key) => {
    setNotice(null)
    setFormTaxChanges?.({})
    if (key === NEW) handleChangeTax?.('type', 1) // the API needs a type; the editor shows it as the default, not as a change
    setOpenKey(key)
  }

  const requestOpen = (key) => {
    if (String(key) === String(openKey)) return
    if (splitRef.current) splitRef.current.requestLeave(() => showDetail(key))
    else showDetail(key)
  }

  const closeDetail = () => {
    setOpenKey(null)
    setFormTaxChanges?.({})
  }

  // leaving the advanced list (another tab, Simple) goes through the editor's own question first
  const leaveDetail = (proceed) => {
    if (isOpen && splitRef.current) {
      splitRef.current.requestLeave(() => {
        closeDetail()
        proceed()
      })
      return
    }
    proceed()
  }

  // a tax that is gone from the project while open closes its editor
  useEffect(() => {
    if (openKey != null && openKey !== NEW && !openTax) closeDetail()
  }, [openKey, openTax])

  const handleTabChange = (next) => {
    if (next === tab) return
    leaveDetail(() => setTab(next))
  }

  // ── Simple / Advanced (decision 12d) ──
  const appliedTaxes = selectedIds.map(id => taxes[`id:${id}`]).filter(Boolean)
  const handleModeChange = (next) => {
    if (next === mode) return
    if (next === SIMPLE && appliedTaxes.length > 0) {
      setAskSimple(true)
      return
    }
    leaveDetail(() => setMode(next))
  }

  const removeAdvancedTaxes = () => {
    setAskSimple(false)
    leaveDetail(() => {
      setField('taxes', [])
      setMode(SIMPLE)
    })
  }

  // ── Which taxes apply to the store (pending until Save, as the old selector) ──
  const toggleTax = (tax, next) => {
    const id = Number(tax.id)
    const current = valueOf('taxes')
    setField('taxes', next ? [...current.filter(item => item !== id), id] : current.filter(item => item !== id))
  }

  // ── Delete a tax of the project (G4-11) ──
  const confirmDelete = async () => {
    const tax = deleting.tax
    if (!tax) return
    setDeleting({ tax, busy: true })
    let result
    try {
      result = await handleDeleteTax(tax.id, 'taxes', { inlineError: true })
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    if (!mounted.current) return
    setDeleting({ tax: null, busy: false })
    if (!result?.ok) {
      setNotice(t('TAX_DELETE_FAILED_NAMED', '_name_ was not deleted: _reason_')
        .replace('_name_', tax.name ?? '')
        .replace('_reason_', translateApiMessage(t, firstMessage(result?.error), t('TAX_DELETE_FAILED', 'The tax could not be deleted.'))))
      return
    }
    // only now does it leave the store's selection; as in main (review P1), a tax the store had leaves a pending change, so Save
    // detaches it from the store
    const id = Number(tax.id)
    const current = valueOf('taxes')
    if (current.includes(id)) setField('taxes', current.filter(item => item !== id))
    if (String(openKey) === String(tax.id)) closeDetail()
  }

  // ── Pieces ──
  const withCount = (template, value) => template.replace('_count_', String(value))
  const typeText = (type) => (type === 1 ? t('INCLUDED_ON_PRICE', 'Included on price') : t('NOT_INCLUDED_ON_PRICE', 'Not included on price'))

  const percentField = (key, hint) => (
    <NumberField
      key={`${key}-${resetKey}`}
      name={key}
      label={labels[key]}
      min={0}
      step={0.01}
      value={valueOf(key)}
      error={fieldErrors[key]}
      onChange={value => setField(key, value === undefined || Number.isNaN(value) ? null : value)}
      hint={hint}
    />
  )

  const simpleForm = (
    <div className='odc-tf-form'>
      {appliedTaxes.length > 0 && (
        <InlineNotice tone='warning' icon={TriangleAlert}>
          {withCount(t('ADVANCED_TAXES_STILL_APPLY', '_count_ advanced taxes still apply to this store.'), appliedTaxes.length)}
        </InlineNotice>
      )}
      <Switch
        key={`tax_type-${resetKey}`}
        checked={valueOf('tax_type') === 1}
        onCheckedChange={checked => setField('tax_type', checked ? 1 : 2)}
      >
        {labels.tax_type}
      </Switch>
      {percentField('tax')}
      <Switch
        key={`delivery_tax_type-${resetKey}`}
        checked={valueOf('delivery_tax_type') === 1}
        onCheckedChange={checked => setField('delivery_tax_type', checked ? 1 : 2)}
      >
        {labels.delivery_tax_type}
      </Switch>
      {percentField('delivery_tax_rate')}
    </div>
  )

  const needle = fold(query.trim())
  const shownTaxes = needle ? taxList.filter(tax => fold(tax.name).includes(needle)) : taxList
  const loadFailed = !!formTaxState?.result?.error || !!taxCatalogState?.error
  // (main #478): until the project's taxes have loaded, the list is not «empty»: a skeleton while they load, the error with
  // Retry when they failed, and never «There are no taxes in the project yet.»
  const catalogPending = !!taxCatalogState && !taxCatalogState.loaded && !taxList.length

  const taxRows = (
    <div className='odc-tf-pane'>
      <div className='odc-tf-tools'>
        {taxList.length > 0 && (
          <SearchField
            className='odc-tf-search'
            value={query}
            onChange={setQuery}
            label={t('SEARCH_TAXES', 'Search taxes')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR', 'Clear')}
          />
        )}
        <Button icon={Plus} onClick={() => requestOpen(NEW)}>
          {t('ADD_NEW_TAX', 'Add new tax')}
        </Button>
      </div>
      <p className='odc-tf-hint'>
        {t('TAXES_PROJECT_HINT', 'Taxes belong to the whole project. Tick the ones that apply to this store, then save.')}
      </p>
      {notice && <InlineNotice tone='warning' icon={TriangleAlert}>{notice}</InlineNotice>}
      {loadFailed && (
        <InlineNotice
          tone='warning'
          icon={TriangleAlert}
          action={getTaxes && (
            <Button size='sm' busy={!!taxCatalogState?.loading} onClick={() => getTaxes()}>
              {t('RETRY', 'Retry')}
            </Button>
          )}
        >
          {t('TAXES_LOAD_FAILED', "We couldn't load the project's taxes.")}
        </InlineNotice>
      )}
      {catalogPending && taxCatalogState?.loading && <Skeleton block='var(--od-x-control-height)' />}
      {catalogPending
        ? null
        : shownTaxes.length === 0
          ? (
          <p className='odc-tf-empty'>
            {needle ? t('NO_RESULTS_FOUND', 'No results found') : t('NO_TAXES_YET', 'There are no taxes in the project yet.')}
          </p>
            )
          : (
          <ul className='odc-tf-rows' aria-label={labels.taxes}>
            {shownTaxes.map(tax => {
              const name = tax.name ?? ''
              const active = isOpen && String(tax.id) === String(openKey)
              return (
                <li
                  key={tax.id}
                  className='odc-tf-row'
                  data-section-split-key={tax.id}
                  aria-current={active ? 'true' : undefined}
                >
                  <Checkbox
                    className='odc-tf-check'
                    checked={selectedIds.includes(Number(tax.id))}
                    label={name}
                    onCheckedChange={next => toggleTax(tax, next)}
                  />
                  <button
                    type='button'
                    className='odc-tf-name'
                    aria-label={`${name}, ${t('VIEW_DETAILS', 'View details')}`}
                    onClick={() => requestOpen(tax.id)}
                  >
                    <span className='odc-tf-name-text' title={name}>{name}</span>
                    <span className='odc-tf-name-meta'>
                      <span className='odc-figure'>{`${tax.rate ?? 0}%`}</span>
                      {` · ${typeText(tax.type)}`}
                    </span>
                  </button>
                  <IconButton
                    className='odc-tf-delete'
                    icon={Trash2}
                    label={t('DELETE_TAX_NAMED', 'Delete _name_').replace('_name_', name)}
                    onClick={() => setDeleting({ tax, busy: false })}
                  />
                </li>
              )
            })}
          </ul>
            )}
    </div>
  )

  const advanced = (
    <SectionSplit
      revealDetail // redesign bugs F row 6 (D5 of 5.18): stacked, the detail opens at its header
      ref={splitRef}
      splitFrom={EDITOR_PANEL_WIDE_FROM}
      open={isOpen}
      detailKey={openKey}
      onClose={closeDetail}
      onExtendChange={value => setIsExtendExtraOpen?.(value)}
      detailTitle={openTax ? (openTax.name ?? '') : t('NEW_TAX', 'New tax')}
      closeLabel={t('CLOSE', 'Close')}
      backLabel={t('BACK', 'Back')}
      list={taxRows}
      detail={isOpen
        ? (
          <EditTaxManager
            key={openKey}
            layout='panel'
            type='taxes'
            data={openTax ? { ...openTax, value: openTax.id } : true}
            formChanges={formTaxChanges}
            onChange={handleChangeTax}
            onClose={closeDetail}
            onDiscard={() => setFormTaxChanges?.({})}
            onSaved={(result) => {
              const id = result?.result?.id
              if (openKey === NEW && id != null) setOpenKey(id)
            }}
            saveOptions={{ inlineError: true }}
            handleSave={handleSaveTax}
          />
          )
        : null}
    />
  )

  const detailOpen = (tab === TAX && mode === ADVANCED && isOpen) || (tab === FEES && feeOpen)

  const serviceFeeStored = (stored.service_fee ?? 0) !== 0
  const legacyField = percentField('service_fee', serviceFeeStored
    ? t('SERVICE_FEE_STILL_SAVED', 'This store still has a service fee saved. Set it to 0 to stop charging it.')
    : undefined)

  return (
    <div ref={rootRef} className='odc-root odc-tf'>
      <h1 className='odc-tf-title'>{t('TAX_AND_FEES', 'Tax & fees')}</h1>
      <Tabs
        className='odc-tf-tabs'
        label={t('TAX_AND_FEES', 'Tax & fees')}
        value={tab}
        onValueChange={handleTabChange}
        items={[
          { value: TAX, label: t('TAX', 'Tax') },
          { value: FEES, label: t('FEES', 'Fees') }
        ]}
      />
      {tab === TAX && (
        <div className='odc-tf-panel'>
          <SegmentedControl
            className='odc-tf-mode'
            label={t('TAX_SETTINGS', 'Tax settings')}
            value={mode}
            onValueChange={handleModeChange}
            options={[
              { value: SIMPLE, label: t('SIMPLE', 'Simple') },
              { value: ADVANCED, label: t('ADVANCED', 'Advanced') }
            ]}
          />
          {mode === SIMPLE ? simpleForm : advanced}
        </div>
      )}
      {tab === FEES && (
        <div className='odc-tf-panel'>
          <CustomerFees
            businessId={business?.id}
            business={business}
            setIsExtendExtraOpen={value => {
              setFeeOpen(!!value)
              setIsExtendExtraOpen?.(value)
            }}
            legacyField={legacyField}
            keepLegacyField={serviceFeeStored || draft.service_fee !== undefined}
          />
        </div>
      )}
      {/* review R1: an open tax or customer fee has its own save bar; the section's would cover it, so it waits for the editor to
          close (its pending changes stay, and the leave guard still asks for them) */}
      {!detailOpen && (
      <SaveBar
        label={t('TAX_AND_FEES', 'Tax & fees')}
        count={count}
        countText={withCount(count === 1
          ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
          : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
        names={changedKeys.map(key => labels[key])}
        moreText={n => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
        saving={saving}
        errorText={errorText}
        onRetry={errorText ? save : undefined}
        retryLabel={t('TRY_AGAIN', 'Try again')}
        saved={saved}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={t('SAVE', 'Save')}
        onDiscard={discard}
        onSave={save}
      />
      )}
      <ConfirmDialog
        open={askSimple}
        tone='default'
        title={t('STOP_ADVANCED_TAXES_TITLE', 'Stop using advanced taxes on this store?')}
        confirmLabel={t('REMOVE_FROM_THIS_STORE', 'Remove from this store')}
        cancelLabel={t('KEEP_ADVANCED_TAXES', 'Keep advanced taxes')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setAskSimple(false)}
        onConfirm={removeAdvancedTaxes}
      >
        {(appliedTaxes.length === 1
          ? t('STOP_ADVANCED_TAXES_BODY_ONE', '_names_ still applies to this store. Remove it from this store to use only the simple tax settings. The tax stays in the project, and nothing changes until you save.')
          : t('STOP_ADVANCED_TAXES_BODY', '_names_ still apply to this store. Remove them from this store to use only the simple tax settings. The taxes stay in the project, and nothing changes until you save.'))
          .replace('_names_', appliedTaxes.map(tax => tax.name).join(', '))}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!deleting.tax}
        tone='danger'
        busy={deleting.busy}
        title={t('TAX_DELETE_TITLE', 'Delete _name_ for the whole project?').replace('_name_', deleting.tax?.name ?? '')}
        confirmLabel={t('DELETE_TAX', 'Delete tax')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setDeleting(current => (current.busy ? current : { tax: null, busy: false }))}
        onConfirm={confirmDelete}
      >
        {t('TAX_DELETE_BODY', 'It is removed from every store and product that uses it, not only from this one. This can\'t be undone.')}
      </ConfirmDialog>
    </div>
  )
}
