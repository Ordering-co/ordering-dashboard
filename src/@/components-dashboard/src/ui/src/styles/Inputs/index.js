import styled from 'styled-components'

import {
  Input as SharedInput,
  InputGroup as SharedInputGroup,
  InputGroupLeft as SharedInputGroupLeft,
  orderingPrimaryGroupStyle,
  TextArea as SharedTextArea
} from '../../components/Shared/UI/Input'

// Keep distinct styled identities and the original extension lineage. Shared/UI
// owns the Base UI root and visual rules; these exports remain compatibility
// facades for existing consumers, interpolations and attrs layers.
export const Input = styled(SharedInput).attrs({ compatibility: 'legacy' })``

export const InputGroup = styled(SharedInputGroup)``

export const InputGroupLeft = styled(SharedInputGroupLeft)``

export const InputGroupRight = styled(InputGroupLeft).attrs({
  className: 'od-input-group-right',
  groupSide: 'right',
  'data-slot': 'input-group-right'
})``

export const InputPrimary = styled(Input).attrs({
  className: 'od-field-primary',
  fieldVariant: 'primary'
})``

export const InputSecundary = styled(Input).attrs({
  className: 'od-field-secondary',
  fieldVariant: 'secondary'
})``

export const InputGroupPrimary = styled(InputGroup).attrs({
  className: 'od-input-group-primary',
  groupVariant: 'primary',
  'data-slot': 'input-group-primary'
})`
  ${orderingPrimaryGroupStyle}
`

export const TextArea = styled(SharedTextArea).attrs({ compatibility: 'legacy' })``
