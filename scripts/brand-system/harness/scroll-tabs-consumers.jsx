import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeProvider } from 'styled-components'

import { ProductForm } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/ProductForm'
import { PaymentOptionSquare } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/PaymentOptionSquare'
import rightArrow from '../../../src/assets/images/icons/right-arrow.svg'
import leftArrow from '../../../src/assets/images/icons/left-arrow.svg'

const transparentImage = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

const product = {
  id: 9100,
  category_id: 91,
  name: 'Fixture customizable product',
  images: transparentImage,
  price: 12,
  minimum_per_order: 1,
  hide_special_instructions: true,
  ingredients: [
    { id: 9110, name: 'Fixture ingredient' }
  ],
  extras: [{
    id: 9120,
    rank: 1,
    options: Array.from({ length: 6 }, (_, index) => ({
      id: 9130 + index,
      name: `Fixture option ${index + 1}`,
      rank: index + 1,
      min: 0,
      max: 1,
      suboptions: [{ id: 9200 + index, name: `Choice ${index + 1}`, rank: 1, enabled: false, price: 0 }]
    }))
  }]
}

const productCart = {
  ingredients: { 'id:9110': { selected: true } },
  options: {},
  quantity: 1,
  total: 12,
  unitTotal: 12,
  comment: ''
}

const paymentMethods = [
  { name: 'Card payments', value: 'card_payments' },
  { name: 'ACH Bank transfer', value: 'ach_bank_transfer' },
  { name: 'Gift Cards', value: 'gift_cards' }
]

const ProductTabsConsumer = () => (
  <section data-testid='product-form-tabs-consumer'>
    <h2>Product options scroll navigation</h2>
    <div
      className='dialog-inner'
      data-testid='product-dialog-inner'
      style={{ height: 360, maxWidth: 620, overflow: 'auto', position: 'relative' }}
    >
      <ProductForm
        businessId={901}
        product={product}
        productCart={productCart}
        isCustomerMode
        useOrderContext={false}
      />
    </div>
  </section>
)

const PaymentTabsConsumer = () => {
  const [methodSelected, setMethodSelected] = useState('card_payments')
  const [isLoading, setIsLoading] = useState(false)
  const [events, setEvents] = useState([])
  const handleChangeMethodSelected = useCallback(value => {
    setEvents(current => [...current, value])
    setMethodSelected(value)
  }, [])
  const controllerState = useMemo(() => ({
    paymentMethods,
    methodSelected,
    handleChangeMethodSelected,
    isLoading,
    isLoadingMethod: false,
    isLoadingPlace: false,
    alertState: { open: false, content: [] },
    setAlertState: () => {}
  }), [handleChangeMethodSelected, isLoading, methodSelected])

  globalThis.__OD_SCROLL_TABS_PAYMENT_FIXTURE__ = controllerState
  useEffect(() => () => {
    delete globalThis.__OD_SCROLL_TABS_PAYMENT_FIXTURE__
  }, [])

  return (
    <section data-testid='payment-square-tabs-consumer'>
      <h2>Payment method navigation</h2>
      <button type='button' onClick={() => setIsLoading(value => !value)}>Toggle payment loading</button>
      <PaymentOptionSquare
        body={{ amount: 12, cartUuid: 'fixture-cart', delivery_zone_id: 1, paymethod_id: 5 }}
        cartTotal={12}
        data={{ application_id: 'fixture', location_id: 'fixture' }}
      />
      <output data-testid='payment-tabs-events' style={{ display: 'block', overflowWrap: 'anywhere' }}>
        {JSON.stringify({ events, isLoading, methodSelected })}
      </output>
    </section>
  )
}

export const ScrollTabsConsumersFixture = () => (
  <ThemeProvider theme={theme => ({ ...theme, images: { ...theme.images, icons: { ...theme.images?.icons, rightArrow, leftArrow } } })}>
    <main style={{ display: 'grid', gap: 32, minWidth: 0, padding: 24 }}>
      <h1>Scroll tab consumer fixtures</h1>
      <ProductTabsConsumer />
      <PaymentTabsConsumer />
    </main>
  </ThemeProvider>
)
