import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../../../../../index'
import { translateApiMessage } from '../../../../../../utils/translateApiMessage'
import {
  Checkbox,
  ConfirmDialog,
  NumberField,
  SaveBar,
  SecretField,
  SegmentedControl,
  TabPanel,
  Tabs,
  TextField,
  useLeaveGuard,
  useSectionSplit
} from '../../../Shared/Product'
import { applyDraftPatch, countChanges, getChanges, initDraft, missingRequired, needsLiveConfirm, needsSandboxConfirm } from './providerPanelModel'
import './provider-panel.css'

// redesign stores 5.9: the shared detail of one payment gateway. It is the BODY of the detail inside P/SectionSplit: the list
// draws the SectionSplit, its title, the X / «‹ Back» and the «⋯» Delete menu, NOT this panel. It replaces the shell every provider form
// copied: tabs, credentials with an explicit Live/Sandbox mode, channels (sites), order types, devices, ONE save bar, the leave guard and
// the Live <-> Sandbox confirmations. Config-driven: a provider form is a thin wrapper that passes `tabs` and `fields` (lots 5.10a, 5.10b, 5.11).
// The panel translates its own strings with `useLanguage()`. The parent mounts one panel per record (`key`): the draft is made once from
// `businessPaymethod`, and the controller mutates that record in place, so a new object is never needed to see a saved value.
//
// Props
//  - `paymethod`            the project gateway `{ id, gateway, name, data_template }` (only `gateway` is read, as `data-gateway`).
//  - `businessPaymethod`    the store record `{ id, paymethod_id, enabled, sandbox, data, data_sandbox, allowed_order_types, sites, devices }`.
//  - `gatewayName`          translated display name: the label of the tablist and of the save bar, and the name in the dialog.
//  - `storeName`            the store's name, in the Live / Sandbox dialog.
//  - `tabs`                 ordered `[{ id: 'general' | 'channels' | 'order_types' | 'devices', index }]`. `index` is the value of
//                           `?paymethod_tab=` for that tab (each form keeps the indices of `main`). `channels` is dropped when `sites` is
//                           empty, and `general` when it has nothing to draw (no `generalBefore`, no `generalAfter`, no `showMode`, no `fields`).
//  - `initialTab`           the `?paymethod_tab` number the form read, or `undefined`. If it is not the index of an available tab the panel
//                           opens the first one (G4-20). A tab the user picked wins over it.
//  - `onTabChange(index)`   called when the USER picks a tab (never on mount), and when a failed Save moves the user to General. The
//                           form writes the URL. main, it gets `null` when the user picks an extra tab (see
//                           `extraTabs`): the form takes `paymethod_tab` away. `null` is only sent when `extraTabs` is not empty.
//  - `extraTabs`            main, `[{ id, label, content }]`, tabs of the gateway itself (Stripe Connect v2: Stripe
//                           account, Platform fee, Payouts), drawn BEFORE the common ones in the same tablist. While it is not empty the
//                           panel opens on the first extra tab and `initialTab` is not used to open (a tab the user picked still wins). An
//                           extra tab is never kept in the URL (`onTabChange(null)`). Its body is `content`, which saves by itself: while one
//                           is current the save bar is drawn only for changes pending in a common tab (the draft, the leave guard and
//                           `onSave` are untouched).
//  - `sites`, `devices`     arrays `{ id, name }` (`sitesState.sites`, `deviceState.devices`).
//  - `orderTypes`           `[{ value, text }]`.
//  - `showMode`             draws the Live/Sandbox control in the General tab.
//  - `fields`               `[{ key, label, mode: 'live' | 'sandbox', required?, secret?, type?, hint? }]`. `secret` (or `type: 'password'`)
//                           draws P/SecretField; anything else P/TextField with `type` when it is text-like (text, email, tel, url,
//                           search) and `text` otherwise: a template type the panel does not know is never skipped (G4-23).
//                           redesign stores 5.10b: an optional `number: { min?, max?, step?, format? }` draws P/NumberField
//                           while the draft text is empty or a number. The draft still keeps TEXT ('' when empty), so the changes and the
//                           PUT do not move. Only `min` and `step` reach the control, never `max` (Base UI clips to it on commit and a value
//                           `main` accepted could not be cleared); `format` extends `{ useGrouping: false, maximumFractionDigits: 20 }`. A
//                           value outside `min` / `max` only changes the hint into a notice: it is never clipped, never required, never
//                           blocks Save. A saved text that is not a number stays in a text field with a hint. `type: 'number'` alone keeps
//                           drawing a text field (G4-23).
//  - `fieldsDisplay`        `'both'` (every field, grouped «Live credentials» / «Sandbox credentials») or `'active'` (only the fields of
//                           the mode chosen in the draft, as `main`'s template form does). redesign stores 5.10b: `'plain'`
//                           draws every field of both modes in one group, without titles and without filtering by mode.
//                           redesign stores 5.11: an optional `readOnly: true` goes to the control (a SecretField keeps its
//                           «Show»). A readOnly field is never required and never shows the required mark.
//  - `extraFields`          redesign stores 5.11: `[{ key, label, hint?, number?, secret?, readOnly?, type? }]`, drawn with the
//                           same rules as `fields` (no `required`) in their own untitled group of the General tab, after the credential
//                           fields and before `generalAfter`. They are NOT the gateway record's (Stripe Connect's fees live on the
//                           business and are saved by another request): `onSave` gets them as `changes.extra = { [key]: text }`, with
//                           ONLY the keys that changed (absent when none did). Each one counts as a change. Their presence also makes
//                           the General tab exist.
//  - `extraValues`          redesign stores 5.11: `{ [key]: value }`, read ONCE when the draft is made (like the record). The
//                           draft keeps them as text ('' when null or undefined). Discard resets them; a good save makes them the baseline.
//  - `draftPatch`           redesign stores 5.11: optional `{ sandbox?: boolean, data?, data_sandbox? }` (the Stripe Connect
//                           OAuth result). Each NEW object (by identity, the first render included) is merged into the DRAFT only:
//                           `sandbox` replaced when it is a boolean, `data` / `data_sandbox` shallow-merged. So it shows as unsaved changes,
//                           Save sends it through `onSave` and Discard drops it. The same object again is not re-applied; null does nothing.
//  - `generalBefore`        optional node at the top of the General tab (Mercado Pago «Connect», the status of the global keys).
//  - `generalAfter`         optional node at the END of the General tab, after the fields: what saves by itself and so is not part of the
//                           bar (Stripe Link's Twilio configs). redesign stores 5.10a
//  - `defaultOrderTypes`    what the draft gets when the record has none (default `[1, 2, 3, 4, 5]`, as `main`).
//  - `onSave(changes)`      returns a promise of `{ ok, error }` (nothing counts as ok). `changes` holds ONLY what changed (see the model):
//                           `sandbox`, the FULL `data` / `data_sandbox` object, and the whole `allowed_order_types` / `sites` / `devices`
//                           list when its set changed. `error` is the API message (a string, an array of strings or `{ message }`s).
//                           redesign stores 5.11: a failure that stored part of the changes adds `unsaved` (draft keys, e.g.
//                           `['extra']`): only those stay changes; the rest becomes the baseline.
//
// Save: a required field of the ACTIVE mode that is empty shows its error, moves the focus to the first one and does not call `onSave`;
// an enabled gateway that goes from Live to Sandbox asks first (decision 6), and from Sandbox to Live too (D-84); then `onSave` runs. On `{ ok: false }` the draft stays and
// the error shows in the bar (with «Try again»). Outside a SectionSplit / leave-guard host the guard is a no-op (the tutorial mounts it so).
// Channels: `sites: []` means ALL channels, exactly as `main` sends it: the list of sites shows only while «All» is off.

const DEFAULT_ORDER_TYPES = [1, 2, 3, 4, 5]
const SAVED_MS = 2000
const TEXT_TYPES = ['text', 'email', 'tel', 'url', 'search']

const text = (value) => (value === undefined || value === null ? '' : String(value))
const modeOf = (field) => (field.mode === 'sandbox' ? 'sandbox' : 'live')
const dataKey = (mode) => (mode === 'sandbox' ? 'data_sandbox' : 'data')
const fieldRefKey = (mode, key) => `${mode}:${key}`
const toggled = (list, value, on) => (on ? (list.includes(value) ? list : [...list, value]) : list.filter(item => item !== value))

// redesign stores 5.10b: the draft text as a number: `null` when empty, `undefined` when it is not a number (blank counts as not a number)
const numberOf = (value) => {
  if (value === '') return null
  const trimmed = value.trim()
  const number = trimmed === '' ? NaN : Number(trimmed)
  return Number.isFinite(number) ? number : undefined
}

// the notice of a number outside `number.{min,max}`: it names only the bounds the field has, and never blocks anything
const rangeNotice = (t, min, max) => {
  if (min != null && max != null) {
    return t('PAYMETHOD_NUMBER_RANGE', 'Usually between _min_ and _max_. Check this value.').replace('_min_', String(min)).replace('_max_', String(max))
  }
  return min != null
    ? t('PAYMETHOD_NUMBER_MIN', 'Usually _min_ or more. Check this value.').replace('_min_', String(min))
    : t('PAYMETHOD_NUMBER_MAX', 'Usually _max_ or less. Check this value.').replace('_max_', String(max))
}

// the API answers a message as a string, a list of strings or a list of `{ message }`
const apiLines = (error) => []
  .concat(error ?? [])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .filter(line => typeof line === 'string' && line.trim())

export const ProviderPanel = ({
  paymethod,
  businessPaymethod,
  gatewayName,
  storeName,
  tabs = [],
  extraTabs = [],
  initialTab,
  onTabChange,
  sites = [],
  devices = [],
  orderTypes = [],
  showMode = false,
  fields = [],
  fieldsDisplay = 'both',
  extraFields = [],
  extraValues,
  draftPatch,
  generalBefore,
  generalAfter,
  defaultOrderTypes = DEFAULT_ORDER_TYPES,
  onSave
}) => {
  const [languageState, t] = useLanguage()
  // redesign bugs C: the number fields read «1,5» in the dashboard's language, not in the browser's
  const locale = languageState?.language?.code
  const name = gatewayName ?? paymethod?.name ?? ''
  const groupId = useId()

  // ── The draft: made once from the record ──
  const [baseline, setBaseline] = useState(() => initDraft(businessPaymethod, { defaultOrderTypes, extraValues }))
  // redesign stores 5.11: a `draftPatch` present on the first render is in the draft from the start, never in the baseline
  const [draft, setDraft] = useState(() => applyDraftPatch(initDraft(businessPaymethod, { defaultOrderTypes, extraValues }), draftPatch))
  const appliedPatch = useRef(draftPatch)
  const [sitesUnticked, setSitesUnticked] = useState(false) // «All» was unticked and no site is picked yet
  const [attempted, setAttempted] = useState(false) // a Save was tried: required fields show their error
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null) // { error } while the last save failed
  const [saved, setSaved] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // redesign D-84 (owner, 2026-10-19): which switch the dialog asks about. It is NOT reset on close, so the texts do not flip while the dialog fades out
  const [confirmMode, setConfirmMode] = useState('sandbox')
  const [picked, setPicked] = useState(null) // the tab the user picked
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const savedTimer = useRef(0)
  const fieldRefs = useRef({})
  const pendingFocus = useRef(null)
  // redesign bugs F row 34: resolve of the save the leave guard asked for while the confirmation dialog is open
  const confirmWaiter = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimeout(savedTimer.current)
      confirmWaiter.current?.({ ok: false })
      confirmWaiter.current = null
    }
  }, [])

  // redesign stores 5.11: a NEW `draftPatch` object (by identity) is merged into the draft once; the same one is not re-applied
  useEffect(() => {
    if (!draftPatch || draftPatch === appliedPatch.current) return
    appliedPatch.current = draftPatch
    setDraft(previous => applyDraftPatch(previous, draftPatch))
  }, [draftPatch])

  // a field that must take the focus but was not drawn yet (its tab was closed) gets it once it is
  useEffect(() => {
    const target = pendingFocus.current
    const node = target ? fieldRefs.current[target] : null
    if (!node) return
    pendingFocus.current = null
    node.focus()
  })

  // ── Tabs ──
  const hasGeneral = !!generalBefore || !!generalAfter || showMode || fields.length > 0 || extraFields.length > 0
  const tabLabels = {
    general: t('GENERAL', 'General'),
    channels: t('CHANNELS', 'Channels'),
    order_types: t('ORDER_TYPE', 'Order type'),
    devices: t('DEVICES', 'Devices')
  }
  const available = tabs.filter(tab => (
    tabLabels[tab.id] !== undefined &&
    !(tab.id === 'channels' && sites.length === 0) &&
    !(tab.id === 'general' && !hasGeneral)
  ))
  // main, an extra tab's value is the string `extra:<id>`, which cannot clash with the numeric indices
  const extras = extraTabs.map(tab => ({ ...tab, value: `extra:${tab.id}` }))
  const hasExtra = (value) => extras.some(tab => tab.value === value)
  const has = (index) => available.some(tab => tab.index === index)
  const currentIndex = hasExtra(picked) || has(picked)
    ? picked
    : extras.length > 0 ? extras[0].value : has(initialTab) ? initialTab : available[0]?.index
  const currentExtra = extras.find(tab => tab.value === currentIndex)
  const current = available.find(tab => tab.index === currentIndex)?.id
  const generalIndex = available.find(tab => tab.id === 'general')?.index

  const pickTab = (value) => {
    setPicked(value)
    onTabChange?.(hasExtra(value) ? null : value)
  }

  // ── The changes ──
  const changes = getChanges(baseline, draft, fields, extraFields)
  const dirty = Object.keys(changes).length > 0
  const count = countChanges(baseline, draft, fields, extraFields)
  const activeMode = draft.sandbox ? 'sandbox' : 'live'
  const missing = missingRequired(draft, fields)

  const setField = (mode, key, value) => setDraft(previous => ({
    ...previous,
    [dataKey(mode)]: { ...previous[dataKey(mode)], [key]: value }
  }))

  const setExtra = (key, value) => setDraft(previous => ({
    ...previous,
    extra: { ...previous.extra, [key]: value }
  }))

  const discard = () => {
    setDraft(baseline)
    setSitesUnticked(false)
    setAttempted(false)
    setSaveError(null)
  }

  // ── Save ──
  const showMissing = () => {
    setAttempted(true)
    const target = fieldRefKey(activeMode, missing[0])
    const node = fieldRefs.current[target]
    if (node) {
      node.focus()
      return
    }
    pendingFocus.current = target
    if (generalIndex !== undefined && currentIndex !== generalIndex) pickTab(generalIndex)
  }

  const commit = async () => {
    const snapshot = draft
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    let result
    try {
      result = await onSave?.(changes)
    } catch (error) {
      result = { ok: false }
    }
    savingRef.current = false
    if (!mountedRef.current) return { ok: result?.ok !== false }
    setSaving(false)
    if (result && result.ok === false) {
      // redesign stores 5.11 (review F2): a save that stored part of the changes names the draft keys still unsaved (`unsaved`, e.g.
      // ['extra']); everything else becomes the baseline, so the bar counts, retries and discards only what is left
      if (Array.isArray(result.unsaved)) {
        setBaseline(previous => ({ ...snapshot, ...Object.fromEntries(result.unsaved.map(key => [key, previous[key]])) }))
      }
      setSaveError({ error: result.error })
      return { ok: false }
    }
    setBaseline(snapshot)
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_MS)
    return { ok: true }
  }

  // `{ ok }` is what the leave guard reads: a save that opens the dialog or shows the errors leaves the user here
  // redesign bugs F row 34: `viaGuard` (the leave guard's Save) waits for the answer to the confirmation dialog instead of
  // answering `{ ok: false }` at once: the guard reads that as a failed save and cancels the way out, and after «Use sandbox» nothing
  // took it up again. The answer is the result of the save the dialog's confirm sends, or `{ ok: false }` if the person cancels.
  const attemptSave = async ({ confirmed = false, viaGuard = false } = {}) => {
    if (savingRef.current) return { ok: false }
    if (!dirty) return { ok: true }
    if (missing.length > 0) {
      showMissing()
      return { ok: false }
    }
    if (!confirmed) {
      const mode = needsSandboxConfirm(businessPaymethod, baseline, draft) ? 'sandbox' : needsLiveConfirm(businessPaymethod, baseline, draft) ? 'live' : null
      if (mode) {
        setConfirmMode(mode)
        setConfirmOpen(true)
        if (!viaGuard) return { ok: false }
        return new Promise(resolve => {
          confirmWaiter.current?.({ ok: false })
          confirmWaiter.current = resolve
        })
      }
    }
    return commit()
  }

  const cancelConfirm = () => {
    setConfirmOpen(false)
    const waiter = confirmWaiter.current
    confirmWaiter.current = null
    waiter?.({ ok: false })
  }

  const acceptConfirm = () => {
    setConfirmOpen(false)
    const result = attemptSave({ confirmed: true })
    const waiter = confirmWaiter.current
    confirmWaiter.current = null
    waiter?.(result)
  }

  useLeaveGuard({
    dirty,
    count,
    save: () => attemptSave({ viaGuard: true }),
    discard,
    registerCloseGuard: useSectionSplit().registerCloseGuard
  })

  // ── General ──
  const secretEnding = (ending) => {
    const [before, after] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
    return <>{before}{ending}{after}</>
  }

  // `extra` (redesign stores 5.11, ): the field is one of `extraFields`: its value is `draft.extra[key]`, it is never required
  // and it is not tied to a mode. `readOnly` goes to the control and also turns the required mark off.
  const renderField = (field, extra = false) => {
    const mode = extra ? 'live' : modeOf(field)
    const required = !extra && !field.readOnly && !!field.required && mode === activeMode
    const refKey = extra ? `extra:${field.key}` : fieldRefKey(mode, field.key)
    const common = {
      label: field.label,
      hint: field.hint,
      value: text(extra ? draft.extra?.[field.key] : draft[dataKey(mode)]?.[field.key]),
      onChange: (value) => (extra ? setExtra(field.key, value) : setField(mode, field.key, value)),
      readOnly: field.readOnly ? true : undefined,
      required,
      requiredLabel: required ? t('REQUIRED', 'Required') : undefined,
      error: required && attempted && missing.includes(field.key)
        ? t('PAYMETHOD_FIELD_REQUIRED', '_field_ is required').replace('_field_', field.label)
        : undefined
    }
    const ref = (node) => { fieldRefs.current[refKey] = node }
    if (field.secret || field.type === 'password') {
      return (
        <SecretField
          key={refKey}
          ref={ref}
          {...common}
          showLabel={t('SHOW', 'Show')}
          hideLabel={t('HIDE', 'Hide')}
          endingLabel={secretEnding}
        />
      )
    }
    // redesign stores 5.10b: opt-in `number`. The draft keeps the TEXT ('' when empty), so the changes and the PUT do not move.
    const parsed = field.number ? numberOf(common.value) : null
    if (field.number && parsed !== undefined) {
      const { min, max, step, format } = field.number
      const outside = parsed !== null && ((min != null && parsed < min) || (max != null && parsed > max))
      // only `min` and `step` reach the control: Base UI clips to `max` on commit and a value `main` accepted could not be cleared
      return (
        <NumberField
          key={refKey}
          ref={ref}
          {...common}
          hint={outside ? rangeNotice(t, min, max) : field.hint}
          value={parsed}
          onChange={(next) => common.onChange(next === null || next === undefined || Number.isNaN(next) ? '' : String(next))}
          min={min}
          step={step}
          locale={locale}
          format={{ useGrouping: false, maximumFractionDigits: 20, ...format }}
        />
      )
    }
    return (
      <TextField
        key={refKey}
        ref={ref}
        {...common}
        // a saved value that is not a number is never hidden: it stays in a text field, with a hint
        hint={field.number ? t('PAYMETHOD_NUMBER_INVALID', 'This is not a number. Check it before saving.') : common.hint}
        type={TEXT_TYPES.includes(field.type) ? field.type : 'text'}
        autoComplete='off'
        // tanda P: a key (Client ID, Publishable key) is LTR text; in an Arabic page it was read from its end. `auto`
        // and not `ltr` (as SecretField), so a free text in Arabic still reads right to left
        dir='auto'
      />
    )
  }

  const renderGroup = (mode, title) => {
    const group = fields.filter(field => modeOf(field) === mode)
    if (group.length === 0) return null
    const titleId = `${groupId}-${mode}`
    return (
      <div key={mode} className='odc-pp-group' role='group' aria-labelledby={titleId}>
        <h4 id={titleId} className='odc-pp-group-title'>{title}</h4>
        {group.map(field => renderField(field))}
      </div>
    )
  }

  // 'active': only the fields of the mode in the draft, without a group title
  const renderActive = () => {
    const group = fields.filter(field => modeOf(field) === activeMode)
    return group.length > 0 ? <div className='odc-pp-group'>{group.map(field => renderField(field))}</div> : null
  }

  // 'plain' (redesign stores 5.10b): every field of both modes in one group, without a title
  const renderPlain = () => (fields.length > 0 ? <div className='odc-pp-group'>{fields.map(field => renderField(field))}</div> : null)

  // redesign stores 5.11: the fields that are not the record's, in their own group without a title
  const renderExtra = () => (extraFields.length > 0 ? <div className='odc-pp-group'>{extraFields.map(field => renderField(field, true))}</div> : null)

  // 'both': every field, grouped by mode
  const renderBoth = () => (
    <>
      {renderGroup('live', t('PAYMETHOD_LIVE_CREDENTIALS', 'Live credentials'))}
      {renderGroup('sandbox', t('PAYMETHOD_SANDBOX_CREDENTIALS', 'Sandbox credentials'))}
    </>
  )

  const renderGeneral = () => (
    <>
      {generalBefore}
      {showMode && (
        <div className='odc-pp-mode'>
          <SegmentedControl
            label={t('PAYMETHOD_MODE', 'Mode')}
            value={activeMode}
            onValueChange={(value) => setDraft(previous => ({ ...previous, sandbox: value === 'sandbox' }))}
            options={[
              { value: 'live', label: t('LIVE', 'Live') },
              { value: 'sandbox', label: t('SANDBOX', 'Sandbox') }
            ]}
          />
          <p className='odc-pp-hint'>
            {draft.sandbox
              ? t('PAYMETHOD_MODE_SANDBOX_HINT', 'Test mode: no real payments are taken.')
              : t('PAYMETHOD_MODE_LIVE_HINT', 'Customers pay with real money.')}
          </p>
        </div>
      )}
      {fieldsDisplay === 'active' ? renderActive() : fieldsDisplay === 'plain' ? renderPlain() : renderBoth()}
      {renderExtra()}
      {generalAfter}
    </>
  )

  // ── Channels, order types, devices ──
  const allChannels = draft.sites.length === 0 && !sitesUnticked

  const renderChannels = () => (
    <div className='odc-pp-list' role='group' aria-label={tabLabels.channels}>
      <Checkbox
        checked={allChannels}
        onCheckedChange={(next) => {
          setSitesUnticked(!next)
          if (next) setDraft(previous => ({ ...previous, sites: [] }))
        }}
      >
        {t('ALL', 'All')}
      </Checkbox>
      {!allChannels && sites.map(site => (
        <Checkbox
          key={site.id}
          checked={draft.sites.includes(site.id)}
          onCheckedChange={(next) => {
            const nextSites = toggled(draft.sites, site.id, next)
            if (nextSites.length === 0) setSitesUnticked(false)
            setDraft(previous => ({ ...previous, sites: toggled(previous.sites, site.id, next) }))
          }}
        >
          {site.name}
        </Checkbox>
      ))}
    </div>
  )

  const renderOrderTypes = () => (
    <div className='odc-pp-list' role='group' aria-label={tabLabels.order_types}>
      {orderTypes.map(type => (
        <Checkbox
          key={type.value}
          checked={draft.allowed_order_types.includes(type.value)}
          onCheckedChange={(next) => setDraft(previous => ({
            ...previous,
            allowed_order_types: toggled(previous.allowed_order_types, type.value, next)
          }))}
        >
          {type.text}
        </Checkbox>
      ))}
    </div>
  )

  const renderDevices = () => (
    devices.length === 0
      ? <p className='odc-pp-empty'>{t('NO_ASSIGNED_DEVICES', 'There are no assigned devices')}</p>
      : (
        <div className='odc-pp-list' role='group' aria-label={tabLabels.devices}>
          {devices.map(device => (
            <Checkbox
              key={device.id}
              checked={draft.devices.includes(device.id)}
              onCheckedChange={(next) => setDraft(previous => ({ ...previous, devices: toggled(previous.devices, device.id, next) }))}
            >
              {device.name}
            </Checkbox>
          ))}
        </div>
        )
  )

  const bodies = { general: renderGeneral, channels: renderChannels, order_types: renderOrderTypes, devices: renderDevices }

  // ── The save bar ──
  const failedFallback = t('PAYMETHOD_SAVE_FAILED', 'The payment method could not be saved. Please try again.')
  const errorText = saveError
    ? apiLines(saveError.error).map(line => translateApiMessage(t, line, failedFallback)).join(' ') || failedFallback
    : null
  const countText = count === 1
    ? t('PAYMETHOD_CHANGES_ONE', '1 unsaved change')
    : t('PAYMETHOD_CHANGES_OTHER', '_count_ unsaved changes').replace('_count_', String(count))

  const fill = (template) => template.replace('_name_', name).replace('_store_', storeName ?? '')

  return (
    <div className='odc-root odc-pp-panel' data-gateway={paymethod?.gateway} tabIndex={-1}>
      {(extras.length > 0 || available.length > 0) && (
        <Tabs
          label={name}
          value={currentIndex}
          onValueChange={pickTab}
          // redesign bugs F row 33: four tabs (Square's Devices) did not fit at 390 px and the last one hid past the scroll edge
          wrap
          items={[
            ...extras.map(tab => ({ value: tab.value, label: tab.label })),
            ...available.map(tab => ({ value: tab.index, label: tabLabels[tab.id] }))
          ]}
        >
          <TabPanel value={currentIndex}>
            <div className='odc-pp-body'>{currentExtra ? currentExtra.content : bodies[current]?.()}</div>
          </TabPanel>
        </Tabs>
      )}
      {/* main, an extra tab saves by itself, so it brings nothing to this bar; the bar still says (and saves) a
          change pending in a common tab while an extra tab is current (review r1 #1) */}
      {(!currentExtra || dirty) && (
        <SaveBar
          label={name}
          count={count}
          countText={countText}
          saving={saving}
          errorText={errorText}
          onRetry={() => attemptSave()}
          retryLabel={t('TRY_AGAIN', 'Try again')}
          saved={saved}
          savedText={t('SAVED', 'Saved')}
          discardLabel={t('DISCARD', 'Discard')}
          saveLabel={t('SAVE', 'Save')}
          onDiscard={discard}
          onSave={() => attemptSave()}
          formSelector='.odc-pp-panel'
        />
      )}
      <ConfirmDialog
        open={confirmOpen}
        tone='primary'
        title={fill(confirmMode === 'live' ? t('PAYMETHOD_LIVE_CONFIRM_TITLE', 'Switch _name_ to live?') : t('PAYMETHOD_SANDBOX_CONFIRM_TITLE', 'Switch _name_ to sandbox?'))}
        confirmLabel={confirmMode === 'live' ? t('PAYMETHOD_USE_LIVE', 'Use live') : t('PAYMETHOD_USE_SANDBOX', 'Use sandbox')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={cancelConfirm}
        onConfirm={acceptConfirm}
      >
        {fill(confirmMode === 'live'
          ? t('PAYMETHOD_LIVE_CONFIRM_BODY', "_store_ will start taking real payments with _name_. Real charges can't be undone.")
          : t('PAYMETHOD_SANDBOX_CONFIRM_BODY', '_store_ will stop taking real payments with _name_. Test credentials are used until you switch back to live.'))}
      </ConfirmDialog>
    </div>
  )
}
