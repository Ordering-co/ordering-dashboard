import styled from 'styled-components'

import { entitySelectorStyle } from '../entity-selector-theme'
import './insert-video.css'

export const InsertLinkContainer = styled.div.attrs(props => ({
  className: 'od-ui od-editor-dialog od-editor-insert-video',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'editor-insert-video'
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const WrapperInput = styled.div.attrs({
  className: 'od-ui od-editor-field',
  'data-slot': 'editor-field'
})`
  ${props => entitySelectorStyle(props.theme)}
`
