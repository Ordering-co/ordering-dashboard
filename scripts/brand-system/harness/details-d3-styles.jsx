import React from 'react'

// redesign 5.4-B (85fc7bcd): the refund flow is a Product Dialog and a Product Button, which read the --od-x-* tokens
// the app loads from src/index.js.
import '../../../src/brand/candidates.css'

import { RefundToWallet } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderBill/RefundToWallet'
import { OrderBill } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderBill'
import { ProductItemAccordion } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/ProductItemAccordion'

const product = {
  id: 12,
  name: 'Long custom pizza name for operations and narrow reflow',
  quantity: 2,
  price: 10,
  valid: true,
  valid_menu: true,
  valid_quantity: true,
  ingredients: [{ id: 5, name: 'Very long sliced onion ingredient', selected: false }],
  options: [{ id: 3, name: 'Toppings', rank: 1, suboptions: [{ id: 8, order_product_option_suboption_id: 308, name: 'Roasted artichoke hearts', quantity: 2, position: 'left', half_price: 1.5, price: 3 }] }],
  comment: 'Keep this long customer comment visible after expanding the product.'
}
const order = {
  id: 77,
  currency: 'USD',
  delivery_type: 1,
  paymethod: { gateway: 'braintree' },
  payment_events: [{ id: 91, event: 'payment', amount: 44, paymethod: { gateway: 'braintree', name: 'Braintree' } }],
  products: [product],
  taxes: [],
  fees: [],
  offers: [],
  metafields: [],
  summary: { subtotal: 40, subtotal_with_discount: 40, discount: 0, tax: 0, service_fee: 0, driver_tip: 0, total: 44 }
}

export const DetailsD3StylesFixture = () => (
  <main data-testid='details-d3-styles' style={{ display: 'grid', gap: 24, maxWidth: 720, minWidth: 0, padding: 24 }}>
    <section data-testid='bill-surface' aria-label='Order bill surface'>
      <OrderBill order={order} viewOnly actionStatus={{ loading: false }} />
    </section>
    <section data-testid='product-surface' aria-label='Product surface'>
      <ProductItemAccordion
        isCartProduct
        product={product}
        changeQuantity={() => {}}
        getProductMax={() => 4}
        offsetDisabled={() => 4}
        onDeleteProduct={() => {}}
        onEditProduct={() => {}}
        currency='$'
        returnSuboptions
      />
    </section>
    <section data-testid='refund-surface' aria-label='Refund surface'>
      <RefundToWallet
        order={order}
        actionStatus={{ loading: false }}
        handleOrderRefund={() => {}}
        stripePaymethods={['stripe', 'stripe_connect']}
        braintreePaymethods={['braintree']}
      />
    </section>
  </main>
)
