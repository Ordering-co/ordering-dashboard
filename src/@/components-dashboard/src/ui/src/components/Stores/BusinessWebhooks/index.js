import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, BusinessWebhooks as BusinessWebhooksController } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Plus, Send, Trash2 } from '../../Shared/Icon'
import { Button, ConfirmDialog, EmptyState, Field, IconButton, InlineNotice, TextField, useLeaveGuard } from '../../Shared/Product'
import './business-webhooks.css'

// redesign stores 5.16 (; G2-39, G2-40): the store's webhooks on Product. A saved webhook reads as text (its event and its
// URL are not editable, as the API does not take them back); only its delay is a field, a native select that saves on change. While
// that row saves only its select is busy; a failed change puts the old delay back and says why in that row. Delete asks first
// (P/ConfirmDialog) and a failed one says why above the list. The add form needs an event and a URL (no URL format check: main takes
// any value), sends the delay only when one is chosen and says why an add failed under the form. Every notice belongs to the action
// that caused it, so none re-opens on an unrelated change.

const withValues = (template, values) => Object.entries(values)
  .reduce((result, [key, value]) => result.split(`_${key}_`).join(String(value)), template)

// The API answers with a list of messages (or one); every one is translated by its key, and none means the generic reason.
const messageOf = (t, error, fallback) => {
  const messages = (Array.isArray(error) ? error : [error])
    .map(item => translateApiMessage(t, item, null))
    .filter(Boolean)
  return messages.length ? messages.join(' ') : fallback
}

const WebhookRow = ({ webhook, label, nameLabel, delays, saving, removing, locked, onChangeDelay, onRemove, t }) => {
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const saved = webhook.delay == null ? '' : String(webhook.delay)
  const [value, setValue] = useState(saved)
  const [error, setError] = useState(null)
  // the controller flags the row on the next render; this answers a second change that comes before it
  const inFlight = useRef(false)
  // the shell hands the row the delay the API accepted
  useEffect(() => { setValue(saved) }, [saved])

  const change = async (event) => {
    // A row that saves ignores another change (the controlled select snaps back to its value). The select is never `disabled`:
    // a disabled control drops the keyboard focus to <body>, and the focus must stay on it while it saves and after a revert.
    if (saving || inFlight.current) return
    const next = event.target.value
    const previous = value
    inFlight.current = true
    setValue(next)
    setError(null)
    let result
    try {
      result = await onChangeDelay(next, webhook)
    } finally {
      inFlight.current = false
    }
    if (!mounted.current || result?.ok) return
    setValue(previous)
    setError(messageOf(t, result?.error, t('WEBHOOK_UPDATE_FAILED', 'The webhook could not be updated.')))
  }

  return (
    <li className='odc-webhooks-row'>
      <span className='odc-webhooks-event'>{label}</span>
      <span className='odc-webhooks-url'><bdi>{webhook.url}</bdi></span>
      <div className='odc-webhooks-delay'>
        <Field label={t('WEBHOOK_DELAY', 'Delay')}>
          <select
            name='delay'
            className='odc-field-input odc-webhooks-select'
            aria-label={withValues(t('WEBHOOK_DELAY_FOR', 'Delay for _hook_'), { hook: nameLabel })}
            aria-busy={saving || undefined}
            aria-disabled={saving ? 'true' : undefined}
            value={value}
            onChange={change}
          >
            {delays.map(option => <option key={option.value} value={option.value}>{option.content}</option>)}
          </select>
        </Field>
      </div>
      <IconButton
        icon={Trash2}
        label={withValues(t('WEBHOOK_DELETE_NAMED', 'Delete webhook _hook_'), { hook: nameLabel })}
        variant='ghost'
        size='sm'
        className='odc-webhooks-remove'
        disabled={saving || removing || locked}
        onClick={(event) => onRemove(webhook, event)}
      />
      {error && <InlineNotice className='odc-webhooks-row-error' tone='danger' role='alert'>{error}</InlineNotice>}
    </li>
  )
}

const BusinessWebhooksUI = (props) => {
  const {
    business,
    hookFormState,
    adding,
    savingId,
    savingIds,
    deletingId,
    handleChangeSelect,
    handleUpdateAddClick,
    handleDeleteWebhook,
    handleChangeDelay
  } = props

  const [, t] = useLanguage()

  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const hookRef = useRef(null)
  const urlRef = useRef(null)
  const listRef = useRef(null)
  const deleteOpener = useRef(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [addError, setAddError] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  const webhookList = [
    { value: '', content: t('SELECT_HOOK', 'Select a hook') },
    { value: 'orders_register', content: t('ORDERS_REGISTER', 'New order') },
    { value: 'orders_status_updated', content: t('ORDERS_STATUS_UPDATED', 'Order status update') },
    { value: 'orders_update_driver', content: t('ORDERS_UPDATE_DRIVER', 'Order update by driver') },
    { value: 'orders_pending', content: t('ORDERS_PENDING', 'Order pending') },
    { value: 'orders_completed', content: t('ORDERS_COMPLETED', 'Completed') },
    { value: 'orders_rejected', content: t('ORDERS_REJECTED', 'Order rejected') },
    { value: 'orders_canceled_customer', content: t('ORDERS_CANCELED_CUSTOMER', 'Order cancelled by customer') },
    { value: 'orders_rejected_business', content: t('ORDERS_REJECTED_BUSINESS', 'Order rejected by business') },
    { value: 'orders_rejected_driver', content: t('ORDERS_REJECTED_DRIVER', 'Order rejected by driver') },
    { value: 'orders_accepted_business', content: t('ORDERS_ACCEPTED_BUSINESS', 'Order accepted by business') },
    { value: 'orders_accepted_driver', content: t('ORDERS_ACCEPTED_DRIVER', 'Order accepted by driver') },
    { value: 'orders_pickup_completed_driver', content: t('ORDERS_PICKUP_COMPLETED_DRIVER', 'Order pickup completed by driver') },
    { value: 'orders_pickup_failed_driver', content: t('ORDERS_PICKUP_FAILED_DRIVER', 'Order pickup failed by driver') },
    { value: 'orders_delivery_completed_driver', content: t('ORDERS_DELIVERY_COMPLETED_DRIVER', 'Order delivery completed by driver') },
    { value: 'orders_delivery_failed_driver', content: t('ORDERS_DELIVERY_FAILED_DRIVER', 'Order delivery failed by driver') },
    { value: 'orders_unassigned_driver', content: t('ORDERS_UNASSIGNED_DRIVER', 'Order unassigned driver') },
    { value: 'preorder_updated', content: t('PREORDER_UPDATED', 'Preorder updated') },
    { value: 'drivers_changes', content: t('DRIVERS_CHANGES', 'Driver changes') }
  ]

  const timeList = [
    { value: '', content: t('SELECT_DELAY', 'Select a delay') },
    { value: '0', content: t('IMMEDIATELY', 'Immediately') },
    { value: '300', content: `5 ${t('MINUTES', 'Minutes')}` },
    { value: '600', content: `10 ${t('MINUTES', 'Minutes')}` },
    { value: '900', content: `15 ${t('MINUTES', 'Minutes')}` },
    { value: 'delivery_time', content: t('DELIVERY_TIME', 'Delivery time') },
    { value: 'pickup_time', content: t('PICKUP_TIME', 'Pickup time') },
    { value: 'preparation_time', content: t('PREPARATION_TIME', 'Preparation time') }
  ]

  // An event this dashboard does not know shows as the API sent it.
  const labelOf = (hook) => webhookList.find(item => item.value !== '' && item.value === hook)?.content ?? String(hook ?? '')

  const webhooks = business?.webhooks || []
  const draft = hookFormState?.changes || {}
  const requiredText = (name) => t('VALIDATION_ERROR_REQUIRED', 'Value is required').replace('_attribute_', name)

  // Adds the webhook of the form. Answers `{ ok: false }` when the form is not valid or the API refuses, so the leave guard keeps
  // the user here.
  const add = async () => {
    if (adding) return { ok: false }
    setDeleteError(null)
    setAddError(null)
    const missing = {}
    if (!draft.hook) missing.hook = requiredText(t('WEBHOOK_EVENT', 'Event'))
    if (!String(draft.url ?? '').trim()) missing.url = requiredText(t('URL', 'Url'))
    setFieldErrors(missing)
    if (missing.hook) { hookRef.current?.focus(); return { ok: false, invalid: true } }
    if (missing.url) { urlRef.current?.focus(); return { ok: false, invalid: true } }
    const result = await handleUpdateAddClick()
    if (!result?.ok) {
      if (mounted.current) setAddError(messageOf(t, result?.error, t('WEBHOOK_ADD_FAILED', 'The webhook could not be added.')))
      return { ok: false }
    }
    return { ok: true }
  }

  const submit = (event) => {
    event.preventDefault()
    return add()
  }

  // Unsaved work: the half-filled add form asks before the section or the editor closes (decision 4), like custom fields.
  const urlTyped = String(draft.url ?? '') !== ''
  const filled = [draft.hook, urlTyped, draft.delay].filter(Boolean).length
  const clearForm = () => {
    handleChangeSelect('', 'hook')
    handleChangeSelect('', 'url')
    handleChangeSelect('', 'delay')
    setFieldErrors({})
    setAddError(null)
  }
  useLeaveGuard({ dirty: filled > 0, count: Math.max(1, filled), save: add, discard: clearForm })

  const askDelete = (item, index, event) => {
    deleteOpener.current = { element: event.currentTarget, index }
    setDeleteError(null)
    setConfirmId(item.id)
  }

  const confirmDelete = async () => {
    const result = await handleDeleteWebhook(confirmId)
    if (!mounted.current) return
    setConfirmId(null)
    if (!result?.ok) {
      setDeleteError(messageOf(t, result?.error, t('WEBHOOK_DELETE_FAILED', 'The webhook could not be deleted.')))
    }
  }

  // Where the focus goes when the confirmation closes: the delete button it came from; if its row left with the delete, the one that
  // took its place (else the previous one); with no row left, the add form's Event select.
  const deleteFinalFocus = () => {
    const opener = deleteOpener.current
    if (opener?.element?.isConnected) return opener.element
    const buttons = listRef.current ? [...listRef.current.querySelectorAll('.odc-webhooks-remove')] : []
    return buttons[opener?.index] ?? buttons[(opener?.index ?? 0) - 1] ?? hookRef.current ?? true
  }

  const confirmWebhook = webhooks.find(webhook => webhook.id === confirmId)

  return (
    <div className='odc-webhooks'>
      <div className='odc-webhooks-head'>
        <h1 className='odc-webhooks-title'>{t('WEBHOOKS', 'Webhooks')}</h1>
        <p className='odc-webhooks-intro'>
          {t('WEBHOOKS_DESCRIPTION', 'A request is sent to the URL each time the event happens in this store.')}
        </p>
      </div>

      {deleteError && <InlineNotice className='odc-webhooks-notice' tone='danger' role='alert'>{deleteError}</InlineNotice>}

      {webhooks.length === 0
        ? (
          <EmptyState
            icon={Send}
            title={t('WEBHOOKS_EMPTY', 'No webhooks yet')}
            description={t('WEBHOOKS_EMPTY_HINT', 'Add one below to be notified when something happens in this store.')}
          />
          )
        : (
          <ul ref={listRef} className='odc-webhooks-list' aria-label={t('WEBHOOKS', 'Webhooks')}>
            {webhooks.map((webhook, index) => (
              <WebhookRow
                key={webhook.id}
                webhook={webhook}
                label={labelOf(webhook.hook)}
                // redesign bugs F row 37: two webhooks of one event get the URL in their control names, so none repeats
                nameLabel={webhooks.filter(other => labelOf(other.hook) === labelOf(webhook.hook)).length > 1
                  ? `${labelOf(webhook.hook)} (${webhook.url})`
                  : labelOf(webhook.hook)}
                delays={timeList}
                saving={(savingIds ?? (savingId != null ? [savingId] : [])).includes(webhook.id)}
                removing={deletingId === webhook.id}
                locked={deletingId != null}
                onChangeDelay={handleChangeDelay}
                onRemove={(item, event) => askDelete(item, index, event)}
                t={t}
              />
            ))}
          </ul>
          )}

      <form className='odc-webhooks-add' noValidate aria-labelledby='odc-webhooks-add-title' onSubmit={submit}>
        <h2 id='odc-webhooks-add-title' className='odc-webhooks-add-title'>{t('WEBHOOK_ADD_TITLE', 'Add a webhook')}</h2>
        <div className='odc-webhooks-fields'>
          <Field
            label={t('WEBHOOK_EVENT', 'Event')}
            required
            requiredLabel={t('REQUIRED', 'Required')}
            error={fieldErrors.hook}
            disabled={adding}
          >
            <select
              ref={hookRef}
              name='hook'
              className='odc-field-input odc-webhooks-select'
              value={draft.hook || ''}
              disabled={adding}
              onChange={(event) => { handleChangeSelect(event.target.value, 'hook'); setFieldErrors(current => ({ ...current, hook: undefined })) }}
            >
              {webhookList.map(option => <option key={option.value} value={option.value}>{option.content}</option>)}
            </select>
          </Field>
          <TextField
            ref={urlRef}
            name='url'
            type='url'
            inputMode='url'
            label={t('URL', 'Url')}
            required
            requiredLabel={t('REQUIRED', 'Required')}
            placeholder='https://'
            value={draft.url || ''}
            error={fieldErrors.url || undefined}
            disabled={adding}
            autoComplete='off'
            spellCheck={false}
            onChange={(next) => { handleChangeSelect(next ?? '', 'url'); setFieldErrors(current => ({ ...current, url: undefined })) }}
          />
          <Field label={t('WEBHOOK_DELAY', 'Delay')} disabled={adding}>
            <select
              name='delay'
              className='odc-field-input odc-webhooks-select'
              value={draft.delay || ''}
              disabled={adding}
              onChange={(event) => handleChangeSelect(event.target.value, 'delay')}
            >
              {timeList.map(option => <option key={option.value} value={option.value}>{option.content}</option>)}
            </select>
          </Field>
          <Button type='submit' variant='primary' icon={Plus} busy={adding} className='odc-webhooks-submit'>
            {t('ADD', 'Add')}
          </Button>
        </div>
        {addError && <InlineNotice className='odc-webhooks-notice' tone='danger' role='alert'>{addError}</InlineNotice>}
      </form>

      <ConfirmDialog
        open={confirmWebhook != null}
        title={t('WEBHOOK_DELETE_TITLE', 'Delete this webhook?')}
        confirmLabel={t('WEBHOOK_DELETE_CONFIRM', 'Delete webhook')} // redesign tanda AB (S-5): verb + object
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deletingId != null}
        finalFocus={deleteFinalFocus}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmId(null)}
      >
        {confirmWebhook && (
          <div className='odc-webhooks-confirm'>
            <p><bdi className='odc-webhooks-confirm-strong'>{labelOf(confirmWebhook.hook)}</bdi></p>
            <p><bdi className='odc-webhooks-confirm-strong'>{confirmWebhook.url}</bdi></p>
            <p>{t('WEBHOOK_DELETE_BODY', 'It stops sending requests to this URL right away.')}</p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

export const BusinessWebhooks = (props) => {
  const businessWebhooksProps = {
    ...props,
    asDashboard: true,
    UIComponent: BusinessWebhooksUI
  }
  return <BusinessWebhooksController {...businessWebhooksProps} />
}
