import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../index'
import { ConfirmDialog } from '../components/Shared/Product'

// redesign (owner decision 25, C8): the confirmation step the screens share, with the texts left to the caller.
// `ask({ title, body, confirmLabel, tone })` opens ONE ConfirmDialog (initial focus on Cancel, as ConfirmDialog does) and
// resolves `true` on confirm, `false` on Cancel, Close or Escape. Cancel writes nothing: the caller just does not go on.
// `tone` is `'danger'` (default, for what destroys or cuts service) or `'primary'` (create, duplicate, turn on).
// Asking while one is open closes that one: its promise resolves `false`. If the host unmounts with one pending, it resolves
// `false` too, so nothing waits forever.
//
// Every text is already translated by the caller; the labels of Cancel and Close come from here.
//
// Returns `{ ask, dialog }`: `dialog` is a node the host renders once.

export const useConfirmStep = () => {
  const [, t] = useLanguage()
  // The texts stay in `step` while the dialog fades out, so its title does not go blank
  const [step, setStep] = useState({ open: false, title: '', body: null, confirmLabel: '', tone: 'danger' })
  const resolver = useRef(null) // the `resolve` of the ask in flight; null when none is

  const settle = (answer) => {
    const resolve = resolver.current
    resolver.current = null
    setStep(current => ({ ...current, open: false }))
    if (resolve) resolve(answer)
  }

  const ask = ({ title, body, confirmLabel, tone = 'danger' }) => {
    if (resolver.current) resolver.current(false) // the previous ask is over; the dialog just takes the new texts
    return new Promise(resolve => {
      resolver.current = resolve
      setStep({ open: true, title, body, confirmLabel, tone })
    })
  }

  useEffect(() => () => {
    const resolve = resolver.current
    resolver.current = null
    if (resolve) resolve(false)
  }, [])

  const dialog = (
    <ConfirmDialog
      open={step.open}
      title={step.title}
      confirmLabel={step.confirmLabel}
      cancelLabel={t('CANCEL', 'Cancel')}
      closeLabel={t('CLOSE', 'Close')}
      tone={step.tone}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    >
      {step.body}
    </ConfirmDialog>
  )

  return { ask, dialog }
}
