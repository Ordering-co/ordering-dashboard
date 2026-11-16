import React from 'react'
import { UsersExport } from '../UsersExport/UsersExport'

export { hasSheetFields } from '../UsersExport/UsersExport'

// redesign BO-B2 (promotion): the export button moved to Users/UsersExport/UsersExport.jsx. This is the customers list's, with the
// words it has always had.
const CUSTOMERS_COPY = {
  button: { key: 'CUSTOMERS_EXPORT_CSV', text: 'Export CSV' },
  title: { key: 'CUSTOMERS_EXPORT_TITLE', text: 'Export customers to CSV?' },
  confirm: { key: 'CUSTOMERS_EXPORT_CONFIRM', text: 'Export CSV' },
  scopeAll: { key: 'CUSTOMERS_EXPORT_SCOPE_ALL', text: 'The file includes all customers, active and inactive.' },
  scopeFiltered: {
    key: 'CUSTOMERS_EXPORT_SCOPE_FILTERS',
    text: 'The file includes active and inactive customers that match the active filters (Verified, Sign up date, Loyalty level and the Filters panel, except ID and External ID). The search, the Orders filter and the Active/Inactive tab don\'t apply.'
  },
  resultTitle: { key: 'CUSTOMERS_EXPORT_RESULT_TITLE', text: 'Export' },
  requested: { key: 'CUSTOMERS_EXPORT_REQUESTED', text: 'The export was requested.' },
  error: { key: 'CUSTOMERS_EXPORT_ERROR', text: 'The export failed. Try again.' }
}

// Takes what `UsersExport` takes: defaultUserTypesSelected, disabledActiveStateCondition, userTypesSelected,
// selectedUserActiveState, multiFilterValues.
export const CustomersExport = (props) => (
  <UsersExport copy={CUSTOMERS_COPY} {...props} />
)
