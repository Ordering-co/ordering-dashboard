import { useSyncExternalStore } from 'react'
import { PHONE_DOWN_PX } from '../../../../../utils/breakpoints' // redesign W0-5 (T0-17)

// redesign W0-7 (T0-28): the phone breakpoint hook, promoted from DateRangePopover (DatePicker used a copy).
// Phones get a bottom sheet: the same breakpoint as the order cards (the cards of RecordCard, W1-1).
const PHONE_QUERY = PHONE_DOWN_PX // (max-width: 767px), the form the stylesheets use

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

const subscribePhone = (listener) => {
  if (!canMatch()) return () => {}
  const media = window.matchMedia(PHONE_QUERY)
  // redesign W1-1 (T1-1): a matchMedia that answers nothing (a test double) reads as «not a phone», as the cards' own hook did
  if (!media) return () => {}
  if (media.addEventListener) {
    media.addEventListener('change', listener)
    return () => media.removeEventListener?.('change', listener)
  }
  media.addListener?.(listener) // old engines
  return () => media.removeListener?.(listener)
}
const phoneSnapshot = () => canMatch() && window.matchMedia(PHONE_QUERY)?.matches === true

export const useIsPhone = () => useSyncExternalStore(subscribePhone, phoneSnapshot, () => false)
