import React from 'react'

import { Select as SharedSelect } from '../../components/Shared/UI/Select'

const LegacySelectFacade = props => <SharedSelect {...props} compatibility='legacy-select' />

// (main): no custom comparison. It skipped renders with a new onChange, so a schedule that changed its minutes kept the
// handler of the earlier hour and put the old hour back.
export const Select = React.memo(LegacySelectFacade)

Select.displayName = 'Select'
