import React from 'react'
import { OrderBill } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderBill'
import { CartBill } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/CartBill'
import { OpenCartBill } from '../../../src/@/components-dashboard/src/ui/src/components/CartRecovery/OpenCartBill'

const taxes = [
  { id: 1, name: 'Product tax', target: 'product', type: 2, rate: 7.5, summary: { tax: 3, tax_after_discount: 2.5 } },
  { id: 2, name: 'Delivery tax', target: 'delivery_fee', type: 2, rate: 10, summary: { tax: 1 } },
  { id: 3, name: 'Order tax', target: 'order', type: 2, rate: 2, summary: { tax: 0.5 } }
]
const fees = [{ id: 4, name: 'Handling fee', description: 'Handling fee details', type: 'business', fixed: 2, percentage: 3, summary: { amount: 3.2 } }]
const bill = {
  id: 501,
  subtotal: 40,
  subtotal_with_discount: 40,
  total: 50,
  delivery_price: 5,
  service_fee: 0,
  totalDriverTip: 0,
  discount: 0,
  products: [],
  offers: [],
  metafields: [],
  business: { tax_type: 2, name: 'Fixture business' },
  taxes,
  fees,
  currency: 'USD',
  delivery_type: 1,
  summary: { subtotal: 40, subtotal_with_discount: 40, total: 50 }
}
export const BillRowConsumersFixture = () => (
  <main style={{ padding: 20 }}>
    <h1>Ordering.co bill row consumers</h1>
    <section data-testid='order-bill' style={{ maxWidth: 700 }}><OrderBill order={bill} viewOnly actionStatus={{ loading: false }} /></section>
    <section data-testid='custom-cart-bill' style={{ maxWidth: 700 }}><CartBill cart={bill} /></section>
    <section data-testid='open-cart-bill' style={{ maxWidth: 700 }}><OpenCartBill cart={bill} /></section>
  </main>
)
