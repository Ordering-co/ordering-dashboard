import React from 'react'
import { UsersFilterSheet } from '../UsersFilterBar/UsersFilterSheet'
import { SHEET_KEYS } from '../UsersFilterBar/userFilters'

// redesign BO-B2 (promotion): the «Filters» sheet moved to Users/UsersFilterBar/UsersFilterSheet.jsx. This is the customers list's:
// the fields and the Orders hint it has always had.
export const CustomersFilterSheet = (props) => (
  <UsersFilterSheet sheetKeys={SHEET_KEYS} showOrders {...props} />
)
