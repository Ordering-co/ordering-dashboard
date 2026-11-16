import React from 'react'
import { useLocation } from 'react-router-dom'

import { GiftCardsList as GiftCardsListController } from '../../../../../index'
import { GiftCardsListingUI } from './GiftCardsListingUI'

// redesign GC-B: the page is GiftCardsListingUI (Product header, tabs, search, table and pagination); this file keeps the
// export and the controller's props. The folder name is a key of the command palette (`Orders/GiftCardsListing:setup|status`).
export const GiftCardsListing = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultStatus = query.get('status')
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const giftCardsProps = {
    ...props,
    UIComponent: GiftCardsListingUI,
    isSearchById: true,
    isSearchByAuthorName: true,
    isSearchByAuthorEmail: true,
    isSearchByAuthorPhone: true,
    // redesign GC-B (D4, lote A GC-A1): also by the code of the card and the recipient's email
    isSearchByCode: true,
    isSearchByRecipientEmail: true,
    defaultStatus,
    paginationSettings: {
      initialPage: Number(defaultPage),
      pageSize: Number(defaultPageSize)
    }
  }
  return <GiftCardsListController {...giftCardsProps} />
}
