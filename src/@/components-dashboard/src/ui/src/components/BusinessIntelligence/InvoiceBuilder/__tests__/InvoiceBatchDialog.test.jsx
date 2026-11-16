/* eslint-disable import/first */
// the dialog of several invoices at once. The controller's `batch` is a stand-in: what is under test is what the dialog
// shows for each state and that each button calls the controller (or saves the file) once.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ saved: [] }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../downloadInvoicePdf', () => ({
  saveInvoicePdfBlob: (blob, filename) => runtime.saved.push({ blob, filename })
}))

import { InvoiceBatchDialog } from '../InvoiceBatchDialog'

const BUSINESSES = [{ id: 7, name: 'Pizza Palace' }, { id: 8, name: 'Burger Barn' }, { id: 9, name: 'Taco Town' }]
const DRIVERS = [{ id: 21, name: 'Dana Driver' }, { id: 22, name: 'José Rider' }]
const PERIOD = { from: '2026-09-01', to: '2026-09-30' }

const makeBatch = (extra = {}) => ({
  limit: 50,
  selected: [],
  toggle: vi.fn(),
  selectAll: vi.fn(),
  clear: vi.fn(),
  items: [],
  running: false,
  blocked: null,
  run: vi.fn(),
  retry: vi.fn(),
  cancel: vi.fn(),
  ...extra
})

const party = (kind) => kind === 'business'
  ? { kind, items: BUSINESSES, loading: false, error: null, page: 1, totalPages: 1, setSearch: vi.fn(), goToPage: vi.fn(), retry: vi.fn() }
  : { kind, items: DRIVERS, loading: false, error: null, retry: vi.fn() }

const makePdf = vi.fn()

const show = ({ kind = 'business', batch = makeBatch(), pdfReady = true } = {}) => {
  const props = { open: true, onOpenChange: vi.fn(), kind, party: party(kind), batch, makePdf, pdfReady }
  const view = render(<InvoiceBatchDialog {...props} />)
  return { ...view, props, rerender: (next) => view.rerender(<InvoiceBatchDialog {...props} {...next} />) }
}

const item = (party, status, extra = {}) => ({ ...party, status, error: null, invoice: { ...PERIOD }, truncated: null, pdf: null, ...extra })

beforeEach(() => {
  runtime.saved = []
  makePdf.mockReset()
})

describe('InvoiceBatchDialog: choosing', () => {
  it('lists the businesses, says the limit, and nothing can be created with none selected', () => {
    show()
    const dialog = screen.getByRole('dialog', { name: 'Invoice several businesses' })
    expect(dialog.textContent).toContain('One PDF each, with the period, fees and filters of the form. Up to 50 at a time.')
    expect(within(dialog).getByRole('status').textContent).toBe('0 of 50 selected')
    expect(within(dialog).getAllByRole('checkbox').map(box => box.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Pizza Palace')]))
    expect(within(dialog).getByRole('button', { name: 'Create 0 invoices' }).disabled).toBe(true)
  })

  it('a row toggles that business, «Select all on this page» passes the page, and Create runs the batch with the PDF maker', async () => {
    const user = userEvent.setup()
    const batch = makeBatch()
    const { rerender } = show({ batch })
    await user.click(screen.getByRole('checkbox', { name: /Burger Barn/ }))
    expect(batch.toggle).toHaveBeenCalledWith(BUSINESSES[1], true)
    await user.click(screen.getByRole('button', { name: 'Select all on this page' }))
    expect(batch.selectAll).toHaveBeenCalledWith(BUSINESSES)

    rerender({ batch: { ...batch, selected: BUSINESSES.slice(0, 2) } })
    expect(screen.getByRole('status').textContent).toBe('2 of 50 selected')
    await user.click(screen.getByRole('button', { name: 'Create 2 invoices' }))
    expect(batch.run).toHaveBeenCalledWith(makePdf)
  })

  it('cannot create while the logo loads, or with no order type, and says why', () => {
    const { rerender } = show({ batch: makeBatch({ selected: [BUSINESSES[0]] }), pdfReady: false })
    expect(screen.getByRole('button', { name: 'Create 1 invoice' }).disabled).toBe(true)
    rerender({ pdfReady: true, batch: makeBatch({ selected: [BUSINESSES[0]], blocked: 'no_order_types' }) })
    expect(screen.getByText('No order types selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create 1 invoice' }).disabled).toBe(true)
  })

  it('says when the limit is reached', () => {
    show({ batch: makeBatch({ limit: 2, selected: BUSINESSES.slice(0, 2) }) })
    expect(screen.getByRole('status').textContent).toBe('2 of 2 selected · Limit reached')
  })

  it('drivers are searched here, without accents', async () => {
    const user = userEvent.setup()
    show({ kind: 'driver' })
    expect(screen.getByRole('dialog', { name: 'Invoice several drivers' })).toBeTruthy()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'jose{Enter}')
    expect(screen.getAllByRole('checkbox').map(box => box.textContent)).toEqual([expect.stringContaining('José Rider')])
    expect(screen.getByRole('button', { name: 'Select all shown' })).toBeTruthy()
  })
})

describe('InvoiceBatchDialog: the results', () => {
  const pdf = (id) => ({ blob: new Blob([`%PDF ${id}`]), filename: `invoice-${id}.pdf` })

  const runResults = async (batch) => {
    const user = userEvent.setup()
    const view = show({ batch: { ...batch, running: false, items: [], selected: BUSINESSES } })
    await user.click(screen.getByRole('button', { name: 'Create 3 invoices' }))
    view.rerender({ batch })
    return { user, ...view }
  }

  it('while it runs: each one with its status, the progress, and only Stop, which cancels', async () => {
    const batch = makeBatch({
      running: true,
      items: [item(BUSINESSES[0], 'done', { pdf: pdf(7) }), item(BUSINESSES[1], 'running'), item(BUSINESSES[2], 'queued')]
    })
    const { user } = await runResults(batch)
    expect(screen.getByRole('status').textContent).toBe('1 of 3 finished')
    const rows = within(screen.getByRole('list', { name: 'Invoice several businesses' })).getAllByRole('listitem')
    expect(rows.map(row => row.getAttribute('data-status'))).toEqual(['done', 'running', 'queued'])
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining('Ready'), expect.stringContaining('Creating'), expect.stringContaining('Waiting')
    ])
    expect(screen.queryByRole('button', { name: 'Change selection' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download all (.zip)' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(batch.cancel).toHaveBeenCalledTimes(1)
  })

  it('when it ends: download one, retry one, retry the failed ones, and the .zip of the ready ones', async () => {
    const batch = makeBatch({
      items: [
        item(BUSINESSES[0], 'done', { pdf: pdf(7) }),
        item(BUSINESSES[1], 'error', { error: ['The server is busy'] }),
        item(BUSINESSES[2], 'empty')
      ]
    })
    const { user } = await runResults(batch)
    const rows = within(screen.getByRole('list', { name: 'Invoice several businesses' })).getAllByRole('listitem')
    expect(rows[1].textContent).toContain('Failed')
    expect(rows[1].textContent).toContain('The server is busy')
    expect(rows[2].textContent).toContain('No orders')
    expect(within(rows[2]).queryByRole('button')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Download the PDF of Pizza Palace' }))
    expect(runtime.saved.map(file => file.filename)).toEqual(['invoice-7.pdf'])

    await user.click(screen.getByRole('button', { name: 'Try Burger Barn again' }))
    expect(batch.retry).toHaveBeenLastCalledWith(makePdf, 8)
    await user.click(screen.getByRole('button', { name: 'Try the failed ones again' }))
    expect(batch.retry).toHaveBeenLastCalledWith(makePdf)

    await user.click(screen.getByRole('button', { name: 'Download all (.zip)' }))
    await vi.waitFor(() => expect(runtime.saved).toHaveLength(2))
    expect(runtime.saved[1].filename).toBe('invoices-2026-09-01_2026-09-30.zip')
    expect(runtime.saved[1].blob.type).toBe('application/zip')
  })

  it('a thrown error is never shown raw', async () => {
    const batch = makeBatch({ items: [item(BUSINESSES[0], 'error', { error: [new Error('Invalid response format')] })] })
    await runResults(batch)
    expect(screen.queryByText(/Invalid response format/)).toBeNull()
    expect(screen.getByText('The invoice could not be created.')).toBeTruthy()
  })

  it('«Change selection» goes back to the list', async () => {
    const batch = makeBatch({ items: [item(BUSINESSES[0], 'done', { pdf: pdf(7) })] })
    const { user } = await runResults(batch)
    await user.click(screen.getByRole('button', { name: 'Change selection' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })
})
