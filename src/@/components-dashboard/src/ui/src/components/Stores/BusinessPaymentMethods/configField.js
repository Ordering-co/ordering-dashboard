import { useEffect } from 'react'
import { useLanguage, useToast, ToastType } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'

// redesign stores 1.B (G4-25): a business config typed into a field (Stripe Link's Twilio secrets, a
// wallet's password config) is saved once, when the field is left, or with Enter or Escape, and only if it changed.
// It used to POST on every keystroke, so a half-typed credential was stored on the way. Escape saves too because it
// can close the whole editor before the field blurs. The last value sent is kept on the field so it is not sent twice.
const commitIfChanged = (input, savedValue, onCommit) => {
  const value = input.value
  if (value === (savedValue ?? '') || value === input.dataset.committed) return
  input.dataset.committed = value
  onCommit(value)
}

export const commitOnBlur = (savedValue, onCommit) => (e) => commitIfChanged(e.target, savedValue, onCommit)

export const commitOnKeyDown = (savedValue, onCommit) => (e) => {
  if (e.key === 'Escape') commitIfChanged(e.currentTarget, savedValue, onCommit)
  if (e.key !== 'Enter') return
  e.preventDefault()
  e.currentTarget.blur()
}

// redesign stores 1.B (G4-25): the config controllers keep a failed save in `actionState.error`, which nothing showed.
export const useConfigSaveError = (error) => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  useEffect(() => {
    if (!error) return
    const messages = (Array.isArray(error) ? error : [error])
      .map(message => translateApiMessage(t, message, null))
      .filter(Boolean)
    showToast(ToastType.Error, messages.length ? messages.join(', ') : t('ERROR', 'Error'))
  }, [error])
}
