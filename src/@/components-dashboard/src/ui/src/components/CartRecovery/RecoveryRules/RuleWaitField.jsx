import React, { useId, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { WAIT_UNITS, formatWait, splitWait, toSeconds } from '../../../../../utils/recoveryRules'
import { CircleAlert } from '../../Shared/Icon'
import { NumberField, SegmentedControl } from '../../Shared/Product'
import './recovery-rule-panel.css'

// redesign RA-B3 (decision 4; M-RA11): how long a rule waits, as an AMOUNT and a UNIT (Seconds, Minutes, Hours, Days) instead of the three
// native selects of main (hh:mm:ss up to 23:59:59, or a number of days). The equivalence under the field is always there.
// A map of LITERAL t() calls (never a built key), so the i18n scanner sees them
const UNIT_LABELS = {
  seconds: (t) => t('SECONDS', 'Seconds'),
  minutes: (t) => t('MINUTES', 'Minutes'),
  hours: (t) => t('HOURS', 'Hours'),
  days: (t) => t('DAYS', 'Days')
}

// The amount is an integer >= 0 with no digit grouping («15600», never «15,600»), whatever the language
const AMOUNT_FORMAT = { maximumFractionDigits: 0, useGrouping: false }

// The figure goes in a node of its own (`odc-figure`, decision 11); the words around it are the translation's
const withFigure = (template, figure) => {
  const [before, ...rest] = template.split('_wait_')
  if (rest.length === 0) return template
  return (
    <>
      {before}
      <span className='odc-figure'>{figure}</span>
      {rest.join('_wait_')}
    </>
  )
}

/**
 * The wait of a rule. Props:
 *  - `seconds`: the wait in seconds (number) or null/undefined when there is none. It is split into the LARGEST exact unit on mount and
 *    whenever it changes from OUTSIDE (the rule was reloaded); an echo of what this field just reported does not split again, so 120
 *    seconds stays «120 Seconds» while the person types it;
 *  - `onChange(seconds | null)`: every change reports the wait in seconds, or null when the amount is empty or not an integer >= 0.
 *    Changing the unit KEEPS the number;
 *  - `allowZero` (default true): editing accepts 0 (main saves it), creating does not. The host owns the rule and its message (`error`);
 *    here a 0 with `allowZero=false` only paints the field invalid;
 *  - `error`: the host's message, drawn under the field (a role=alert) with the number marked invalid;
 *  - `disabled`.
 */
export const RuleWaitField = ({ seconds, onChange, allowZero = true, error, disabled = false }) => {
  const [languageState, t] = useLanguage()
  const locale = languageState?.language?.code
  const ids = { label: useId(), error: useId() }

  const outside = seconds ?? null
  const [draft, setDraft] = useState(() => splitWait(outside))
  const [seen, setSeen] = useState(outside)
  // A change of `seconds` that is not what the field reports is a change from outside: split it again, in this same render
  if (seen !== outside) {
    setSeen(outside)
    if (toSeconds(draft.amount, draft.unit) !== outside) setDraft(splitWait(outside))
  }

  const value = toSeconds(draft.amount, draft.unit)
  const report = (next) => {
    setDraft(next)
    onChange?.(toSeconds(next.amount, next.unit))
  }
  const invalid = Boolean(error) || (!allowZero && draft.amount === 0)
  const label = t('RECOVERY_RULES_SEND_AFTER', 'Send after')

  return (
    <div className='odc-root odc-ra-wait' data-allow-zero={allowZero ? '' : undefined}>
      <span id={ids.label} className='odc-ra-wait-label'>{label}</span>
      <div className='odc-ra-wait-row'>
        <div className='odc-ra-wait-amount'>
          <NumberField
            aria-label={label}
            aria-describedby={error ? ids.error : undefined}
            value={draft.amount}
            onChange={(amount) => report({ ...draft, amount })}
            min={0}
            step={1}
            format={AMOUNT_FORMAT}
            locale={locale}
            disabled={disabled}
            invalid={invalid}
          />
        </div>
        {/* SegmentedControl has no `disabled`: a disabled fieldset (a plain wrapper for AT) disables the buttons inside it */}
        <fieldset className='odc-ra-wait-unit' role='none' disabled={disabled}>
          <SegmentedControl
            label={label}
            value={draft.unit}
            onValueChange={(unit) => report({ ...draft, unit })}
            options={WAIT_UNITS.map(unit => ({ value: unit, label: UNIT_LABELS[unit](t) }))}
          />
        </fieldset>
      </div>
      {error && (
        <p id={ids.error} className='odc-ra-field-error' role='alert'>
          <CircleAlert className='odc-icon odc-ra-field-error-icon' aria-hidden='true' />
          <span>{error}</span>
        </p>
      )}
      {/* redesign RA-I2 (live check): with no wait yet there is no equivalence to write («= — after…» read as a broken line) */}
      {formatWait(value, locale) && (
        <p className='odc-ra-wait-equals'>
          {withFigure(t('RECOVERY_RULES_WAIT_EQUALS', '= _wait_ after the customer last opened the cart'), formatWait(value, locale))}
        </p>
      )}
    </div>
  )
}
