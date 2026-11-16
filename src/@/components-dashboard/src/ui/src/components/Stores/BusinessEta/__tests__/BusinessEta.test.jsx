import React, { useState } from 'react'
import { render, screen, cleanup, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, it, expect, afterEach, beforeEach, describe } from 'vitest'
import { LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product'
import { BusinessEta } from '../index'

// the UI wired to its REAL controller: only the contexts the controller reads, the language, the status names and fetch are simulated
vi.mock('../../../../../../index', async () => {
  const { BusinessEta } = await import('../../../../../../components/BusinessEta')
  return {
    useLanguage: () => [{}, (key, fallback) => fallback],
    useUtils: () => [{ getOrderState: index => `Status ${index}` }],
    BusinessEta
  }
})
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v1/en/project' }]
}))
vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'tok' }]
}))

// redesign stores 5.7: the Advanced ETA tab is one form with a draft and a save bar (decision 4 of Tiendas).

const answer = (body) => ({ json: async () => body })
let fetchMock

beforeEach(() => {
  fetchMock = vi.fn(async () => answer({ error: false, result: {} }))
  vi.stubGlobal('fetch', fetchMock)
  window.matchMedia = vi.fn((query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

let host
let updates
// the editor's page: a host for the leave guard and a business that the controller updates
const Harness = ({ initial }) => {
  const [business, setBusiness] = useState({ id: 7, eta_status_times: initial })
  host = useLeaveGuardHost()
  return (
    <LeaveGuardContext.Provider value={host.context}>
      <BusinessEta
        business={business}
        handleUpdateBusinessState={next => {
          updates.push(next)
          setBusiness(next)
        }}
      />
    </LeaveGuardContext.Provider>
  )
}

const renderEta = (initial = { 'status:0': 5, 'status:3': 10, 'status_penalty:1': 2 }) => {
  updates = []
  const user = userEvent.setup()
  render(<Harness initial={initial} />)
  return { user }
}

const field = name => screen.getByRole('textbox', { name: new RegExp(`^${name}\\b`) })
const saveBar = () => screen.queryByRole('group', { name: 'Save changes' })
const barButton = name => within(saveBar()).getByRole('button', { name })
const pickList = (user, name) => user.click(screen.getByRole('button', { name }))
const sentBody = (call = 0) => JSON.parse(JSON.parse(fetchMock.mock.calls[call][1].body).eta_status_times)

const typeNumber = async (user, input, text) => {
  await user.clear(input)
  if (text) await user.type(input, text)
  await user.tab()
}

describe('BusinessEta (5.7 form)', () => {
  it('paints the heading, the list switch and 24 fields with the saved times (missing = 0), and no bar', () => {
    renderEta()
    expect(screen.getByRole('heading', { name: 'Status time' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Status time' })).toBeTruthy()
    expect(screen.getAllByRole('textbox')).toHaveLength(24)
    expect(field('Status 0').value).toBe('5')
    expect(field('Status 3').value).toBe('10')
    expect(field('Status 23').value).toBe('0')
    expect(screen.getAllByText('Minutes')).toHaveLength(24)
    // the saved time of the other list is not on this one
    expect(field('Status 1').value).toBe('0')
    expect(saveBar()).toBeNull()
  })

  it('has no Save with no changes, and typing the saved value is not a change', async () => {
    const { user } = renderEta()
    await typeNumber(user, field('Status 0'), '5')
    await typeNumber(user, field('Status 23'), '0')
    expect(saveBar()).toBeNull()
    expect(host.isDirty()).toBe(false)
  })

  it('counts the changes and names each one with its list', async () => {
    const { user } = renderEta()
    await typeNumber(user, field('Status 0'), '8')
    await typeNumber(user, field('Status 2'), '4')
    expect(within(saveBar()).getByText(/2 unsaved changes/)).toBeTruthy()
    expect(within(saveBar()).getByText(/Status 0 · Estimated times by status, Status 2 · Estimated times by status/)).toBeTruthy()

    await pickList(user, 'Estimated penalty times by status')
    await typeNumber(user, field('Status 1'), '9')
    expect(within(saveBar()).getByText(/3 unsaved changes/)).toBeTruthy()
    expect(within(saveBar()).getByText(/Status 1 · Estimated penalty times by status/)).toBeTruthy()
  })

  it('switching the list keeps the draft of both, and shows each list its own values', async () => {
    const { user } = renderEta()
    await typeNumber(user, field('Status 0'), '8')
    await pickList(user, 'Estimated penalty times by status')
    expect(field('Status 0').value).toBe('0')
    expect(field('Status 1').value).toBe('2')
    await typeNumber(user, field('Status 0'), '3')
    await pickList(user, 'Estimated times by status')
    expect(field('Status 0').value).toBe('8')
    await pickList(user, 'Estimated penalty times by status')
    expect(field('Status 0').value).toBe('3')
    expect(within(saveBar()).getByText(/2 unsaved changes/)).toBeTruthy()
  })

  it('Save sends the WHOLE object (saved merged with the draft) in one POST, then the saved times update', async () => {
    const { user } = renderEta()
    await typeNumber(user, field('Status 0'), '8')
    await pickList(user, 'Estimated penalty times by status')
    await typeNumber(user, field('Status 4'), '12')
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(barButton('Save'))
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/v1/en/project/business/7')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer tok')
    expect(sentBody()).toEqual({ 'status:0': 8, 'status:3': 10, 'status_penalty:1': 2, 'status_penalty:4': 12 })
    expect(updates).toEqual([{ id: 7, eta_status_times: { 'status:0': 8, 'status:3': 10, 'status_penalty:1': 2, 'status_penalty:4': 12 } }])
    // the draft is empty and the values come from the saved business
    expect(within(saveBar()).queryByRole('button', { name: 'Save' })).toBeNull()
    expect(field('Status 4').value).toBe('12')
    expect(host.isDirty()).toBe(false)
  })

  it('an empty field is an error under it, takes the focus and nothing is sent', async () => {
    const { user } = renderEta()
    await typeNumber(user, field('Status 3'), '')
    await user.click(barButton('Save'))
    await waitFor(() => expect(field('Status 3').getAttribute('aria-invalid')).toBe('true'))
    expect(screen.getByText('Enter a whole number, 0 or more.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(field('Status 3')))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a decimal is an error, and if it is in the other list that list opens first', async () => {
    const { user } = renderEta()
    await pickList(user, 'Estimated penalty times by status')
    await typeNumber(user, field('Status 5'), '1.5')
    await pickList(user, 'Estimated times by status')
    await typeNumber(user, field('Status 0'), '8')
    await user.click(barButton('Save'))

    // the first wrong field is in the penalty list: that list is on screen with the error and the focus
    await waitFor(() => expect(screen.getByRole('button', { name: 'Estimated penalty times by status' }).getAttribute('aria-pressed')).toBe('true'))
    await waitFor(() => expect(field('Status 5').getAttribute('aria-invalid')).toBe('true'))
    expect(screen.getByText('Enter a whole number, 0 or more.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(field('Status 5')))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('the field refuses the minus sign, so a negative time can never be sent', async () => {
    const { user } = renderEta()
    await typeNumber(user, field('Status 2'), '-4')
    expect(field('Status 2').value).toBe('4')
    await user.click(barButton('Save'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sentBody()['status:2']).toBe(4)
  })

  it('a failure shows the text of the API in the bar, keeps the draft, and Retry sends the same object', async () => {
    fetchMock.mockImplementationOnce(async () => answer({ error: true, result: ['Nope'] }))
    const { user } = renderEta()
    await typeNumber(user, field('Status 0'), '8')
    await user.click(barButton('Save'))

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 })
    expect(alert.textContent).toContain('Nope')
    expect(updates).toHaveLength(0)
    expect(within(saveBar()).getByText(/1 unsaved change/)).toBeTruthy()
    expect(field('Status 0').value).toBe('8')

    await user.click(within(saveBar()).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentBody(1)).toEqual({ 'status:0': 8, 'status:3': 10, 'status_penalty:1': 2 })
    expect(updates).toHaveLength(1)
  })

  it('a thrown error and a failure without text show their message or the generic one', async () => {
    fetchMock.mockImplementationOnce(async () => { throw new Error('Network down') })
    const { user } = renderEta()
    await typeNumber(user, field('Status 0'), '8')
    await user.click(barButton('Save'))
    expect((await screen.findByRole('alert')).textContent).toContain('Network down')

    fetchMock.mockImplementationOnce(async () => answer({ error: true, result: null }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain("We couldn't save the change."))
  })

  it('Discard goes back to what is saved', async () => {
    const { user } = renderEta()
    await typeNumber(user, field('Status 0'), '8')
    await user.click(barButton('Discard'))
    expect(saveBar()).toBeNull()
    expect(field('Status 0').value).toBe('5')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('registers in the leave guard while there are unsaved changes', async () => {
    const { user } = renderEta()
    expect(host.isDirty()).toBe(false)
    await typeNumber(user, field('Status 0'), '8')
    expect(host.isDirty()).toBe(true)
    await user.click(barButton('Discard'))
    expect(host.isDirty()).toBe(false)
  })
})
