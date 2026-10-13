import React from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { Select } from '../../../styles/Select/FirstSelect'
import { Container, Label } from './styles'

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

  if (user?.level !== 0) return null

  const options = [
    ...(showInherit
      ? [{
          value: 'inherit',
          content: t('INHERIT', 'Inherit')
        }]
      : []),
    {
      value: 'business',
      content: t('RECIPIENT_BUSINESS', 'Business')
    },
    {
      value: 'platform',
      content: t('RECIPIENT_PLATFORM', 'Platform')
    }
  ]

  const resolvedValue = value ?? defaultValue ?? (showInherit ? null : 'business')
  const selectValue = resolvedValue === null ? 'inherit' : resolvedValue

  const handleChange = (val) => {
    if (showInherit && val === 'inherit') {
      onChange(null)
      return
    }
    onChange(val)
  }

  return (
    <Container>
      <Label>{t(labelKey, labelFallback)}</Label>
      <Select
        defaultValue={selectValue}
        options={options}
        onChange={handleChange}
        isDisabled={disabled}
      />
    </Container>
  )
}
