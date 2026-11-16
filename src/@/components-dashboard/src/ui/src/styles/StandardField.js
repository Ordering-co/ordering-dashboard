import styled from 'styled-components'

import { StandardField as SharedStandardField } from '../components/Shared/UI/StandardField'

// Preserve the public styled identity and polymorphic extension surface while
// Shared/UI owns the layout implementation.
export const StandardField = styled(SharedStandardField)``
