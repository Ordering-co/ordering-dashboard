import React from 'react'

import { PosMenu } from '../PosMenu'

// redesign SC-B: /connect/sales-channels uses the pieces of /connect/pos-menu (page shell, store table, store panel,
// cards) with the integration kind `sales_channel` (see PosMenu/connectKinds.js): same controllers, same requests, other columns,
// words and actions. The old pieces (BusinessesList, SingleBusiness, BusinessDetails, BusinessIntegration, BusinessesListingHeader
// and this folder's styles.js) were deleted as dead code; BusinessSummary stays for D-75 (b).
export const SalesChannels = (props) => <PosMenu {...props} kind='sales_channel' />
