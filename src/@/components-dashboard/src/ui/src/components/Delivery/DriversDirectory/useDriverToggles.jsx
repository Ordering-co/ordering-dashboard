import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { AlertDialog, ConfirmDialog } from '../../Shared/Product'
import { driverName } from './driverData'

// redesign DL-B2 (decision 4; defect M-DL3): the three switches of a driver (Active, Online, Busy) of the drivers list and of the
// panel's status strip.
//
// redesign D-1 (owner, 2026-10-19, decision 25 C8; P-9 approved): with `confirmDeactivate` on, deactivating
// (`enabled: false`) goes through a ConfirmDialog (tone danger) with the initial focus on Cancel, like useCustomerActiveToggle:
//   title        t('DRIVERS_DEACTIVATE_TITLE', 'Deactivate _name_?')
//   body         t('DRIVERS_DEACTIVATE_BODY', 'The account becomes inactive. You can activate it again at any time.')
//   confirm      t('DRIVERS_DEACTIVATE_CONFIRM', 'Deactivate driver')
// Cancel writes nothing and leaves the switch where it was. Activating, Online and Busy stay immediate. Without the option
// (default) everything is immediate, as in `main`.
// redesign (n.º 26, D-86): the drivers MANAGERS list asks too (it passes `confirmDeactivate` and `managers`): same title
// and body (neither says «driver»), and the confirm button says t('DRIVERS_MANAGERS_DEACTIVATE_CONFIRM', 'Deactivate driver manager').
//
// Never optimistic: the switch is controlled by the row the host passes, so it does not move until the API says ok. The
// controllers (`handleChangeActiveUser`, `handleChangeAvailable`, `handleChangeBusyUser`, DL-B1) resolve `{ ok, error, user }`;
// with `ok: false` (or a throw) an AlertDialog tells the person and the switch stays where it was. A controller that resolves
// nothing (the legacy one) counts as done.
//
// Returns `{ onToggle(user, attribute, next), pendingKeys, dialogs }`: `pendingKeys` are `${id}:${attribute}` in flight (the
// switch shows them busy); `dialogs` is a node the host renders once. `onUpdated(id, { [attribute]: value })` follows an ok,
// with the value the API returned in `user`, or `next` when it returned none: the page uses it for the open
// record that is not in the list.

// Plain strings out of what the controller left as `error` (a string, a list, a list of lists); empty means «say the default»
const messagesOf = (error) => {
  const list = Array.isArray(error) ? error.flat(Infinity) : [error]
  return list.filter(item => typeof item === 'string' && item.trim() !== '')
}

// attribute → the controller that changes it (its payload key is the attribute itself); any other is not a switch of this list
const ROUTES = {
  enabled: 'handleChangeActiveUser',
  available: 'handleChangeAvailable',
  busy: 'handleChangeBusyUser'
}

export const useDriverToggles = ({ handleChangeActiveUser, handleChangeAvailable, handleChangeBusyUser, onUpdated, confirmDeactivate = false, managers = false } = {}) => {
  const [, t] = useLanguage()
  const [pendingKeys, setPendingKeys] = useState([])
  // The driver stays in `confirm` while the dialog fades out, so its title does not go blank
  const [confirm, setConfirm] = useState({ open: false, user: null })
  const [failure, setFailure] = useState({ open: false, content: [] })
  const inFlight = useRef(new Set()) // synchronous: a second press before the render still finds the first one
  const latest = useRef({})
  latest.current = { handleChangeActiveUser, handleChangeAvailable, handleChangeBusyUser, onUpdated }
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const run = async (user, attribute, next) => {
    const route = ROUTES[attribute]
    if (!user || !route) return
    const key = `${user.id}:${attribute}`
    if (inFlight.current.has(key)) return
    inFlight.current.add(key)
    setPendingKeys(keys => [...keys, key])
    let result
    try {
      result = await latest.current[route]?.({ id: user.id, [attribute]: next })
    } catch (error) {
      result = { ok: false, error: null }
    }
    inFlight.current.delete(key)
    const failed = !!result && result.ok === false
    // the page hears the state the API returned (`result.user`), or what was asked when it returned none
    const returned = result?.user && typeof result.user === 'object' ? result.user[attribute] : undefined
    const value = typeof returned === 'boolean' ? returned : next
    // The change happened on the server even if this host is gone: the page that asked still hears it
    if (!failed) latest.current.onUpdated?.(user.id, { [attribute]: value })
    if (!mounted.current) return
    setPendingKeys(keys => keys.filter(item => item !== key))
    if (failed) {
      const messages = messagesOf(result.error)
      setFailure({
        open: true,
        content: messages.length > 0 ? messages : [t('DRIVERS_STATUS_ERROR', 'Something went wrong. Try again.')]
      })
    }
  }

  const onToggle = (user, attribute, next) => {
    // redesign D-1 (owner, 2026-10-19), (n.º 26): deactivating a driver or a manager asks first
    if (confirmDeactivate && attribute === 'enabled' && next === false && user && !inFlight.current.has(`${user.id}:${attribute}`)) {
      setConfirm({ open: true, user })
      return undefined
    }
    return run(user, attribute, next)
  }

  const cancel = () => setConfirm(current => ({ ...current, open: false }))
  const accept = () => {
    const { user } = confirm
    cancel()
    if (user) run(user, 'enabled', false)
  }

  const dialogs = (
    <>
      {confirmDeactivate && (
        <ConfirmDialog
          open={confirm.open}
          title={t('DRIVERS_DEACTIVATE_TITLE', 'Deactivate _name_?').replace('_name_', () => (confirm.user ? driverName(confirm.user, t) : ''))}
          confirmLabel={managers ? t('DRIVERS_MANAGERS_DEACTIVATE_CONFIRM', 'Deactivate driver manager') : t('DRIVERS_DEACTIVATE_CONFIRM', 'Deactivate driver')}
          cancelLabel={t('CANCEL', 'Cancel')}
          closeLabel={t('CLOSE', 'Close')}
          tone='danger'
          onConfirm={accept}
          onCancel={cancel}
        >
          {t('DRIVERS_DEACTIVATE_BODY', 'The account becomes inactive. You can activate it again at any time.')}
        </ConfirmDialog>
      )}
      <AlertDialog
        open={failure.open}
        title={t('DRIVERS_STATUS_ERROR_TITLE', "The status didn't change")}
        content={failure.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setFailure(current => ({ ...current, open: false }))}
      />
    </>
  )

  return { onToggle, pendingKeys, dialogs }
}
