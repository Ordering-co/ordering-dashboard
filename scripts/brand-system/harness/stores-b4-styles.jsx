import React from 'react'

import {
  Title as ScheduleTitle
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessSchedule/styles'

// Presentation-only fixture: the real Stores (delivery / pickup / schedule /
// reservations settings) styled surfaces for batch b4-business-delivery-schedule,
// no controller, SDK, account or network. Every interactive node here is
// mounted exactly as it exists in today's source: a styled `div`/`span` (or a
// native element) with `onClick` stays that element (never promoted to
// `<button>` and never given invented `type='button'`/`aria-pressed`
// attributes) — the coordinator converts these and aligns the fixture itself,
// per this batch's explicit instruction.
// `Stores/BusinessDeliveryZoneShare/styles.js` declares no font-size and is
// out of this batch's mount list.
//
// One source `styles.js` file is mounted below: BusinessSchedule.
// BusinessCateringDelivery, BusinessPreorderDetails and BusinessReservations
// moved to Product wrappers and plain CSS with the Stores order-notices lot
// BusinessDeliveryPickupMore, BusinessDeliveryDetails,
// BusinessPickupDetails, BusinessEta and BusinessDeliveryGroupsDetails did the
// same with the Stores delivery forms lot; and
// BusinessDeliveryZoneDetails, BusinessDeliveryZoneInformation and
// BusinessDeliveryZoneList did it with the Stores delivery zones lot
// None of them has a styles.js left to mount.
//
// Real-nesting adaptations (checked against the source styles.js and its
// consuming index.js before mounting):
// - BusinessSchedule/styles.js's `Title` (`styled.h1`) declares font-size on
//   itself; index.js renders it as a direct child of `ScheduleContainer`
//   (alongside `ScheduleSection`), mounted as a leaf with its real text.
export const StoresB4StylesFixture = () => {
  return (
    <main data-testid='stores-b4-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <section data-testid='schedule-group' aria-label='Schedule'>
        <ScheduleTitle data-testid='schedule-title'>Schedule</ScheduleTitle>
      </section>

    </main>
  )
}
