/* eslint-disable import/first */
// redesign stores 5.4: Notifications is one form with one Save. The email, the printer switch and the model are a
// draft kept in BusinessNotifications; nothing is sent while typing; Save sends only the keys that changed. (These cases replace the
// «one save per change» ones of stores 1.A: the section no longer saves by itself.)
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  printersListState: { loading: false, printers: [], error: null },
  getPrinters: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  useApi: () => [{ root: 'https://api.example.com/v400/en/acme' }],
  BusinessGprsPrinters: ({ UIComponent, ...rest }) => (
    <UIComponent {...rest} printersListState={mocks.printersListState} getPrinters={mocks.getPrinters} />
  )
}))

import { LeaveGuardContext } from '../../../Shared/Product'
import { BusinessNotifications } from '../index'

const PRINTERS = [{ id: 1, model: 'Star TSP100' }, { id: 2, model: 'Epson TM-T20' }]

const renderSection = ({ business = { id: 7, email: 'ops@example.com', use_printer: false, printer_id: null }, update, host } = {}) => {
  const handleUpdateBusinessClick = update || vi.fn().mockResolvedValue({ ok: true })
  const view = (
    <LeaveGuardContext.Provider value={host || null}>
      <BusinessNotifications business={business} handleUpdateBusinessClick={handleUpdateBusinessClick} />
    </LeaveGuardContext.Provider>
  )
  return { handleUpdateBusinessClick, ...render(view) }
}

const emailInput = () => screen.getByRole('textbox', { name: /Email to receive orders/ })
const saveButton = () => screen.getByRole('button', { name: 'Save' })

beforeEach(() => {
  mocks.printersListState = { loading: false, printers: PRINTERS, error: null }
  mocks.getPrinters = vi.fn()
})
afterEach(() => cleanup())

describe('BusinessNotifications · one form, one Save', () => {
  it('does not write while typing the email, and shows the bar with the field name', () => {
    const { handleUpdateBusinessClick } = renderSection()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    fireEvent.change(emailInput(), { target: { value: 'sales@example.com' } })
    expect(handleUpdateBusinessClick).not.toHaveBeenCalled()
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(within(bar).getByText(/1 unsaved change/)).toBeTruthy()
    expect(within(bar).getByText(/Email to receive orders/)).toBeTruthy()
  })

  it('sends only the email on Save, with keepPendingChanges, then shows Saved', async () => {
    const { handleUpdateBusinessClick } = renderSection()
    fireEvent.change(emailInput(), { target: { value: 'sales@example.com' } })
    await act(async () => { fireEvent.click(saveButton()) })
    expect(handleUpdateBusinessClick).toHaveBeenCalledTimes(1)
    expect(handleUpdateBusinessClick).toHaveBeenCalledWith({ email: 'sales@example.com' }, { keepPendingChanges: true })
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
  })

  it('saves an empty email as an empty string (it clears the address)', async () => {
    const { handleUpdateBusinessClick } = renderSection()
    fireEvent.change(emailInput(), { target: { value: '' } })
    await act(async () => { fireEvent.click(saveButton()) })
    expect(handleUpdateBusinessClick).toHaveBeenCalledWith({ email: '' }, { keepPendingChanges: true })
  })

  it('shows an error under an invalid email on Save and sends nothing', async () => {
    const { handleUpdateBusinessClick } = renderSection()
    fireEvent.change(emailInput(), { target: { value: 'not-an-email' } })
    await act(async () => { fireEvent.click(saveButton()) })
    expect(handleUpdateBusinessClick).not.toHaveBeenCalled()
    expect(await screen.findByText('Enter a valid email, or leave it empty.')).toBeTruthy()
    // typing again clears the error
    fireEvent.change(emailInput(), { target: { value: 'ok@example.com' } })
    expect(screen.queryByText('Enter a valid email, or leave it empty.')).toBeNull()
  })

  it('with an invalid email, Save sends nothing and the focus goes to the email field', async () => {
    const { handleUpdateBusinessClick } = renderSection()
    fireEvent.change(emailInput(), { target: { value: 'not-an-email' } })
    saveButton().focus()
    await act(async () => { fireEvent.click(saveButton()) })
    // the error is drawn first; the invalid field takes the focus on the next frame
    await waitFor(() => expect(document.activeElement).toBe(emailInput()))
    expect(emailInput().getAttribute('aria-invalid')).toBe('true')
    expect(handleUpdateBusinessClick).not.toHaveBeenCalled()
  })

  it('sends only the printer keys when the switch and the model change', async () => {
    const { handleUpdateBusinessClick } = renderSection()
    fireEvent.click(screen.getByRole('switch', { name: 'Accept GPRS printer' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Printer model' }), { target: { value: '2' } })
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(within(bar).getByText(/2 unsaved changes/)).toBeTruthy()
    await act(async () => { fireEvent.click(saveButton()) })
    expect(handleUpdateBusinessClick).toHaveBeenCalledTimes(1)
    expect(handleUpdateBusinessClick).toHaveBeenCalledWith({ use_printer: true, printer_id: 2 }, { keepPendingChanges: true })
  })

  it('shows the queue paths only for the SAVED printer, read only', () => {
    const business = { id: 7, email: '', use_printer: true, printer_id: 1 }
    renderSection({ business })
    const path = screen.getByRole('textbox', { name: 'Printer Orders Queue Path' })
    expect(path.value).toBe('http://api.example.com/v400/en/acme/business/7/queue.txt')
    expect(path.readOnly).toBe(true)
    expect(screen.getByRole('textbox', { name: 'Printer Confirmation Orders Queue Path' }).value).toMatch(/\/business\/7\/queue\/confirm$/)
  })

  it('does not show the queue paths while the printer is only a draft', () => {
    renderSection()
    fireEvent.click(screen.getByRole('switch', { name: 'Accept GPRS printer' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Printer model' }), { target: { value: '1' } })
    expect(screen.queryByRole('textbox', { name: 'Printer Orders Queue Path' })).toBeNull()
  })

  it('Discard brings back the saved values and sends nothing', () => {
    const { handleUpdateBusinessClick } = renderSection()
    fireEvent.change(emailInput(), { target: { value: 'sales@example.com' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Accept GPRS printer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(emailInput().value).toBe('ops@example.com')
    expect(screen.getByRole('switch', { name: 'Accept GPRS printer' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    expect(handleUpdateBusinessClick).not.toHaveBeenCalled()
  })

  it('a failed save keeps the draft, shows the error in the bar and Retry sends again', async () => {
    const update = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: ['Something went wrong'] })
      .mockResolvedValueOnce({ ok: true })
    renderSection({ update })
    fireEvent.change(emailInput(), { target: { value: 'sales@example.com' } })
    await act(async () => { fireEvent.click(saveButton()) })
    expect(update).toHaveBeenCalledTimes(1)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/Something went wrong/)
    expect(emailInput().value).toBe('sales@example.com')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })) })
    expect(update).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenLastCalledWith({ email: 'sales@example.com' }, { keepPendingChanges: true })
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
  })

  it('a second Save while saving does nothing', async () => {
    let finish
    const update = vi.fn(() => new Promise(resolve => { finish = resolve }))
    renderSection({ update })
    fireEvent.change(emailInput(), { target: { value: 'sales@example.com' } })
    await act(async () => { fireEvent.click(saveButton()) })
    await act(async () => { fireEvent.click(saveButton()) })
    expect(update).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ ok: true }) })
  })

  it('registers in the leave guard: dirty with a draft, and its save / discard work', async () => {
    let entry
    const host = { register: vi.fn(ref => { entry = ref; return () => {} }), requestLeave: vi.fn() }
    const { handleUpdateBusinessClick } = renderSection({ host })
    expect(host.register).toHaveBeenCalledTimes(1)
    expect(entry.current.isDirty()).toBe(false)
    fireEvent.change(emailInput(), { target: { value: 'sales@example.com' } })
    expect(entry.current.isDirty()).toBe(true)
    expect(entry.current.count()).toBe(1)
    let result
    await act(async () => { result = await entry.current.save() })
    expect(result).toEqual({ ok: true })
    expect(handleUpdateBusinessClick).toHaveBeenCalledWith({ email: 'sales@example.com' }, { keepPendingChanges: true })
    fireEvent.change(emailInput(), { target: { value: 'again@example.com' } })
    act(() => { entry.current.discard() })
    expect(entry.current.isDirty()).toBe(false)
  })
})

describe('BusinessNotifications · list of printer models', () => {
  it('shows a notice with Try again when the list fails, and Try again asks for the list', () => {
    mocks.printersListState = { loading: false, printers: [], error: ['Unauthorized'] }
    renderSection()
    const notice = screen.getByRole('alert')
    expect(notice.textContent).toMatch(/We couldn't load the printer models\./)
    expect(screen.queryByRole('combobox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mocks.getPrinters).toHaveBeenCalledTimes(1)
  })

  it('says only «We couldn\'t load the printer models.» for a request error, not the request\'s own text, and Try again stays', () => {
    mocks.printersListState = { loading: false, printers: [], error: ['Failed to fetch'] }
    renderSection()
    const notice = screen.getByRole('alert')
    expect(notice.textContent).toContain("We couldn't load the printer models.")
    expect(notice.textContent).not.toContain('Failed to fetch')
    expect(screen.queryByText(/Failed to fetch/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mocks.getPrinters).toHaveBeenCalledTimes(1)
  })

  it('a saved printer that is not in the list reads «Select a printer», not the first model, and choosing a model works', async () => {
    const { handleUpdateBusinessClick } = renderSection({ business: { id: 7, email: '', use_printer: true, printer_id: 99 } })
    const select = screen.getByRole('combobox', { name: 'Printer model' })
    expect(select.selectedOptions).toHaveLength(1)
    expect(select.selectedOptions[0].textContent).toBe('Select a printer')
    expect(select.selectedOptions[0].disabled).toBe(true)
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()

    fireEvent.change(select, { target: { value: '2' } })
    const chosen = screen.getByRole('combobox', { name: 'Printer model' })
    expect(chosen.selectedOptions[0].textContent).toBe('Epson TM-T20')
    expect(within(screen.getByRole('group', { name: 'Save changes' })).getByText(/1 unsaved change/)).toBeTruthy()
    await act(async () => { fireEvent.click(saveButton()) })
    expect(handleUpdateBusinessClick).toHaveBeenCalledWith({ printer_id: 2 }, { keepPendingChanges: true })
  })

  it('says so when there are no models to choose from', () => {
    mocks.printersListState = { loading: false, printers: [], error: null }
    renderSection()
    expect(screen.getByText('There are no printer models to choose from.')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a loading state, not the select, while the list loads', () => {
    mocks.printersListState = { loading: true, printers: [], error: null }
    renderSection()
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByText('There are no printer models to choose from.')).toBeNull()
  })

  it('offers the empty option only while there is no model', () => {
    renderSection()
    const select = screen.getByRole('combobox', { name: 'Printer model' })
    expect(within(select).getByRole('option', { name: 'Select a printer' })).toBeTruthy()
    cleanup()
    renderSection({ business: { id: 7, email: '', use_printer: true, printer_id: 2 } })
    const withModel = screen.getByRole('combobox', { name: 'Printer model' })
    expect(withModel.value).toBe('2')
    expect(within(withModel).queryByRole('option', { name: 'Select a printer' })).toBeNull()
  })
})
