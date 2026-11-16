import React from 'react'

import { Info } from '../Icon'
import { BillRowInfoButton } from './bill-row-styles'

export const BillRowAction = ({ label, onClick, variant, Wrapper }) => (
  <Wrapper
    as='span'
    className='od-ui od-bill-row-action-wrapper'
    data-bill-row-slot='action-wrapper'
    data-icon-variant={variant}
  >
    <BillRowInfoButton aria-label={label} onClick={onClick}>
      <Info size='20' data-bill-row-slot='info-icon' />
    </BillRowInfoButton>
  </Wrapper>
)
