import React, { useState } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { SideBar } from '../../Shared'
import { Button } from '../../../styles'
import { CardForm } from './CardForm'
import { CardFormCustom } from './CardFormCustom'
import { CartBill } from './CartBill'
import { Checkout } from './Checkout'
import { CouponControl } from './CouponControl'
import { CustomOrderDetails } from './CustomOrderDetails'
import { DriverTips } from './DriverTips'
import { Map } from './Map'
import { OrderTypeSelector } from './OrderTypeSelector'
import { PaymentOptionCard } from './PaymentOptionCard'
import { PaymentOptionPaypal } from './PaymentOptionPaypal'
import { PaymentOptions } from './PaymentOptions'
import { PaymentOptionSquare } from './PaymentOptionSquare'
import { PaymentOptionWallet } from './PaymentOptionWallet'
import { ProductForm } from './ProductForm'
import { ProductIngredient } from './ProductIngredient'
import { ProductOption } from './ProductOption'
import { ProductOptionSubOption } from './ProductOptionSubOption'
import { SelectBusinesses } from './SelectBusinesses'
import { SelectCustomer } from './SelectCustomer'
import { SelectProducts } from './SelectProducts'
import { SingleProductCard } from './SingleProductCard'
import { StripeElementsForm } from './StripeElementsForm'
import { StripeMethodForm } from './StripeMethodForm'
import { StripeRedirectForm } from './StripeRedirectForm'
import { TaxInformation } from './TaxInformation'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'

export const CreateCustomOrder = (props) => {
  const {
    handleOpenCustomOrderDetail,
    handleOpenOrderDetail
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [openSidebar, setOpenSidebar] = useState(false)
  const [moveDistance, setMoveDistance] = useState(0)

  // `?add=custom_order` (command palette) opens the same form as the button
  useOpenFromQuery('add', () => setOpenSidebar(true), {
    enabled: user?.level === 0,
    accept: value => value === 'custom_order'
  })

  return (
    <>
      {user?.level === 0 && (
        <Button
          borderRadius='7.6px'
          color='lightPrimary'
          onClick={() => setOpenSidebar(true)}
        >
          {t('CREATE_CUSTOM_ORDER', 'Create custom order')}
        </Button>
      )}
      {openSidebar && (
        <SideBar
          sidebarId='custom_order_details'
          open={openSidebar}
          onClose={() => {
            setMoveDistance(0)
            setOpenSidebar(false)
          }}
          defaultSideBarWidth={500 + moveDistance}
          moveDistance={moveDistance}
        >
          <CustomOrderDetails
            handleParentSidebarMove={val => setMoveDistance(val)}
            handleOpenCustomOrderDetail={handleOpenCustomOrderDetail}
            onClose={() => setOpenSidebar(false)}
            handleOpenOrderDetail={handleOpenOrderDetail}
          />
        </SideBar>
      )}
    </>
  )
}

export {
  CardForm,
  CardFormCustom,
  CartBill,
  Checkout,
  CouponControl,
  CustomOrderDetails,
  DriverTips,
  Map,
  OrderTypeSelector,
  PaymentOptionCard,
  PaymentOptionPaypal,
  PaymentOptions,
  PaymentOptionSquare,
  PaymentOptionWallet,
  ProductForm,
  ProductIngredient,
  ProductOption,
  ProductOptionSubOption,
  SelectBusinesses,
  SelectCustomer,
  SelectProducts,
  SingleProductCard,
  StripeElementsForm,
  StripeMethodForm,
  StripeRedirectForm,
  TaxInformation
}
