/* eslint-disable import/first */
// redesign F4 (C20): the order panel while it loads has the grid of the loaded one: the header (title, status,
// actions, metadata line), the tab strip, the route and blocks in the scrolling body, and the footer where the
// status selector goes. The frame, the header and the tab strip use the real classes, so their heights are the
// real ones. The tab contents are mocked, as in the frame test: this file only looks at the loading state.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({
  user: { id: 1, level: 0 },
  tabProps: {},
  chatLifecycle: { mounts: 0, unmounts: 0 },
  footerProps: null,
  headerProps: null,
  addQueryToUrl: null,
  removeQueryToUrl: null
}))

runtime.addQueryToUrl = vi.fn()
runtime.removeQueryToUrl = vi.fn()

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: value => String(value) }],
  useSession: () => [{ user: runtime.user, token: null }],
  useApi: () => [null],
  OrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../../utils', () => ({
  getOrderStatuPickUp: () => ({ percentage: 20 }),
  getOrderStatus: () => ({ percentage: 20 }),
  getOrderStatusPrefix: () => 'Pending',
  getCurrenySymbol: () => '$',
  addQueryToUrl: (...args) => runtime.addQueryToUrl(...args),
  removeQueryToUrl: (...args) => runtime.removeQueryToUrl(...args),
  getUserType: () => false
}))

vi.mock('react-hook-form', () => ({
  useForm: () => ({ register: vi.fn(), handleSubmit: fn => fn, formState: { errors: {} } })
}))

vi.mock('../../OrderDetailsHeader', () => ({
  OrderDetailsHeader: (props) => {
    runtime.headerProps = props
    return (
      <div data-testid='header'>
        <button type='button' onClick={() => props.handleShowOption('clone_order')}>Open clone</button>
        <button type='button' onClick={() => props.handleShowOption('chat')}>Open chat</button>
        <button type='button' onClick={() => props.handleShowOption('history')}>Open history</button>
        <button type='button' onClick={() => props.handleShowOption('metafields')}>Open fields</button>
        <button type='button' onClick={() => props.actionSidebar(false)}>Close panel</button>
        <button type='button' onClick={() => props.setIsExpand(prev => !prev)}>Toggle expand</button>
      </div>
    )
  }
}))

vi.mock('../DetailsTab', () => ({
  DetailsTab: (props) => { runtime.tabProps.details = props; return <div data-testid='tab-details'>details content</div> }
}))
vi.mock('../ActivityTab', () => ({
  ActivityTab: (props) => { runtime.tabProps.activity = props; return <div data-testid='tab-activity'>activity content</div> }
}))
vi.mock('../ChatTab', () => ({
  ChatTab: (props) => {
    runtime.tabProps.chat = props
    React.useEffect(() => {
      runtime.chatLifecycle.mounts += 1
      return () => { runtime.chatLifecycle.unmounts += 1 }
    }, [])
    return <div data-testid='tab-chat'>chat content</div>
  }
}))
// The panel's one Messages controller (parity audit 2) is not under test here: the tabs are mocked.
vi.mock('../OrderMessages', () => ({ OrderMessagesProvider: ({ children }) => children }))
vi.mock('../FieldsTab', () => ({
  FieldsTab: (props) => { runtime.tabProps.fields = props; return <div data-testid='tab-fields'>fields content</div> }
}))
vi.mock('../DetailsFooter', () => ({
  DetailsFooter: (props) => {
    runtime.footerProps = props
    return <div data-testid='footer'>footer</div>
  }
}))

vi.mock('../../CloneOrder', () => ({
  CloneOrder: () => <div data-testid='clone-order'>Clone order content</div>
}))
vi.mock('../../OrderToPrint', () => {
  const OrderToPrint = React.forwardRef(function OrderToPrintMock () { return null })
  return { OrderToPrint }
})
vi.mock('../../OrderToPrintTicket', () => {
  const OrderToPrintTicket = React.forwardRef(function OrderToPrintTicketMock () { return null })
  return { OrderToPrintTicket }
})

vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => open ? <div role='dialog' aria-label='legacy'>{children}</div> : null,
  Alert: () => null
}))

vi.mock('../../../../styles', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  TextArea: (props) => <textarea {...props} />
}))

import { OrderDetails } from '..'

// redesign N-05: the panel is a lazy chunk. These tests look at the loading state of the real panel, so they wait for the
// chunk (the fallback in OrderDetailsLazy draws the same skeleton) before they look.
const renderLoading = async ({ search = '', layout = 'split', ...props } = {}) => {
  const handlers = { onClose: vi.fn(), handleBackRedirect: vi.fn(), setCurrentTourStep: vi.fn(), setIsTourOpen: vi.fn() }
  const view = renderWithProviders(
    <OrderDetails
      open
      layout={layout}
      order={{ loading: true, order: null }}
      messages={{ messages: [] }}
      setIsTourFlag={vi.fn()}
      handleCloneOrder={vi.fn()}
      setCloneState={vi.fn()}
      cloneState={{ type: 1, loading: false }}
      {...handlers}
      {...props}
    />,
    { initialEntries: [`/orders${search}`] }
  )
  await act(async () => { await import('../OrderDetailsPanel') })
  return { ...view, ...handlers }
}

const panel = () => document.getElementById('orderDetails')

describe('OrderDetails skeleton: the grid of the loaded panel', () => {
  beforeEach(() => {
    runtime.user = { id: 1, level: 0 }
    runtime.tabProps = {}
  })

  it('is the frame of the loaded panel: header, then the tab strip with the body and the footer', async () => {
    await renderLoading()
    const frame = panel().querySelector('.odc-od-frame[data-skeleton]')
    expect(frame).not.toBeNull()
    expect(Array.from(frame.children).map(child => child.tagName + '.' + child.className.split(' ').filter(name => /^odc-od/.test(name)).join('.')))
      .toEqual(expect.arrayContaining(['HEADER.odc-od-head', 'DIV.odc-od-tabs']))
    const tabs = frame.querySelector('.odc-od-tabs')
    expect(Array.from(tabs.children).map(child => child.className)).toEqual([
      expect.stringContaining('odc-tabs-list'),
      expect.stringContaining('odc-od-body'),
      expect.stringContaining('odt-foot')
    ])
  })

  it('draws the header: title, status, the actions and the metadata line', async () => {
    await renderLoading()
    const head = panel().querySelector('.odc-od-head')
    const row = head.querySelector('.odc-od-head-row')
    expect(row.querySelectorAll('.odc-skeleton').length).toBeGreaterThanOrEqual(2)
    // the way out stays a real button; the other actions are placeholders of the control size
    expect(within(row).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(head.querySelectorAll('.odc-od-head-actions .odc-skeleton[data-shape="box"]').length).toBe(3)
    expect(head.querySelectorAll('.odc-od-meta > span').length).toBeGreaterThanOrEqual(3)
  })

  it('draws the tab strip as placeholders: no tablist to move into while loading', async () => {
    await renderLoading()
    const strip = panel().querySelector('.odc-od-tabs > .odc-tabs-list')
    expect(strip.querySelectorAll('.odc-tab')).toHaveLength(4)
    expect(strip.getAttribute('role')).toBeNull()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('draws the route (five steps, with the real route classes) and three blocks in the body', async () => {
    await renderLoading()
    const body = panel().querySelector('.odc-od-body')
    const steps = body.querySelectorAll('.odc-route ol > li')
    expect(steps).toHaveLength(5)
    steps.forEach(step => expect(step.querySelector('.odc-route-node')).not.toBeNull())
    expect(body.querySelectorAll('.odc-od-sk-block')).toHaveLength(3)
  })

  it('draws the footer where the status selector goes', async () => {
    await renderLoading()
    const foot = panel().querySelector('.odc-od-tabs > .odt-foot')
    expect(foot.querySelector('.odt-foot-selector .odc-skeleton')).not.toBeNull()
  })

  it('is busy, says «Loading» once in hidden text and keeps the way out', async () => {
    const view = await renderLoading()
    expect(panel()).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByText('Loading')).toHaveLength(1)
    expect(screen.getByText('Loading')).toHaveClass('odc-sr-only')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(view.onClose).toHaveBeenCalledTimes(1)
  })

  it('leaves nothing of the skeleton once the order is there', async () => {
    renderWithProviders(
      <OrderDetails
        open
        layout='split'
        order={{ loading: false, order: { id: 42, customer_id: 7, products: [], delivery_type: 1, status: 0, unread_count: 0 } }}
        messages={{ messages: [] }}
        setIsTourFlag={vi.fn()}
        handleCloneOrder={vi.fn()}
        setCloneState={vi.fn()}
        cloneState={{ type: 1, loading: false }}
        onClose={vi.fn()}
        handleBackRedirect={vi.fn()}
        setCurrentTourStep={vi.fn()}
        setIsTourOpen={vi.fn()}
      />,
      { initialEntries: ['/orders'] }
    )
    // redesign N-05: the lazy panel replaces the skeleton of the fallback once its chunk is in.
    await waitFor(() => expect(panel().querySelector('[data-skeleton]')).toBeNull())
    expect(panel().querySelector('[data-skeleton]')).toBeNull()
    expect(panel()).not.toHaveAttribute('aria-busy', 'true')
  })
})

describe('OrderDetails skeleton: stylesheet', () => {
  const css = readFileSync(resolve(__dirname, '../order-details.css'), 'utf8')

  it('holds the line of the text each placeholder stands for, from tokens', () => {
    expect(css).toMatch(/\.odc-od-sk-line\s*\{[^}]*min-block-size:\s*calc\(var\(--od-x-type-ui-size\) \* var\(--od-x-leading-ui\)\)/)
    expect(css).toMatch(/\.odc-od-sk-title\s*\{[^}]*var\(--od-x-leading-title\)/)
  })

  it('has no rule left of the old generic skeleton', () => {
    expect(css).not.toMatch(/odc-od-skeleton-(head|tabs|route)/)
  })
})
