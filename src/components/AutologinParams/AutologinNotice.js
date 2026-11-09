import { useEffect } from 'react'
import { ToastType, useLanguage, useToast } from '~components'
import { consumeAutologinNotice, HANDOFF_EXPIRED_NOTICE } from './autologinSession'

// Shows the outcome of a failed access link once the toast provider exists.
export const AutologinNotice = () => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  useEffect(() => {
    if (consumeAutologinNotice() !== HANDOFF_EXPIRED_NOTICE) return
    showToast?.(ToastType.Error, t('ACCESS_LINK_EXPIRED', 'The access link expired. Request a new one.'), 6000)
  }, [])

  return null
}
