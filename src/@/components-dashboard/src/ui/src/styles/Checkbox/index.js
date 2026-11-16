import styled from 'styled-components'

import {
  Checkbox as SharedCheckbox,
  RadioButton as SharedRadioButton
} from '../../components/Shared/UI/Checkbox'

// Keep independent styled identities: RadioButton has always been a native
// checkbox with circular presentation, not an extension of Checkbox.
export const Checkbox = styled(SharedCheckbox).attrs({ compatibility: 'legacy' })``

export const RadioButton = styled(SharedRadioButton).attrs({ compatibility: 'legacy' })``
