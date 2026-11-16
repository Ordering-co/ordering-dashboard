import React from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import styled, { css } from 'styled-components'

import { resolveFieldTheme } from '../../../styles/fieldsTheme'
import { TabActionBridge } from './tab-action-bridge'
import './confirm-admin.css'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-confirm-admin-${key}`, String(value)])
)

const confirmAdminStyle = (theme, props = {}) => {
  const roles = resolveFieldTheme(theme)
  return variables({
    surface: roles.surface,
    text: roles.text,
    muted: roles.textMuted,
    placeholder: roles.textSubtle,
    border: roles.border,
    focus: roles.focus,
    action: roles.actionContent,
    font: roles.fontFamily,
    'font-size': roles.fontSize,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    'touch-target': roles.touchTarget,
    'tab-color': props.active ? roles.text : roles.textMuted,
    'tab-border-width': props.active ? '1px' : '0px',
    'resend-color': props.disabled ? roles.textMuted : roles.actionContent,
    'resend-cursor': props.disabled ? 'not-allowed' : 'pointer'
  })
}

const ResendElement = React.forwardRef(({ component: Component = 'span', cosmeticDisabled, literalAs, ...props }, ref) => (
  <Component
    {...props}
    ref={ref}
    {...(cosmeticDisabled ? { disabled: 'disabled' } : {})}
    {...(literalAs ? { as: literalAs } : {})}
  />
))
ResendElement.displayName = 'OrderingConfirmAdminResendElement'

const ResendAction = React.forwardRef((componentProps, ref) => {
  const props = { ...componentProps }
  const Component = 'span'
  const literalAs = props.as ?? props.forwardedAs
  const disabled = props.disabled
  for (const key of ['as', 'disabled', 'forwardedAs', 'nativeButton', 'render', 'theme']) delete props[key]
  return (
    <ButtonPrimitive
      {...props}
      ref={ref}
      disabled={false}
      nativeButton={false}
      render={<ResendElement component={Component} cosmeticDisabled={disabled} literalAs={literalAs} />}
    />
  )
})
ResendAction.displayName = 'OrderingConfirmAdminResendAction'

export const WrapperCheckPassword = styled.form.attrs({
  className: 'od-ui od-confirm-admin-form'
})`
  ${props => confirmAdminStyle(props.theme, props)}
`

export const FormController = styled.div.attrs({
  className: 'od-ui od-confirm-admin-form-control'
})`
  ${props => confirmAdminStyle(props.theme, props)}
`

export const Tabs = styled.div.attrs({
  className: 'od-ui od-confirm-admin-tabs'
})`
  ${props => confirmAdminStyle(props.theme, props)}
`

export const Tab = styled(TabActionBridge).attrs({
  className: 'od-ui od-confirm-admin-tab'
})`
  ${props => confirmAdminStyle(props.theme, props)}
  ${props => props.theme?.rtl
? css`margin-left: 15px;`
: css`margin-right: 15px;`}
`

export const CountdownTimer = styled.div.attrs({
  className: 'od-ui od-confirm-admin-countdown'
})`
  ${props => confirmAdminStyle(props.theme, props)}
`

export const OtpWrapper = styled.div.attrs({
  className: 'od-ui od-confirm-admin-otp'
})`
  ${props => confirmAdminStyle(props.theme, props)}
`

export const ResendCode = styled(ResendAction).attrs({
  className: 'od-ui od-confirm-admin-resend'
})`
  ${props => confirmAdminStyle(props.theme, props)}
`
