import styled from 'styled-components'

import { entitySelectorStyle } from './entity-selector-theme'
import './select-sites.css'

export const ChannelsContainer = styled.div.attrs(props => ({
  className: 'od-ui od-select-sites',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'entity-selector',
  'data-entity-selector': 'sites'
}))`
  ${props => entitySelectorStyle(props.theme)}
`
export const SearchBarWrapper = styled.div.attrs({
  className: 'od-ui od-entity-selector-search',
  'data-slot': 'select-sites-search'
})`
  ${props => entitySelectorStyle(props.theme)}
`
export const ButtonGroup = styled.div.attrs({
  className: 'od-ui od-entity-selector-actions',
  'data-slot': 'entity-selector-actions'
})`
  ${props => entitySelectorStyle(props.theme)}
`
export const ChannelItem = styled.div.attrs({
  className: 'od-ui od-entity-selector-row od-select-sites-row',
  'data-slot': 'entity-selector-row'
})`
  ${props => entitySelectorStyle(props.theme)}
`
