import React from 'react'

import { OrderToPrint } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderToPrint'
import { OrderToPrintTicket } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderToPrintTicket'

const long = 'This is a deliberately long operational note that must wrap across the printable width without clipping, overlap, or hidden content.'
const product = {
  id: 7001,
  code: 'PRINT-7001',
  name: 'Extra large custom pizza with a deliberately long product name for print verification',
  quantity: 2,
  price: 18.5,
  total: 42,
  images: null,
  ingredients: [{ id: 1, name: 'Very long sliced red onion ingredient', selected: false }],
  options: [{ id: 2, name: 'Premium toppings', suboptions: [{ id: 3, name: 'Roasted artichoke hearts', quantity: 2, position: 'left', price: 2.5, half_price: 1.25 }] }],
  comment: long
}
const order = {
  id: 910099,
  status: 0,
  delivery_type: 1,
  delivery_datetime: '2026-09-15 12:30',
  delivery_datetime_utc: '2026-09-15 17:30',
  currency: 'USD',
  logistic_status: 'pending',
  logistic_attemps: 2,
  priority: 1,
  paymethod: { gateway: 'cash', name: 'Cash' },
  payment_events: [{ id: 80, event: 'payment', amount: 52.75, paymethod: { gateway: 'cash', name: 'Cash' } }],
  business: {
    name: 'Synthetic Store With A Very Long Ordering.co Operations Name',
    phone: '+1 555 0100',
    email: 'operations-contact-with-a-long-name@example.invalid',
    address: '100 Very Long Operations Avenue, Suite 12345, Fixture City',
    address_notes: long,
    zipcode: '78701'
  },
  customer: {
    name: 'Fixture',
    middle_name: 'Alexandria',
    lastname: 'Customer',
    second_lastname: 'Longname',
    cellphone: '+1 555 0200',
    phone: '+1 555 0201',
    email: 'customer-with-a-very-long-address@example.invalid',
    address: '200 Another Extremely Long Customer Address, Apartment 98765',
    address_notes: long,
    internal_number: 'UNIT-987654321',
    zipcode: '78702'
  },
  driver_id: 12,
  driver: { name: 'Synthetic', lastname: 'Driver', cellphone: '+1 555 0300' },
  products: [product, { ...product, id: 7002, code: 'PRINT-7002', name: 'Second product preserving page-break behavior' }],
  subtotal: 84,
  total: 105.5,
  tax_type: 2,
  taxes: [{ id: 90, name: 'Fixture product tax', target: 'product', type: 2, rate: 8.25, summary: { tax: 6.93 } }],
  fees: [{ id: 91, name: 'Fixture handling fee', type: 'business', fixed: 2, percentage: 0, summary: { amount: 2 } }],
  offers: [],
  metafields: [],
  delivery_price: 12.5,
  service_fee: 0,
  summary: { subtotal: 84, subtotal_with_discount: 84, discount: 0, tax: 6.93, service_fee: 0, driver_tip: 2.07, total: 105.5 }
}

export const PrintOrderDocumentsFixture = () => {
  const ticket = new URLSearchParams(window.location.search).get('document') === 'ticket'
  return (
    <main data-testid='print-order-document'>
      {ticket
        ? <OrderToPrintTicket order={order} getOrderStatus={() => ({ value: 'Pending', percentage: 20 })} />
        : <OrderToPrint order={order} placeSpotEnabled={[3, 4, 5]} getOrderStatus={() => ({ value: 'Pending', percentage: 20 })} getLogisticTag={() => 'Pending'} getPriorityTag={() => 'High'} />}
    </main>
  )
}
