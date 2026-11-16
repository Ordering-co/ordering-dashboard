import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

import { DriversCompanyDetails as DriversCompanyDetailsController, useLanguage } from '../../../../../index'
import { getScheduleLabels } from '../../../utils/scheduleLabels'
import { AlertDialog, Button, RecordPanel, ScheduleEditor, useSplitView } from '../../Shared/Product'
import { GeneralFields, WebhooksFields } from './CompanyFields'
import { discardTexts } from './CompanyPanel'
import { FIELD_ORDER, validate } from './companyForm'
import './company-panel.css'
import './company-add.css'

/**
 * The add panel of a driver company (redesign DC-B4, decision 5 | M-DC15), in place of the former add form. A sibling of
 * CompanyPanel: it mounts K/DriversCompanyDetails with no company and `CompanyAddPanelUI`, which brings `changesState`,
 * `handleChangesState`, `handleChangeScheduleState` and `handleAddDriversCompany()` (it answers `{ ok, error }`, B1, and on ok it
 * calls the controller's `onClose`).
 *
 * Props the page (B5) gives:
 *  - `driversCompaniesState`, `setDriversCompaniesState`: what main gave the former add form;
 *  - `onClose()`: the close of the panel (Cancel, Escape, the scrim). It asks first when the form has changes;
 *  - `onAdded()`: the company was saved: close without asking. The controller calls it as its `onClose`, only after a save;
 *  - `panelRef`: the RecordPanel's ref; `panelRef.current.requestClose(proceed)` is the guard for opening a company over this form.
 *
 * General, Schedule and Webhooks are stacked in one `<form noValidate>` (Enter in a field saves) with a heading each. The check is
 * companyForm.validate in 'add' mode: every required field and the time zone, as main's add form.
 */

const sameSchedule = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

const errorLines = (error, fallback) => {
  const list = (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim())
  return list.length ? [...new Set(list)] : [fallback]
}

export const CompanyAddPanelUI = (props) => {
  const {
    changesState,
    handleChangesState,
    handleChangeScheduleState,
    handleAddDriversCompany,
    panelClose,
    panelRef
  } = props

  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'
  const changes = changesState ?? {}

  const ownRef = useRef(null)
  const ref = panelRef ?? ownRef
  const formRef = useRef(null)
  const formId = useId()
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // ---- the schedule's own report on mount is not a change ----
  // K/Schedule emits the schedule it draws when there is no `scheduleList`; it is still sent (as main), but it is the baseline.
  const scheduleBaseline = useRef(null)
  const onSchedule = useCallback((next) => {
    if (scheduleBaseline.current == null) scheduleBaseline.current = next
    handleChangeScheduleState(next)
  }, [handleChangeScheduleState])

  // what the person did: any field they touched, and the schedule only when it differs from the baseline
  const dirty = Object.keys(changes).some(field => (
    field === 'schedule' ? !sameSchedule(changes.schedule, scheduleBaseline.current) : true
  ))

  // ---- the fields: an edit clears its own error ----
  const [errors, setErrors] = useState({})
  const onFieldChange = (field, value) => {
    handleChangesState(field, value)
    if (errors[field]) setErrors(({ [field]: _gone, ...rest }) => rest)
  }

  const focusField = (field) => {
    const tryFocus = (attempt) => {
      const frame = formRef.current?.querySelector(`[data-field="${field}"]`)
      const control = frame?.querySelector('input, textarea, [aria-haspopup="listbox"], button')
      if (control) {
        control.focus()
        return
      }
      if (attempt < 10) window.requestAnimationFrame(() => tryFocus(attempt + 1))
    }
    window.requestAnimationFrame(() => tryFocus(0))
  }

  // ---- save ----
  const [saving, setSaving] = useState(false)
  const [alertContent, setAlertContent] = useState(null)

  const save = async () => {
    if (saving) return
    const found = validate({ mode: 'add', changes, t })
    if (Object.keys(found).length > 0) {
      setErrors(found)
      focusField(FIELD_ORDER.find(field => found[field]))
      return
    }
    setErrors({})
    setSaving(true)
    let result
    try {
      result = await handleAddDriversCompany()
    } catch (error) {
      result = { ok: false, error: [error?.message] }
    }
    if (!mounted.current) return // on ok the controller told the list and the page closed the panel
    setSaving(false)
    if (result && result.ok === false) {
      setAlertContent(errorLines(result.error, t('DRIVERS_COMPANIES_SAVE_ERROR', "We couldn't save the changes. Try again.")))
    }
  }

  const submit = (event) => {
    event.preventDefault()
    save()
  }

  // Cancel goes through the guard when there is something to lose
  const cancel = () => {
    if (dirty && ref.current) ref.current.requestClose(panelClose)
    else panelClose?.()
  }

  const footer = (
    <div className='odc-dc-add-footer'>
      <Button onClick={cancel}>{t('CANCEL', 'Cancel')}</Button>
      <Button type='submit' form={formId} variant='primary' busy={saving} disabled={!dirty}>{t('SAVE', 'Save')}</Button>
    </div>
  )

  return (
    <>
      <RecordPanel
        ref={ref}
        className='odc-dc-panel odc-dc-add'
        title={t('ADD_DRIVER_COMPANY', 'Add driver company')}
        closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
        onClose={panelClose}
        footer={footer}
        dirty={dirty}
        {...discardTexts(t)}
      >
        <form id={formId} ref={formRef} className='odc-dc-add-form' noValidate onSubmit={submit}>
          <section className='odc-dc-add-section' data-section='general'>
            <h3 className='odc-dc-add-title'>{t('GENERAL', 'General')}</h3>
            <GeneralFields changes={changes} company={null} errors={errors} onChange={onFieldChange} />
          </section>
          <section className='odc-dc-add-section' data-section='schedule'>
            <h3 className='odc-dc-add-title'>{t('SCHEDULE', 'Schedule')}</h3>
            <ScheduleEditor labels={getScheduleLabels(t)} handleChangeScheduleState={onSchedule} />
          </section>
          <section className='odc-dc-add-section' data-section='webhooks'>
            <h3 className='odc-dc-add-title'>{t('WEBHOOKS', 'Webhooks')}</h3>
            <WebhooksFields changes={changes} company={null} errors={errors} onChange={onFieldChange} />
          </section>
        </form>
      </RecordPanel>

      <AlertDialog
        open={Boolean(alertContent)}
        title={t('DRIVERS_COMPANIES_ADD_ERROR_TITLE', "The company wasn't added")}
        content={alertContent ?? []}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setAlertContent(null)}
      />
    </>
  )
}

export const CompanyAddPanel = (props) => {
  const { onClose, onAdded } = props
  return (
    <DriversCompanyDetailsController
      {...props}
      // the controller calls `onClose` only once the company is saved; the panel's own close is `panelClose`
      onClose={onAdded}
      panelClose={onClose}
      UIComponent={CompanyAddPanelUI}
    />
  )
}
