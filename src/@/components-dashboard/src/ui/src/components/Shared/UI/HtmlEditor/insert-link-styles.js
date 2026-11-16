import styled from 'styled-components'

import { entitySelectorStyle } from '../entity-selector-theme'
import './insert-link.css'

export const InsertLinkContainer = styled.div.attrs(props => ({
  className: 'od-ui od-editor-dialog od-editor-insert-link',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'editor-insert-link'
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const WrapperInput = styled.div.attrs({
  className: 'od-ui od-editor-field',
  'data-slot': 'editor-field'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const CheckboxWrapper = styled.div.attrs({
  className: 'od-ui od-editor-checkbox-field',
  'data-slot': 'editor-checkbox-field'
})`
  ${props => entitySelectorStyle(props.theme)}
`
