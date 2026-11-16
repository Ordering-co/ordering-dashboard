import styled from 'styled-components'

import { Button } from './Button'
import { entitySelectorStyle } from './entity-selector-theme'
import './outbound-link.css'

export const Container = styled.div.attrs(props => ({
  className: 'od-ui od-personalization',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'personalization'
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const WrapperButton = styled.div.attrs({
  className: 'od-ui od-personalization-actions',
  'data-slot': 'personalization-actions'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const ContactButton = styled(Button).attrs({
  className: 'od-personalization-contact',
  color: 'primary',
  type: 'submit',
  'data-outbound-link-slot': 'contact-action'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const LinkableTextContainer = styled.span.attrs(props => ({
  className: 'od-ui od-linkable-text',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'linkable-text'
}))`
  ${props => entitySelectorStyle(props.theme)}
`
