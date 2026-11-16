import React from 'react'
import { UsersFilterBar } from '../UsersFilterBar/UsersFilterBar'
import { SHEET_KEYS } from '../UsersFilterBar/userFilters'

// redesign BO-B2 (promotion): the filter bar moved to Users/UsersFilterBar/UsersFilterBar.jsx. This is the customers list's, with
// its Orders control, its sheet fields and its two labels.
export const CustomersFilters = (props) => (
  <UsersFilterBar
    showOrders
    sheetKeys={SHEET_KEYS}
    searchLabel={{ key: 'CUSTOMERS_SEARCH', text: 'Search name, email or phone' }}
    barLabel={{ key: 'CUSTOMERS_FILTER_BAR', text: 'Customer filters' }}
    {...props}
  />
)
