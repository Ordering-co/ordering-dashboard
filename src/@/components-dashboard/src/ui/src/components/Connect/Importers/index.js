import React from 'react'

import { PosMenu } from '../PosMenu'

// redesign IM-A: /connect/importers uses the pieces of /connect/pos-menu (page shell, store table, cards, split view) with
// the kind `importer` (see PosMenu/connectKinds.js), as /connect/sales-channels does: same controller, same requests, the columns ID and
// Business, no column manager, the panel of the store (ImporterStorePanel) and `?id=` as main opened it. ImportersUI is gone. The old
// pieces (BusinessesList, BusinessesListingHeader, ImportersPanel, MenuImportModal, GloriaFoodImportModal) were deleted.
export const Importers = (props) => <PosMenu {...props} kind='importer' />
