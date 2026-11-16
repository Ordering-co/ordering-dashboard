import React, { useState } from 'react'
import { BusinessSchedule } from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessSchedule'
import { EnterprisePromotionSchedule } from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionSchedule'
// redesign SL-F3 (C): the business schedule is the Product ScheduleEditor, whose Switch reads the --od-x-* candidates (the app loads them in src/index.js)
import '../../../src/brand/candidates.css'

const initialSchedule = Array.from({ length: 7 }, (_, index) => ({
  enabled: index === 0,
  lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }]
}))
const record = (type, value) => {
  globalThis.__OD_SCHEDULE_CONSUMER_EVENTS__ = [...(globalThis.__OD_SCHEDULE_CONSUMER_EVENTS__ || []), { type, value }]
}

const BusinessCase = () => {
  const [business, setBusiness] = useState({ id: 701, schedule: structuredClone(initialSchedule) })
  return (
    <section data-testid='schedule-business'>
      <BusinessSchedule business={business} handleSuccessUpdate={value => { record('business-success', value); setBusiness(value) }} />
    </section>
  )
}
const PromotionCase = () => {
  const [schedule, setSchedule] = useState(() => structuredClone(initialSchedule))
  return (
    <section data-testid='schedule-promotion'>
      <EnterprisePromotionSchedule
        promotionState={{ promotion: { schedule } }}
        handleChangeItem={value => { record('promotion-change', value); setSchedule(value.schedule) }}
        onClickDone={(...args) => record('promotion-done', args)}
      />
      <output data-testid='promotion-schedule'>{JSON.stringify(schedule)}</output>
    </section>
  )
}

export const ScheduleConsumersFixture = () => (
  <main className='schedule-consumer-fixture'>
    <style>{`
      .schedule-consumer-fixture { padding: 20px; min-width: 0; }
      .schedule-consumer-fixture > section { margin-bottom: 32px; max-width: 760px; min-width: 0; }
      .schedule-consumer-fixture output { display: block; overflow-wrap: anywhere; }
    `}</style>
    <h1>Ordering.co schedule consumer contracts</h1>
    <BusinessCase />
    <PromotionCase />
  </main>
)
