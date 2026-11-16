import React, { useEffect, useRef, useState } from 'react'
import { PaymentCard } from '../../../src/@/components-dashboard/src/ui/src/components/Billing/BillingPaymentOptions/Stripe/PaymentCard'
import { UsersExportCSV } from '../../../src/@/components-dashboard/src/ui/src/components/Users/UsersExportCSV'

const card = { id: 501, default: false, data: { brand: 'visa', last4: '4242' } }
const noop = () => {}

export const FeedbackConsumersFixture = () => {
  const [cardLoading, setCardLoading] = useState(true)
  const [cardEvents, setCardEvents] = useState([])
  const [exportLoading, setExportLoading] = useState(false)
  const [exportEvents, setExportEvents] = useState([])
  const timer = useRef()
  globalThis.__OD_FEEDBACK_EXPORT__ = {
    actionStatus: { loading: exportLoading, result: null },
    disabled: false,
    getCSV: (...args) => {
      setExportEvents(current => [...current, args])
      setExportLoading(true)
      timer.current = setTimeout(() => setExportLoading(false), 1600)
    }
  }
  useEffect(() => () => {
    clearTimeout(timer.current)
    delete globalThis.__OD_FEEDBACK_EXPORT__
  }, [])
  return (
    <main data-testid='feedback-consumers' style={{ padding: 16, display: 'grid', gap: 24, maxWidth: '100%' }}>
      <section data-testid='payment-card-consumer' style={{ width: 'min(100%, 500px)' }}>
        <h1>Real payment card loading</h1>
        <button type='button' onClick={() => setCardLoading(value => !value)}>Toggle card loading</button>
        <PaymentCard card={card} cardsLength={2} cardSelected={card} isLoading={cardLoading} handleCardClick={value => setCardEvents(current => [...current, value])} handleDeleteCard={noop} />
        <output data-testid='card-events'>{JSON.stringify(cardEvents)}</output>
      </section>
      <section data-testid='export-consumer'>
        <h2>Real CSV export loading</h2>
        <UsersExportCSV />
        <output data-testid='export-events'>{JSON.stringify(exportEvents)}</output>
      </section>
    </main>
  )
}
