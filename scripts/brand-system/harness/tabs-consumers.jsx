import React, { useState } from 'react'

import { Tabs, Tab } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Tabs'

// Lot 5.12: BusinessTaxAndFees and EditTaxManager no longer render
// the Shared Tabs (they moved onto Product wrappers, and EditTaxManager lost its
// nested «Change by order types» modal), so they stop being consumers here. The
// Shared Tabs contracts they used to prove (a native button with aria-pressed
// driven by the external `active` prop, the visible focus ring, the 44px target)
// stay proven on a stateful probe of the same Shared Tabs.
const StatefulTabsProbe = () => {
  const [active, setActive] = useState('first')
  return (
    <section data-testid='tabs-state-probe'>
      <Tabs>
        <Tab active={active === 'first'} onClick={() => setActive('first')}>First</Tab>
        <Tab active={active === 'second'} onClick={() => setActive('second')}>Second</Tab>
      </Tabs>
      <output data-testid='tabs-state-panel' style={{ display: 'block' }}>{active === 'first' ? 'First panel' : 'Second panel'}</output>
    </section>
  )
}

export const TabsConsumersFixture = () => {
  return (
    <main data-testid='tabs-consumers' style={{ boxSizing: 'border-box', display: 'grid', gap: 32, minWidth: 0, padding: 24, width: '100%' }}>
      <StatefulTabsProbe />
      <Tabs data-testid='tabs-weight-probe' style={{ fontWeight: 600 }}>
        <Tab>Inherited</Tab>
        <Tab active>Active</Tab>
      </Tabs>
    </main>
  )
}
