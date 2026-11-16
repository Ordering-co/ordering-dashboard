import React, { useState } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { SelectField } from '../Product'

// redesign (K-1 of stores 5.12; Sponsor of stores 5.14): the recipient of a fee, a tax, a zone or a promotion (or its
// sponsor) is a Product select. Its visible label now names the select (the legacy one was announced by its value alone). The legacy
// logic stays: only a level-0 user sees it; with `showInherit` the first option is «Inherit», which is `null` in and out; without a
// value it shows `defaultValue`, else «Business» (or «Inherit» with `showInherit`). As the legacy select, a pick shows at once even
// when the owner does not hand the value back, and a new `value` or `defaultValue` from the owner wins again.

const INHERIT = 'inherit'

export const RecipientSelect = (props) => {
  const {
    value,
    defaultValue,
    onChange,
    showInherit = false,
    labelKey = 'RECIPIENT',
    labelFallback = 'Recipient',
    disabled = false
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()

  const resolved = value ?? defaultValue ?? (showInherit ? null : 'business')
  const [shown, setShown] = useState(resolved)
  const [owned, setOwned] = useState(resolved)
  if (!Object.is(owned, resolved)) {
    setOwned(resolved)
    setShown(resolved)
  }

  if (user?.level !== 0) return null

  const options = [
    ...(showInherit ? [{ value: INHERIT, label: t('INHERIT', 'Inherit') }] : []),
    { value: 'business', label: t('RECIPIENT_BUSINESS', 'Business') },
    { value: 'platform', label: t('RECIPIENT_PLATFORM', 'Platform') }
  ]

  const handleChange = (next) => {
    const picked = showInherit && next === INHERIT ? null : next
    setShown(picked)
    onChange?.(picked)
  }

  return (
    <SelectField
      label={t(labelKey, labelFallback)}
      options={options}
      value={shown === null ? INHERIT : shown}
      onValueChange={handleChange}
      disabled={disabled}
    />
  )
}
