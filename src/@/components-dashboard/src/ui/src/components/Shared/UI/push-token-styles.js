import styled from 'styled-components'

import { entitySelectorStyle } from './entity-selector-theme'
import './push-token.css'

export const Container = styled.div.attrs(props => ({
  className: 'od-ui od-push-tokens',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'),
  'data-slot': 'push-tokens'
}))`
  ${props => entitySelectorStyle(props.theme)}
`

export const TableWrapper = styled.div.attrs({
  className: 'od-ui od-push-token-scrollport',
  'data-slot': 'push-token-scrollport'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const Table = styled.table.attrs({
  className: 'od-ui od-push-token-table',
  'data-slot': 'push-token-table'
})`
  ${props => entitySelectorStyle(props.theme)}
`

export const WrapperPagination = styled.div.attrs({
  className: 'od-ui od-push-token-pagination'
})`
  ${props => entitySelectorStyle(props.theme)}
`
