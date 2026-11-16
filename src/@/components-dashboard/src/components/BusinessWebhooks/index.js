import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

// redesign stores 5.16 (; G2-39, G2-40): the webhooks of Store details › Webhooks. Adding, changing a delay and deleting
// say how they went, `{ ok: true, result }` or `{ ok: false, error: [messages] }` (the API's messages, or the network's), and each
// has its own busy state (`adding`, `savingIds` (every row saving; `savingId` is the latest of them), `deletingId`) so one row's
// request never flags the others. Nothing throws. A failed
// request merges nothing into the store. Same requests as before: POST /business/:id/webhooks { hook, url, delay? }, PUT
// /business/:id/webhooks/:wid with the whole webhook and the new delay, DELETE /business/:id/webhooks/:wid; same toasts.

const toMessages = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .filter(Boolean)

/**
 * Component to manage Busness webhook behavior without UI component
 */
export const BusinessWebhooks = (props) => {
  const {
    UIComponent,
    business,
    handleSuccessUpdate
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  // The draft of the add form: { hook, url, delay }. The saved webhooks belong to the shell (`business.webhooks`).
  const [formState, setFormState] = useState({ changes: {}, result: { error: false } })
  const [adding, setAdding] = useState(false)
  // Every row whose PUT is out, in the order they started (two rows can save at once: one answering never unlocks the other).
  // `savingId` stays for readers of the old prop: the most recent row still saving.
  const [savingIds, setSavingIds] = useState([])
  const savingId = savingIds.length ? savingIds[savingIds.length - 1] : null
  const [deletingId, setDeletingId] = useState(null)

  // Two requests can be out at once (two rows). Each one merges into the latest store the shell handed us, never into the one
  // of the render it was started in, so the second answer does not drop what the first one changed.
  const latest = useRef(business)
  latest.current = business
  const commit = (update) => {
    const next = { ...latest.current, webhooks: update([...(latest.current?.webhooks || [])]) }
    latest.current = next
    handleSuccessUpdate && handleSuccessUpdate(next)
  }

  const request = async (method, path, body) => {
    try {
      const response = await fetch(`${ordering.root}/business/${business?.id}/webhooks${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      })
      const content = await response.json()
      if (content?.error) return { ok: false, error: toMessages(content.result) }
      return { ok: true, result: content?.result }
    } catch (err) {
      return { ok: false, error: toMessages(err?.message) }
    }
  }

  /**
   * Adds the webhook of the add form. The delay is sent only when one was chosen.
   */
  const handleUpdateAddClick = async () => {
    const { delay, ...changes } = formState.changes
    const body = delay === undefined || delay === '' || delay === null ? changes : { ...changes, delay }
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    setAdding(true)
    const outcome = await request('POST', '', body)
    setAdding(false)
    if (!outcome.ok) {
      setFormState(current => ({ ...current, result: { error: true, result: outcome.error } }))
      return outcome
    }
    setFormState({ changes: {}, result: { error: false } })
    commit(webhooks => [...webhooks, outcome.result])
    showToast(ToastType.Success, t('WEBHOOK_ADDED', 'Webhook added'))
    return outcome
  }

  /**
   * Changes the delay of one webhook: PUT with the whole webhook and the new delay. Only that row is in `savingIds`.
   */
  const handleChangeDelay = async (value, webhook) => {
    const id = webhook?.id
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    setSavingIds(current => [...current.filter(item => item !== id), id])
    const outcome = await request('PUT', `/${id}`, { ...webhook, delay: value })
    setSavingIds(current => current.filter(item => item !== id))
    if (!outcome.ok) return outcome
    const delay = outcome.result?.delay !== undefined ? outcome.result.delay : value
    commit(webhooks => webhooks.map(item => (item.id === id ? { ...item, delay } : item)))
    showToast(ToastType.Success, t('WEBHOOK_UPDATED', 'Webhook updated'))
    return outcome
  }

  /**
   * Deletes one webhook. Only that one is `deletingId`.
   */
  const handleDeleteWebhook = async (id) => {
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    setDeletingId(id)
    const outcome = await request('DELETE', `/${id}`)
    setDeletingId(current => (current === id ? null : current))
    if (!outcome.ok) return outcome
    commit(webhooks => webhooks.filter(item => item.id !== id))
    showToast(ToastType.Success, t('WEBHOOK_DELETED', 'Webhook deleted'))
    return outcome
  }

  /**
   * Update the add form from an input event (`name` and `value` of the target)
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    const currentChanges = {
      [e.target.name]: e.target.value
    }

    setFormState(current => ({
      ...current,
      changes: { ...current.changes, ...currentChanges }
    }))
  }

  /**
   * Update the add form from a value
   * @param {string} value selected data from select
   * @param {string} name field name: hook, url or delay
   */
  const handleChangeSelect = (value, name) => {
    setFormState(current => ({
      ...current,
      changes: { ...current.changes, [name]: value }
    }))
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          hookFormState={formState}
          adding={adding}
          savingId={savingId}
          savingIds={savingIds}
          deletingId={deletingId}
          handleChangeInput={handleChangeInput}
          handleChangeSelect={handleChangeSelect}
          handleUpdateAddClick={handleUpdateAddClick}
          handleDeleteWebhook={handleDeleteWebhook}
          handleChangeDelay={handleChangeDelay}
        />
      )}
    </>
  )
}

BusinessWebhooks.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Object for a business
   */
  business: PropTypes.object,
  /**
   * Function to set a business state
   */
  handleSuccessUpdate: PropTypes.func
}
