import styled from 'styled-components'

import { entitySelectorStyle } from './entity-selector-theme'
import './select-users.css'

export const UsersContainer = styled.div.attrs(props => ({
  className: 'od-ui od-select-users',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'entity-selector',
  'data-entity-selector': 'users'
}))`
  ${props => entitySelectorStyle(props.theme)}
`
export const SearchBarWrapper = styled.div.attrs({
  className: 'od-ui od-entity-selector-search',
  'data-slot': 'select-users-search'
})`
  ${props => entitySelectorStyle(props.theme)}
`
export const UserItem = styled.div.attrs({
  className: 'od-ui od-entity-selector-row od-select-users-row',
  'data-slot': 'entity-selector-row'
})`
  ${props => entitySelectorStyle(props.theme)}
`
export const WrapperPagination = styled.div.attrs({
  className: 'od-ui od-select-users-pagination',
  'data-slot': 'select-users-pagination'
})`
  ${props => entitySelectorStyle(props.theme)}
`
