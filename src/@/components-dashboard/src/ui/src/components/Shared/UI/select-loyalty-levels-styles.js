import styled from 'styled-components'

import { entitySelectorStyle } from './entity-selector-theme'
import './select-loyalty-levels.css'

export const Container = styled.div.attrs(props => ({
  className: 'od-ui od-select-loyalty-levels',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'entity-selector',
  'data-entity-selector': 'loyalty-levels'
}))`
  ${props => entitySelectorStyle(props.theme)}
`
export const SearchBarWrapper = styled.div.attrs({
  className: 'od-ui od-entity-selector-search',
  'data-slot': 'select-loyalty-levels-search'
})`
  ${props => entitySelectorStyle(props.theme)}
`
export const ButtonGroup = styled.div.attrs({
  className: 'od-ui od-entity-selector-actions',
  'data-slot': 'entity-selector-actions'
})`
  ${props => entitySelectorStyle(props.theme)}
`
export const LevelItem = styled.div.attrs({
  className: 'od-ui od-entity-selector-row od-select-loyalty-levels-row',
  'data-slot': 'entity-selector-row'
})`
  ${props => entitySelectorStyle(props.theme)}
`
