import styled from 'styled-components'

import { NativeInput, orderingFieldStyle } from './Input'
import './checkbox.css'

const classNames = (...values) => [...new Set(
  values.filter(Boolean).flatMap(value => String(value).split(/\s+/)).filter(Boolean)
)].join(' ')

const selectionAttrs = (props, variant) => ({
  className: classNames(
    'od-ui',
    'od-selection-control',
    variant === 'radio' ? 'od-radio-button' : 'od-checkbox'
  ),
  'data-slot': variant === 'radio' ? 'radio-button' : 'checkbox',
  nativeValueCompatibility: true,
  selectionVariant: variant,
  type: 'checkbox'
})

export const Checkbox = styled(NativeInput).attrs(props => selectionAttrs(props, 'checkbox'))`
  ${props => orderingFieldStyle(props.theme)}
`

// RadioButton deliberately remains an independent checkbox-typed identity.
// Existing consumers use checkbox serialization with a circular appearance.
export const RadioButton = styled(NativeInput).attrs(props => selectionAttrs(props, 'radio'))`
  ${props => orderingFieldStyle(props.theme)}
`
