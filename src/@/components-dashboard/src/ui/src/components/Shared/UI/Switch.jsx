import React, { useEffect, useState } from 'react'
import styled from 'styled-components'

import { resolveFieldTheme } from '../../../styles/fieldsTheme'
import { NativeInput, orderingFieldStyle } from './Input'
import './switch.css'

const switchVariables = theme => ({
  '--od-switch-checked-transform': theme?.rtl ? 'translateX(-11px)' : 'translateX(11px)'
})

const switchThumbVariables = theme => {
  const roles = resolveFieldTheme(theme)
  return {
    '--od-switch-thumb-own-surface': roles.surface,
    '--od-switch-thumb-own-surface-subtle': roles.surfaceSubtle,
    '--od-switch-thumb-own-border-strong': roles.borderStrong,
    '--od-switch-thumb-own-duration': String(roles.duration),
    '--od-switch-thumb-own-easing': roles.easing,
    '--od-switch-thumb-own-left': theme?.rtl ? 'auto' : '1px',
    '--od-switch-thumb-own-right': theme?.rtl ? '1px' : 'auto'
  }
}

export const SwitchContainer = styled.label.attrs({
  className: 'od-ui od-switch',
  'data-slot': 'switch'
})`
  ${props => orderingFieldStyle(props.theme)}
  ${props => switchVariables(props.theme)}
  flex-shrink: 0;
`

export const SwitchThumb = styled.span.attrs({
  className: 'od-switch-thumb',
  'data-slot': 'switch-thumb'
})`
  ${props => switchThumbVariables(props.theme)}
`

export const Switch = (props) => {
  const {
    defaultChecked,
    disabled,
    onChange,
    className,
    notAsync,
    ariaLabel // (main): a switch without a visible label names itself
  } = props
  const [checked, setChecked] = useState(Boolean(defaultChecked)) // main (618956639): a switch starts at its default value

  useEffect(() => {
    setChecked(defaultChecked)
  }, [defaultChecked])

  const handleCheckBoxChange = (event) => {
    event.stopPropagation()
    if (!notAsync) setChecked(event.target.checked)
    if (onChange) onChange(event.target.checked)
  }

  return (
    <SwitchContainer className={className} disabled={disabled}>
      <NativeInput
        compatibility='legacy'
        nativeValueCompatibility
        type='checkbox'
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={handleCheckBoxChange}
      />
      <SwitchThumb />
    </SwitchContainer>
  )
}
