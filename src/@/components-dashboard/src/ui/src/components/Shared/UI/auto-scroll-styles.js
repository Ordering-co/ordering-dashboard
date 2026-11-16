import styled from 'styled-components'

import { IconButton } from '../../../styles/Buttons'
import { entitySelectorStyle } from './entity-selector-theme'
import './auto-scroll.css'

export const AutoscrollContainer = styled.span.attrs(props => ({
  className: 'od-ui od-auto-scroll',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'auto-scroll',
  'data-scroll-target': 'ancestor-scrollport',
  'data-modal': props.modal ? '' : undefined,
  'data-special': props.special ? '' : undefined,
  'data-inner-scroll': props.innerScroll ? '' : undefined
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const AutoScrollArrow = styled(IconButton).attrs({
  className: 'od-auto-scroll-arrow'
})`
  ${props => entitySelectorStyle(props.theme)}
`
