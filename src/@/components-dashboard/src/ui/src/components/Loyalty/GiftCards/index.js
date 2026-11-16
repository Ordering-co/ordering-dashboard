import React, { useState } from 'react'
import { PlatformProductsList as PlatformProductsListController } from '../../../../../index'
import { GiftCardsCatalogUI } from './GiftCardsCatalogUI'

// redesign GC-C: the catalog of gift cards for sale is a Product Sheet (GiftCardsCatalogUI) that the page opens with
// `open` and closes with `onClose`. The controller (PlatformProductsList, lote A) is mounted the first time the sheet opens, so the
// page does not ask for the products until someone looks at them, and it stays mounted so the sheet can play its exit animation.
// The legacy `GiftCards` (a SideBar with its own `handleParentSidebarMove`) is gone: the page imports this.
export const GiftCardsCatalog = ({ open = false, onClose, ...props }) => {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  if (!mounted) return null
  const giftCardsProps = {
    ...props,
    open,
    onClose,
    UIComponent: GiftCardsCatalogUI
  }
  return <PlatformProductsListController {...giftCardsProps} />
}
