/* eslint-disable import/first */
// redesign CA-B4 (decision 2; defect M-CA8): the list of opens of a campaign in a Product Dialog. The controller
// (`K/CampaignUserList`) is mocked: it hands its UIComponent the `userListState` the real one builds from the API.
// The Dialog, DataTable and Pagination are real.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  state: { users: [], loading: false, error: null },
  controller: vi.fn()
}))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    CampaignUserList: (props) => {
      mocks.controller(props)
      const { UIComponent, ...rest } = props
      return React.createElement(UIComponent, { ...rest, userListState: mocks.state })
    }
  }
})

import { CampaignOpensDialog } from '../CampaignOpensDialog'

const campaign = { id: 41, name: 'Weekend offer' }
const user = (index, extra = {}) => ({
  id: index,
  open_at: '2026-08-01 10:00:00',
  user: { name: `Person ${index}`, email: `person${index}@example.com` },
  ...extra
})

let onOpenChange
const draw = (props = {}) => {
  onOpenChange = vi.fn()
  return render(<CampaignOpensDialog campaign={campaign} open onOpenChange={onOpenChange} {...props} />)
}

const dialog = () => screen.findByRole('dialog')
const bodyRows = (root) => Array.from(root.querySelectorAll('tbody tr:not([data-skeleton])'))

beforeEach(() => {
  mocks.state = { users: [], loading: false, error: null }
  mocks.controller.mockClear()
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('CampaignOpensDialog', () => {
  it('is a dialog titled «Opens · <name>» with a close button', async () => {
    mocks.state = { users: [user(1)], loading: false, error: null }
    draw()
    const root = await dialog()
    expect(within(root).getByRole('heading', { name: 'Opens · Weekend offer' })).toBeInTheDocument()
    await userEvent.click(within(root).getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('wires the controller to this campaign, for its opens', async () => {
    mocks.state = { users: [user(1)], loading: false, error: null }
    draw()
    await dialog()
    const props = mocks.controller.mock.calls[0][0]
    expect(props.campaignId).toBe(41)
    expect(props.isOpens).toBe(true)
  })

  it('fetches nothing while it is closed', () => {
    draw({ open: false })
    expect(mocks.controller).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lists User and Email Address only (the third column always read 1), for the users who opened', async () => {
    mocks.state = {
      users: [user(1), user(2, { open_at: null }), user(3), user(4, { open_at: undefined })],
      loading: false,
      error: null
    }
    draw()
    const root = await dialog()
    expect(within(root).getAllByRole('columnheader').map(header => header.textContent)).toEqual(['User', 'Email Address'])
    const rows = bodyRows(root)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Person 1')
    expect(rows[0]).toHaveTextContent('person1@example.com')
    expect(rows[1]).toHaveTextContent('Person 3')
    expect(within(root).queryByText('Person 2')).toBeNull()
    expect(within(root).queryByText('Person 4')).toBeNull()
  })

  it('a user without a name or an email reads N/A', async () => {
    mocks.state = {
      users: [{ id: 1, open_at: '2026-08-01 10:00:00', user: { name: '', email: null } }, { id: 2, open_at: '2026-08-01 10:00:00' }],
      loading: false,
      error: null
    }
    draw()
    const root = await dialog()
    const rows = bodyRows(root)
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row.textContent).toBe('N/AN/A')
  })

  it('paginates on the client, 10 per page, with the range as figures', async () => {
    mocks.state = { users: Array.from({ length: 12 }, (_, index) => user(index + 1)), loading: false, error: null }
    draw()
    const root = await dialog()
    expect(bodyRows(root)).toHaveLength(10)
    const nav = within(root).getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 1–10 of 12')
    expect(within(nav).getByText('12')).toHaveClass('odc-figure')
    await userEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    const rows = bodyRows(root)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Person 11')
    expect(within(root).queryByText('Person 1')).toBeNull()
    await userEvent.click(within(nav).getByRole('button', { name: 'Previous page' }))
    expect(bodyRows(root)).toHaveLength(10)
  })

  it('the page count follows the users who opened, not everyone the list returned', async () => {
    const opened = Array.from({ length: 3 }, (_, index) => user(index + 1))
    const notOpened = Array.from({ length: 20 }, (_, index) => user(100 + index, { open_at: null }))
    mocks.state = { users: [...notOpened, ...opened], loading: false, error: null }
    draw()
    const root = await dialog()
    expect(bodyRows(root)).toHaveLength(3)
    expect(within(root).getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1–3 of 3')
  })

  it('changing the page size re-slices the list', async () => {
    mocks.state = { users: Array.from({ length: 12 }, (_, index) => user(index + 1)), loading: false, error: null }
    draw()
    const root = await dialog()
    const nav = within(root).getByRole('navigation', { name: 'Pagination' })
    await userEvent.click(within(nav).getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(bodyRows(root)).toHaveLength(12)
  })

  it('while loading it paints skeleton rows, a hidden label and no pagination', async () => {
    mocks.state = { users: [], loading: true, error: null }
    draw()
    const root = await dialog()
    expect(root.querySelectorAll('tr[data-skeleton]').length).toBeGreaterThan(0)
    expect(within(root).getByText('Loading opens')).toHaveClass('odc-sr-only')
    expect(within(root).queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('an error shows its message through the translator, not an empty table', async () => {
    mocks.state = { users: [], loading: false, error: ['Unauthorized'] }
    draw()
    const root = await dialog()
    const alert = within(root).getByRole('alert')
    expect(within(alert).getByText("We couldn't load the opens.")).toBeInTheDocument()
    expect(within(alert).getByText('Unauthorized')).toBeInTheDocument()
    expect(within(root).queryByRole('table')).toBeNull()
  })

  it('an error given as a string works too', async () => {
    mocks.state = { users: [], loading: false, error: 'Network down' }
    draw()
    const root = await dialog()
    expect(within(within(root).getByRole('alert')).getByText('Network down')).toBeInTheDocument()
  })

  it('«No opens yet» when nobody opened, with or without users in the list', async () => {
    mocks.state = { users: [user(1, { open_at: null })], loading: false, error: null }
    const view = draw()
    const root = await dialog()
    expect(within(root).getByText('No opens yet')).toBeInTheDocument()
    expect(within(root).queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    view.unmount()
    document.getElementById('app-modals')?.remove()
    mocks.state = { users: [], loading: false, error: null }
    draw()
    expect(within(await dialog()).getByText('No opens yet')).toBeInTheDocument()
  })
})
