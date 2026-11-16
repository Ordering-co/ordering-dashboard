import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../index'
import { AlertDialog, ConfirmDialog } from '../components/Shared/Product'

// redesign BO-B2 (promoted from Users/CustomersDirectory/useCustomerActiveToggle; originally redesign UC-B2, decision 5 /
// decision 25 C8, defect M-10): the status switch of a users list, with the texts and the confirmation left to the caller.
// Activating is immediate. Deactivating either asks first (`confirmDeactivate` given: a ConfirmDialog with the initial focus on
// Cancel) or is immediate too (`confirmDeactivate: null`).
// The controller (`handleChangeActiveUser`) resolves `{ ok, error }`; when it says `ok: false` (or throws) an AlertDialog tells the
// person. The switch is controlled by `user.enabled` in the host, so a failure leaves it where it was: the interface never lies.
// A controller that resolves nothing (the legacy one) counts as done.
//
// Options (every text is already translated by the caller):
//   handleChangeActiveUser  `({ id, enabled }) => Promise<{ ok, error } | void>`
//   confirmDeactivate       `null`, or `{ title: (user) => string, body, confirmLabel }`. `user` is the one being confirmed and
//                           may be `null` while the dialog is closed, so `title` must not assume it.
//   failureTitle            the title of the alert that says the status did not change
//   failureFallback         the one line of that alert when the controller gave no message of its own
//
// Returns `{ onToggleActive(user, enabled), pendingIds, dialogs }`: `pendingIds` are the ids whose call is in flight (the
// switch shows them busy); `dialogs` is a node the host renders once.

// Plain strings out of what the controller left as `error` (a string, a list, a list of lists); empty means «say the default»
const messagesOf = (error) => {
  const list = Array.isArray(error) ? error.flat(Infinity) : [error]
  return list.filter(item => typeof item === 'string' && item.trim() !== '')
}

export const useActiveToggle = ({ handleChangeActiveUser, confirmDeactivate = null, failureTitle, failureFallback } = {}) => {
  const [, t] = useLanguage()
  const [pendingIds, setPendingIds] = useState([])
  // The user stays in `confirm` while the dialog fades out, so its title does not go blank. `token` is the
  // ConfirmAdmin confirmation_token (admin kinds only): it waits here through the deactivate
  // ConfirmDialog, if there is one, and travels to the controller only once that second question is answered.
  const [confirm, setConfirm] = useState({ open: false, user: null, token: undefined })
  const [failure, setFailure] = useState({ open: false, content: [] })
  const inFlight = useRef(new Set()) // synchronous: a second press before the render still finds the first one
  const handleRef = useRef(handleChangeActiveUser)
  handleRef.current = handleChangeActiveUser
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const run = async (user, enabled, confirmationToken) => {
    if (inFlight.current.has(user.id)) return
    inFlight.current.add(user.id)
    setPendingIds(ids => [...ids, user.id])
    let result
    try {
      result = await handleRef.current?.({ id: user.id, enabled, ...(confirmationToken ? { confirmationToken } : {}) })
    } catch (error) {
      result = { ok: false, error: null }
    }
    inFlight.current.delete(user.id)
    if (!mounted.current) return
    setPendingIds(ids => ids.filter(id => id !== user.id))
    if (result && result.ok === false) {
      const messages = messagesOf(result.error)
      setFailure({
        open: true,
        content: messages.length > 0 ? messages : [failureFallback]
      })
    }
  }

  const onToggleActive = (user, enabled, confirmationToken) => {
    if (!user) return
    if (enabled || !confirmDeactivate) {
      run(user, enabled, confirmationToken)
      return
    }
    if (inFlight.current.has(user.id)) return
    setConfirm({ open: true, user, token: confirmationToken })
  }

  const cancel = () => setConfirm(current => ({ ...current, open: false }))
  const accept = () => {
    const { user, token } = confirm
    cancel()
    if (user) run(user, false, token)
  }

  const dialogs = (
    <>
      {confirmDeactivate && (
        <ConfirmDialog
          open={confirm.open}
          title={confirmDeactivate.title(confirm.user)}
          confirmLabel={confirmDeactivate.confirmLabel}
          cancelLabel={t('CANCEL', 'Cancel')}
          closeLabel={t('CLOSE', 'Close')}
          tone='danger'
          onConfirm={accept}
          onCancel={cancel}
        >
          {confirmDeactivate.body}
        </ConfirmDialog>
      )}
      <AlertDialog
        open={failure.open}
        title={failureTitle}
        content={failure.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setFailure(current => ({ ...current, open: false }))}
      />
    </>
  )

  return { onToggleActive, pendingIds, dialogs }
}
