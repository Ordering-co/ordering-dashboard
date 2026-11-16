// Adapted from shadcn/ui base button, commit 7c9eaba1c0a6404c990c144a654792e3313c650d.
// MIT notice and source hashes: docs/third-party/shadcn-ui/provenance.json.
import React from 'react'
import styled, { css } from 'styled-components'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import {
  orderingButtonStyle,
  orderingButtonStateForeground,
  orderingIconButtonStyle,
  orderingLinkButtonStyle,
  orderingUIStyle
} from './theme'

const BUTTON_COLOR_CLASSES = {
  primary: 'od-button-primary',
  lightPrimary: 'od-button-light-primary',
  lightGreen: 'od-button-light-green',
  green: 'od-button-green',
  warning: 'od-button-warning',
  secundaryDark: 'od-button-secondary-dark',
  secundary: 'od-button-secondary',
  black: 'od-button-black'
}

const classNames = (...values) => [...new Set(
  values.filter(Boolean).flatMap(value => String(value).split(/\s+/)).filter(Boolean)
)].join(' ')
const buttonColorClass = color => Object.prototype.hasOwnProperty.call(BUTTON_COLOR_CLASSES, color)
  ? BUTTON_COLOR_CLASSES[color]
  : undefined
const STYLE_PROPS = new Set([
  'active',
  'bgtransparent',
  'borderRadius',
  'circle',
  'color',
  'compatibility',
  'disabledWithOpacity',
  'initialIcon',
  'isDisabled',
  'literalAs',
  'orderingTheme',
  'outline',
  'rectangle',
  'theme',
  'tone'
])

const buttonClassName = props => classNames(
  'od-ui',
  'od-button',
  'od-inline-flex',
  'od-items-center',
  'od-justify-center',
  'od-gap-2',
  buttonColorClass(props.color),
  props.outline && 'od-button-outline',
  props.circle && 'od-button-circle',
  props.rectangle && 'od-button-rectangle',
  props.bgtransparent && 'od-button-transparent',
  props.initialIcon && 'od-button-initial-icon'
)

const iconButtonClassName = props => classNames(
  'od-ui',
  'od-icon-button',
  props.color === 'black' && 'od-icon-button-black',
  props.color === 'primary' && 'od-icon-button-primary',
  props.color === 'black' && props.active && 'od-icon-button-active',
  props.isDisabled && 'od-icon-button-pointer-disabled'
)

const stripStyleProps = props => Object.fromEntries(
  Object.entries(props).filter(([key]) => !STYLE_PROPS.has(key))
)

const getOrderingTheme = componentProps => componentProps.orderingTheme ?? componentProps.theme

const decorateButtonProps = (componentProps, props) => ({
  ...props,
  className: classNames(props.className, buttonClassName(componentProps)),
  dir: componentProps.dir ?? (getOrderingTheme(componentProps)?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'button'
})

const decorateIconButtonProps = (componentProps, props) => ({
  ...props,
  className: classNames(props.className, iconButtonClassName(componentProps)),
  dir: componentProps.dir ?? (getOrderingTheme(componentProps)?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'icon-button'
})

const decorateLinkButtonProps = (componentProps, props) => ({
  ...props,
  className: classNames('od-ui', 'od-link-button', componentProps.disabled && 'od-link-button-disabled', props.className),
  dir: componentProps.dir ?? (getOrderingTheme(componentProps)?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'link-button'
})

// Base UI deliberately defaults native buttons to type="button". Existing
// dashboard buttons rely on the browser's attribute-free implicit submit, so
// this render target removes only Base UI's injected default type.
const ImplicitSubmitButton = React.forwardRef((props, ref) => {
  const buttonProps = { ...props }
  delete buttonProps.type
  return <button {...buttonProps} ref={ref} />
})
ImplicitSubmitButton.displayName = 'OrderingImplicitSubmitButton'

const ButtonImplementation = React.forwardRef((componentProps, ref) => {
  const {
    as: Component = 'button',
    type,
    ...styleProps
  } = componentProps
  const strippedProps = stripStyleProps(styleProps)
  const props = componentProps['data-slot'] === 'icon-button'
    ? decorateIconButtonProps(componentProps, strippedProps)
    : decorateButtonProps(componentProps, strippedProps)
  if (componentProps.literalAs) props.as = componentProps.literalAs

  if (Component !== 'button') {
    return <Component {...props} ref={ref} type={type} />
  }

  if (type == null && componentProps.compatibility === 'legacy') {
    return <ButtonPrimitive {...props} ref={ref} render={<ImplicitSubmitButton />} />
  }

  return <ButtonPrimitive {...props} ref={ref} type={type ?? 'submit'} />
})
ButtonImplementation.displayName = 'OrderingButton'

const AnchorImplementation = React.forwardRef((componentProps, ref) => {
  const { as: Component = 'a', disabled, type, ...styleProps } = componentProps
  const strippedProps = stripStyleProps(styleProps)
  const buttonProps = decorateButtonProps(componentProps, strippedProps)
  const props = componentProps['data-slot'] === 'link-button'
    ? decorateLinkButtonProps(componentProps, strippedProps)
    : {
        ...buttonProps,
        className: classNames(buttonProps.className, 'od-button-link')
      }
  if (componentProps.literalAs) props.as = componentProps.literalAs
  return <Component {...props} ref={ref} disabled={disabled} type={type} />
})
AnchorImplementation.displayName = 'OrderingButtonLink'

const buttonAttrs = props => ({
  className: buttonClassName(props),
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  orderingTheme: props.theme,
  'data-slot': 'button'
})

const buttonLinkAttrs = props => ({
  ...buttonAttrs(props),
  className: classNames(buttonClassName(props), 'od-button-link')
})

// These legacy cascade contracts cannot be expressed as unconditional CSS
// variables: absent initialIcon must leave child styles alone, and an explicit
// bgtransparent must still win over an ordinary inline/consumer background.
const actionCompatibilityStyles = props => css`
  ${(() => {
    const foreground = orderingButtonStateForeground(props.theme, props)
    return css`
      ${foreground.hover && css`&:hover { color: ${foreground.hover}; }`}
      ${foreground.active && css`&:active { color: ${foreground.active}; }`}
    `
  })()}
  ${props.bgtransparent && css`background: transparent !important;`}
  ${props.initialIcon && css`
    img {
      vertical-align: middle;
    }
    span {
      padding-left: 15%;
      ${props.theme?.rtl && css`
        padding-right: 15%;
        padding-left: 0;
      `}
    }
  `}
`

// Shared/UI owns the implementation and presentation classes. Compatibility
// facades may extend these exports, but consumers never import Base UI directly.
export const Button = styled(ButtonImplementation).attrs(buttonAttrs)`
  ${props => orderingUIStyle(props.theme)}
  ${props => orderingButtonStyle(props.theme, props)}
  ${actionCompatibilityStyles}
`

export const IconButton = styled(ButtonImplementation).attrs(props => ({
  className: iconButtonClassName(props),
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  orderingTheme: props.theme,
  'data-slot': 'icon-button'
}))`
  ${props => orderingUIStyle(props.theme)}
  ${props => orderingIconButtonStyle(props.theme, props)}
`

export const ButtonLink = styled(AnchorImplementation).attrs(buttonLinkAttrs)`
  ${props => orderingUIStyle(props.theme)}
  ${props => orderingButtonStyle(props.theme, props, { buttonLink: true })}
  ${actionCompatibilityStyles}
`

export const LinkButton = styled(AnchorImplementation).attrs(props => ({
  className: classNames('od-ui', 'od-link-button', props.disabled && 'od-link-button-disabled'),
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  orderingTheme: props.theme,
  'data-slot': 'link-button'
}))`
  ${props => orderingUIStyle(props.theme)}
  ${props => orderingLinkButtonStyle(props.theme, props)}
`

export const TextButton = styled(Button).attrs({ className: 'od-button-danger-text', tone: 'dangerText' })``
