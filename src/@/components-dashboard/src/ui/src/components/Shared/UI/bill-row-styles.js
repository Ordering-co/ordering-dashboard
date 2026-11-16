import styled from 'styled-components'

import { IconButton } from './Button'
import { orderingUIStyle } from './theme'
import './bill-row.css'

export const BillRow = styled.tr.attrs(props => ({
  className: 'od-ui od-bill-row',
  'data-slot': 'bill-row',
  'data-row-kind': props.rowKind
}))`
  ${props => orderingUIStyle(props.theme)}
`

export const BillRowInfoButton = styled(IconButton).attrs({
  className: 'od-bill-row-info-action',
  color: 'primary',
  type: 'button',
  'data-bill-row-slot': 'info-action'
})`
  ${props => orderingUIStyle(props.theme)}
`
