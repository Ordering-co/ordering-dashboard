// Adapted from shadcn/ui base input and textarea, commit
// 7c9eaba1c0a6404c990c144a654792e3313c650d. Ordering.co wrappers retain
// native dashboard contracts and own the Base UI primitive boundary.
import React from 'react'
import styled, { css } from 'styled-components'
import { Input as InputPrimitive } from '@base-ui/react/input'

import { resolveFieldTheme } from '../../../styles/fieldsTheme'
import { Button } from './Button'
import './fields.css'

const classNames = (...values) => [...new Set(
  values.filter(Boolean).flatMap(value => String(value).split(/\s+/)).filter(Boolean)
)].join(' ')

const INPUT_STYLE_PROPS = new Set([
  'compatibility',
  'fieldVariant',
  'nativeValueCompatibility',
  'selectionVariant',
  'theme',
  'w'
])

const stripInputStyleProps = props => Object.fromEntries(
  Object.entries(props).filter(([key]) => !INPUT_STYLE_PROPS.has(key))
)

const CompatibleInputElement = React.forwardRef(({
  hasNativeDefaultValue,
  hasNativeValue,
  nativeDefaultValue,
  nativeValue,
  preserveNativeValue,
  removeGeneratedId,
  ...componentProps
}, ref) => {
  const props = { ...componentProps }
  if (removeGeneratedId) delete props.id
  if (preserveNativeValue) {
    if (hasNativeValue) props.value = nativeValue
    else delete props.value
    if (hasNativeDefaultValue) props.defaultValue = nativeDefaultValue
    else delete props.defaultValue
  }
  return <input {...props} ref={ref} />
})
CompatibleInputElement.displayName = 'OrderingCompatibleInputElement'

const cssVariables = variables => Object.fromEntries(
  Object.entries(variables).map(([key, value]) => [`--od-field-${key}`, String(value)])
)

export const orderingFieldStyle = theme => {
  const roles = resolveFieldTheme(theme)
  return cssVariables({
    surface: roles.surface,
    'surface-subtle': roles.surfaceSubtle,
    text: roles.text,
    'text-muted': roles.textMuted,
    'text-subtle': roles.textSubtle,
    border: roles.border,
    'border-strong': roles.borderStrong,
    action: roles.action,
    'action-content': roles.actionContent,
    'action-foreground': roles.actionForeground,
    focus: roles.focus,
    danger: roles.danger,
    'secondary-content': roles.secondaryContent,
    'secondary-border': roles.secondaryBorder,
    font: roles.fontFamily,
    'font-size': roles.fontSize,
    radius: roles.radiusControl,
    duration: roles.duration,
    easing: roles.easing,
    'compact-height': roles.compactHeight,
    'touch-target': roles.touchTarget,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset
  })
}

const fieldClassName = props => classNames(
  'od-ui',
  'od-field',
  props.fieldVariant === 'primary' && 'od-field-primary',
  props.fieldVariant === 'secondary' && 'od-field-secondary'
)

export const NativeInput = React.forwardRef((componentProps, ref) => {
  const props = stripInputStyleProps(componentProps)
  const removeGeneratedId = componentProps.compatibility === 'legacy' && componentProps.id == null
  const preserveNativeValue = Boolean(componentProps.nativeValueCompatibility)
  if (preserveNativeValue) {
    delete props.value
    delete props.defaultValue
  }
  if (componentProps.compatibility === 'legacy' || componentProps.nativeValueCompatibility) {
    return (
      <InputPrimitive
        {...props}
        ref={ref}
        render={(
          <CompatibleInputElement
            hasNativeDefaultValue={preserveNativeValue && componentProps.defaultValue !== undefined}
            hasNativeValue={preserveNativeValue && componentProps.value !== undefined}
            nativeDefaultValue={componentProps.defaultValue}
            nativeValue={componentProps.value}
            preserveNativeValue={preserveNativeValue}
            removeGeneratedId={removeGeneratedId}
          />
        )}
      />
    )
  }
  return <InputPrimitive {...props} ref={ref} />
})
NativeInput.displayName = 'OrderingNativeInput'

export const Input = styled(NativeInput).attrs(props => ({
  className: classNames(fieldClassName(props), 'od-field-input'),
  'data-slot': 'input'
}))`
  ${props => orderingFieldStyle(props.theme)}
  ${props => props.w && css`width: 20%;`}
`

export const InputPrimary = styled(Input).attrs({
  className: 'od-field-primary',
  fieldVariant: 'primary'
})``

export const InputSecundary = styled(Input).attrs({
  className: 'od-field-secondary',
  fieldVariant: 'secondary'
})``

export const TextArea = styled.textarea.attrs(props => ({
  className: classNames(fieldClassName(props), 'od-field-textarea'),
  'data-slot': 'textarea'
}))`
  ${props => orderingFieldStyle(props.theme)}
  ${props => props.w && css`width: 20%;`}
`

const groupClassName = (props, base) => classNames(
  'od-ui',
  base,
  props.groupSide === 'right' && 'od-input-group-right',
  props.groupVariant === 'primary' && 'od-input-group-primary'
)

export const InputGroup = styled.div.attrs(props => ({
  className: groupClassName(props, 'od-input-group'),
  'data-slot': 'input-group'
}))`
  ${props => orderingFieldStyle(props.theme)}

  & > ${Input} {
    min-width: 0;
    flex-basis: auto;
  }

  & > ${Input}:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: 0;
    padding-left: 0;
  }

  & > ${Input}:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: 0;
    padding-right: 0;
  }

`

export const InputGroupLeft = styled.div.attrs(props => ({
  className: groupClassName(props, 'od-input-group-left'),
  'data-slot': 'input-group-left'
}))`
  ${props => orderingFieldStyle(props.theme)}
  background: var(--od-field-surface);
  color: var(--od-field-text);
  border-radius: 34px 0 0 34px;
  line-height: 34px;
  padding-left: 7px;
  padding-right: 7px;
  font-size: 14px;
  border-width: 1px;
  height: 34px;
  border-style: solid;
  border-color: var(--od-field-border);
  font-family: var(--od-field-font);
  border-right-width: 0;

  ${props => props.theme?.rtl && css`
    border-left-width: 0;
    border-right-width: initial;
  `}

  & ${Button} {
    margin-left: -7px;
    ${props => props.theme?.rtl && css`
      margin-right: -7px;
      margin-left: 0;
    `}
  }

  ${props => props.groupSide === 'right' && css`
    border-radius: 0 34px 34px 0;
    line-height: 34px;
    border-right-width: 1px;
    border-left-width: 0;

    ${props.theme?.rtl && css`
      border-left-width: 1px;
      border-right-width: 0;
    `}

    & ${Button} {
      margin-left: 0;
      margin-right: -7px;
      ${props.theme?.rtl && css`
        margin-left: -7px;
        margin-right: 0;
      `}
    }
  `}
`

export const InputGroupRight = styled(InputGroupLeft).attrs({
  className: 'od-input-group-right',
  groupSide: 'right',
  'data-slot': 'input-group-right'
})``

export const orderingPrimaryGroupStyle = props => css`
  & > ${InputGroupLeft} {
    color: ${resolveFieldTheme(props.theme).actionContent};
    border-color: ${resolveFieldTheme(props.theme).action};
  }
`

export const InputGroupPrimary = styled(InputGroup).attrs({
  className: 'od-input-group-primary',
  groupVariant: 'primary',
  'data-slot': 'input-group-primary'
})`
  ${orderingPrimaryGroupStyle}
`
