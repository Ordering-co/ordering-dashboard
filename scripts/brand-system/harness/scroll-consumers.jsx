import React, { useState } from 'react'
import { OccupationsFilter } from '../../../src/@/components-dashboard/src/ui/src/components/Users/OccupationsFilter'

const occupations = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, name: `Occupation ${index + 1} with a long name` }))
const OccupationCase = () => {
  const [selected, setSelected] = useState(null)
  const [events, setEvents] = useState([])
  return (
    <section data-testid='scroll-occupation-consumer'>
      <h2>Occupation filter</h2>
      <OccupationsFilter
        occupationsState={{ loading: false, occupations }}
        selectedOccupation={selected}
        handleSelectOccupation={value => { setSelected(value); setEvents(previous => [...previous, value]) }}
      />
      <output data-testid='occupation-scroll-events'>{JSON.stringify(events)}</output>
    </section>
  )
}

export const ScrollConsumersFixture = () => (
  <main className='scroll-consumer-fixture'>
    <style>{`
      .scroll-consumer-fixture { padding: 20px; min-width: 0; }
      .scroll-consumer-fixture > section { max-width: 720px; min-width: 0; margin-bottom: 32px; }
      .scroll-consumer-fixture output { display: block; overflow-wrap: anywhere; }
    `}</style>
    <h1>Ordering.co scroll consumer contracts</h1>
    <OccupationCase />
    <section data-testid='scroll-occupation-loading'>
      <OccupationsFilter occupationsState={{ loading: true, occupations: [] }} />
    </section>
    <section data-testid='scroll-occupation-empty'>
      <OccupationsFilter occupationsState={{ loading: false, occupations: [] }} />
    </section>
  </main>
)
