import React from 'react'
import styled from 'styled-components'

import {
  Button as SharedButton,
  ButtonLink as SharedButtonLink,
  IconButton as SharedIconButton,
  LinkButton as SharedLinkButton
} from '../../components/Shared/UI/Button'

const bridgeProps = componentProps => {
  const props = { ...componentProps }
  const literalAs = props.as ?? props.forwardedAs
  delete props.as
  delete props.forwardedAs
  return { props, literalAs }
}

const LegacyButtonBridge = React.forwardRef((componentProps, ref) => {
  const { props, literalAs } = bridgeProps(componentProps)
  return <SharedButton {...props} ref={ref} compatibility='legacy' literalAs={literalAs} />
})
LegacyButtonBridge.displayName = 'LegacyButtonBridge'

const LegacyIconButtonBridge = React.forwardRef((componentProps, ref) => {
  const { props, literalAs } = bridgeProps(componentProps)
  return <SharedIconButton {...props} ref={ref} compatibility='legacy' literalAs={literalAs} />
})
LegacyIconButtonBridge.displayName = 'LegacyIconButtonBridge'

const LegacyButtonLinkBridge = React.forwardRef((componentProps, ref) => {
  const { props, literalAs } = bridgeProps(componentProps)
  return <SharedButtonLink {...props} ref={ref} compatibility='legacy' literalAs={literalAs} />
})
LegacyButtonLinkBridge.displayName = 'LegacyButtonLinkBridge'

const LegacyLinkButtonBridge = React.forwardRef((componentProps, ref) => {
  const { props, literalAs } = bridgeProps(componentProps)
  return <SharedLinkButton {...props} ref={ref} literalAs={literalAs} />
})
LegacyLinkButtonBridge.displayName = 'LegacyLinkButtonBridge'

// Keep a distinct styled identity for every legacy export. Existing consumers
// extend and interpolate these facades, while Shared/UI remains the only owner
// of the Base UI root and the Ordering.co presentation classes.
export const Button = styled(SharedButton).attrs({ as: LegacyButtonBridge, className: 'od-button-legacy', compatibility: 'legacy' })``

export const IconButton = styled(SharedIconButton).attrs(props => ({
  as: props.as || LegacyIconButtonBridge,
  compatibility: 'legacy'
}))``

export const ButtonLink = styled(SharedButtonLink).attrs({ as: LegacyButtonLinkBridge, className: 'od-button-legacy', compatibility: 'legacy' })``

export const LinkButton = styled(SharedLinkButton).attrs(props => ({
  as: props.as || LegacyLinkButtonBridge
}))``
