import styled from 'styled-components'

import { entitySelectorStyle } from './entity-selector-theme'
import './spreadsheet.css'

export const SpreadSheetContainer = styled.div.attrs(props => ({
  className: 'od-ui od-spreadsheet',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'spreadsheet'
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const SpreadSheetViewport = styled.div.attrs({
  className: 'od-ui od-spreadsheet-scrollport',
  'data-slot': 'spreadsheet-scrollport'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const SpreadSheetMenuHost = styled.div.attrs(props => ({
  className: 'od-ui od-spreadsheet-menu-host',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'spreadsheet-menu-host'
}))`
  ${props => entitySelectorStyle(props.theme)}
`
