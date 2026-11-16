import React from 'react'
import { PlatformProductDetail as PlatformProductDetailController } from '../../../../../index'
import { GiftCardEditorUI } from './GiftCardEditorUI'

// redesign GC-C: the card of a gift card for sale is GiftCardEditor (Product). The legacy GiftCardDetail and its
// styled-components are gone; the controller (PlatformProductDetail) is the one of lote A.
export const GiftCardEditor = (props) => {
  const giftCardDetailProps = {
    ...props,
    UIComponent: GiftCardEditorUI
  }
  return <PlatformProductDetailController {...giftCardDetailProps} />
}
