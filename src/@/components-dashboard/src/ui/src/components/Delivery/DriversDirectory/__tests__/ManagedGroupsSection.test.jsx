/* eslint-disable import/first */
// redesign (owner, option A): the Managed groups section. The REAL controller (K/DriverGroupSetting) runs on a simulated
// `fetch`, so NOTHING here reaches a server. What is pinned is what the section shows, that nothing is written until Save, Discard,
// what it tells the panel about unsaved changes and the failure of a save.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: [{ token: 'token' }],
  api: [{ root: 'https://api.test' }],
  language: [{ dictionary: {} }, (_key, text) => text]
}))

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => mocks.api }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => mocks.language }))
vi.mock('../../../../../../index', async () => {
  const { DriverGroupSetting } = await vi.importActual('../../../../../../components/DriverGroupSetting')
  return { DriverGroupSetting, useLanguage: () => mocks.language }
})

import { ManagedGroupsSection } from '../ManagedGroupsSection'

const USER_ID = 7
const stored = () => ([
  { id: 1, name: 'North', drivers: [], administrators: [{ id: USER_ID }] },
  { id: 2, name: 'South', drivers: [], administrators: [{ id: 99 }] },
  { id: 3, name: 'East', drivers: [], administrators: [{ id: USER_ID }, { id: 99 }] }
])

let writes = []
let failFor = null
let failReads = false

const reply = (body) => Promise.resolve({ ok: true, json: async () => body })
beforeEach(() => {
  writes = []
  failFor = null
  failReads = false
  mocks.showToast.mockClear()
  global.fetch = vi.fn((url, options = {}) => {
    if (options.method === 'GET') return reply(failReads ? { error: true, result: ['Read failed'] } : { error: false, result: stored() })
    const id = Number(url.match(/\/drivergroups\/(\d+)\/administrators\/7$/)[1])
    writes.push([options.method, id])
    if (id === failFor) return reply({ error: true, result: ['Not allowed'] })
    return reply({ error: false, result: { id } })
  })
})
afterEach(cleanup)

const open = async (props = {}) => {
  const onDirtyChange = vi.fn()
  const view = render(<ManagedGroupsSection userId={USER_ID} label='Managed groups' onDirtyChange={onDirtyChange} {...props} />)
  await screen.findByRole('list', { name: 'All groups' })
  return { onDirtyChange, ...view }
}
const assigned = () => screen.getByRole('list', { name: 'Assigned' })
const catalog = () => screen.getByRole('list', { name: 'All groups' })
const box = (list, name) => within(list).getByRole('checkbox', { name: new RegExp(`^${name}`) })
const heading = () => screen.getByRole('heading', { name: /^Assigned/ })

describe('ManagedGroupsSection', () => {
  it('shows a labelled search, the assigned groups with their count and every group with its announced state', async () => {
    await open()
    expect(screen.getByRole('searchbox', { name: 'Search groups' })).toBeInTheDocument()
    expect(heading()).toHaveTextContent('Assigned (2)')
    expect(within(assigned()).getAllByRole('checkbox').map(item => item.textContent)).toEqual(['North', 'East'])
    expect(box(catalog(), 'South')).toHaveAttribute('aria-checked', 'false')
    expect(box(catalog(), 'North')).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
  })

  it('writes nothing until Save, then stores the change once', async () => {
    const user = userEvent.setup()
    const { onDirtyChange } = await open()
    await user.click(box(catalog(), 'South'))
    expect(writes).toEqual([])
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(heading()).toHaveTextContent('Assigned (3)')
    expect(within(assigned()).getByText('Will be added')).toBeInTheDocument()
    expect(screen.getByText('1 change')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Changes saved'))
    expect(writes).toEqual([['POST', 2]])
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull())
    expect(within(assigned()).queryByText('Will be added')).toBeNull()
  })

  it('removing keeps the row, struck out and said in words, until it is saved', async () => {
    const user = userEvent.setup()
    await open()
    await user.click(box(assigned(), 'North'))
    expect(heading()).toHaveTextContent('Assigned (1)')
    const note = within(assigned()).getByText('Will be removed')
    expect(box(assigned(), 'North')).toHaveAttribute('aria-describedby', note.id)
    expect(writes).toEqual([])
  })

  it('Discard goes back to what is stored and writes nothing', async () => {
    const user = userEvent.setup()
    const { onDirtyChange } = await open()
    await user.click(box(catalog(), 'South'))
    await user.click(box(assigned(), 'North'))
    expect(screen.getByText('2 changes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(heading()).toHaveTextContent('Assigned (2)')
    expect(box(catalog(), 'South')).toHaveAttribute('aria-checked', 'false')
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    expect(writes).toEqual([])
  })

  it('Select all and Select none only mark; Save writes the groups that change', async () => {
    const user = userEvent.setup()
    await open()
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(heading()).toHaveTextContent('Assigned (3)')
    await user.click(screen.getByRole('button', { name: 'Select none' }))
    expect(heading()).toHaveTextContent('Assigned (0)')
    expect(writes).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes).toEqual([['DELETE', 1], ['DELETE', 3]])
    await screen.findByText('No groups assigned yet. Select them below.')
  })

  it('the search narrows the list; Select all still means every group, as in main', async () => {
    const user = userEvent.setup()
    await open()
    await user.type(screen.getByRole('searchbox', { name: 'Search groups' }), 'sou{Enter}')
    await waitFor(() => expect(within(catalog()).getAllByRole('checkbox')).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(heading()).toHaveTextContent('Assigned (3)')
    await user.clear(screen.getByRole('searchbox', { name: 'Search groups' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search groups' }), 'zzz{Enter}')
    await screen.findByText('No groups match this search')
  })

  it('a partial failure says which group was not saved and keeps it as a change', async () => {
    const user = userEvent.setup()
    failFor = 1
    const { onDirtyChange } = await open()
    await user.click(screen.getByRole('button', { name: 'Select none' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent("Some groups weren't saved")
    expect(dialog).toHaveTextContent('North: Not allowed')
    expect(dialog).not.toHaveTextContent('East')
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Changes saved')
    expect(screen.getByText('1 change')).toBeInTheDocument()
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('a failed read shows an error with Retry, and Retry loads the groups', async () => {
    const user = userEvent.setup()
    failReads = true
    render(<ManagedGroupsSection userId={USER_ID} label='Managed groups' />)
    await screen.findByText("We couldn't load the groups.")
    expect(screen.queryByRole('heading', { name: /^Assigned/ })).toBeNull()
    failReads = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('list', { name: 'All groups' })
    expect(heading()).toHaveTextContent('Assigned (2)')
  })

  it('tells the panel it is clean again when it goes away with changes', async () => {
    const user = userEvent.setup()
    const { onDirtyChange, unmount } = await open()
    await user.click(box(catalog(), 'South'))
    unmount()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})
