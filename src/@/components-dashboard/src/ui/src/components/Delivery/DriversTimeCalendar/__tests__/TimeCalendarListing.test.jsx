/* eslint-disable import/first */
// redesign DT-B5 (decisions 1–7 | DT-12, DT-15, DT-17): the drivers time display page. The controller is played by the props; the bar
// (B4), the grid and the agenda (B3) and the dialogs (B2) are stubs that record what they receive: what is tested is how the page
// composes them, the bodies it sends (blockData's real addBody / editBody), the confirmation with the propagation, the API errors in an
// AlertDialog, the list of a day's blocks and the pagination. The Product wrappers (PageHeader, FilterBar, Pagination, Dialog,
// AlertDialog) are the real ones.
import React from 'react'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({ grid: null, agenda: null, dialog: null, confirm: null, pills: null, nav: null, phone: false }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useConfig: () => [{ configs: { general_hour_format: { value: 'HH:mm' } } }],
  useUtils: () => [{ parseDate: (value) => `day(${String(value).slice(0, 10)})` }]
}))
const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))
vi.mock('../../../Shared/LearnDropDown', () => ({ LearnDropDown: () => <span>Learn</span> }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => seen.phone }))
vi.mock('../ScheduleGrid', () => ({
  ScheduleGrid: (props) => { seen.grid = props; return <div data-testid='grid' /> }
}))
vi.mock('../ScheduleAgenda', () => ({
  ScheduleAgenda: (props) => { seen.agenda = props; return <div data-testid='agenda' /> }
}))
vi.mock('../ScopePills', () => ({
  ScopePills: (props) => { seen.pills = props; return <span data-testid='pills' /> }
}))
vi.mock('../DateNav', () => ({
  DateNav: (props) => { seen.nav = props; return <span data-testid='datenav' /> }
}))
vi.mock('../BlockDialog', () => ({
  BlockDialog: (props) => { seen.dialog = props; return props.open ? <div data-testid='block-dialog' data-mode={props.mode} /> : null }
}))
vi.mock('../BlockConfirmDialog', () => ({
  BlockConfirmDialog: (props) => { seen.confirm = props; return props.open ? <div data-testid='confirm' data-kind={props.kind}>{props.summary}</div> : null }
}))

import { TimeCalendarListingUI } from '../TimeCalendarListing'

const carlos = {
  id: 67,
  name: 'Carlos',
  lastname: 'Mendoza',
  email: 'carlos@example.com',
  delivery_blocks: [
    { id: 900, name: 'Morning', start: '2030-09-16 09:00:00', end: '2030-09-16 17:00:00', break_start: null, break_end: null, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO', until: '2030-10-30 23:59:59' }
  ]
}

// (row 34): a block that does not repeat (rrule null)
const single = { id: 901, name: 'Once', start: '2030-09-16 09:00:00', end: '2030-09-16 17:00:00', break_start: null, break_end: null, rrule: null, until: null }
const dana = { id: 68, name: 'Dana', lastname: 'Cruz', email: 'dana@example.com', delivery_blocks: [single] }

const form = (over = {}) => ({
  name: '',
  description: '',
  day: '2030-09-16',
  start: '09:00',
  end: '17:00',
  showBreak: false,
  breakStart: '',
  breakEnd: '',
  freq: null,
  byweekday: [],
  untilDay: '2030-09-16',
  ...over
})

const baseProps = (over = {}) => ({
  range: { from: '2030-09-16', to: '2030-09-16' },
  setRange: vi.fn(),
  selectedGroup: null,
  setSelectedGroup: vi.fn(),
  driverIds: [],
  toggleDriver: vi.fn(),
  clearDrivers: vi.fn(),
  driversList: { users: [carlos], loading: false, error: null },
  paginationProps: { currentPage: 1, pageSize: 10, totalPages: 2, totalItems: 17 },
  changePage: vi.fn(),
  changePageSize: vi.fn(),
  addBlock: vi.fn(async () => ({ ok: true })),
  editBlock: vi.fn(async () => ({ ok: true })),
  deleteBlock: vi.fn(async () => ({ ok: true })),
  ...over
})

const draw = (props) => renderWithProviders(<TimeCalendarListingUI {...props} />)

beforeEach(() => {
  seen.phone = false
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
})
afterEach(() => cleanup())

describe('TimeCalendarListingUI', () => {
  it('composes the header, the bar, the grid and the pagination of main (10, 25, 50)', () => {
    draw(baseProps())
    expect(screen.getByRole('heading', { level: 1, name: 'Drivers time display' })).toBeInTheDocument()
    expect(screen.getByTestId('pills')).toBeInTheDocument()
    expect(screen.getByTestId('datenav')).toBeInTheDocument()
    expect(screen.getByTestId('grid')).toBeInTheDocument()
    expect(seen.grid.users).toEqual([carlos])
    expect(seen.grid.range).toEqual({ from: '2030-09-16', to: '2030-09-16' })
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
  })

  it('has the menu button only while the sidebar is collapsed, as the first child of the header lead block', async () => {
    draw(baseProps())
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    cleanup()
    infoShare.isCollapse = true
    draw(baseProps())
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  // redesign bugs-d row 65 (R-10): on a narrow header Learn keeps only its icon (its name stays), so the header is one line at 390
  it('scopes the header so Learn collapses to its icon on a narrow header', () => {
    draw(baseProps())
    const head = screen.getByRole('heading', { level: 1, name: 'Drivers time display' }).closest('.odc-dtd-head')
    expect(head).not.toBeNull()
    const css = readFileSync(path.resolve(__dirname, '../drivers-time-page.css'), 'utf8').replace(/\s+/g, ' ')
    expect(css).toMatch(/@container \(max-width: 767px\) \{ \.odc-dtd-head \.od-learn-label \{[^}]*clip-path: inset\(50%\)/)
  })

  it('shows the agenda on a phone (decision 4)', () => {
    seen.phone = true
    draw(baseProps())
    expect(screen.getByTestId('agenda')).toBeInTheDocument()
    expect(screen.queryByTestId('grid')).not.toBeInTheDocument()
  })

  it('a load error replaces the grid with a retry (DT-17)', async () => {
    const props = baseProps({ driversList: { users: [], loading: false, error: ['boom'] } })
    draw(props)
    expect(screen.getByRole('alert')).toHaveTextContent('The drivers could not be loaded.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.changePage).toHaveBeenCalledWith(1)
  })

  it('adding sends addBody of the form to the driver and closes on success (DT-12: the dialog gets the driver)', async () => {
    const props = baseProps()
    draw(props)
    act(() => seen.grid.onAddBlock(carlos, '2030-09-16', '10:00'))
    expect(screen.getByTestId('block-dialog')).toHaveAttribute('data-mode', 'add')
    expect(seen.dialog.driver).toBe(carlos)
    expect(seen.dialog.day).toBe('2030-09-16')
    expect(seen.dialog.startTime).toBe('10:00')
    await act(async () => { await seen.dialog.onSubmit(form({ start: '10:00' })) })
    expect(props.addBlock).toHaveBeenCalledTimes(1)
    const [driverId, body] = props.addBlock.mock.calls[0]
    expect(driverId).toBe(67)
    expect(Object.keys(body).sort()).toEqual(['end', 'start', 'until'])
    expect(screen.queryByTestId('block-dialog')).not.toBeInTheDocument()
  })

  it('editing asks the propagation first and sends editBody with it (C8, DT-02)', async () => {
    const props = baseProps()
    draw(props)
    act(() => seen.grid.onOpenBlock(carlos, carlos.delivery_blocks[0], '2030-09-16'))
    expect(seen.dialog.mode).toBe('edit')
    await act(async () => { await seen.dialog.onSubmit(form({ freq: 'weekly', byweekday: [0], start: '08:00' })) })
    expect(props.editBlock).not.toHaveBeenCalled()
    expect(screen.getByTestId('confirm')).toHaveAttribute('data-kind', 'edit')
    expect(screen.getByTestId('confirm')).toHaveTextContent('Carlos Mendoza · 08:00 – 17:00 · day(2030-09-16)')
    act(() => seen.confirm.onPropagationChange('all'))
    await act(async () => { await seen.confirm.onConfirm() })
    const [driverId, blockId, body] = props.editBlock.mock.calls[0]
    expect([driverId, blockId]).toEqual([67, 900])
    expect(body.propagation).toBe('all')
    expect(body.rrule).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO')
    // a series keeps its own until (DT-02), in UTC
    expect(body.until).toBeTruthy()
    expect(body.until.slice(0, 10) >= '2030-10-30').toBe(true)
    expect(screen.queryByTestId('confirm')).not.toBeInTheDocument()
    expect(screen.queryByTestId('block-dialog')).not.toBeInTheDocument()
  })

  it('deleting asks with the propagation and sends it (DT-15)', async () => {
    const props = baseProps()
    draw(props)
    act(() => seen.grid.onOpenBlock(carlos, carlos.delivery_blocks[0], '2030-09-16'))
    act(() => seen.dialog.onDelete())
    expect(screen.getByTestId('confirm')).toHaveAttribute('data-kind', 'delete')
    act(() => seen.confirm.onPropagationChange('from_event'))
    await act(async () => { await seen.confirm.onConfirm() })
    expect(props.deleteBlock).toHaveBeenCalledWith(67, 900, 'from_event')
  })

  // (row 34, drivers-time-display P-3): the confirmation only asks about the series when the block (as it was) repeats
  it('a block with a rrule asks the propagation, for edit and for delete (repeats true)', async () => {
    draw(baseProps())
    act(() => seen.grid.onOpenBlock(carlos, carlos.delivery_blocks[0], '2030-09-16'))
    await act(async () => { await seen.dialog.onSubmit(form({ start: '08:00' })) })
    expect(seen.confirm.repeats).toBe(true)
    act(() => seen.confirm.onCancel())
    act(() => seen.dialog.onDelete())
    expect(seen.confirm.kind).toBe('delete')
    expect(seen.confirm.repeats).toBe(true)
  })

  it('a block without a rrule does not ask the propagation on edit and still sends «none»', async () => {
    const props = baseProps({ driversList: { users: [dana], loading: false, error: null } })
    draw(props)
    act(() => seen.grid.onOpenBlock(dana, single, '2030-09-16'))
    await act(async () => { await seen.dialog.onSubmit(form({ start: '08:00' })) })
    expect(screen.getByTestId('confirm')).toHaveAttribute('data-kind', 'edit')
    expect(seen.confirm.repeats).toBe(false)
    await act(async () => { await seen.confirm.onConfirm() })
    const [driverId, blockId, body] = props.editBlock.mock.calls[0]
    expect([driverId, blockId]).toEqual([68, 901])
    expect(body.propagation).toBe('none')
  })

  it('a block without a rrule edited into a repeating one still sends «none»', async () => {
    const props = baseProps({ driversList: { users: [dana], loading: false, error: null } })
    draw(props)
    act(() => seen.grid.onOpenBlock(dana, single, '2030-09-16'))
    await act(async () => { await seen.dialog.onSubmit(form({ freq: 'weekly', byweekday: [0] })) })
    expect(seen.confirm.repeats).toBe(false)
    await act(async () => { await seen.confirm.onConfirm() })
    expect(props.editBlock.mock.calls[0][2].propagation).toBe('none')
  })

  it('a block without a rrule keeps the delete confirmation, without the propagation, and sends «none»', async () => {
    const props = baseProps({ driversList: { users: [dana], loading: false, error: null } })
    draw(props)
    act(() => seen.grid.onOpenBlock(dana, single, '2030-09-16'))
    act(() => seen.dialog.onDelete())
    expect(screen.getByTestId('confirm')).toHaveAttribute('data-kind', 'delete')
    expect(seen.confirm.repeats).toBe(false)
    expect(props.deleteBlock).not.toHaveBeenCalled()
    await act(async () => { await seen.confirm.onConfirm() })
    expect(props.deleteBlock).toHaveBeenCalledWith(68, 901, 'none')
  })

  it('a failed delete says why and keeps the dialogs (DT-15)', async () => {
    const props = baseProps({ deleteBlock: vi.fn(async () => ({ ok: false, error: ['The block could not be deleted'] })) })
    draw(props)
    act(() => seen.grid.onOpenBlock(carlos, carlos.delivery_blocks[0], '2030-09-16'))
    act(() => seen.dialog.onDelete())
    await act(async () => { await seen.confirm.onConfirm() })
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('The block could not be deleted')
    expect(screen.getByTestId('confirm')).toBeInTheDocument()
  })

  it('«+N more» lists the blocks of the day and opens one', async () => {
    draw(baseProps())
    act(() => seen.grid.onShowDay(carlos, '2030-09-16', carlos.delivery_blocks))
    expect(await screen.findByRole('dialog', { name: 'Stacked shifts' })).toBeInTheDocument()
    const button = await screen.findByRole('button', { name: /09:00 – 17:00/ })
    await userEvent.click(button)
    await waitFor(() => expect(seen.dialog.mode).toBe('edit'))
    expect(seen.dialog.block).toBe(carlos.delivery_blocks[0])
  })

  it('the bar reports the scope and the dates to the controller', () => {
    const props = baseProps()
    draw(props)
    act(() => seen.pills.onToggleDriver(68, 'Jessica Tran'))
    expect(props.toggleDriver).toHaveBeenCalledWith(68)
    expect(seen.pills.driverNames).toEqual({ 68: 'Jessica Tran' })
    act(() => seen.pills.onGroupChange({ id: 3, name: 'North' }))
    expect(props.setSelectedGroup).toHaveBeenCalledWith({ id: 3, name: 'North' })
    act(() => seen.nav.onRangeError(true))
    expect(seen.nav.rangeError).toBe(true)
    act(() => seen.nav.onRangeChange({ from: '2030-09-15', to: '2030-09-21' }))
    expect(props.setRange).toHaveBeenCalledWith({ from: '2030-09-15', to: '2030-09-21' })
    expect(seen.nav.rangeError).toBe(false)
  })

  it('cancelling the confirmation goes back to the open block dialog, with its edits (review r1 R-01)', async () => {
    const props = baseProps()
    draw(props)
    act(() => seen.grid.onOpenBlock(carlos, carlos.delivery_blocks[0], '2030-09-16'))
    await act(async () => { await seen.dialog.onSubmit(form({ start: '08:00' })) })
    // the block dialog stays mounted (open) under the confirmation, so its form is not started again
    expect(screen.getByTestId('confirm')).toBeInTheDocument()
    expect(seen.dialog.open).toBe(true)
    act(() => seen.confirm.onCancel())
    expect(screen.queryByTestId('confirm')).not.toBeInTheDocument()
    expect(screen.getByTestId('block-dialog')).toHaveAttribute('data-mode', 'edit')
    expect(props.editBlock).not.toHaveBeenCalled()
  })

  it('«Clear filters» is one click away while drivers are chosen, as main (review r1 R-06)', async () => {
    const props = baseProps({ driverIds: [68] })
    draw(props)
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(props.clearDrivers).toHaveBeenCalledTimes(1)
    cleanup()
    draw(baseProps())
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('passes the 12-hour clock of the project to the grid (general_hour_format)', () => {
    draw(baseProps())
    expect(seen.grid.is12).toBe(false)
    expect(seen.grid.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// the page works in the zone of the chosen group and writes it under the title
describe('TimeCalendarListingUI · the zone of the group', () => {
  const bogota = { zone: 'America/Bogota', fallback: false }

  it('writes the zone, and hands it to the date bar and the dialog', () => {
    draw(baseProps({ timeZone: bogota }))
    expect(screen.getByText('Times in America/Bogota')).toBeInTheDocument()
    expect(seen.nav.zone).toBe('America/Bogota')
    act(() => seen.grid.onAddBlock(carlos, '2030-09-16', '09:00'))
    expect(seen.dialog.zone).toBe('America/Bogota')
  })

  it('a shift made at 09:00 is sent as the UTC of 09:00 in the group\'s zone', async () => {
    const props = baseProps({ timeZone: bogota })
    draw(props)
    act(() => seen.grid.onAddBlock(carlos, '2030-09-16', '09:00'))
    await act(async () => { await seen.dialog.onSubmit(form()) })
    expect(props.addBlock.mock.calls[0][1]).toMatchObject({ start: '2030-09-16 14:00:00', end: '2030-09-16 22:00:00' })
  })

  it('says when there is no group zone and the browser\'s is used', () => {
    draw(baseProps({ timeZone: { zone: 'Asia/Tokyo', fallback: true } }))
    expect(screen.getByText('Times in Asia/Tokyo, your browser’s time zone (none is set here)')).toBeInTheDocument()
  })
})
