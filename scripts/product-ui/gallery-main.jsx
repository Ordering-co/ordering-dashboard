/* Gallery of the governed Product wrappers (orders pilot, wave 4). Not product code.
 * ?theme=dark  ?dir=rtl  ?section=<id>  (one section only, for screenshots)
 * Example data has the shape of the sample tenant (C16: illustrative, labelled). */
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'

import '~/brand/ordering.tokens.generated.css'
import '~/brand/candidates.css'
import './gallery.css'

import {
  Bike, CalendarDays, Columns3, Copy, Download, Inbox, Navigation, Plus, Printer, Receipt, RefreshCw,
  Rows3, SlidersHorizontal, Store, Timer, Trash2, TriangleAlert, Truck, FilterX, WifiOff, X
  , CircleAlert, CircleCheck, Ban, Info, Ellipsis, Menu as MenuIcon
} from '~ui/src/components/Shared/Icon'
import * as P from '~ui/src/components/Shared/Product'
import * as PW from '~ui/src/components/Shared/Product/Wizard'
import { buildOrderRoute } from '~ui/src/utils/orderRoute'
import { ConfigContext } from '~components/contexts/ConfigContext' // redesign 2.E: the 12 h TimeField demo
// redesign 2.B: the SectionSplit harness runs inside the real store editor panel (its CSS, its width rule and its
// Escape contract) and opens a fixed side bar that takes the Escape the way the legacy U/SideBar does.
import '~ui/src/components/Stores/BusinessDetails/store-editor.css'
import { getPanelSize } from '~components/utils/editorPanel'
import { BREAKPOINT_PHONE } from '~components/utils/breakpoints'
import { captureSidebarDismissal, ownsCapturedSidebarDismissal, registerSidebar } from '~ui/src/components/Shared/UI/sidebar-layer'
import { hasActiveDialogLayer } from '~ui/src/components/Shared/UI/dialog-layer'
import appTheme from '~/theme.json'

// redesign W0-7 (T0-29): ImageField, ColorField and PhoneField are imported by file and on demand (React.lazy): they load
// the legacy pieces and bootstrap.css, which repaints the whole page. Only the legacy-fields section loads them.
const ImageField = lazy(() => import('~ui/src/components/Shared/Product/ImageField').then(m => ({ default: m.ImageField })))
const ColorField = lazy(() => import('~ui/src/components/Shared/Product/ColorField').then(m => ({ default: m.ColorField })))
const PhoneField = lazy(() => import('~ui/src/components/Shared/Product/PhoneField').then(m => ({ default: m.PhoneField })))
// redesign home FA (D8): the chart is imported by file and on demand: it pulls Chart.js, which the barrel never loads.
const Chart = lazy(() => import('~ui/src/components/Shared/Product/Chart').then(m => ({ default: m.Chart })))

const params = new URLSearchParams(location.search)
const theme = params.get('theme') === 'dark' ? 'dark' : 'light'
const dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
const only = params.get('section')
document.documentElement.dataset.odTheme = theme
document.documentElement.dir = dir

const ORDERS = [
  { id: 13792, ago: '1 h 12 min', status: 'Accepted by business', family: 'progress', sla: ['late', 'Delayed · 12 min'], biz: 'Fool and Fattah', cust: 'Customer Demo', driver: null, total: '$56.00' },
  { id: 13793, ago: '1 h 1 min', status: 'Driver almost arrived to customer', family: 'progress', sla: ['late', 'Delayed · 7 min'], biz: 'Subway', cust: 'Rafael Soto', driver: 'Kofi Mensah', total: '$26.45' },
  { id: 13791, ago: '1 h 18 min', status: 'Preparation completed', family: 'progress', sla: ['risk', 'Due in 2 min'], biz: 'P.F. Changs', cust: 'Grace Okafor', driver: null, total: '$73.15' },
  { id: 13798, ago: '34 min', status: 'Order not ready', family: 'review', sla: ['risk', 'Due in 3 min'], biz: 'Subway', cust: 'Omar Haddad', driver: 'Ana Pérez', total: '$14.05' },
  { id: 13799, ago: '30 min', status: 'Driver arrived to business', family: 'progress', sla: ['ok', 'On time'], biz: 'Fast Bite', cust: 'Mei Chen', driver: 'Marta Díaz', total: '$31.67' },
  { id: 13790, ago: '1 h 20 min', status: 'Delivery completed by driver', family: 'done', sla: ['ok', 'On time'], biz: 'Fast Bite', cust: 'Mei Chen', driver: 'Marta Díaz', total: '$24.60' },
  { id: 13764, ago: 'Oct 3', status: 'Rejected by business', family: 'cancel', sla: ['ok', 'On time'], biz: 'Portare', cust: 'Luis Mora with a very long family name', driver: null, total: '$42.00' }
]

const Section = ({ id, title, children, flush, fit }) => {
  if (only && only !== id) return null
  return (
    <section className='g-section' id={id} data-testid={`section-${id}`}>
      <h2>{title}</h2>
      <div className={['g-body', flush && 'flush', fit && 'fit'].filter(Boolean).join(' ')}>{children}</div>
    </section>
  )
}

const Who = ({ name, kind }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--od-space-2)' }}>
    <P.Avatar name={name} kind={kind} /><span>{name}</span>
  </span>
)

const columns = [
  { id: 'order', header: 'Order', locked: true, cell: o => <span><b className='odc-mono'>#{o.id}</b> <span className='odc-muted'>{o.ago}</span></span> },
  { id: 'status', header: 'Status', locked: true, cell: o => <P.Status family={o.family} label={o.status} /> },
  { id: 'sla', header: 'SLA', cell: o => <P.SlaBadge level={o.sla[0]} label={o.sla[1]} /> },
  { id: 'business', header: 'Business', hideBelow: 1100, cell: o => <Who name={o.biz} kind='business' /> },
  { id: 'customer', header: 'Customer', hideBelow: 900, cell: o => <Who name={o.cust} /> },
  { id: 'driver', header: 'Driver', hideBelow: 820, cell: o => o.driver ? <Who name={o.driver} /> : <P.Button size='sm'>Assign</P.Button> },
  { id: 'total', header: 'Total', align: 'end', cell: o => <span className='odc-num'>{o.total}</span> }
]

const TableDemo = ({ density = 'comfortable', loading = false, empty = false }) => {
  const [selected, setSelected] = useState(density === 'comfortable' && !loading && !empty ? [13792, 13793] : [])
  const [active, setActive] = useState(13791)
  const rows = empty ? [] : ORDERS
  return (
    <div className='g-table'>
      <P.DataTable
        label='In progress orders, most urgent first'
        columns={columns}
        rows={rows}
        getRowId={o => o.id}
        density={density}
        activeRowId={active}
        onOpenRow={o => setActive(o.id)}
        newRowIds={[]}
        loading={loading}
        selection={{
          selectedIds: selected,
          onToggle: id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]),
          onToggleAll: on => setSelected(on ? rows.map(o => o.id) : []),
          rowLabel: o => `Select order ${o.id}`,
          allLabel: 'Select all orders on this page'
        }}
        onClearSelection={() => setSelected([])}
        empty={<P.EmptyState icon={FilterX} title='No orders match these filters' description='Nothing in Completed matches “zzz-nothing”, Today and Fast Bite.' action={<P.Button>Clear filters</P.Button>} />}
      />
      {selected.length > 0 && (
        <P.SelectionBar
          label='Selection'
          countLabel={`${selected.length} selected`}
          selectAllLabel='Select all 8'
          onSelectAll={() => {}}
          actions={<>
            <P.Button size='sm' icon={RefreshCw}>Change status</P.Button>
            <P.Button size='sm' icon={Bike}>Assign driver</P.Button>
            <P.Button size='sm' icon={Download}>Export</P.Button>
            <P.Button size='sm' icon={Trash2} data-tone='danger'>Delete…</P.Button>
          </>}
          clearLabel='Clear selection'
          onClear={() => setSelected([])}
        />
      )}
    </div>
  )
}

const ColumnsDemo = () => {
  const [cols, setCols] = useState([
    { id: 'order', label: 'Order', visible: true, locked: true },
    { id: 'status', label: 'Status', visible: true, locked: true },
    { id: 'sla', label: 'SLA', visible: true },
    { id: 'business', label: 'Business', visible: true, widthHidden: true },
    { id: 'customer', label: 'Customer', visible: true },
    { id: 'driver', label: 'Driver', visible: true },
    { id: 'total', label: 'Total', visible: true },
    { id: 'external', label: 'External ID', visible: false },
    { id: 'eta', label: 'ETA', visible: false }
  ])
  return (
    <div className='g-row' style={{ justifyContent: 'flex-end' }}>
      <P.ColumnManager
        columns={cols}
        onChange={setCols}
        onReset={() => {}}
        triggerLabel='Manage columns'
        title='Columns'
        resetLabel='Reset'
        lockedNote='Always shown'
        widthHiddenNote='Hidden at this width'
        moveUpLabel={l => `Move ${l} up`}
        moveDownLabel={l => `Move ${l} down`}
      />
    </div>
  )
}

const FilterDemo = ({ active }) => {
  const [q, setQ] = useState(active ? 'zzz-nothing' : '')
  const [chips, setChips] = useState(active ? ['date', 'business'] : [])
  const chipList = [
    { key: 'date', label: 'Date: Today' },
    { key: 'business', label: 'Business: Fast Bite' }
  ].filter(c => chips.includes(c.key)).map(c => ({ ...c, removeLabel: `Remove ${c.label}`, onRemove: () => setChips(s => s.filter(k => k !== c.key)) }))
  return (
    <P.FilterBar
      label='Order filters'
      overflowLabel={count => `+${count} more filters`}
      search={<P.SearchField value={q} onChange={setQ} label='Search by order number, customer or phone' placeholder='Search orders' clearLabel='Clear search' />}
      filters={<>
        <P.FilterPill icon={CalendarDays} label='Date' value={chips.includes('date') ? 'Today' : undefined} hasPopup='dialog' />
        <P.FilterPill icon={Store} label='Business' value={chips.includes('business') ? 'Fast Bite' : undefined} hasPopup='dialog' />
        <P.FilterPill icon={Truck} label='Driver group' priority='secondary' hasPopup='dialog' />
        <P.FilterPill icon={Timer} label='SLA' priority='secondary' hasPopup='dialog' />
      </>}
      more={<P.Button icon={SlidersHorizontal}>{chips.length ? `Filters ${chips.length}` : 'Filters'}</P.Button>}
      clear={chips.length ? <P.Button variant='ghost' size='sm' onClick={() => setChips([])}>Clear filters</P.Button> : null}
      tools={<>
        <P.IconButton icon={Rows3} label='Compact rows' aria-pressed='false' />
        <P.IconButton icon={Columns3} label='Manage columns' />
      </>}
      chips={chipList.length ? <P.FilterChips label='Active filters' chips={chipList} clearAllLabel='Clear all' onClearAll={() => setChips([])} /> : null}
      notice={chips.length ? <P.InlineNotice tone='warning'>Filters are on. New orders that don’t match them won’t appear in this list.</P.InlineNotice> : null}
    />
  )
}

const TabsDemo = () => {
  const [value, setValue] = useState('progress')
  // redesign reviews FA1 (D2, coordinador: opción c): the same tabs with `wrap`, in frames the width of a phone, so they break into lines.
  const [wrapped, setWrapped] = useState('drivers')
  const wrappedItems = [
    { value: 'business', label: 'Business' },
    { value: 'drivers', label: 'Drivers' },
    { value: 'customers', label: 'Customers' },
    { value: 'professionals', label: 'Professionals' },
    { value: 'products', label: 'Products' }
  ]
  return (
    <>
      <P.Tabs
        label='Order status'
        value={value}
        onValueChange={setValue}
        items={[
          { value: 'pending', label: 'Pending', count: 3, attention: true, countLabel: '3 orders waiting' },
          { value: 'progress', label: 'In progress', count: 8, countLabel: '8 orders' },
          { value: 'completed', label: 'Completed', count: 744, countLabel: '744 orders' },
          { value: 'cancelled', label: 'Cancelled', count: 2, countLabel: '2 orders' }
        ]}
      >
        <P.TabPanel value={value}><p className='odc-muted' style={{ margin: 'var(--od-space-3) 0 0' }}>Panel: {value}</p></P.TabPanel>
      </P.Tabs>
      {[320, 360, 390].map(width => (
        <div key={width} className='g-frame' data-testid={`tabs-wrap-frame-${width}`} style={{ inlineSize: `${width}px`, maxInlineSize: '100%', marginBlockStart: 'var(--od-space-4)' }}>
          <P.Tabs label={`Reviews of ${width}`} wrap value={wrapped} onValueChange={setWrapped} items={wrappedItems} />
        </div>
      ))}
    </>
  )
}

// FA states: the bar and the tabs inside frames too narrow for them, a flush bar, the single-choice menu.
const OverflowBar = () => (
  <P.FilterBar
    label='Order filters'
    overflowLabel={count => `+${count} more filters`}
    search={<P.SearchField value='' onChange={() => {}} label='Search by order number, customer or phone' placeholder='Search orders' clearLabel='Clear search' />}
    filters={<>
      <P.FilterPill icon={CalendarDays} label='Date' hasPopup='dialog' />
      <P.FilterPill icon={Store} label='Business' hasPopup='dialog' />
      <P.FilterPill icon={Truck} label='Driver group' hasPopup='dialog' />
      <P.FilterPill icon={Timer} label='SLA' hasPopup='dialog' />
      <P.FilterPill label='City' hasPopup='dialog' />
      <P.FilterPill label='Payment method' hasPopup='dialog' />
    </>}
    more={<P.Button icon={SlidersHorizontal}>Filters</P.Button>}
  />
)

// Redesign F1b · the bar of /orders with its six pills, in the widths where it overflowed: it is always one row
// (never stacked, never wrapped); the pills that do not fit leave it for the «+N» menu, and the tools stay at the
// end, also in a split view (552px). The bar never changes height when the list narrows beside the order panel.
// `plain` is the bar with no filter on (the six pills do not fit 552px); without it the bar has two filters on,
// their values in the pills and the chips under them.
const OrdersLikeBar = ({ plain = false }) => (
  <P.FilterBar
    flush
    label='Order filters'
    overflowLabel={count => `+${count} more filters`}
    search={<P.SearchField value='' onChange={() => {}} label='Search by order number, customer, phone or store' placeholder='Search' clearLabel='Clear search' />}
    filters={<>
      <P.FilterPill icon={Timer} label='Status' value={plain ? undefined : '2 selected'} hasPopup='dialog' />
      <P.FilterPill icon={Timer} label='SLA' hasPopup='dialog' />
      <P.FilterPill icon={Truck} label='Driver' hasPopup='dialog' />
      <P.FilterPill icon={Truck} label='Driver group' hasPopup='dialog' />
      <P.FilterPill icon={CalendarDays} label='Date' value={plain ? undefined : 'Last 30 days'} hasPopup='dialog' />
      <P.FilterPill icon={Store} label='Business' value={plain ? undefined : 'Fast Bite'} hasPopup='dialog' />
    </>}
    more={<P.Button icon={SlidersHorizontal}>{plain ? 'Filters' : 'Filters 2'}</P.Button>}
    clear={plain ? undefined : <P.Button variant='ghost'>Clear filters</P.Button>}
    tools={<>
      <P.IconButton icon={Rows3} label='Compact rows' aria-pressed='false' />
      <P.IconButton icon={Columns3} label='Manage columns' />
    </>}
    chips={plain ? undefined : <P.FilterChips label='Active filters' chips={[{ key: 'date', label: 'Date: Last 30 days', removeLabel: 'Remove Date: Last 30 days', onRemove: () => {} }, { key: 'business', label: 'Business: Fast Bite', removeLabel: 'Remove Business: Fast Bite', onRemove: () => {} }]} clearAllLabel='Clear filters' onClearAll={() => {}} />}
  />
)

const FlushBar = () => (
  <P.FilterBar
    flush
    label='Order filters'
    search={<P.SearchField value='' onChange={() => {}} label='Search by order number, customer or phone' placeholder='Search orders' clearLabel='Clear search' />}
    filters={<P.FilterPill icon={CalendarDays} label='Date' value='Today' hasPopup='dialog' />}
    more={<P.Button icon={SlidersHorizontal}>Filters 1</P.Button>}
    chips={<P.FilterChips label='Active filters' chips={[{ key: 'date', label: 'Date: Today', removeLabel: 'Remove Date: Today', onRemove: () => {} }]} clearAllLabel='Clear all' onClearAll={() => {}} />}
    notice={<P.InlineNotice tone='warning'>Filters are on. New orders that don’t match them won’t appear in this list.</P.InlineNotice>}
  />
)

const SlaMenu = () => {
  const [sla, setSla] = useState('risk')
  return (
    <div className='g-row'>
      <P.Menu
        label='SLA'
        align='start'
        items={[
          { key: 'ontime', type: 'radio', label: 'On time', checked: sla === 'ontime', onSelect: () => setSla('ontime') },
          { key: 'risk', type: 'radio', label: 'At risk', checked: sla === 'risk', onSelect: () => setSla('risk') },
          { key: 'late', type: 'radio', label: 'Delayed', checked: sla === 'late', onSelect: () => setSla('late') },
          { key: 'clear', label: 'Clear', onSelect: () => setSla(null), separatorBefore: true }
        ]}
      />
    </div>
  )
}

const ROUTE_LABELS = { placed: 'Placed', accepted: 'Accepted', ready: 'Ready', pickedUp: 'Picked up', delivered: 'Delivered', collected: 'Collected', completed: 'Completed' }
const describeStep = step => step.state === 'done'
  ? `${step.label}, done${step.at ? ` at ${step.at}` : ''}`
  : step.state === 'next' ? `${step.label}, next step` : step.state === 'stop' ? `${step.label}, the order stopped here` : `${step.label}, not reached`
const ROUTES = [
  ['In progress, delayed', buildOrderRoute({ status: 7, deliveryType: 1, placedAt: '08:20', events: [{ status: 7, at: '08:26' }], labels: ROUTE_LABELS }), { tone: 'late', icon: CircleAlert, children: <span><b>Delayed 12 min</b> past the estimated delivery time (09:20). Next step: the business marks it ready.</span> }],
  ['Delivered', buildOrderRoute({ status: 11, deliveryType: 1, placedAt: '15:51', events: [{ status: 7, at: '15:58' }, { status: 4, at: '16:20' }, { status: 9, at: '16:31' }, { status: 11, at: '16:51' }], labels: ROUTE_LABELS }), { tone: 'ok', icon: CircleCheck, children: <span>Completed on time.</span> }],
  ['Pickup, collected', buildOrderRoute({ status: 15, deliveryType: 2, placedAt: '11:56', events: [{ status: 7, at: '12:01' }, { status: 4, at: '12:20' }, { status: 15, at: '12:38' }], labels: ROUTE_LABELS }), null],
  ['Rejected', buildOrderRoute({ status: 5, deliveryType: 1, placedAt: '04:08', events: [{ status: 5, at: '04:12' }], labels: ROUTE_LABELS, stopLabel: 'Rejected by business' }), { tone: 'stop', icon: Ban, children: <span><b>Rejected by business</b> at 04:12. Reason given: “Closing early tonight”.</span> }]
]

// Milestones with a date, as the detail panel shows an order of another day.
const DATED_ROUTE = buildOrderRoute({
  status: 11,
  deliveryType: 1,
  placedAt: 'Oct 1, 11:51 AM',
  events: [{ status: 7, at: 'Oct 1, 11:58 AM' }, { status: 4, at: 'Oct 1, 12:20 PM' }, { status: 9, at: 'Oct 1, 12:31 PM' }, { status: 11, at: 'Oct 1, 12:53 PM' }],
  labels: ROUTE_LABELS
})

const TimelineDemo = () => {
  const [show, setShow] = useState('all')
  return (
    <P.ActivityTimeline
      label='Order activity'
      detailsLabel='Technical details'
      filter={<div style={{ inlineSize: '100%' }}><P.SegmentedControl label='Show' value={show} onValueChange={setShow} options={[{ value: 'all', label: 'All' }, { value: 'status', label: 'Status' }, { value: 'logistics', label: 'Logistics' }, { value: 'payments', label: 'Payments' }]} /></div>}
      items={[
        { id: 1, at: 'Oct 2, 16:51', key: true, title: <span>Status changed to <b>Delivery completed by driver</b></span>, by: 'by Driver Test · driver app', details: <span className='odc-mono'>App id ordering-react-native</span> },
        { id: 2, at: 'Oct 2, 16:31', title: <span>Status changed to <b>Picked up by driver</b></span>, by: 'by Driver Test' },
        { id: 3, at: 'Oct 2, 16:12', title: <span>Driver <b>Driver Test</b> assigned</span>, by: 'by Ordering Admin · comment “test”' },
        { id: 4, at: 'Oct 2, 16:05', title: <span>Logistics: drivers not found, <b>attempt 3</b></span>, by: 'Driver groups 1, 67 and 100' },
        { id: 5, at: 'Oct 2, 15:51', key: true, title: <span>Order placed on <b>Web marketplace</b></span>, by: 'by Customer Demo' }
      ]}
    />
  )
}

// redesign UF-B1b: P/SaveBar, promoted from the Settings save bar; every state, and the submit form inside a <form>
const SAVE_BAR = {
  label: 'Save changes',
  discardLabel: 'Discard',
  saveLabel: 'Save changes',
  savedText: 'Saved',
  moreText: n => `+${n}`,
  onDiscard: () => {},
  onSave: () => {}
}

const SaveBarStates = () => (
  <>
    {[
      ['Count with names and «+n»', { count: 5, countText: '5 unsaved changes', names: ['Name', 'Email', 'Phone', 'Language', 'Photo'] }],
      ['Validation error', { count: 2, countText: '2 unsaved changes', names: ['Email', 'Phone'], errorText: 'Fix 1 field to save.' }],
      ['API error', { count: 2, countText: '2 unsaved changes', names: ['Email', 'Phone'], errorText: 'We couldn’t save your changes. Server unavailable' }],
      ['Partial error', { count: 2, countText: '2 unsaved changes', names: ['Phone'], errorText: 'Saved 1 of 3. Phone failed: Invalid value' }],
      ['Saving', { count: 2, countText: '2 unsaved changes', names: ['Email', 'Phone'], saving: true }],
      ['Saved', { count: 0, saved: true }],
      // redesign stores 2.A: the opt-in Retry after a failed save
      ['API error with Retry', { count: 1, countText: '1 unsaved change', errorText: 'We couldn’t save your changes. Slug already in use', onRetry: () => {}, retryLabel: 'Retry' }]
    ].map(([title, props]) => (
      <div key={title}>
        <p className='g-label'>{title}</p>
        <P.SaveBar {...SAVE_BAR} {...props} />
      </div>
    ))}
    <p className='g-label'>Inside a form (saveType submit)</p>
    <form onSubmit={event => event.preventDefault()}>
      <P.TextField label='Name' defaultValue='Taylor Example' />
      <P.SaveBar {...SAVE_BAR} count={1} countText='1 unsaved change' names={['Name']} saveType='submit' onSave={undefined} />
    </form>
  </>
)

// redesign stores 5.18 (F7 of 5.11, m3 of 5.13): a short scroller (a phone panel) whose save bar appears with the first change.
// The bar is sticky at the foot of the scroller: the field being typed in must stay above it.
const SAVE_BAR_FIELDS = ['Name', 'Email', 'Phone', 'Address', 'City', 'Zip code', 'Country', 'Company', 'Website', 'Notes']
const SaveBarRevealDemo = () => {
  const initial = Object.fromEntries(SAVE_BAR_FIELDS.map(name => [name, '']))
  const [values, setValues] = useState(initial)
  const changed = SAVE_BAR_FIELDS.filter(name => values[name] !== '')
  return (
    <div data-testid='savebar-scroller' style={{ blockSize: 'calc(var(--od-space-8) * 10)', overflowY: 'auto', border: 'var(--od-x-hairline) solid var(--od-border)' }}>
      <form onSubmit={event => event.preventDefault()} style={{ display: 'grid', gap: 'var(--od-space-4)', padding: 'var(--od-space-4)' }}>
        {SAVE_BAR_FIELDS.map(name => (
          <P.TextField key={name} label={name} value={values[name]} onChange={next => setValues(previous => ({ ...previous, [name]: next }))} />
        ))}
        <P.SaveBar
          {...SAVE_BAR}
          count={changed.length}
          countText={`${changed.length} unsaved ${changed.length === 1 ? 'change' : 'changes'}`}
          names={changed}
          onDiscard={() => setValues(initial)}
        />
      </form>
    </div>
  )
}

// redesign stores 2.A (decision 4): the leave guard. A host asks «Keep editing · Save and continue · Discard» before any way
// out of a form with unsaved changes; the form registers itself with useLeaveGuard and a tab of its own asks with useRequestLeave.
const LeaveGuardForm = ({ value, setValue, saved, setSaved }) => {
  const dirty = value !== saved
  P.useLeaveGuard({
    dirty,
    count: dirty ? 1 : 0,
    save: () => { setSaved(value); return { ok: true } },
    discard: () => setValue(saved)
  })
  const requestLeave = P.useRequestLeave()
  const [tab, setTab] = useState('information')
  return (
    <div style={{ display: 'grid', gap: 'var(--od-space-3)' }}>
      <P.Tabs
        label='Store details'
        value={tab}
        onValueChange={next => requestLeave(() => setTab(next))}
        items={[{ value: 'information', label: 'Information' }, { value: 'seo', label: 'SEO' }]}
        size='sm'
      />
      <P.TextField label={tab === 'information' ? 'Short description' : 'SEO title'} value={value} onChange={event => setValue(event.target.value)} />
      <P.SaveBar
        {...SAVE_BAR}
        count={dirty ? 1 : 0}
        countText='1 unsaved change'
        onDiscard={() => setValue(saved)}
        onSave={() => setSaved(value)}
      />
    </div>
  )
}

const LeaveGuardDemo = () => {
  const leave = P.useLeaveGuardHost()
  const [section, setSection] = useState('Store details')
  const [saved, setSaved] = useState('A modern quick-service restaurant')
  const [value, setValue] = useState(saved)
  return (
    <P.LeaveGuardContext.Provider value={leave.context}>
      <div className='g-row'>
        {['Store details', 'Schedule'].map(name => (
          <P.Button key={name} variant={section === name ? 'primary' : 'secondary'} onClick={() => leave.requestLeave(() => setSection(name))}>{name}</P.Button>
        ))}
      </div>
      {section === 'Store details'
        ? <LeaveGuardForm value={value} setValue={setValue} saved={saved} setSaved={setSaved} />
        : <p className='odc-muted'>Schedule</p>}
      <P.LeaveDialog
        {...leave.dialog}
        title='Discard your changes?'
        description={`You have unsaved changes in ${section}. If you leave, they are lost.`}
        keepLabel='Keep editing'
        saveLabel='Save and continue'
        discardLabel='Discard'
        closeLabel='Close'
      />
    </P.LeaveGuardContext.Provider>
  )
}

const OverlayDemo = () => {
  const [open, setOpen] = useState(params.get('open') || '')
  const close = () => setOpen('')
  return (
    <div className='g-row'>
      <P.Button onClick={() => setOpen('dialog')} data-testid='open-dialog'>Clone order…</P.Button>
      <P.Button variant='danger' onClick={() => setOpen('confirm')} data-testid='open-confirm'>Delete order…</P.Button>
      <P.Button icon={SlidersHorizontal} onClick={() => setOpen('sheet')} data-testid='open-sheet'>Filters</P.Button>
      <P.Dialog
        open={open === 'dialog'}
        onOpenChange={o => !o && close()}
        title='Clone order #13729'
        description='A new pending order is created with the same customer and items.'
        size='sm'
        closeLabel='Close'
        footer={<><P.Button onClick={close}>Cancel</P.Button><P.Button variant='primary' onClick={close}>Clone order</P.Button></>}
      >
        <P.Checkbox checked>Keep the delivery address</P.Checkbox>
      </P.Dialog>
      <P.ConfirmDialog
        open={open === 'confirm'}
        title='Delete order #13729?'
        confirmLabel='Delete order'
        cancelLabel='Cancel'
        closeLabel='Close'
        onConfirm={close}
        onCancel={close}
      >
        <p>Order <strong>#13729</strong> for Customer Demo, <strong>$35.23</strong>, will be deleted. <strong>This can’t be undone.</strong></p>
      </P.ConfirmDialog>
      <P.Sheet
        open={open === 'sheet'}
        onOpenChange={o => !o && close()}
        title='Filters'
        closeLabel='Close filters'
        footer={<><P.Button onClick={close}>Clear filters</P.Button><P.Button variant='primary' onClick={close}>Show results</P.Button></>}
      >
        <P.FilterChips label='Active filters' chips={[{ key: 'd', label: 'Date: Today', removeLabel: 'Remove Date: Today', onRemove: () => {} }]} />
        <p className='odc-muted'>Grouped, labelled fields go here (Order, Customer, Location, Logistics, Payment and marketing).</p>
      </P.Sheet>
    </div>
  )
}

const SplitPanel = () => {
  const { mode, onClose } = P.useSplitView()
  return (
    <div style={{ padding: 'var(--od-space-4) var(--od-space-5)', display: 'grid', gap: 'var(--od-space-3)' }}>
      <div className='g-row'>
        <b className='odc-mono' style={{ fontSize: 'var(--od-x-type-title-size)' }}>#13792</b>
        <P.StatusBadge family='progress' label='Accepted by business' />
        <span style={{ flex: 1 }} />
        <P.IconButton icon={X} label={mode === 'full' ? 'Back to orders' : 'Close'} onClick={onClose} />
      </div>
      <P.OrderRoute label='Order progress' steps={ROUTES[0][1].steps} describeStep={describeStep} note={ROUTES[0][2]} />
    </div>
  )
}

const SplitDemo = () => {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ blockSize: '420px', display: 'grid' }}>
      <P.SplitView
        open={open}
        onClose={() => setOpen(false)}
        panelLabel='Order 13792'
        resizeLabel='Resize the order panel'
        list={<TableDemo density='compact' />}
        panel={<SplitPanel />}
      />
      {!open && <div style={{ padding: 'var(--od-space-3)' }}><P.Button onClick={() => setOpen(true)}>Open order</P.Button></div>}
    </div>
  )
}

// redesign 2.B: SectionSplit. The harness is the store editor panel of /stores/list (class odc-se-panel and its
// store-editor.css, the width from getPanelSize, the Escape from useEditorPanel), with a Delivery zones section of 22 zones.
// «Share with» opens a fixed side bar inside the detail, registered in the sidebar layer and closing on Escape from 1000px,
// as U/SideBar does. Example data (C16: illustrative).
const SPLIT_ZONES = [
  { id: 1, name: 'Everywhere', type: 'Everywhere', minimum: '$10.00', fee: '$10.00' },
  { id: 2, name: 'Zone Fast Bite principal', type: 'Polygon', minimum: '$100.00', fee: '$55.00' },
  { id: 3, name: '2km', type: 'Circle', minimum: '$1.00', fee: '$1.00' },
  ...Array.from({ length: 19 }, (_, index) => ({ id: index + 4, name: `Zone ${index + 4}`, type: index % 2 ? 'Circle' : 'Polygon', minimum: `$${index + 5}.00`, fee: `$${index + 2}.50` }))
]
const SPLIT_COLUMNS = [
  { id: 'name', header: 'Zone', cell: zone => zone.name },
  { id: 'type', header: 'Type', cell: zone => zone.type, hideBelow: 360 },
  { id: 'minimum', header: 'Minimum', align: 'end', cell: zone => <span className='odc-figure'>{zone.minimum}</span> },
  { id: 'fee', header: 'Fee', align: 'end', cell: zone => <span className='odc-figure'>{zone.fee}</span> }
]
const SPLIT_STORE_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'delivery', label: 'Delivery & pickup' },
  { id: 'payment_methods', label: 'Payment methods' }
]

const LegacySideBarStandIn = ({ onClose }) => {
  const ref = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const unregister = registerSidebar(ref)
    const capture = event => captureSidebarDismissal(event, hasActiveDialogLayer())
    const onKeyDown = event => {
      if (!ownsCapturedSidebarDismissal(event, ref)) return
      if (event.code === 'Escape' && window.innerWidth >= 1000) onCloseRef.current()
    }
    document.addEventListener('keydown', capture, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      unregister()
      document.removeEventListener('keydown', capture, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])
  return (
    <aside
      ref={ref}
      aria-label='Share with stores'
      data-testid='legacy-sidebar'
      style={{
        position: 'fixed',
        insetBlock: 0,
        insetInlineEnd: 0,
        inlineSize: 'min(var(--od-x-store-panel), 100vw)',
        zIndex: 'calc(var(--od-x-layer-chrome) + 10)',
        background: 'var(--od-bg)',
        borderInlineStart: 'var(--od-x-hairline) solid var(--od-border)',
        boxShadow: 'var(--od-x-pop-shadow)',
        padding: 'var(--od-space-4)',
        display: 'grid',
        alignContent: 'start',
        gap: 'var(--od-space-3)'
      }}
    >
      <div className='g-row'><b>Share with stores</b><span style={{ flex: 1 }} /><P.IconButton icon={X} label='Close share with stores' onClick={onClose} /></div>
      <p className='odc-muted'>A fixed side bar opened from the detail, as the legacy ones are: it paints over the whole page.</p>
    </aside>
  )
}

const useRoomWidth = () => {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

// The form of the open zone: controlled fields, keyed by the zone, and a leave guard that the piece (X, «‹ Zones», Escape, another
// row) and the host (closing the editor) both reach, as a lot of wave 5 wires it (decisions.md, instruction 5).
const SplitZoneForm = ({ zone, draft, setDraft, saved, onSave, onDiscard, sharing, onCloseShare }) => {
  const { registerCloseGuard } = P.useSectionSplit()
  const dirty = draft.name !== saved.name || draft.minimum !== saved.minimum || draft.fee !== saved.fee
  P.useLeaveGuard({ dirty, save: onSave, discard: onDiscard, registerCloseGuard })
  return (
    <div style={{ display: 'grid', gap: 'var(--od-space-3)' }}>
      <P.TextField label='Name' value={draft.name} onChange={name => setDraft({ ...draft, name })} />
      <P.TextField label='Minimum purchase' value={draft.minimum} onChange={minimum => setDraft({ ...draft, minimum })} />
      <P.TextField label='Delivery fee' value={draft.fee} onChange={fee => setDraft({ ...draft, fee })} />
      <div style={{ blockSize: 'var(--od-x-map-height)', border: 'var(--od-x-hairline) solid var(--od-border)', borderRadius: 'var(--od-radius-component)', background: 'var(--od-surface-subtle)' }} aria-hidden='true' />
      {sharing && <LegacySideBarStandIn onClose={onCloseShare} />}
      {zone == null && <p className='odc-muted'>A new zone.</p>}
    </div>
  )
}

const EMPTY_ZONE = { name: '', minimum: '', fee: '' }

const SectionSplitEditor = ({ splitFrom, onClose }) => {
  const panelRef = useRef(null)
  const splitRef = useRef(null)
  const leave = P.useLeaveGuardHost()
  const width = useRoomWidth()
  const [extended, setExtended] = useState(false)
  const [zoneId, setZoneId] = useState(null)
  const [saved, setSaved] = useState(EMPTY_ZONE)
  const [draft, setDraft] = useState(EMPTY_ZONE)
  const [sharing, setSharing] = useState(false)
  const zone = SPLIT_ZONES.find(item => item.id === zoneId)
  const dirty = draft.name !== saved.name || draft.minimum !== saved.minimum || draft.fee !== saved.fee
  // Closing the editor is a way out of the host: it asks the open zone first (useNestedLeaveGuard inside SectionSplit).
  const closeEditor = () => leave.requestLeave(onClose)
  P.useEditorPanel({ open: true, panelRef, onClose: closeEditor })

  const openZone = id => {
    const next = SPLIT_ZONES.find(item => item.id === id)
    const values = next ? { name: next.name, minimum: next.minimum, fee: next.fee } : EMPTY_ZONE
    setZoneId(id)
    setSaved(values)
    setDraft(values)
    setSharing(false)
  }

  return (
    <P.LeaveGuardContext.Provider value={leave.context}>
      <aside
        ref={panelRef}
        tabIndex={-1}
        className='odc-root odc-se-panel'
        data-open=''
        data-size={getPanelSize({ width, isExpand: false, sectionOpen: true, isExtendExtraOpen: extended })}
        data-section=''
        aria-label='Store editor'
        data-testid='split-editor'
      >
        <div className='odc-se-head'>
          <div className='odc-se-head-row'>
            <h2 className='odc-se-title'>Fast Bite</h2>
            <span className='odc-se-spacer' />
            <div className='odc-se-actions'>
              {extended && <P.Button size='sm' onClick={() => setExtended(false)}>All sections</P.Button>}
              <P.Menu label='More store actions' icon={Ellipsis} items={[{ key: 'duplicate', label: 'Duplicate', onSelect: () => {} }]} />
              <P.IconButton icon={X} label='Close store editor' onClick={closeEditor} />
            </div>
          </div>
        </div>
        <div className='odc-se-main' data-view='section' data-nav={extended ? 'hidden' : undefined}>
          {!extended && (
            <div className='odc-se-nav'>
              <P.SectionNav className='odc-se-sections' label='Store sections' compactLabel='Section' items={SPLIT_STORE_SECTIONS} value='delivery' onValueChange={() => {}} />
            </div>
          )}
          <div className='odc-se-content' data-testid='split-content'>
            <div style={{ padding: 'var(--od-space-4) var(--od-space-5)', display: 'grid', gap: 'var(--od-space-3)' }}>
              <div className='g-row'>
                <b>Delivery zones</b>
                <span style={{ flex: 1 }} />
                <P.Button size='sm' variant='primary' icon={Plus} onClick={() => splitRef.current.requestLeave(() => openZone('new'))}>Add zone</P.Button>
              </div>
              <P.SectionSplit
                ref={splitRef}
                open={zoneId != null}
                detailKey={zoneId}
                onClose={() => { setZoneId(null); setSharing(false) }}
                onExtendChange={setExtended}
                splitFrom={splitFrom}
                detailTitle={zone?.name ?? 'New zone'}
                closeLabel='Close zone'
                backLabel='Zones'
                headerActions={
                  <>
                    <P.Button size='sm' onClick={() => setSharing(true)}>Share with</P.Button>
                    <P.Menu label='More zone actions' icon={Ellipsis} items={[{ key: 'snooze', label: 'Snooze', onSelect: () => {} }, { key: 'delete', label: 'Delete', tone: 'danger', onSelect: () => {} }]} />
                  </>
                }
                footer={dirty
                  ? (
                    <div className='g-row'>
                      <span className='odc-muted' style={{ flex: 1 }}>1 unsaved change</span>
                      <P.Button size='sm' onClick={() => setDraft(saved)}>Discard</P.Button>
                      <P.Button size='sm' variant='primary' onClick={() => setSaved(draft)}>Save</P.Button>
                    </div>
                    )
                  : null}
                list={
                  <P.DataTable
                    label='Delivery zones'
                    columns={SPLIT_COLUMNS}
                    rows={SPLIT_ZONES}
                    getRowId={item => item.id}
                    activeRowId={zoneId}
                    onOpenRow={item => splitRef.current.requestLeave(() => openZone(item.id))}
                    getRowAttributes={item => ({ 'data-section-split-key': String(item.id) })}
                  />
                }
                detail={
                  <SplitZoneForm
                    key={String(zoneId)}
                    zone={zone}
                    draft={draft}
                    setDraft={setDraft}
                    saved={saved}
                    onSave={() => { setSaved(draft); return true }}
                    onDiscard={() => setDraft(saved)}
                    sharing={sharing}
                    onCloseShare={() => setSharing(false)}
                  />
                }
              />
            </div>
          </div>
        </div>
        <P.LeaveDialog
          {...leave.dialog}
          title='Discard the changes to this zone?'
          description='You have unsaved changes in this zone. If you leave, they are lost.'
          keepLabel='Keep editing'
          saveLabel='Save and continue'
          discardLabel='Discard'
          closeLabel='Close'
        />
      </aside>
    </P.LeaveGuardContext.Provider>
  )
}

const SectionSplitDemo = () => {
  const [editor, setEditor] = useState(null)
  return (
    <div className='g-row' data-testid='section-split-demo'>
      <P.Button onClick={() => setEditor({ splitFrom: undefined })}>Open the store editor</P.Button>
      <P.Button onClick={() => setEditor({ splitFrom: BREAKPOINT_PHONE })}>Open it with splitFrom 768 (zones, as in main)</P.Button>
      {editor && <SectionSplitEditor splitFrom={editor.splitFrom} onClose={() => setEditor(null)} />}
    </div>
  )
}

// redesign W0-2b (T0-5): DateRangePopover promoted from Orders/DateTypeSelector to Shared/Product.
const DATE_PRESETS = [
  { value: 'default', label: 'Any' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' }
]
const DATE_LABELS = {
  title: 'Select a date',
  presets: 'Date',
  close: 'Close',
  done: 'Done',
  from: 'From',
  to: 'To',
  today: 'Today',
  goToToday: 'Go to today',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  rangeOrder: 'The start date must not be after the end date.',
  invalidDate: (format) => `Enter a real date as ${format}.`
}

const DateRangeDemo = ({ hold }) => {
  const [preset, setPreset] = useState('default')
  const [range, setRange] = useState({ from: null, to: null })
  const text = range.from && range.to
    ? `${range.from} – ${range.to}`
    : range.from
      ? `From ${range.from}`
      : range.to
        ? `To ${range.to}`
        : (DATE_PRESETS.find(p => p.value === preset && p.value !== 'default')?.label || '')
  return (
    <P.DateRangePopover
      presets={DATE_PRESETS}
      presetValue={range.from || range.to ? 'term' : preset}
      from={range.from}
      to={range.to}
      dateFormat='YYYY-MM-DD'
      triggerText={text || 'Select a date'}
      empty={!text}
      labels={DATE_LABELS}
      locale='en'
      onPreset={value => { setPreset(value); setRange({ from: null, to: null }) }}
      onRange={setRange}
      onApplyRange={hold ? setRange : undefined}
    />
  )
}

// redesign W0-2e (T0-8): AlertDialog promoted from Orders/OrderDetails to Shared/Product.
const AlertDialogDemo = () => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <P.Button data-testid='open-alert' onClick={() => setOpen(true)}>Open alert</P.Button>
      <P.AlertDialog
        open={open}
        title='Refund not sent'
        content={['The refund could not be sent.', 'Try again in a few minutes.']}
        closeLabel='Close alert'
        confirmLabel='OK'
        onClose={() => setOpen(false)}
      />
    </>
  )
}

// redesign deliveries-followups P3: the assignment comment, promoted from the /deliveries board and the order panel.
const AssignCommentDialogDemo = () => {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState('')
  return (
    <>
      <P.Button data-testid='open-assign-comment' onClick={() => setOpen(true)}>Assign with a comment</P.Button>
      {sent && <span>Sent: {sent}</span>}
      <P.AssignCommentDialog
        open={open}
        onSubmit={(text) => { setSent(text); setOpen(false) }}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

// redesign W0-2c (T0-6): the step-by-step wizard promoted from Orders/CreateCustomOrder/Wizard to Shared/Product.
const WIZARD_STEPS = ['Customer', 'Business', 'Payment']
const WizardDemo = () => {
  const [step, setStep] = useState(1)
  const steps = WIZARD_STEPS.map((label, index) => ({
    id: label.toLowerCase(),
    label,
    state: index === step ? 'current' : (index < step ? 'done' : 'pending')
  }))
  return (
    <PW.Wizard
      steps={steps}
      current={step}
      onSelectStep={setStep}
      stepperLabel='Steps'
      doneLabel='Done'
      pendingLabel='Not reached yet'
      title={WIZARD_STEPS[step]}
      summary={(
        <PW.Summary
          label='Order summary'
          totalLabel='Total'
          editLabel='Edit'
          notSetLabel='Not set yet'
          blocks={[
            { id: 'customer', label: 'Customer', lines: ['Ana Perez', '555 0001111'], step: 0 },
            { id: 'business', label: 'Business', lines: step > 0 ? ['Corner Store'] : null, step: 1 }
          ]}
          total={step > 1 ? '$24.00' : null}
          onEdit={setStep}
        />
      )}
      footer={(
        <PW.WizardFooter
          showBack={step > 0}
          backLabel='Back'
          onBack={() => setStep(step - 1)}
          continueLabel={step === 2 ? 'Place order $24.00' : 'Continue'}
          onContinue={() => setStep(Math.min(step + 1, 2))}
        />
      )}
    >
      <p>Content of the step.</p>
    </PW.Wizard>
  )
}

// redesign W0-2a (T0-4): FilterPopover and ChecklistPopover promoted from Orders/OrdersFilterBar.
const CHECKLIST_ITEMS = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Marcus Hill', 'Edsger Dijkstra', 'Barbara Liskov']
  .map((name, i) => ({ id: i + 1, name }))
const ChecklistPillDemo = () => {
  const [selected, setSelected] = useState([2])
  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const name = id => CHECKLIST_ITEMS.find(i => i.id === id)?.name
  return (
    <P.FilterBar
      label='Order filters'
      search={<P.SearchField value='' onChange={() => {}} label='Search orders' placeholder='Search orders' clearLabel='Clear search' />}
      filters={
        <>
          <P.FilterPill icon={CalendarDays} label='Date' hasPopup='dialog' />
          <P.ChecklistPopover
            icon={Truck}
            label='Driver'
            value={P.pillValue(selected, name)}
            items={CHECKLIST_ITEMS}
            selected={selected}
            onToggle={toggle}
            onClear={() => setSelected([])}
            searchLabel='Search'
            clearSearchLabel='Clear search'
            loadingLabel='Loading...'
            noResultsLabel='No results found'
            clearLabel='Clear'
          />
        </>
      }
    />
  )
}

// redesign stores 2.D: ListPopover, the «Type» pill of /stores/list. The 18 business types of the test project
// (illustrative, C16); one name in Arabic for the RTL check. The variants: a value not in the list, loading, a failed request.
const LIST_TYPES = [
  'Food & Beverages', 'Coffee & Smoothies', 'Ice Cream & Dessert', 'Asian Delight', 'Mexican', 'Healthy', 'Steak', 'Ramen',
  'Sushi', 'Chicken', 'Thai', 'Convenience', 'Café', 'Bakery', 'Pizza', 'Burgers', 'Vegan', 'مطعم Shawarma'
].map((name, i) => ({ id: i + 1, name }))
const LIST_TEXT = {
  allLabel: 'All types',
  searchLabel: 'Search',
  clearSearchLabel: 'Clear search',
  noResultsLabel: 'No results found',
  loadingLabel: 'Loading...',
  errorLabel: 'We couldn\'t load the business types.',
  retryLabel: 'Retry'
}
const ListPillDemo = () => {
  const [type, setType] = useState(2)
  return (
    <>
      <P.FilterBar
        label='Store filters'
        search={<P.SearchField value='' onChange={() => {}} label='Search stores' placeholder='Search name, email or phone' clearLabel='Clear search' />}
        filters={
          <>
            <P.ListPopover icon={Store} label='Type' items={LIST_TYPES} value={type} onChange={setType} {...LIST_TEXT} />
            <P.FilterPill label='City' hasPopup='dialog' />
          </>
        }
      />
      <div className='g-row'>
        <P.ListPopover label='Unknown value' items={LIST_TYPES} value={99} onChange={() => {}} {...LIST_TEXT} />
        <P.ListPopover label='Loading' items={[]} value={null} loading onChange={() => {}} {...LIST_TEXT} />
        <P.ListPopover label='Failed' items={[]} value={null} error onRetry={() => {}} onChange={() => {}} {...LIST_TEXT} />
      </div>
    </>
  )
}

// redesign W0-8d (T0-33): StepBoundary on its own — a step that fails, «Try again», focus to the title (D-23).
const Boom = () => { throw new Error('Step failed') }
const StepBoundaryDemo = () => {
  const [broken, setBroken] = useState(true)
  const titleRef = React.useRef(null)
  return (
    <div className='g-row'>
      <h3 ref={titleRef} tabIndex={-1}>Payment</h3>
      {/* redesign tramo B cierre (W0-PB4-03): the demo throws on purpose, so it does not report it as a runtime error */}
      <PW.StepBoundary
        report={false}
        focusOnReset={titleRef}
        fallback={({ reset }) => (
          <P.InlineNotice tone='danger' action={<P.Button onClick={() => { setBroken(false); reset() }}>Try again</P.Button>}>
            {'We couldn\'t load this step.'}
          </P.InlineNotice>
        )}
      >
        {broken ? <Boom /> : <p>Content of the step.</p>}
      </PW.StepBoundary>
      <P.Button variant='ghost' onClick={() => setBroken(true)}>Break the step again</P.Button>
    </div>
  )
}

// redesign W0-7 (T0-29): demos of the cross-family wrappers (forms, switch, radio, pagination, page header, map frame,
// record panel, section nav, day picker, legacy fields). English text; layout through gallery.css classes, no inline style.
const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#2c7be5"/><text x="48" y="58" font-size="30" font-family="sans-serif" fill="#ffffff" text-anchor="middle">BH</text></svg>')}`

const FIELD_DATE_LABELS = {
  title: 'Choose a date',
  close: 'Close',
  today: 'Today',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  invalidDate: format => `Enter a real date as ${format}.`,
  outOfRange: 'That date is not available.'
}

const FieldsDemo = () => {
  const [storeName, setStoreName] = useState('Burger Hub')
  const [startDate, setStartDate] = useState(null)
  return (
    <div className='g-fields'>
      <P.TextField label='Store name' hint='Shown to customers on the order screen.' value={storeName} onChange={setStoreName} />
      <P.TextField label='Contact email' type='email' required requiredLabel='Required' placeholder='name@example.com' />
      <P.TextField label='Phone' defaultValue='555' error='Enter a phone number with the country code.' />
      <P.TextField label='Store ID' defaultValue='ST-1042' disabled />
      <P.TextField aria-label='Search stores' placeholder='Search stores' />
      <P.TextArea label='Order notes' rows={4} hint='Only the kitchen sees these.' defaultValue='No onions, extra napkins.' />
      <P.PasswordField label='Password' showLabel='Show password' hideLabel='Hide password' defaultValue='correct horse' />
      <P.NumberField label='Quantity' defaultValue={3} min={0} max={10} incrementLabel='Increase quantity' decrementLabel='Decrease quantity' />
      <P.NumberField label='Seats' defaultValue={10} min={1} max={10} incrementLabel='Increase seats' decrementLabel='Decrease seats' error='The most a table seats is 10.' />
      <P.Field label='Order type' hint='Field frames a control that names itself.'>
        <select className='odc-field-input' aria-label='Order type' defaultValue='delivery'>
          <option value='delivery'>Delivery</option>
          <option value='pickup'>Pickup</option>
        </select>
      </P.Field>
      <P.Field label='Start date' hint='The promotion starts at midnight.' error='Choose a start date.' required requiredLabel='Required'>
        <P.DatePicker label='Start date' labels={FIELD_DATE_LABELS} dateFormat='DD/MM/YYYY' locale='en' value={startDate} onChange={setStartDate} invalid />
      </P.Field>
      <P.NumberField label='Delivery fee' defaultValue={4.5} locale='en-US' format={{ style: 'currency', currency: 'USD' }} hint='Charged on every delivery.' />
    </div>
  )
}

const SwitchDemo = () => {
  const [accepting, setAccepting] = useState(false)
  const [online, setOnline] = useState(true)
  const [sms, setSms] = useState(false)
  return (
    <div className='g-row'>
      <div className='g-stack'>
        <p className='g-label'>Off, named by label</p>
        <P.Switch label='Accept orders' checked={accepting} onCheckedChange={setAccepting} />
      </div>
      <div className='g-stack'>
        <p className='g-label'>On by default</p>
        <P.Switch label='Online ordering' checked={online} onCheckedChange={setOnline} />
      </div>
      <div className='g-stack'>
        <p className='g-label'>With visible text</p>
        <P.Switch checked={sms} onCheckedChange={setSms}>Notify the driver by SMS</P.Switch>
      </div>
      <div className='g-stack'>
        <p className='g-label'>Busy while it saves</p>
        <P.Switch label='Saving the schedule' defaultChecked busy />
      </div>
      <div className='g-stack'>
        <p className='g-label'>Disabled, off</p>
        <P.Switch label='Auto-accept orders' disabled />
      </div>
      <div className='g-stack'>
        <p className='g-label'>Disabled, on</p>
        <P.Switch label='Allow tips' defaultChecked disabled />
      </div>
    </div>
  )
}

// redesign 2.E: TimeField. The 12 h variant reads the project's hour format through the real ConfigContext.
const TWELVE_HOURS = [{ configs: { general_hour_format: { value: 'hh:mma' } } }, async () => {}]
const DURATION_TEXT = { hourLabel: 'Hours', minuteLabel: 'Minutes', hoursUnit: 'h', minutesUnit: 'min' }
const CLOCK_TEXT = { hourLabel: 'Hour', minuteLabel: 'Minute', amLabel: 'AM', pmLabel: 'PM' }

const TimeFieldDemo = () => {
  const [deliveryTime, setDeliveryTime] = useState('0:45')
  const [preorderTime, setPreorderTime] = useState(90)
  const [opensAt, setOpensAt] = useState('14:30')
  return (
    <div className='g-row'>
      <div className='g-fields'>
        <P.TimeField label='Delivery time' hint={`Saved as "${deliveryTime}".`} value={deliveryTime} onChange={setDeliveryTime} {...DURATION_TEXT} />
        <P.TimeField label='Pre order time' valueFormat='minutes' hint={`Saved as ${preorderTime} minutes.`} value={preorderTime} onChange={setPreorderTime} {...DURATION_TEXT} />
        <P.TimeField label='Pickup time' defaultValue='30:00' hint='A stored value outside the range is kept and shown.' {...DURATION_TEXT} />
        <P.TimeField label='Pickup time' defaultValue='0:20' error='Choose at least 30 minutes.' required requiredLabel='Required' {...DURATION_TEXT} />
        <P.TimeField label='Delivery time' defaultValue='1:00' disabled {...DURATION_TEXT} />
      </div>
      <div className='g-fields'>
        <P.TimeField mode='time' label='Opens at (24 h)' value={opensAt} onChange={setOpensAt} {...CLOCK_TEXT} />
        <ConfigContext.Provider value={TWELVE_HOURS}>
          <P.TimeField mode='time' label='Opens at (12 h, hh:mma)' value={opensAt} onChange={setOpensAt} {...CLOCK_TEXT} />
        </ConfigContext.Provider>
        <div className='g-frame g-w-360'>
          <P.TimeField label='Delivery time' hint='360px wide.' defaultValue='2:30' {...DURATION_TEXT} />
        </div>
      </div>
    </div>
  )
}

// redesign 2.C: SecretField. Hidden until «Show»; the ending (last 4) is the consumer's text around a mono node.
// The ending node brings the ellipsis. The values are made up: never a real key.
const SECRET_TEXT = { showLabel: 'Show', hideLabel: 'Hide', endingLabel: ending => <>Ends in {ending}</> }

const SecretFieldDemo = () => {
  const [spoonityKey, setSpoonityKey] = useState('spn_demo_7a1c90e2b4d8')
  return (
    <div className='g-row'>
      <div className='g-fields'>
        <P.SecretField label='Secret key' name='secret' defaultValue='sample_51Hdemo0000000000k3Fz' shownStatus='Secret key shown' hiddenStatus='Secret key hidden' {...SECRET_TEXT} />
        <P.SecretField label='Spoonity API key' hint='Controlled: the parent keeps the value.' value={spoonityKey} onChange={setSpoonityKey} {...SECRET_TEXT} />
        <P.SecretField label='Access token' hint='Paste the token from your provider.' {...SECRET_TEXT} />
        <P.SecretField label='Webhook secret' defaultValue='whsec_12345' hint='Under 12 characters: no ending.' {...SECRET_TEXT} />
      </div>
      <div className='g-fields'>
        <P.SecretField label='Secret key' defaultValue='sample_bad' error='This key is not valid.' required requiredLabel='Required' {...SECRET_TEXT} />
        <P.SecretField label='Secret key' defaultValue='sample_51Hdemo0000000000a9Qx' disabled {...SECRET_TEXT} />
        <P.SecretField label='Payout account number' defaultValue='000123456789' readOnly {...SECRET_TEXT} />
        <div className='g-frame g-w-360'>
          <P.SecretField label='Secret key' hint='360px wide.' defaultValue='sample_51Hdemo0000000000k3Fz' {...SECRET_TEXT} />
        </div>
      </div>
    </div>
  )
}

// redesign stores 5.15a: CopyButton. «Copy» turns into «Copied» for two seconds; a failure is said beside it.
const COPY_TEXT = { copyLabel: 'Copy', copiedLabel: 'Copied', failedLabel: 'Couldn\'t copy. Select the text and copy it.' }

const CopyButtonDemo = () => (
  <div className='g-row'>
    <P.CopyButton text='https://example.com/store/demo' label='Copy store link' {...COPY_TEXT} />
    <P.CopyButton text='<button onclick="toggleOrderingWidget()">Order</button>' label='Copy button code' variant='ghost' {...COPY_TEXT} />
    <P.CopyButton text='' label='Copy popup script' {...COPY_TEXT} />
  </div>
)

// redesign 2.G: the switch that saves at once. The first save succeeds; the second one fails (as an API error
// would) and the switch goes back to the stored value with the notice below it.
const AsyncSwitchDemo = () => {
  const [stored, setStored] = useState(true)
  const [failing, setFailing] = useState(false)
  const wait = () => new Promise(resolve => setTimeout(resolve, 600))
  const save = async (next) => {
    await wait()
    if (failing) return { ok: false, error: ['Internal error'] }
    setStored(next)
    setFailing(true)
    return { ok: true }
  }
  return (
    <div className='g-row'>
      <div className='g-stack'>
        <p className='g-label'>Saves, then fails the next time</p>
        <P.AsyncSwitch label='Accept orders' checked={stored} onToggle={save} failureText="We couldn't save the change." />
      </div>
      <div className='g-stack'>
        <p className='g-label'>Error without text: failureText</p>
        <P.AsyncSwitch checked={false} onToggle={async () => { await wait(); return { ok: false } }} failureText="We couldn't save the change.">
          Featured
        </P.AsyncSwitch>
      </div>
    </div>
  )
}

const RadioGroupDemo = () => {
  const [when, setWhen] = useState('later')
  const [sort, setSort] = useState('unknown')
  const [layout, setLayout] = useState('food')
  return (
    <div className='g-row'>
      <P.RadioGroup
        label='Delivery time'
        value={when}
        onValueChange={setWhen}
        options={[
          { value: 'later', label: 'Schedule for later' },
          { value: 'now', label: 'As soon as possible' },
          { value: 'pickup', label: 'Customer pickup', description: 'Not offered by this store', disabled: true }
        ]}
      />
      <P.RadioGroup
        label='Sort orders by'
        hideLabel
        orientation='horizontal'
        value={sort}
        onValueChange={setSort}
        options={[
          { value: 'age', label: 'Oldest first' },
          { value: 'total', label: 'Total' },
          { value: 'sla', label: 'SLA' }
        ]}
      />
      <P.RadioGroup
        label='Receipt language'
        disabled
        defaultValue='en'
        options={[
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Spanish' }
        ]}
      />
      {/* redesign stores 5.15b: opt-in cards, each with a decorative preview */}
      <P.RadioGroup
        label='Website layout'
        variant='cards'
        value={layout}
        onValueChange={setLayout}
        options={[
          { value: 'food', label: 'Food', description: 'Categories along the top, products in a list', media: <span className='g-preview' /> },
          { value: 'groceries', label: 'Groceries', description: 'Parent categories in a side list', media: <span className='g-preview' /> },
          { value: 'retail', label: 'Retail', description: 'Not available for this project', disabled: true, media: <span className='g-preview' /> }
        ]}
      />
    </div>
  )
}

const PAGINATION_LABELS = {
  previousLabel: 'Previous page',
  nextLabel: 'Next page',
  pageSizeLabel: 'Rows per page',
  pageLabel: 'Page',
  rangeLabel: (from, to, total, figure) => total == null
    ? <>Showing {figure(from)}–{figure(to)}</>
    : <>Showing {figure(from)}–{figure(to)} of {figure(total)}</>,
  pageOfLabel: (totalPages, figure) => <>of {figure(totalPages)}</>,
  // redesign tramo B r2 (W0-QB1-07): what a screen reader hears when the page changes
  pageStatusLabel: (page, totalPages) => totalPages == null ? `Page ${page}` : `Page ${page} of ${totalPages}`
}

const PaginationDemo = ({ label, initialPage = 1, total, busy = false }) => {
  const [page, setPage] = useState(initialPage)
  const [size, setSize] = useState(10)
  const open = total == null
  return (
    <P.Pagination
      {...PAGINATION_LABELS}
      label={label}
      page={page}
      pageSize={size}
      total={total}
      hasMore={open && page < 5}
      itemCount={open ? (page < 5 ? size : 4) : undefined}
      pageSizeOptions={open ? undefined : [10, 25, 50]}
      showPageInput={!open}
      busy={busy}
      onPageChange={setPage}
      onPageSizeChange={(nextSize, nextPage) => { setSize(nextSize); setPage(nextPage) }}
    />
  )
}

// redesign P/SelectableList, promoted from the staff Stores section; used by «Share with» of menus and zones
const SELECTABLE_STORES = [
  { id: 1, name: 'Burger Town' },
  { id: 2, name: 'Pizza Hub' },
  { id: 3, name: 'Taco Spot with a long name that wraps inside a narrow panel' },
  { id: 4, name: 'Sushi Bar' }
]
const SELECTABLE_LABELS = {
  loadingLabel: 'Loading',
  emptyTitle: 'No stores match this search',
  errorTitle: "We couldn't load the stores.",
  retryLabel: 'Retry',
  searchLabel: 'Search stores',
  clearSearchLabel: 'Clear search',
  selectAllLabel: 'Select all',
  selectNoneLabel: 'Select none'
}

const SelectableListDemo = ({ label, loading = false, error = false, empty = false }) => {
  const [selected, setSelected] = useState([2])
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [query, setQuery] = useState('')
  const items = empty ? [] : SELECTABLE_STORES.filter(store => store.name.toLowerCase().includes(query.toLowerCase()))
  return (
    <P.SelectableList
      {...SELECTABLE_LABELS}
      label={label}
      items={items}
      avatars='business'
      selectedIds={selected}
      onToggle={(id, next) => setSelected(ids => next ? [...ids, id] : ids.filter(other => other !== id))}
      loading={loading}
      error={error}
      onRetry={() => {}}
      onSearch={setQuery}
      onSelectAll={() => setSelected(ids => [...new Set([...ids, ...items.map(store => store.id)])])}
      onSelectNone={() => setSelected([])}
      pagination={{ ...PAGINATION_LABELS, label: `${label} pages`, page, pageSize: size, total: empty ? 0 : 34, pageSizeOptions: [10, 25, 50], onPageChange: setPage, onPageSizeChange: (nextSize, nextPage) => { setSize(nextSize); setPage(nextPage) } }}
    />
  )
}

const PageHeaderDemo = () => {
  const actions = [{ key: 'export', label: 'Export…', icon: Download, onSelect: () => {} }]
  const primary = <P.Button variant='primary' icon={Plus}>New order</P.Button>
  const learn = <P.Button variant='ghost' size='sm' icon={Info}><span data-collapse-label=''>About this page</span></P.Button>
  const status = <P.Button variant='ghost' size='sm' icon={CircleCheck}><span data-collapse-label=''>Live</span></P.Button>
  return (
    <>
      <div className='g-frame'>
        <P.PageHeader title='Orders' count={744} countLabel='744 orders' status={status} learn={learn} actions={actions} moreLabel='More actions' primaryAction={primary} description='Every order from every store, newest first.' />
      </div>
      <div className='g-frame'>
        <P.PageHeader title='Order 1042' onBack={() => {}} backLabel='Back to orders' status={status} actions={actions} moreLabel='More order actions' primaryAction={<P.Button variant='primary'>Mark as ready</P.Button>} />
      </div>
      <div className='g-frame g-w-360' data-testid='page-header-narrow'>
        <P.PageHeader title='Deliveries scheduled for the Downtown and Harbour districts this week' count={12} countLabel='12 deliveries' status={status} learn={learn} actions={actions} moreLabel='More delivery actions' primaryAction={primary} />
      </div>
      {/* redesign tramo B cierre (W0-QB4-02): `actions` as a node, with text buttons: the group wraps, it never overflows */}
      <div className='g-frame' data-testid='page-header-text-actions'>
        <P.PageHeader
          title='Drivers'
          learn={<P.Button variant='ghost' size='sm' icon={Info}>Learn</P.Button>}
          actions={<><P.Button>Export drivers</P.Button><P.Button>Import from CSV</P.Button></>}
          primaryAction={<P.Button variant='primary' icon={Plus}>New driver</P.Button>}
        />
      </div>
      <div className='g-frame' data-testid='page-header-text-actions-back'>
        <P.PageHeader
          title='Stores'
          onBack={() => {}}
          backLabel='Back to stores'
          learn={<P.Button variant='ghost' size='sm' icon={Info}>Learn</P.Button>}
          actions={<><P.Button>Export stores</P.Button><P.Button>Import from CSV</P.Button></>}
          primaryAction={<P.Button variant='primary' icon={Plus}>New store</P.Button>}
        />
      </div>
      <div className='g-frame'>
        <P.PageHeader title='Without status' description='The status line keeps its height when no status is shown.' primaryAction={<P.Button variant='primary' icon={Plus}>New business</P.Button>} />
      </div>
      {/* (P-1): `leading`, the page's own «Open menu» button, first in the lead block (centred with the title, before the back arrow) */}
      <div className='g-frame' data-testid='page-header-leading'>
        <P.PageHeader
          title='Customers'
          leading={<P.IconButton icon={MenuIcon} label='Open menu' onClick={() => {}} />}
          count={86}
          countLabel='86 customers'
          learn={learn}
          primaryAction={<P.Button variant='primary' icon={Plus}>Add customer</P.Button>}
          description='Everyone who ordered from this project.'
        />
      </div>
      <div className='g-frame g-w-360' data-testid='page-header-leading-narrow'>
        <P.PageHeader
          title='Delivery zones of the Downtown and Harbour stores'
          leading={<P.IconButton icon={MenuIcon} label='Open menu' onClick={() => {}} />}
          onBack={() => {}}
          backLabel='Back to stores'
          primaryAction={<P.Button variant='primary' icon={Plus}>New zone</P.Button>}
        />
      </div>
      {/* (owner decision 28 B): the report header, narrow, without and with `wideTitle` (the title takes the whole row) */}
      {[false, true].map(wide => (
        <div key={String(wide)} className='g-frame g-w-360' data-testid={wide ? 'page-header-wide-title-narrow' : 'page-header-report-narrow'}>
          <P.PageHeader
            wideTitle={wide}
            title='Average ticket by site and channel'
            description='The average order value of each site and channel, in the period.'
            leading={<P.IconButton icon={MenuIcon} label='Open menu' onClick={() => {}} />}
            onBack={() => {}}
            backLabel='All reports'
            learn={learn}
            actions={<P.Menu label='Switch report' items={[{ key: 'r1', label: 'Sales over time', onSelect: () => {} }]} align='end' />}
          />
        </div>
      ))}
      {/* (DD-09): an action marked `data-fill` (the page's search) spans the whole line on a narrow header */}
      <div className='g-frame g-w-360' data-testid='page-header-fill-narrow'>
        <P.PageHeader
          title='Drivers dashboard'
          leading={<P.IconButton icon={MenuIcon} label='Open menu' onClick={() => {}} />}
          learn={learn}
          actions={<div data-fill=''><P.SearchField value='' onChange={() => {}} label='Search' placeholder='Search by name or phone' clearLabel='Clear search' /></div>}
        />
      </div>
    </>
  )
}

const RecordCardDemo = () => {
  const card = (id, extra = {}) => ({
    id,
    href: `#record-${id}`,
    label: `Record #${id}`,
    title: `#${id}`,
    status: <P.Status family='pending' label='Pending' />,
    from: <span>Fast Bite</span>,
    to: <span>Ana Gómez</span>,
    assignee: <span>Luis Pérez</span>,
    schedule: ['Today 12:30', 'ETA 12:50'],
    indicator: <P.SlaBadge level='ok' label='On time' />,
    indicatorNote: '5 min ago',
    figure: <span className='odc-figure'>$24.50</span>,
    ...extra
  })
  const actions = <div className='odc-order-card-actions' data-card-actions=''><P.Button size='lg'>Reject…</P.Button><P.Button size='lg' variant='primary'>Accept</P.Button></div>
  return (
    <div className='g-stack'>
      <p className='g-label'>Default, open record, with actions, no assignee, long names, tinted</p>
      <P.RecordCardList
        label='Records'
        items={[
          card(101),
          card(102, { active: true }),
          card(103, { actions }),
          card(104, { assignee: null, schedule: [null, 'ETA 13:10'], indicatorNote: null }),
          card(105, { from: <span>A business with a very long name that has to end in an ellipsis</span>, to: <span>A customer with an equally long name</span> }),
          card(106, { tint: 'delayed' })
        ]}
      />
      <p className='g-label'>One card on its own, in a bare list</p>
      <ul className='odc-order-card-list'><P.RecordCard {...card(107, { tour: undefined })} /></ul>
      <p className='g-label'>Loading (3 skeleton cards)</p>
      <P.RecordCardList label='Loading records' items={[]} loading loadingLabel='Loading records' skeletonCount={3} />
      <p className='g-label'>Empty</p>
      <P.RecordCardList label='No records' items={[]} empty={<P.EmptyState title='No records' />} />
    </div>
  )
}

const CHART_DAYS = ['10 Sep', '11 Sep', '12 Sep', '13 Sep', '14 Sep', '15 Sep', '16 Sep', '17 Sep', '18 Sep', '19 Sep', '20 Sep', '21 Sep', '22 Sep', '23 Sep']
const CHART_SALES = [86.03, 120.4, 0, 54.1, 215.22, 98.6, 140.5, 76.2, 0, 33.4, 250.83, 326.25, 90.8, 112.3]
const CHART_PREVIOUS = [70.1, 95.2, 40.3, 60.4, 180.5, 110.6, 90.7, 85.8, 20.9, 45.1, 190.2, 260.3, 120.4, 100.5]
const money = value => `$${Number(value).toFixed(2)}`

// redesign home FA (D8): sales with the previous period (Home), one series, bars, and the six slots in order
const ChartDemo = () => (
  <Suspense fallback={<P.Skeleton block='var(--od-x-chart-height)' />}>
    <>
      <Chart type='line' label='Sales, last 14 days' labels={CHART_DAYS} formatValue={money} table={{ caption: 'Sales, last 14 days', xHeader: 'Date' }} series={[{ id: 'sales', label: 'Sales', data: CHART_SALES }, { id: 'previous', label: 'Previous 14 days', data: CHART_PREVIOUS, comparison: true }]} />
      <Chart type='line' size='compact' label='Sales, one series' labels={CHART_DAYS} formatValue={money} table={{ caption: 'Sales', xHeader: 'Date' }} series={[{ id: 'sales', label: 'Sales', data: CHART_SALES }]} />
      <Chart type='bar' label='Orders by store' labels={['Fast Bite', 'Subway', 'P.F. Changs', 'Dunkers', 'Tim\'s Cafe', 'Dairy Queen']} table={{ caption: 'Orders by store', xHeader: 'Store' }} series={[1, 2, 3, 4, 5, 6].map(slot => ({ id: `s${slot}`, label: `Slot ${slot}`, data: [12, 9, 7, 5, 4, 3].map(value => value + slot) }))} />
    </>
  </Suspense>
)

const MapFrameDemo = () => (
  <div className='g-w-520 g-stack' data-testid='map-frame-demo'>
    <p className='g-label'>Default: the map fills the frame</p>
    <P.MapFrame label='Delivery location' apiKey='demo' unavailableTitle='The map is unavailable'><div className='g-map-fill' /></P.MapFrame>
    <p className='g-label'>Compact: reported unavailable, with a description</p>
    <P.MapFrame label='Driver position' apiKey='demo' size='compact' unavailable unavailableTitle='The map is unavailable' unavailableDescription='Drivers are listed below until the map loads again.'><div className='g-map-fill' /></P.MapFrame>
    <p className='g-label'>No provider key</p>
    <P.MapFrame label='Store location' apiKey='' unavailableTitle='The map is unavailable'><div className='g-map-fill' /></P.MapFrame>
  </div>
)

const STORE_SECTIONS = [
  { id: 'basic', label: 'Basic information', group: 'Store' },
  { id: 'hours', label: 'Opening hours', group: 'Store' },
  { id: 'delivery', label: 'Delivery', group: 'Operation', count: 3, countLabel: '3 items need attention', attention: true },
  { id: 'payments', label: 'Payments', group: 'Operation', disabled: true },
  { id: 'taxes', label: 'Taxes', group: 'Operation', description: 'Rates and tax-inclusive prices' }
]

const SectionNavDemo = ({ label }) => {
  const [value, setValue] = useState('hours')
  return <P.SectionNav label={label} compactLabel='Section' items={STORE_SECTIONS} value={value} onValueChange={setValue} />
}

// redesign settings 0: collapsible groups with descriptions, listOnly, activateOnFocus
const SETTINGS_GROUPS = [
  { id: 'store', label: 'Store', description: 'Name, hours and contact' },
  { id: 'operation', label: 'Operation', description: 'Delivery, payments and taxes' },
  { id: 'channels', label: 'Channels', description: 'Where customers order' }
]
const SETTINGS_SECTIONS = [
  { id: 'basic', label: 'Basic information', group: 'store' },
  { id: 'hours', label: 'Opening hours', group: 'store' },
  { id: 'delivery', label: 'Delivery', group: 'operation' },
  { id: 'payments', label: 'Payments', group: 'operation', disabled: true },
  { id: 'taxes', label: 'Taxes', group: 'operation' }
]

const GroupedSectionNavDemo = ({ label }) => {
  const [value, setValue] = useState('hours')
  const [group, setGroup] = useState('store')
  return (
    <P.SectionNav
      label={label}
      compactLabel='Section'
      items={SETTINGS_SECTIONS}
      groups={SETTINGS_GROUPS}
      openGroups={[group]}
      onGroupSelect={setGroup}
      value={value}
      onValueChange={setValue}
      listOnly
      activateOnFocus
    />
  )
}

const RecordPanelDemo = () => {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState('general')
  const [saved, setSaved] = useState('Neighbourhood burger place, open daily.')
  const [text, setText] = useState(saved)
  if (!open) return <div className='g-row'><P.Button onClick={() => setOpen(true)}>Open store record</P.Button></div>
  return (
    <div className='g-frame g-w-640 g-record' data-testid='record-panel-demo'>
      <P.RecordPanel
        title='Burger Hub'
        subtitle='Store 1042 · Downtown'
        status={<P.StatusBadge family='done' label='Open' />}
        closeLabel='Close panel'
        onClose={() => { setText(saved); setOpen(false) }}
        tabs={{
          label: 'Store record',
          value: tab,
          onValueChange: setTab,
          items: [
            { value: 'general', label: 'General', content: <P.TextArea label='Description' rows={4} value={text} onChange={setText} /> },
            { value: 'hours', label: 'Hours', content: <p className='odc-muted'>Monday to Sunday, 10:00 to 22:00.</p> }
          ]
        }}
        footer={<P.Button variant='primary' onClick={() => setSaved(text)}>Save changes</P.Button>}
        dirty={text !== saved}
        discardTitle='Discard changes?'
        discardDescription='The changes to this store have not been saved.'
        discardConfirmLabel='Discard'
        keepEditingLabel='Keep editing'
      />
    </div>
  )
}

const RecordPanelNavDemo = () => {
  const [value, setValue] = useState('basic')
  return (
    <div className='g-frame g-w-900 g-record' data-testid='record-panel-nav-demo'>
      <P.RecordPanel
        title='Burger Hub sections'
        closeLabel='Close sections panel'
        onClose={() => {}}
        nav={<P.SectionNav label='Record sections' compactLabel='Section' items={STORE_SECTIONS} value={value} onValueChange={setValue} />}
      >
        <p className='odc-muted'>Section: {value}</p>
      </P.RecordPanel>
    </div>
  )
}

// redesign (K-1): Select, the form select. Conditions of a business fee (with search, «All» as a real option), the
// recipient (three options, no search), a disabled and an invalid one, and a remote list with a pager in the footer (the store of
// a device). One name in Arabic for the RTL check.
const SELECT_TEXT = { searchLabel: 'Search', clearSearchLabel: 'Clear search', noResultsLabel: 'No results found', loadingLabel: 'Loading...' }
const SELECT_SITES = [{ value: 'all', label: 'All' }, ...['Web', 'iOS app', 'Android app', 'Kiosk', 'Call center', 'POS', 'WhatsApp', 'Marketplace', 'Facebook', 'Instagram', 'موقع Web Arabic'].map((label, i) => ({ value: i + 1, label }))]
const SELECT_RECIPIENTS = [{ value: 'inherit', label: 'Inherit' }, { value: 'business', label: 'Business' }, { value: 'platform', label: 'Platform' }]
const SELECT_STORES = Array.from({ length: 24 }, (_, i) => ({ value: 100 + i, label: `Store ${String(i + 1).padStart(2, '0')}` }))
const RemoteStoreSelect = () => {
  const [value, setValue] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const found = SELECT_STORES.filter(store => store.label.toLowerCase().includes(search.toLowerCase()))
  const options = found.slice((page - 1) * 8, page * 8)
  return (
    <P.SelectField
      label='Store'
      placeholder='Select an option'
      options={options}
      value={value}
      onValueChange={setValue}
      searchable
      searchValue={search}
      onSearchChange={(text) => { setSearch(text); setPage(1) }}
      footer={(
        <P.Pagination page={page} pageSize={8} total={found.length} onPageChange={setPage} label='Store pages' previousLabel='Previous page' nextLabel='Next page' rangeLabel={(from, to, total) => `${from}–${to} of ${total}`} pageStatusLabel={(current, pages) => `Page ${current} of ${pages}`} />
      )}
      {...SELECT_TEXT}
    />
  )
}
const SelectDemo = () => {
  const [site, setSite] = useState('all')
  const [recipient, setRecipient] = useState('business')
  return (
    <div className='g-row' data-testid='select-demo'>
      <div className='g-stack g-stack-fill g-w-320'>
        <P.SelectField label='Site' placeholder='Select site' options={SELECT_SITES} value={site} onValueChange={setSite} searchable hint='Where the order was placed' {...SELECT_TEXT} />
        <P.SelectField label='Recipient' options={SELECT_RECIPIENTS} value={recipient} onValueChange={setRecipient} />
      </div>
      <div className='g-stack g-stack-fill g-w-320'>
        <P.SelectField label='Payment method' placeholder='Select payment method' options={SELECT_SITES} value={null} onValueChange={() => {}} error='Choose a payment method' required requiredLabel='Required' />
        <P.SelectField label='Business' options={SELECT_RECIPIENTS} value='platform' onValueChange={() => {}} disabled hint='The fee belongs to this business' />
      </div>
      <div className='g-stack g-stack-fill g-w-320'>
        <RemoteStoreSelect />
        <p className='g-label'>Outside a Field: named by its own label</p>
        <P.Select label='Sort by' options={[{ value: 'name', label: 'Name' }, { value: 'date', label: 'Date created' }]} value='name' onValueChange={() => {}} />
      </div>
    </div>
  )
}

const DATE_PICKER_LABELS = {
  title: 'Choose a date',
  close: 'Close',
  today: 'Today',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  invalidDate: format => `Enter a real date as ${format}.`,
  outOfRange: 'That date is not available.'
}

const DatePickerVariant = ({ caption, initial = null, ...props }) => {
  const [value, setValue] = useState(initial)
  return (
    <div className='g-stack'>
      <p className='g-label'>{caption}</p>
      <P.DatePicker value={value} onChange={setValue} labels={DATE_PICKER_LABELS} dateFormat='DD/MM/YYYY' locale='en' {...props} />
    </div>
  )
}

const DatePickerDemo = () => (
  <div className='g-row' data-testid='date-picker-demo'>
    <DatePickerVariant caption='With a value' label='Delivery date' initial='2026-03-15' />
    <DatePickerVariant caption='Empty, placeholder' label='Pickup date' />
    <DatePickerVariant caption='Invalid' label='Snooze until' initial='2026-03-02' invalid />
    <DatePickerVariant caption='Disabled' label='Closing date' initial='2026-03-15' disabled />
    <DatePickerVariant caption='Only 10 to 20 March 2026' label='Event date' min='2026-03-10' max='2026-03-20' />
    <DatePickerVariant caption='Clearable, week starts Monday, MM/DD/YYYY' label='Report date' initial='2026-03-15' firstDayOfWeek={1} dateFormat='MM/DD/YYYY' labels={{ ...DATE_PICKER_LABELS, clear: 'Clear date' }} />
  </div>
)

// redesign SL-F3 (C): ScheduleEditor, the Product UIComponent of the Schedule controller (all text comes in `labels`).
const SCHEDULE_LABELS = {
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  daysAbbreviated: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  schedule: 'Schedule',
  open: 'Open',
  close: 'Close',
  hour: 'Hour',
  minute: 'Minute',
  am: 'AM',
  pm: 'PM',
  unavailable: 'Unavailable',
  addHours: 'Add hours',
  copyHours: 'Copy hours to…',
  copyTitle: 'Copy times to',
  apply: 'Apply',
  cancel: 'Cancel',
  delete: 'Delete',
  deleteQuestion: 'Are you sure to delete this Schedule?',
  accept: 'Accept',
  conflict: 'There is an schedule conflict',
  endTimeLater: 'Choose an end time later than the start time.'
}
const scheduleLapse = (openHour, openMinute, closeHour, closeMinute) => ({ open: { hour: openHour, minute: openMinute }, close: { hour: closeHour, minute: closeMinute } })
const SCHEDULE_WEEK = [
  { enabled: false, lapses: [scheduleLapse(9, 0, 17, 0)] },
  { enabled: true, lapses: [scheduleLapse(9, 0, 12, 0), scheduleLapse(13, 30, 21, 45)] },
  { enabled: true, lapses: [scheduleLapse(9, 0, 21, 45)] },
  { enabled: true, lapses: [scheduleLapse(9, 0, 21, 45)] },
  { enabled: true, lapses: [scheduleLapse(9, 0, 21, 45)] },
  { enabled: true, lapses: [scheduleLapse(9, 0, 23, 0)] },
  { enabled: true, lapses: [scheduleLapse(10, 0, 23, 0)] }
]
const ScheduleEditorDemo = props => {
  const [list, setList] = useState(SCHEDULE_WEEK)
  return <P.ScheduleEditor scheduleList={list} handleChangeScheduleState={setList} labels={SCHEDULE_LABELS} {...props} />
}

const PhoneDemo = props => {
  const [value, setValue] = useState('+14155552671')
  // redesign tramo B r2 (W0-QB1-08): the country selector is named by a prop, one per field
  return <PhoneField value={value} setValue={setValue} handleIsValid={() => {}} countryLabel={`${props.label} country`} {...props} />
}

// The legacy ImageCrop reads the styled-components theme (as the app provides it): the demo gives it the app theme.
const LegacyFieldsDemo = () => {
  const [logo, setLogo] = useState(LOGO)
  const [brand, setBrand] = useState('#2C7BE5')
  return (
    <ThemeProvider theme={appTheme}>
      <Suspense fallback={null}>
        <div className='g-fields'>
          <ImageField label='Logo' hint='A square image, at least 300 by 300 pixels.' value={logo} previewAlt='Current logo' changeLabel='Change logo' removeLabel='Remove logo' onChange={setLogo} onRemove={() => setLogo('')} cropTitle='Crop the logo' closeLabel='Close' />
          <ImageField label='Cover photo' required requiredLabel='Required' error='Add a cover photo.' changeLabel='Add cover photo' cropTitle='Crop the cover photo' closeLabel='Close' />
          <ColorField label='Brand color' hint='Used for buttons in your storefront.' value={brand} onChange={setBrand} />
          <ColorField label='Accent color' value='#FFFFFF' error='White does not show on a white page.' />
          <PhoneDemo label='Phone number' hint='Include the country code.' />
          <PhoneDemo label='Mobile phone' required requiredLabel='Required' />
          <PhoneDemo label='Backup phone' error='Add a phone number we can call.' />
          <PhoneDemo label='Store phone' disabled />
        </div>
      </Suspense>
    </ThemeProvider>
  )
}

const App = () => (
  <main className='g-main'>
    <h1>Product wrappers</h1>
    <p className='g-lead'>Governed wrappers of the orders pilot on Base UI and Ordering.co tokens. Theme {theme}, direction {dir}. Example data, shaped like the sample tenant.</p>

    <Section id='buttons' title='Button and IconButton'>
      <div className='g-row'>
        <P.Button variant='primary' icon={Plus}>New order</P.Button>
        <P.Button icon={Download}>Export</P.Button>
        <P.Button variant='ghost'>Guide</P.Button>
        <P.Button variant='danger'>Delete order</P.Button>
        <P.Button variant='link'>Select all 744</P.Button>
        <P.Button disabled>Disabled</P.Button>
        <P.Button busy variant='primary'>Refund $35.23</P.Button>
      </div>
      <div className='g-row'>
        <P.Button size='sm'>Small</P.Button>
        <P.Button size='lg' variant='primary'>Accept order</P.Button>
        <P.IconButton icon={Printer} label='Print' />
        <P.IconButton icon={X} label='Close' variant='secondary' />
        <P.IconButton icon={Navigation} label='Tracking link' size='sm' />
      </div>
    </Section>

    <Section id='status' title='Status, StatusBadge, SlaBadge and Count (C5)'>
      <div className='g-row'>
        <P.Status family='pending' label='Pending' />
        <P.Status family='progress' label='Driver almost arrived to customer' />
        <P.Status family='review' label='Order not ready' />
        <P.Status family='done' label='Delivery completed by driver' />
        <P.Status family='cancel' label='Rejected by business' />
      </div>
      <div className='g-row'>
        <P.StatusBadge family='pending' label='Pending' />
        <P.StatusBadge family='progress' label='Accepted by business' />
        <P.StatusBadge family='review' label='Order not ready' />
        <P.StatusBadge family='done' label='Completed by admin' />
        <P.StatusBadge family='cancel' label='Delivery failed by driver' />
      </div>
      <div className='g-row'>
        <P.SlaBadge level='ok' label='On time' />
        <P.SlaBadge level='risk' label='Due in 4 min' />
        <P.SlaBadge level='late' label='Delayed · 12 min' />
        <P.Count value={3} attention srLabel='3 pending orders' />
        <P.Count value={744} srLabel='744 orders' />
      </div>
    </Section>

    <Section id='avatar' title='Avatar (C12)'>
      <div className='g-row'>
        <P.Avatar name='Customer Demo' />
        <P.Avatar name='Grace Okafor' size='lg' />
        <P.Avatar name='Fast Bite' kind='business' />
        <P.Avatar name='P.F. Changs' kind='business' size='lg' />
        <P.Avatar name='' />
        <P.Avatar name='' kind='business' size='lg' />
        <P.Avatar name='محمد علي' size='lg' />
      </div>
    </Section>

    <Section id='checkbox' title='Checkbox (C6)'>
      <div className='g-row'>
        <P.Checkbox label='Unchecked' />
        <P.Checkbox label='Checked' checked />
        <P.Checkbox label='Mixed' checked='mixed' />
        <P.Checkbox label='Disabled' disabled />
        <div style={{ inlineSize: 'var(--od-x-popover)' }}><P.Checkbox checked>Driver</P.Checkbox></div>
      </div>
    </Section>

    <Section id='feedback' title='EmptyState and Skeleton (C10)'>
      <P.EmptyState icon={Inbox} title='No pending orders' description='New orders appear here as they arrive, with a sound if alerts are on.' />
      <P.EmptyState tone='error' icon={TriangleAlert} title='We couldn’t load the orders' description='The server didn’t answer in time. Check your connection and try again.' action={<P.Button icon={RefreshCw}>Try again</P.Button>} />
      <div style={{ display: 'grid', gap: 'var(--od-space-2)', inlineSize: 'var(--od-x-popover)' }}>
        <P.Skeleton size='65%' /><P.Skeleton /><P.Skeleton size='40%' align='end' />
      </div>
    </Section>

    {/* (N-FD2, N-SU1): the static catalog card that /free-downloads and /support share */}
    <Section id='catalog-card' title='CatalogCard'>
      <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))', gap: 'var(--od-space-4)', margin: 0, padding: 0, listStyle: 'none' }}>
        <P.CatalogCard
          media={<Inbox className='odc-icon' aria-hidden='true' />}
          title='Help center'
          description='Guides for every part of the dashboard, from the first store to the reports.'
          footer={<a className='odc-btn' href='#catalog-card'>Open the help center</a>}
        />
        <P.CatalogCard
          layout='inline'
          media={<RefreshCw className='odc-icon' aria-hidden='true' />}
          title='Integrations'
          description='Connect your POS, delivery partners and payment providers.'
          footer={<a className='odc-btn' href='#catalog-card'>See integrations</a>}
        />
      </ul>
    </Section>

    {/* (N-SU2): the «project code + Copy» note that /free-downloads and /support share */}
    <Section id='project-code' title='ProjectCode'>
      <P.ProjectCode
        note='Our team will ask for your project code.'
        codeLabel='Project code'
        project='example-tenant'
        copy={{ label: 'Copy project code', copyLabel: 'Copy', copiedLabel: 'Copied', failedLabel: 'We couldn’t copy. Select the text and copy it.' }}
      />
      <P.ProjectCode
        note='Sign in to see your project code.'
        codeLabel='Project code'
        copy={{ label: 'Copy project code', copyLabel: 'Copy', copiedLabel: 'Copied', failedLabel: 'We couldn’t copy. Select the text and copy it.' }}
      />
    </Section>

    <Section id='tabs' title='Tabs'><TabsDemo /></Section>

    <Section id='menu' title='Menu'>
      <div className='g-row' style={{ justifyContent: 'flex-end' }}>
        <P.Menu
          label='More actions'
          icon={SlidersHorizontal}
          items={[
            { key: 'clone', label: 'Clone order…', icon: Copy, onSelect: () => {} },
            { key: 'track', label: 'Tracking link', icon: Navigation, onSelect: () => {} },
            { key: 'refund', label: 'Refund…', icon: Receipt, onSelect: () => {}, disabled: true, description: 'Nothing was charged on this order' },
            { key: 'delete', label: 'Delete order…', icon: Trash2, onSelect: () => {}, tone: 'danger', separatorBefore: true }
          ]}
        />
      </div>
    </Section>

    <Section id='table' title='DataTable with selection (comfortable, 44px rows)' flush><TableDemo /></Section>
    <Section id='table-compact' title='DataTable compact (36px rows)' flush><TableDemo density='compact' /></Section>
    <Section id='table-loading' title='DataTable loading' flush><TableDemo loading /></Section>
    <Section id='table-empty' title='DataTable empty with filters' flush><TableDemo empty /></Section>
    {/* redesign tramo C r1 (W1-PC1-03, W1-QC1-11, W1-QC1-15): a table without a row action, a row header and a named scroll region */}
    <Section id='table-plain' title='DataTable without a row action (row header, named scroll region)' flush>
      <div className='g-table'>
        <P.DataTable
          label='Stores'
          scrollLabel='Stores table, scrolls sideways'
          getRowId={r => r.id}
          columns={[{ id: 'store', header: 'Store', cell: r => r.name, rowHeader: true, wrap: true }, { id: 'total', header: 'Total drivers', align: 'end', cell: r => r.total }]}
          rows={[{ id: 1, name: 'North Store', total: 4 }, { id: 2, name: 'South Store', total: 7 }]}
        />
      </div>
    </Section>

    <Section id='columns' title='ColumnManager'><ColumnsDemo /></Section>

    <Section id='filterbar' title='FilterBar idle' flush><FilterDemo /></Section>
    <Section id='filterbar-active' title='FilterBar with active filters' flush><FilterDemo active /></Section>

    <Section id='fa-overflow' fit title='FilterBar and Tabs that do not fit fade at the edge they continue past; flush bar'>
      {/* 480px on a phone (767px viewport): the phone layout keeps the pills on a row of their own that scrolls and fades; «+N» is not drawn there. */}
      <div style={{ inlineSize: '480px', maxInlineSize: '100%' }} className='g-frame' data-testid='fa-bar-frame'><OverflowBar /></div>
      <div style={{ inlineSize: '280px', maxInlineSize: '100%' }} className='g-frame' data-testid='fa-tabs-frame'>
        <P.Tabs
          label='Order status'
          value='pending'
          onValueChange={() => {}}
          items={[
            { value: 'pending', label: 'Pending', count: 3, attention: true, countLabel: '3 orders waiting' },
            { value: 'progress', label: 'In progress', count: 8, countLabel: '8 orders' },
            { value: 'completed', label: 'Completed', count: 744, countLabel: '744 orders' },
            { value: 'cancelled', label: 'Cancelled', count: 2, countLabel: '2 orders' }
          ]}
        />
      </div>
      <div className='g-frame' data-testid='fa-flush-frame' style={{ padding: 'var(--od-space-4)' }}><FlushBar /></div>
    </Section>

    <Section id='fa-onerow' fit title='F1b: the bar is one row at every width above a phone; the pills that do not fit go to «+N» (1100px, 1240px, a 552px split view); a phone keeps its sideways row'>
      <div style={{ inlineSize: '1100px', maxInlineSize: '100%' }} className='g-frame' data-testid='onerow-1100'><OrdersLikeBar /></div>
      <div style={{ inlineSize: '1240px', maxInlineSize: '100%' }} className='g-frame' data-testid='onerow-wide'><OrdersLikeBar /></div>
      <div style={{ inlineSize: '552px', maxInlineSize: '100%' }} className='g-frame' data-testid='onerow-split'><OrdersLikeBar /></div>
      {/* The same 552px list with no filter on: six pills, one row, the rest in «+N». */}
      <div style={{ inlineSize: '552px', maxInlineSize: '100%' }} className='g-frame' data-testid='onerow-split-plain'><OrdersLikeBar plain /></div>
    </Section>

    <Section id='menu-radio' title='Menu with a single choice'><SlaMenu /></Section>

    {/* redesign bugs-d row 36c (W1-D-26): the chat bubble time (a text made focusable) and an icon button, both with a note on hover and on focus */}
    <Section id='tooltip' title='Tooltip: opens on hover and keyboard focus, Escape closes; a text trigger is made focusable'>
      <div className='g-row'>
        <P.Tooltip content='Oct 3, 2026, 9:31 AM'><span data-testid='tooltip-time'>3 min ago</span></P.Tooltip>
        <P.Tooltip content='Copy the tracking link' side='bottom'><P.IconButton icon={Copy} label='Copy tracking link' onClick={() => {}} /></P.Tooltip>
      </div>
    </Section>

    <Section id='notice' title='InlineNotice'>
      <P.InlineNotice tone='warning' icon={WifiOff} action={<P.Button size='sm'>Reconnect now</P.Button>}>Connection lost at 09:31. The list may be out of date; it refreshes when the connection is back.</P.InlineNotice>
      <P.InlineNotice tone='info'>Sample order #10001 from Taylor Example.</P.InlineNotice>
      <P.InlineNotice tone='danger'>The refund failed. Nothing was moved.</P.InlineNotice>
    </Section>
    <Section id='route' title='OrderRoute (C5)'>
      {ROUTES.map(([title, route, note]) => (
        <div key={title}>
          <p className='g-label'>{title}</p>
          <P.OrderRoute label='Order progress' steps={route.steps} describeStep={describeStep} note={note || undefined} />
        </div>
      ))}
      <div style={{ inlineSize: '320px' }} className='g-frame'>
        <P.OrderRoute label='Order progress' steps={ROUTES[0][1].steps} describeStep={describeStep} />
      </div>
    </Section>

    <Section id='route-dated' title='OrderRoute with dated milestones in narrow panels'>
      {['420px', '480px', '560px'].map(width => (
        <div key={width} style={{ inlineSize: width }} className='g-frame' data-testid={`dated-${width}`}>
          <P.OrderRoute label='Order progress' steps={DATED_ROUTE.steps} describeStep={describeStep} />
        </div>
      ))}
    </Section>

    <Section id='timeline' title='ActivityTimeline and SegmentedControl (C9, C13)'>
      <TimelineDemo />
      <div style={{ inlineSize: '240px' }}>
        <P.SegmentedControl label='Show' value='all' onValueChange={() => {}} options={[{ value: 'all', label: 'All' }, { value: 'status', label: 'Status' }, { value: 'logistics', label: 'Logistics' }, { value: 'payments', label: 'Payments' }]} />
      </div>
    </Section>
    <Section id='split' title='SplitView (C8): list and panel side by side from 1280px' flush><SplitDemo /></Section>
    <Section id='section-split' title='SectionSplit: list and detail inside a store editor section (side by side from 1280px, or splitFrom; the detail replaces the list below)'><SectionSplitDemo /></Section>

    <Section id='overlays' title='Dialog, ConfirmDialog and Sheet (C8)'><OverlayDemo /></Section>

    <Section id='save-bar' title='SaveBar: the unsaved-changes bar of a form (Settings, user profile)'><SaveBarStates /></Section>

    <Section id='save-bar-reveal' title='SaveBar in a short scroller: the field being typed in stays above the bar'><SaveBarRevealDemo /></Section>
    <Section id='leave-guard' title='LeaveGuard: ask before leaving unsaved changes (store editor)'><LeaveGuardDemo /></Section>

    <Section id='checklist-pill' title='ChecklistPopover: a pill with a searchable list of six (Driver)' flush><ChecklistPillDemo /></Section>

    <Section id='list-popover' title='ListPopover: a pill with a searchable single-choice list and «All» (Type); unknown value, loading, failed'><ListPillDemo /></Section>

    <Section id='alert-dialog' title='AlertDialog: the Product replacement of the legacy Alert (API messages as lines, one OK)'>
      <div className='g-row'><AlertDialogDemo /></div>
    </Section>

    <Section id='assign-comment-dialog' title='AssignCommentDialog: the required comment before a driver is assigned (order panel and /deliveries)'>
      <div className='g-row'><AssignCommentDialogDemo /></div>
    </Section>

    <Section id='wizard' title='Wizard, Stepper, Summary and WizardFooter (3 steps; the footer inline without a host)'><WizardDemo /></Section>

    <Section id='step-boundary' title='StepBoundary: a failing step keeps the wizard alive; «Try again» returns the focus to the step title'><StepBoundaryDemo /></Section>

    <Section id='date-range' title='DateRangePopover: presets, From / To fields and calendar (a bottom sheet under 768px); the second one holds the range until «Done»'>
      <div className='g-row' data-testid='date-range-demo'>
        <DateRangeDemo />
        <DateRangeDemo hold />
      </div>
    </Section>

    {/* redesign deliveries-followups W1-D-25: 32 visible with a 44×44 area on a phone or with a coarse pointer; 28 on a desktop */}
    <Section id='segmented-touch' title='SegmentedControl: 28px on a desktop, 32px visible with a 44×44 area on a phone (decision 12)'>
      <div style={{ inlineSize: '100%' }} data-testid='touch-seg'>
        <P.SegmentedControl label='View' value='list' onValueChange={() => {}} options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }, { value: 'all', label: 'All' }]} />
      </div>
    </Section>

    <Section id='segmented-narrow' title='SegmentedControl that does not fit becomes a select (C13)'>
      <div style={{ inlineSize: 'var(--od-x-popover)' }} data-testid='narrow-seg'>
        <P.SegmentedControl label='Show' value='all' onValueChange={() => {}} options={[{ value: 'all', label: 'Everything' }, { value: 'status', label: 'Status changes' }, { value: 'logistics', label: 'Logistics' }, { value: 'payments', label: 'Payments' }]} />
      </div>
    </Section>

    {/* redesign W0-7 (T0-29): the cross-family wrappers. */}
    <Section id='fields' title='Field family: TextField, TextArea, PasswordField, NumberField (hint, required, error, disabled, aria-label only, steppers, currency)'><FieldsDemo /></Section>

    <Section id='time-field' title='TimeField: duration (h and min, "H:M" or minutes), time of day in 24 h and 12 h, out of range, error, disabled, 360px'><TimeFieldDemo /></Section>
    <Section id='secret-field' title='SecretField: hidden until Show, ending (last 4), controlled, empty, short, error, disabled, read only, 360px'><SecretFieldDemo /></Section>
    <Section id='copy-button' title='CopyButton: copy, «Copied» for two seconds, failure said, ghost, nothing to copy (disabled)'><CopyButtonDemo /></Section>

    <Section id='switch' title='Switch: off, on, with text, busy, disabled (44px target on a phone)'><SwitchDemo /></Section>
    <Section id='async-switch' title='AsyncSwitch: saves at once, goes back and says why when the save fails'><AsyncSwitchDemo /></Section>

    <Section id='radio-group' title='RadioGroup: vertical with a disabled option, horizontal with a hidden title and an unknown value, disabled group, cards'><RadioGroupDemo /></Section>

    <Section id='pagination' title='Pagination: with page field, first page, last partial page, no total, busy, no results'>
      <PaginationDemo label='Orders pages' total={123} initialPage={4} />
      <PaginationDemo label='First page' total={123} />
      <PaginationDemo label='Last page' total={123} initialPage={13} />
      <PaginationDemo label='Without a total' />
      <PaginationDemo label='Saving page' total={123} initialPage={3} busy />
      <p className='g-label'>No results: the foot paints nothing (nothing between this line and the end of the section)</p>
      <PaginationDemo label='No results' total={0} />
    </Section>

    <Section id='selectable-list' title='SelectableList: search, Select all and none, rows with a store avatar, pagination; loading, failed and empty (360px)'>
      <div className='g-frame g-w-640'><SelectableListDemo label='Share with' /></div>
      <div className='g-frame g-w-360'><SelectableListDemo label='Loading stores' loading /></div>
      <div className='g-frame g-w-360'><SelectableListDemo label='Failed stores' error /></div>
      <div className='g-frame g-w-360'><SelectableListDemo label='No stores' empty /></div>
    </Section>

    <Section id='page-header' title='PageHeader: full, with a back arrow, narrow with a long title, without status'><PageHeaderDemo /></Section>

    <Section id='record-card' title='RecordCard: default, open, with actions, no assignee, long names, tinted, loading, empty'><RecordCardDemo /></Section>

    <Section id='map-frame' title='MapFrame: default, compact and unavailable (a neutral child stands in for the map)'><MapFrameDemo /></Section>
    <Section id='chart' title='Chart (by file): line with the previous period, one series compact, bars in the six slots'><ChartDemo /></Section>

    <Section id='record-panel' title='RecordPanel: tabs with a discard guard (640px), and the navigation slot (900px: a column beside the body)'>
      <RecordPanelDemo />
      <RecordPanelNavDemo />
    </Section>

    <Section id='section-nav' title='SectionNav: a 640px list and a 320px container (a selector under 768px of viewport)'>
      <div className='g-frame g-w-640'><SectionNavDemo label='Store sections' /></div>
      <div className='g-frame g-w-320'><SectionNavDemo label='Store sections, narrow' /></div>
      <p className='g-label'>Grouped and collapsible (groups, openGroups, onGroupSelect), with descriptions; listOnly keeps the list at 320px; arrows activate</p>
      <div className='g-frame g-w-320'><GroupedSectionNavDemo label='Settings sections, grouped' /></div>
    </Section>

    <Section id='schedule-editor' title='ScheduleEditor: a day per row (switch, lapses with native selects, add, copy), 640px and 360px; with the disabled variant'>
      <div className='g-frame g-w-640'><ScheduleEditorDemo /></div>
      <div className='g-frame g-w-360'><ScheduleEditorDemo useDaysAbbrevation /></div>
      <div className='g-frame g-w-640'><ScheduleEditorDemo disableSchedule /></div>
    </Section>

    {/* redesign bi FA0 (D3): Metric and MetricGrid, the figure with its references (promoted from Home) */}
    <Section id='metric' title='Metric and MetricGrid: a figure with its references; loaded and loading, 4 and 6 columns'>
      <P.MetricGrid columns={4}>
        <P.Metric label='Sales' value={<span className='odc-figure'><bdi>$ 5,594.18</bdi></span>} refs={[{ text: '+9.2% vs the previous 7 days', value: <span className='odc-figure'><bdi>$ 5,120.40</bdi></span> }, { text: 'Full day', value: <span className='odc-figure'><bdi>$ 92.21</bdi></span>, secondary: true }]} />
        <P.Metric label='Orders' value={<span className='odc-figure'><bdi>160</bdi></span>} refs={[{ text: 'Yesterday by this time:', value: <span className='odc-figure'><bdi>3</bdi></span> }]} />
        <P.Metric label='Average ticket' loading refs={[{ text: '' }]} />
        <P.Metric label='Registered users' value={<span className='odc-figure'><bdi>81</bdi></span>} />
      </P.MetricGrid>
      <div className='g-frame g-w-900'>
        <P.MetricGrid columns={6}>
          {['Orders', 'Sales', 'Average ticket', 'Registered users', 'Time to accept', 'Wait at pickup'].map(label => (
            <P.Metric key={label} label={label} value={<span className='odc-figure'><bdi>160</bdi></span>} />
          ))}
        </P.MetricGrid>
      </div>
    </Section>

    <Section id='select' title='Select: the form select (search, three short options, invalid and required, disabled, remote list with a pager)'><SelectDemo /></Section>

    <Section id='date-picker' title='DatePicker: value, empty, invalid, disabled, min and max, clearable with a Monday start'><DatePickerDemo /></Section>

    <Section id='legacy-fields' title='ImageField, ColorField and PhoneField: the Product frame around the legacy pieces'><LegacyFieldsDemo /></Section>
  </main>
)

createRoot(document.getElementById('root')).render(<App />)
