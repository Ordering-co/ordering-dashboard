import React, { useEffect, useRef, useState } from 'react'

// redesign audit-4: Learn is a Product Menu, which reads the --od-x-* tokens the app loads from src/index.js.
import '../../../src/brand/candidates.css'

import { ColorPicker } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/ColorPicker'
import { ColumnAllowSettingPopover } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/ColumnAllowSettingPopover'
import { LearnDropDown } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/LearnDropDown'
import { Modal } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Modal'
import { RangeCalendar } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/RangeCalendar'
import { SideBar } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SideBar'

const colorOutput = state => JSON.stringify(state)
const columnOptions = [
  { value: 'name', content: 'Name column' },
  { value: 'email', content: 'Email column' }
]
const initialLearnOptions = [
  { value: 'launch', name: 'Launch guide', url: 'https://help.ordering.co/launch' },
  { value: 'reports', name: 'Reports guide', url: 'https://help.ordering.co/reports' }
]
const updatedLearnOptions = [
  { value: 'launch', name: 'Updated launch guide', url: 'https://help.ordering.co/launch-updated' },
  { value: 'reports', name: 'Updated reports guide', url: 'https://help.ordering.co/reports-updated' }
]
const initialSingleDate = '2024-06-15T12:00:00'
const initialTimedDate = '2024-06-16T12:34:56'
const initialRange = {
  from: '2024-06-10T12:00:00',
  to: '2024-06-12T12:00:00'
}

const FixtureSection = ({ label, children, testId, minHeight }) => (
  <section
    aria-label={label}
    data-testid={testId}
    style={{
      border: '1px solid currentColor',
      borderRadius: 8,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: 10,
      minHeight,
      minWidth: 0,
      padding: 16
    }}
  >
    <h2 style={{ fontSize: 18, margin: 0 }}>{label}</h2>
    {children}
  </section>
)

const ColorPickerCases = () => {
  const [defaultColor, setDefaultColor] = useState('#112233')
  const [isDisabled, setIsDisabled] = useState(false)
  const [events, setEvents] = useState([])

  return (
    <FixtureSection label='Color picker contract' testId='color-picker-case' minHeight={330}>
      <div data-testid='color-picker-control'>
        <ColorPicker
          defaultColor={defaultColor}
          isDisabled={isDisabled}
          onChangeColor={value => setEvents(current => [...current, value])}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button data-fixture-control type='button' onClick={event => { event.stopPropagation(); setDefaultColor('#663399') }}>Resync color default</button>
        <button data-fixture-control type='button' onClick={event => { event.stopPropagation(); setIsDisabled(value => !value) }}>Toggle color disabled</button>
      </div>
      <output data-testid='color-picker-events'>{colorOutput({ defaultColor, isDisabled, events })}</output>
    </FixtureSection>
  )
}

const ColumnCases = () => {
  const [flatColumns, setFlatColumns] = useState({ name: true, email: false })
  const [orderColumns, setOrderColumns] = useState({
    name: { visable: true, width: 180 },
    email: { visable: false, width: 240 }
  })
  const [controlledOpen, setControlledOpen] = useState(false)
  const [events, setEvents] = useState([])

  const toggleFlat = value => {
    setEvents(current => [...current, { kind: 'flat', value }])
    setFlatColumns(current => ({ ...current, [value]: !current[value] }))
  }
  const toggleOrder = value => {
    setEvents(current => [...current, { kind: 'order', value }])
    setOrderColumns(current => ({
      ...current,
      [value]: { ...current[value], visable: !current[value].visable }
    }))
  }

  return (
    <FixtureSection label='Column popover contract' testId='column-popover-case' minHeight={260}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
        <div data-testid='flat-columns'>
          <ColumnAllowSettingPopover
            title='Flat columns'
            optionsDefault={columnOptions}
            allowColumns={flatColumns}
            handleChangeAllowColumns={toggleFlat}
            open={controlledOpen}
            onOpenChange={() => setEvents(current => [...current, { kind: 'unexpected-controlled-change' }])}
          />
        </div>
        <div data-testid='order-columns'>
          <ColumnAllowSettingPopover
            title='Order columns'
            optionsDefault={columnOptions}
            allowColumns={orderColumns}
            handleChangeAllowColumns={toggleOrder}
            isOrder
            open={controlledOpen}
            onOpenChange={() => setEvents(current => [...current, { kind: 'unexpected-controlled-change' }])}
          />
        </div>
      </div>
      <button
        type='button'
        onMouseUp={event => event.stopPropagation()}
        onClick={() => setControlledOpen(value => !value)}
      >
        Toggle ignored controlled open
      </button>
      <output data-testid='column-popover-events'>
        {JSON.stringify({ controlledOpen, flatColumns, orderColumns, events })}
      </output>
    </FixtureSection>
  )
}

const LearnCases = () => {
  const [learnOptions, setLearnOptions] = useState(initialLearnOptions)
  const [openCalls, setOpenCalls] = useState([])
  const originalOpen = useRef(null)

  useEffect(() => {
    originalOpen.current = window.open
    window.open = (url, target) => {
      setOpenCalls(current => [...current, { url, target }])
      return null
    }
    return () => {
      window.open = originalOpen.current
    }
  }, [])

  return (
    <FixtureSection label='Learn menu contract' testId='learn-menu-case' minHeight={180}>
      <div data-testid='learn-menu-control'>
        <LearnDropDown learnOptions={learnOptions} />
      </div>
      <div data-testid='empty-learn-menu'>
        <LearnDropDown learnOptions={[]} />
      </div>
      <button data-fixture-control type='button' onClick={() => setLearnOptions(updatedLearnOptions)}>Update learn option props</button>
      <output data-testid='learn-menu-events'>
        {JSON.stringify({ options: learnOptions.map(({ value, name, url }) => ({ value, name, url })), openCalls })}
      </output>
    </FixtureSection>
  )
}

const RangeCases = () => {
  const [singleDefault, setSingleDefault] = useState(initialSingleDate)
  const [rangeDefault, setRangeDefault] = useState(initialRange)
  const [events, setEvents] = useState([])
  const [submissions, setSubmissions] = useState(0)
  const record = kind => (...args) => setEvents(current => [...current, { kind, args }])

  return (
    <FixtureSection label='Range calendar contract' testId='range-calendar-case' minHeight={360}>
      <form onSubmit={event => { event.preventDefault(); setSubmissions(value => value + 1) }}>
        <div style={{ alignItems: 'start', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <div data-testid='single-calendar'>
            <RangeCalendar
              isSingleDate
              isLeft
              defaultValue={singleDefault}
              minDate={new Date(2024, 5, 10, 12, 0, 0)}
              handleChangeDate={record('single')}
            />
          </div>
          <div data-testid='timed-calendar'>
            <RangeCalendar
              isSingleDate
              isLeft
              withTime
              defaultValue={initialTimedDate}
              minDate={new Date(2024, 5, 10, 12, 0, 0)}
              handleChangeDate={record('timed')}
            />
          </div>
          <div data-testid='range-calendar'>
            <RangeCalendar
              isLeft
              defaultValue={rangeDefault}
              minDate={new Date(2024, 5, 10, 12, 0, 0)}
              handleChangeDate={record('range')}
            />
          </div>
        </div>
      </form>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button data-fixture-control type='button' onClick={() => setSingleDefault('2024-07-20T12:00:00')}>Resync single default</button>
        <button data-fixture-control type='button' onClick={() => setRangeDefault({ from: '2024-07-21T12:00:00', to: '2024-07-23T12:00:00' })}>Resync range default</button>
      </div>
      <output data-testid='range-calendar-events'>{JSON.stringify({ events, submissions })}</output>
    </FixtureSection>
  )
}

const LayerCases = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [events, setEvents] = useState([])
  const modalOpener = useRef(null)
  const sidebarOpener = useRef(null)

  return (
    <FixtureSection label='Floating picker layers' testId='floating-layer-case' minHeight={160}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button data-fixture-control ref={modalOpener} type='button' onClick={() => setModalOpen(true)}>Open picker modal</button>
        <button data-fixture-control ref={sidebarOpener} type='button' onClick={() => setSidebarOpen(true)}>Open picker sidebar</button>
      </div>
      <Modal
        open={modalOpen}
        title='Color picker modal'
        onClose={() => {
          setEvents(current => [...current, 'modal-close'])
          setModalOpen(false)
        }}
      >
        <div data-testid='modal-color-picker'>
          <p>Modal color</p>
          <ColorPicker defaultColor='#2255AA' onChangeColor={() => {}} />
        </div>
      </Modal>
      {sidebarOpen && (
        <SideBar
          open
          containerRef={sidebarOpener}
          sidebarId='floating-picker-sidebar'
          onClose={() => {
            setEvents(current => [...current, 'sidebar-close'])
            setSidebarOpen(false)
          }}
        >
          <section aria-label='Color picker sidebar' style={{ padding: 72 }}>
            <h2>Color picker sidebar</h2>
            <div data-testid='sidebar-color-picker'>
              <ColorPicker defaultColor='#AA5522' onChangeColor={() => {}} />
            </div>
          </section>
        </SideBar>
      )}
      <output data-testid='floating-layer-events'>{JSON.stringify({ modalOpen, sidebarOpen, events })}</output>
    </FixtureSection>
  )
}

export const FloatingSelectorsFixture = () => (
  <main
    data-testid='floating-selectors'
    style={{
      boxSizing: 'border-box',
      display: 'grid',
      gap: 20,
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
      minWidth: 0,
      padding: 24,
      width: '100%'
    }}
  >
    <style>{'[data-testid="floating-selectors"] output { max-width: 100%; min-width: 0; overflow-wrap: anywhere; word-break: break-word; } [data-testid="floating-selectors"] [data-fixture-control] { max-width: 100%; white-space: normal; }'}</style>
    <h1 style={{ gridColumn: '1 / -1', margin: 0 }}>Ordering.co floating selector fixtures</h1>
    <ColorPickerCases />
    <ColumnCases />
    <LearnCases />
    <RangeCases />
    <LayerCases />
    <button data-fixture-control data-testid='floating-outside-target' type='button'>Outside floating controls</button>
  </main>
)
