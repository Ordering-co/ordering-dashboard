import React, { useState } from 'react'
import { useTheme } from 'styled-components'

import { AutoScroll } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/AutoScroll'
import { DragScroll } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/DragScroll'

const items = count => Array.from({ length: count }, (_, index) => `Long horizontal option ${index + 1}`)
const ItemButtons = ({ count, prefix, record, itemWidth }) => (
  <div className='scroll-fixture-items'>
    {items(count).map((label, index) => <button type='button' key={label} style={itemWidth ? { flexBasis: itemWidth } : undefined} onClick={() => record(`${prefix}-${index + 1}`)}>{label}</button>)}
  </div>
)

const AutoCase = ({ label, modal, special, innerScroll, scrollId, testId, width = 1600, count = 8, itemWidth, record }) => {
  const [position, setPosition] = useState(0)
  return (
    <fieldset data-testid={testId} className='scroll-fixture-cell'>
      <legend>{label}</legend>
      <button data-fixture-focus-before data-testid={`${testId}-focus-before`} type='button'>Focus before {label}</button>
      <div className='auto-scrollport' data-testid={`${testId}-scrollport`} onScroll={event => setPosition(event.currentTarget.scrollLeft)}>
        <div className='auto-scroll-content' style={{ width }}>
          <AutoScroll modal={modal} special={special} innerScroll={innerScroll} scrollId={scrollId}>
            <ItemButtons count={count} itemWidth={itemWidth} prefix={testId} record={record} />
          </AutoScroll>
        </div>
      </div>
      <output data-testid={`${testId}-position`}>{position}</output>
    </fieldset>
  )
}

const DragCase = ({ count, label, record, testId }) => (
  <fieldset data-testid={testId} className='scroll-fixture-cell'>
    <legend>{label}</legend>
    <button data-fixture-focus-before data-testid={`${testId}-focus-before`} type='button'>Focus before {label}</button>
    <DragScroll><ItemButtons count={count} prefix={testId} record={record} /></DragScroll>
  </fieldset>
)

export const ScrollContainersFixture = () => {
  const theme = useTheme()
  const [events, setEvents] = useState([])
  const [dynamicCount, setDynamicCount] = useState(1)
  const record = value => setEvents(current => [...current, value])
  return (
    <main data-testid='scroll-containers-fixture' className='scroll-containers-fixture' style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default }}>
      <style>{`
        .scroll-containers-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
        .scroll-containers-fixture * { box-sizing: border-box; }
        .scroll-containers-fixture > h1, .scroll-fixture-section > h2 { margin: 0; }
        .scroll-fixture-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 16px; min-width: 0; padding: 16px; }
        .scroll-fixture-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); min-width: 0; }
        .scroll-fixture-cell { border: 1px dashed currentColor; min-width: 0; padding: 12px; }
        .scroll-fixture-cell legend { font-size: 14px; padding-inline: 6px; }
        .auto-scrollport { max-width: 100%; overflow-x: auto; overflow-y: hidden; width: 300px; }
        .auto-scroll-content { display: inline-flex; min-width: 0; }
        .scroll-fixture-items { display: inline-flex; flex-wrap: nowrap; min-width: max-content; }
        .scroll-fixture-items > button { flex: 0 0 180px; min-height: 44px; white-space: normal; }
        .scroll-containers-fixture [data-fixture-focus-before] { display: block; margin-bottom: 8px; min-height: 44px; }
        .scroll-containers-fixture output { display: block; max-width: 100%; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
        .scroll-containers-fixture [data-fixture-control] { min-height: 44px; max-width: 100%; white-space: normal; }
        @media (max-width: 420px) { .scroll-containers-fixture { gap: 12px; padding: 12px; } .scroll-fixture-section { padding: 12px; } .auto-scrollport { width: 100%; } }
      `}</style>
      <h1>Ordering.co horizontal scroll containers</h1>
      <section aria-label='AutoScroll contracts' className='scroll-fixture-section' data-testid='autoscroll-cases'>
        <h2>AutoScroll contracts</h2>
        <div className='scroll-fixture-grid'>
          <AutoCase label='Default AutoScroll one' testId='auto-default-one' innerScroll record={record} />
          <AutoCase label='Default AutoScroll two' testId='auto-default-two' width={2200} innerScroll record={record} />
          <AutoCase label='Near-fit AutoScroll' testId='auto-near-fit' scrollId='fixture-near-fit' width={260} count={1} itemWidth={260} innerScroll record={record} />
          <AutoCase label='Explicit AutoScroll' testId='auto-explicit' scrollId='fixture-explicit-autoscroll' innerScroll record={record} />
          <AutoCase label='Special AutoScroll' testId='auto-special' scrollId='fixture-special-autoscroll' special record={record} />
          <AutoCase label='Modal AutoScroll' testId='auto-modal' scrollId='fixture-modal-autoscroll' modal innerScroll record={record} />
        </div>
      </section>
      <section aria-label='DragScroll contracts' className='scroll-fixture-section' data-testid='dragscroll-cases'>
        <h2>DragScroll contracts</h2>
        <div className='scroll-fixture-grid'>
          <DragCase label='Wide draggable row' testId='drag-wide' count={12} record={record} />
          <DragCase label='Dynamic draggable row' testId='drag-dynamic' count={dynamicCount} record={record} />
        </div>
        <button data-fixture-control type='button' onClick={() => setDynamicCount(count => count === 1 ? 10 : 1)}>Toggle dynamic children</button>
      </section>
      <output data-testid='scroll-container-events'>{JSON.stringify(events)}</output>
    </main>
  )
}
