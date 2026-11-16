import styled from 'styled-components'

import { Button, IconButton } from '../../../styles/Buttons'
import { entitySelectorStyle } from './entity-selector-theme'
import './schedule-copy-times.css'

export const CopyTimesContainer = styled.div.attrs(props => ({
  className: 'od-ui od-schedule-copy-times',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'schedule-copy-times'
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const HeaderItem = styled(IconButton).attrs({
  className: 'od-schedule-copy-trigger',
  'data-schedule-action': 'copy'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const PopoverBody = styled.div.attrs({
  className: 'od-ui od-schedule-copy-popover',
  'data-slot': 'schedule-copy-popover'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const Title = styled.div.attrs({
  className: 'od-ui od-schedule-copy-title',
  'data-slot': 'schedule-copy-title'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const PopoverList = styled.div.attrs({
  className: 'od-ui od-schedule-copy-list',
  'data-slot': 'schedule-copy-list'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const CopyItem = styled(Button).withConfig({
  shouldForwardProp: prop => prop !== 'isChecked'
}).attrs(props => ({
  className: 'od-schedule-copy-day',
  'data-copy-source': props.disabled ? '' : undefined,
  'data-copy-checked': props.isChecked ? '' : undefined
}))`
  ${props => entitySelectorStyle(props.theme)}
`
