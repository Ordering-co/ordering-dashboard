import styled from 'styled-components'

import { IconButton } from '../../../styles/Buttons'
import { entitySelectorStyle } from './entity-selector-theme'
import './drag-scroll.css'

export const ScrollBox = styled.div.attrs(props => ({
  className: 'od-ui od-drag-scroll scroll-box',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'drag-scroll',
  'data-dragging': props.isDragging ? '' : undefined
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const ScrollBoxWrapper = styled.div.attrs(props => ({
  className: 'od-ui od-drag-scroll-scrollport scroll-box__wrapper',
  'data-slot': 'drag-scroll-scrollport',
  'data-dragging': props.isDragging ? '' : undefined
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const ScrollBoxContainer = styled.div.attrs({
  className: 'od-ui od-drag-scroll-content scroll-box__container',
  'data-slot': 'drag-scroll-content'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const ArrowButton = styled(IconButton).withConfig({
  shouldForwardProp: prop => prop !== 'isRight'
}).attrs(props => ({
  className: 'od-drag-scroll-arrow',
  'data-scroll-action': props['data-scroll-action'] || (props.isRight ? 'right' : 'left')
}))`
  ${props => entitySelectorStyle(props.theme)}
`
