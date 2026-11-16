import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../contexts/LanguageContext'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { TriangleAlert } from '../Icon'
import { cx } from './classNames'
import { InlineNotice } from './FilterBar'
import { Switch } from './Switch'
import './async-switch.css'

// The first text of an API error: a string, `{ message }`, or a list of either.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

// redesign 2.G, promoted from the store list (StoreRowSwitch, SL-F1 A2, M-12)
/**
 * A Switch that saves at once and does not lie when the save fails. In `main`
 * a failed save left the switch in the flipped position with the old data and
 * nothing said so.
 *
 * It is CONTROLLED by the stored value (`checked`). On a press it calls
 * `onToggle(next)` and, while that runs, shows `next`, is busy (aria-busy) and
 * ignores further presses. `onToggle` may return a promise: `{ ok: false, error }`
 * or a throw is a failure; anything else (`undefined`, `{ ok: true }`) is a
 * success, and the consumer's stored value is what shows afterwards. On a
 * failure the switch shows the stored value again and a danger notice below it
 * says why: the API message translated with `translateApiMessage`, or
 * `failureText` when the error has no text. A new press clears the notice, and
 * so does a change of `checked` from outside (another control saved
 * it, a refresh brought it): the notice is about the value stored when the save
 * failed, and it does not come back if that value returns.
 *
 * No text of its own: `failureText` is required (`== null` throws; '' paints
 * empty) and the name comes as in Switch (`label` or `children`). `className`
 * goes to the wrapper (switch and notice); the ref and other props go to the
 * Switch, except the ones the save owns (`onCheckedChange`, `defaultChecked`,
 * `readOnly`, `data-busy`), which are dropped. `busy` (or `aria-busy`, unless
 * it is `false`) is the consumer's own: it saves the same record from another
 * control (a row and the header of its panel) and says so. The switch is busy
 * for that too (AB-S02), in addition to its own save, and takes no
 * press meanwhile; by default, with neither, it is idle as before.
 * `useLanguage` is only for the API message, as in AlertDialog.
 *
 * redesign an OPT-IN question before the save. With `confirmChange(next) => boolean | Promise<boolean>` a press
 * first awaits it (a ConfirmDialog from the consumer, usually). A falsy answer, or a throw, is «no»: nothing happens (no
 * `onToggle`, the switch keeps showing the stored value, it is not busy, and a failure notice already there stays as it was).
 * A truthy answer is the normal flow above. While the question is open the switch is NOT shown flipped nor busy, and it
 * ignores further presses. Without the prop nothing changes.
 */
export const AsyncSwitch = React.forwardRef(function ProductAsyncSwitch ({
  checked,
  onToggle,
  confirmChange,
  failureText,
  className,
  busy: consumerBusy,
  'aria-busy': consumerAriaBusy,
  /* eslint-disable no-unused-vars */
  onCheckedChange: _onCheckedChange,
  defaultChecked: _defaultChecked,
  readOnly: _readOnly,
  'data-busy': _dataBusy,
  /* eslint-enable no-unused-vars */
  ...props
}, ref) {
  if (failureText == null) throw new Error('AsyncSwitch needs a failureText')
  const [, t] = useLanguage()
  const [pending, setPending] = useState(null) // the value being saved; null when nothing is
  const [failure, setFailure] = useState(null) // { error, before }: `before` is the stored value when the save failed
  const confirming = useRef(false) // synchronous: a second press before the render still finds the open question
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const busy = pending !== null
  // AB-S02: the consumer's busy is kept (it used to be dropped); `aria-busy='false'` is not busy
  const consumerIsBusy = Boolean(consumerBusy) || (consumerAriaBusy != null && consumerAriaBusy !== false && consumerAriaBusy !== 'false')
  const stored = Boolean(checked)
  const storedRef = useRef(stored) // read after the question, when the render of the press is old
  storedRef.current = stored
  // (R1-05 of ): the stored value changed from outside after a failure, so the notice is old. It is hidden
  // in this same render (no frame with an old notice beside a new value) and dropped, so the old value coming back does not
  // bring it back.
  const failureIsCurrent = failure !== null && failure.before === stored
  useEffect(() => {
    if (failure !== null && !busy && !failureIsCurrent) setFailure(null)
  }, [failure, busy, failureIsCurrent])

  const handleChange = async (next) => {
    if (busy || confirming.current) return
    // redesign the question comes first; «no» (falsy, a throw) leaves everything where it was
    if (confirmChange) {
      confirming.current = true
      let confirmed = false
      try {
        confirmed = Boolean(await confirmChange(next))
      } catch (error) {
        confirmed = false
      }
      confirming.current = false
      if (!confirmed || !mounted.current) return
    }
    const before = storedRef.current
    setFailure(null)
    setPending(next)
    let result
    try {
      result = await onToggle(next)
    } catch (error) {
      result = { ok: false, error }
    }
    // the consumer may unmount it while it saves (a disabled store leaves the Active tab with its row)
    if (!mounted.current) return
    setPending(null)
    if (result && result.ok === false) setFailure({ error: result.error, before })
  }

  return (
    <span className={cx('odc-async-switch', className)} data-failed={failureIsCurrent ? '' : undefined}>
      <Switch
        ref={ref}
        {...props}
        checked={busy ? pending : stored}
        busy={busy || consumerIsBusy}
        onCheckedChange={handleChange}
      />
      {failureIsCurrent && (
        <InlineNotice tone='danger' icon={TriangleAlert} role='alert' className='odc-async-switch-notice'>
          {translateApiMessage(t, firstMessage(failure.error), failureText)}
        </InlineNotice>
      )}
    </span>
  )
})
