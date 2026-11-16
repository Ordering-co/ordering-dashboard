import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { DriversCompanyDetails as DriversCompanyDetailsController, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { getScheduleLabels } from '../../../utils/scheduleLabels'
import { CircleAlert, Ellipsis, Info, Maximize2, Minimize2, Trash2 } from '../../Shared/Icon'
import {
  AlertDialog,
  AsyncSwitch,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineNotice,
  Menu,
  RecordPanel,
  SaveBar,
  ScheduleEditor,
  Skeleton,
  Status,
  useSplitView
} from '../../Shared/Product'
import { GeneralFields, WebhooksFields } from './CompanyFields'
import { companyName, isIntegration } from './companyData'
import { COMPANY_SECTIONS, FIELD_ORDER, changedFields, fieldLabel, firstErrorSection, validate } from './companyForm'
import './company-panel.css'

/**
 * The panel of a driver company (redesign DC-B3, decisions 3, 4 and 6), in place of the former details form and its three
 * tabs. It mounts K/DriversCompanyDetails with `CompanyPanelUI`: the controller brings `companyState`, `changesState`,
 * `actionState` and the handlers (`handleUpdateDriversCompany()`, `handleDeleteDriversCompany()` answer `{ ok, error }`, B1).
 *
 * Props the page (B5) gives:
 *  - `driversCompaniesState`, `setDriversCompaniesState`, `driversCompany` (the row; undefined when opened by `?id=`),
 *    `driversCompanyId`: what main gave the former details form (D/DriversCompaniesListing:175-180);
 *  - `section` (the raw `?tab=`) and `onSectionChange(id)`; an unknown or missing tab is General, as main;
 *  - `onClose()` (the close of the panel; the guard asks first when dirty), `onDeleted(id)` (the company is gone: close without
 *    asking and take it off the selection, M-DC21), `expanded` and `onToggleExpanded()` («Open as page», as main's Expand);
 *  - `onToggleEnabled(company, next)` → `{ ok, error }`: the list controller's save of `{ enabled }` (the same as the row's);
 *  - `confirmDisable(company)` → `Promise<boolean>` (D-5): turning it OFF asks this first; false saves nothing;
 *  - `panelRef`: the RecordPanel's ref; `panelRef.current.requestClose(proceed)` is the guard for opening another company.
 * The panel remounts the controller when the id changes (and on «Retry»), so each company starts clean (M-DC17).
 *
 * One SaveBar for the three sections (decision 3 | M-DC9): main's controller already sent every pending change from any tab's
 * «Save»; the bar now names them. The check is companyForm.validate (the section in view as main, plus a required field emptied
 * anywhere); an error of another section opens it and focuses its first field.
 *
 * redesign (n.º 10, drivers-companies P-1): an integration (`owner_type: 'system'`: DoorDash, Uber Direct…) opens read only.
 * It shows its data, has no Save bar, no Delete, no Enabled change and no editable field (the schedule sits in a disabled fieldset), and
 * a notice sends to Connect › Delivery services, where it is managed. A company of the project works as always.
 */

const SAVED_MS = 2500

const apiErrorText = (t, error) => {
  const fallback = t('DRIVERS_COMPANIES_SAVE_ERROR', "We couldn't save the changes. Try again.")
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)].map(message => translateApiMessage(t, message, fallback)).join(' ') : fallback
}

const errorLines = (error, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)] : [fallback]
}

const sameSchedule = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

/** `?tab=` → the section shown: a key main knew, else General (the former details form). */
export const resolveCompanySection = (tab) => (COMPANY_SECTIONS.includes(tab) ? tab : 'general')

/** The four texts of the discard guard (decision 17): the keys the other redesigned panels use. */
export const discardTexts = (t) => ({
  discardTitle: t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?'),
  discardDescription: t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.'),
  discardConfirmLabel: t('DISCARD', 'Discard'),
  keepEditingLabel: t('KEEP_EDITING', 'Keep editing')
})

const BodySkeleton = ({ label }) => (
  <div className='odc-dc-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

export const CompanyPanelUI = (props) => {
  const {
    companyState,
    changesState,
    cleanChagesState,
    handleChangesState,
    handleUpdateDriversCompany,
    handleChangeScheduleState,
    handleDeleteDriversCompany,
    driversCompaniesState,
    section,
    onSectionChange,
    panelClose,
    expanded = false,
    onToggleExpanded,
    onToggleEnabled,
    confirmDisable,
    panelRef,
    onRetry,
    actionDisabled = false
  } = props

  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'

  // The controller starts with `company: null` and copies the row in its mount effect: the row stands in until then (no error flash)
  const company = companyState?.company ?? props.driversCompany ?? null
  const loading = Boolean(companyState?.loading)
  const failed = !company && !loading // M-DC20: a company that did not open says so
  const current = resolveCompanySection(section)
  const changes = changesState ?? {}

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // ---- the schedule's own report on mount is not a change (auditor 5) ----
  // K/Schedule emits the schedule it draws when the company has none; it is still sent (as main), but it is the baseline.
  const scheduleBaseline = useRef(Array.isArray(company?.schedule) ? company.schedule : null)
  useEffect(() => {
    if (Array.isArray(company?.schedule)) scheduleBaseline.current = company.schedule
  }, [company?.schedule])
  const onSchedule = useCallback((next) => {
    if (scheduleBaseline.current == null) scheduleBaseline.current = next
    handleChangeScheduleState(next)
  }, [handleChangeScheduleState])

  const pending = changedFields(changes).filter(field => field !== 'schedule' || !sameSchedule(changes.schedule, scheduleBaseline.current))
  const listed = company ? driversCompaniesState?.companies?.find(item => item.id === company.id) : null
  const integration = isIntegration(listed ?? company)
  const dirty = Boolean(company) && !integration && pending.length > 0
  const locked = Boolean(actionDisabled) || integration // redesign (n.º 10, P-1): an integration is read only

  // ---- the fields: an edit clears its own error ----
  const [errors, setErrors] = useState({})
  const [formKey, setFormKey] = useState(0) // remounts what keeps its own value (the time zone list, the schedule) after Discard
  const onFieldChange = (field, value) => {
    handleChangesState(field, value)
    if (errors[field]) setErrors(({ [field]: _gone, ...rest }) => rest)
  }

  // ---- the save bar ----
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const savedTimer = useRef(null)
  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const focusField = (field) => {
    const find = () => document.querySelector(`.odc-dc-panel .odc-dc-section[data-section] [data-field="${field}"]`)
    const tryFocus = (attempt) => {
      const frame = find()
      const control = frame?.querySelector('input, textarea, [aria-haspopup="listbox"], button')
      if (control && !control.closest('[hidden]')) {
        control.focus()
        return
      }
      if (attempt < 10) window.requestAnimationFrame(() => tryFocus(attempt + 1))
    }
    window.requestAnimationFrame(() => tryFocus(0))
  }

  const save = async () => {
    if (saving || !company || integration) return
    const found = validate({ section: current, changes, company, integration, t })
    if (Object.keys(found).length > 0) {
      setErrors(found)
      const target = firstErrorSection(found)
      if (target && target !== current) onSectionChange?.(target)
      focusField(FIELD_ORDER.find(field => found[field]))
      return
    }
    setErrors({})
    setSaveError(null)
    setSaved(false)
    clearTimeout(savedTimer.current)
    setSaving(true)
    let result
    try {
      result = await handleUpdateDriversCompany()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    if (!mounted.current) return
    setSaving(false)
    if (result && result.ok === false) {
      setSaveError(apiErrorText(t, result.error))
      return
    }
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_MS)
  }

  const discard = () => {
    cleanChagesState()
    setErrors({})
    setSaveError(null)
    setFormKey(key => key + 1)
  }

  const submit = (event) => {
    event.preventDefault()
    save()
  }
  // A form with several fields and no submit button does not submit on Enter (the Save button is in the panel's footer): Enter in
  // one of the company's own text fields saves, as the «Save» of each of main's tabs did. Not in the time zone list's search.
  const saveOnEnter = (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented) return
    const target = event.target
    if (target?.tagName !== 'INPUT' || !target.name || !target.closest('[data-field]')) return
    event.preventDefault()
    save()
  }

  // ---- the header: the company's name (it follows what is typed, as main), «#id · Integration», the switch ----
  const name = company ? companyName({ name: changes.name ?? company.name }, t) : t('DRIVER_COMPANY', 'Driver company')
  const enabled = Boolean((listed ?? company)?.enabled)
  const subtitle = company && (
    <span className='odc-dc-panel-sub'>
      <bdi dir='ltr' className='odc-figure'>{`#${company.id}`}</bdi>
      {integration && <> · <span className='odc-dc-tag'>{t('DRIVERS_COMPANIES_INTEGRATION', 'Integration')}</span></>}
    </span>
  )
  const status = company && (
    <span className='odc-dc-panel-status'>
      <Status family={enabled ? 'done' : 'cancel'} label={enabled ? t('ENABLED', 'Enabled') : t('DISABLED', 'Disabled')} />
      <AsyncSwitch
        checked={enabled}
        disabled={locked}
        label={t('DRIVERS_COMPANIES_ENABLE_NAME', 'Enable _name_').replace('_name_', name)}
        failureText={t('DRIVERS_COMPANIES_TOGGLE_ERROR', "The company didn't change. Try again.")}
        // redesign D-5 (owner, 2026-10-19, C8): turning OFF asks first (the page's dialog); ON stays immediate
        confirmChange={confirmDisable ? next => next || confirmDisable(listed ?? company) : undefined}
        onToggle={next => onToggleEnabled?.(listed ?? company, next)}
      />
    </span>
  )

  // ---- Delete (C8): the name, and the integration said ----
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState(null)
  const deleteCompany = async () => {
    if (deleting) return
    setDeleting(true)
    let result
    try {
      result = await handleDeleteDriversCompany()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    if (!mounted.current) return // on ok the controller told the list and the page closed the panel
    setDeleting(false)
    setConfirmOpen(false)
    if (result && result.ok === false) {
      setDeleteErrors(errorLines(result.error, t('DRIVERS_COMPANIES_DELETE_ERROR', "We couldn't delete this company. Try again.")))
    }
  }

  // redesign (n.º 10, P-1): no Delete menu for an integration (it cannot be deleted here)
  const headerActions = company && (
    <>
      {!phone && onToggleExpanded && (
        <IconButton
          icon={expanded ? Minimize2 : Maximize2}
          label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
          onClick={() => split.guardPlaceChange(() => onToggleExpanded())}
        />
      )}
      {!integration && (
        <Menu
          label={t('ACTIONS', 'Actions')}
          icon={Ellipsis}
          items={[{ key: 'delete', label: t('DELETE', 'Delete'), icon: Trash2, tone: 'danger', disabled: actionDisabled, onSelect: () => setConfirmOpen(true) }]}
          triggerProps={{ disabled: Boolean(actionDisabled) }}
        />
      )}
    </>
  )

  // ---- the sections: all three stay mounted (RecordPanel keeps them), so a draft survives a switch ----
  const sectionLabels = {
    general: t('GENERAL', 'General'),
    schedule: t('SCHEDULE', 'Schedule'),
    webhooks: t('WEBHOOKS', 'Webhooks')
  }
  // redesign (n.º 10, P-1): an integration is managed in Connect › Delivery services: the notice says so and links there
  const integrationNotice = integration && (
    <InlineNotice
      tone='info'
      icon={Info}
      live={false}
      data-integration-notice=''
      action={(
        <Link className='odc-btn' data-variant='link' data-size='md' to='/connect/delivery-services'>
          {t('DRIVERS_COMPANIES_INTEGRATION_LINK', 'Open Connect › Delivery services')}
        </Link>
      )}
    >
      {t('DRIVERS_COMPANIES_INTEGRATION_NOTICE', 'This integration is managed in Connect. Here you can only see it.')}
    </InlineNotice>
  )
  const sectionBody = (id) => {
    if (id === 'general') {
      return (
        <form className='odc-dc-section' data-section='general' noValidate onSubmit={submit} onKeyDown={saveOnEnter}>
          {integrationNotice}
          <GeneralFields changes={changes} company={company} errors={errors} onChange={onFieldChange} disabled={locked} readOnly={integration} timezoneKey={formKey} />
        </form>
      )
    }
    if (id === 'schedule') {
      return (
        <div className='odc-dc-section' data-section='schedule'>
          {integrationNotice}
          {/* a fieldset disabled makes the time selects read only without changing P/ScheduleEditor; `disableSchedule` takes its buttons away */}
          <fieldset className='odc-dc-readonly' disabled={integration}>
            <ScheduleEditor
              key={formKey}
              labels={getScheduleLabels(t)}
              scheduleList={Array.isArray(company?.schedule) ? company.schedule : undefined}
              handleChangeScheduleState={onSchedule}
              disableSchedule={integration}
            />
          </fieldset>
        </div>
      )
    }
    return (
      <form className='odc-dc-section' data-section='webhooks' noValidate onSubmit={submit} onKeyDown={saveOnEnter}>
        {integrationNotice}
        <WebhooksFields changes={changes} company={company} errors={errors} onChange={onFieldChange} disabled={locked} showApiKey integration={integration} />
      </form>
    )
  }

  const count = pending.length
  // The bar draws itself from the first change, while saving, with an error or while «Saved» (and hands the focus back when it goes)
  const footer = company && !integration && (
    <SaveBar
      label={t('SAVE_CHANGES', 'Save changes')}
      count={count}
      countText={(count === 1 ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change') : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)}
      names={pending.map(field => fieldLabel(field, t))}
      moreText={n => t('SETTINGS_UNSAVED_MORE', '+_count_').replace('_count_', n)}
      saving={saving}
      errorText={saveError}
      onRetry={save}
      retryLabel={t('RETRY', 'Retry')}
      saved={saved}
      savedText={t('SAVED', 'Saved')}
      discardLabel={t('DISCARD', 'Discard')}
      saveLabel={t('SAVE', 'Save')}
      onDiscard={discard}
      onSave={save}
      formSelector='.odc-dc-section'
    />
  )

  const panelLabel = t('DRIVER_COMPANY_SETTINGS', 'Driver company settings')
  const navigation = {}
  let body = null
  if (failed) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('DRIVERS_COMPANIES_OPEN_ERROR', "We couldn't open this company.")}
        action={(
          <span className='odc-dc-state-actions'>
            {onRetry && <Button onClick={onRetry}>{t('RETRY', 'Retry')}</Button>}
            {panelClose && <Button onClick={panelClose}>{t('CLOSE', 'Close')}</Button>}
          </span>
        )}
      />
    )
  } else if (!company) {
    body = <BodySkeleton label={t('LOADING', 'Loading')} />
  } else {
    navigation.tabs = {
      label: panelLabel,
      value: current,
      onValueChange: onSectionChange,
      items: COMPANY_SECTIONS.map(id => ({ value: id, label: sectionLabels[id], content: sectionBody(id) }))
    }
  }

  return (
    <>
      <RecordPanel
        ref={panelRef}
        className='odc-dc-panel'
        title={company || failed ? name : <span className='odc-dc-title-skeleton'><Skeleton /></span>}
        subtitle={subtitle}
        status={status}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={panelClose}
        headerActions={headerActions}
        footer={footer}
        {...navigation}
        dirty={dirty}
        {...discardTexts(t)}
      >
        {body}
      </RecordPanel>

      <ConfirmDialog
        open={confirmOpen}
        title={t('DRIVERS_COMPANIES_DELETE_ONE_TITLE', 'Delete _name_?').replace('_name_', name)}
        confirmLabel={t('DRIVERS_COMPANIES_DELETE_ONE', 'Delete company')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        tone='danger'
        busy={deleting}
        onConfirm={deleteCompany}
        onCancel={() => setConfirmOpen(false)}
      >
        {t('DRIVERS_GROUPS_CANT_UNDO', "This can't be undone.")}
      </ConfirmDialog>

      <AlertDialog
        open={Boolean(deleteErrors)}
        title={t('DRIVERS_COMPANIES_DELETE_ERROR_TITLE', "The company wasn't deleted")}
        content={deleteErrors ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setDeleteErrors(null)}
      />
    </>
  )
}

export const CompanyPanel = (props) => {
  const { onClose, onDeleted, driversCompanyId, driversCompany } = props
  // The controller has no refetch: a new `key` mounts it again (also how each company starts clean, M-DC17)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(count => count + 1), [])
  const id = driversCompany?.id ?? driversCompanyId
  return (
    <DriversCompanyDetailsController
      key={`${id}:${attempt}`}
      {...props}
      // the controller calls `onClose` only once the company is deleted; the panel's own close is `panelClose`
      onClose={() => onDeleted?.(id)}
      panelClose={onClose}
      onRetry={retry}
      UIComponent={CompanyPanelUI}
    />
  )
}
