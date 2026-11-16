/* eslint-disable import/first */
// redesign SL-F1 (A1): the head of /stores/list. Everything BusinessesListingHeader did with the same conditions, now in view:
// Importers and Refresh beside the primary «Add new store» (nothing in a menu), the Learn menu with the same 14 articles,
// the count of the tab, and under them Active / Inactive (the behaviour of BusinessActiveStateFilter) and the List / Card switch.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ level: 0, addQueryToUrl: vi.fn(), returnFocusRef: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useSession: () => [{ user: { level: mockState.level } }]
}))
vi.mock('../../../../utils', async () => {
  const { learnOptionsValues } = await import('../../../../utils/learnOptionsValues')
  return { learnOptionsValues, addQueryToUrl: (...args) => mockState.addQueryToUrl(...args) }
})
// redesign stores 3.A, P-1: with `hideTrigger` (the phone's «⋯» opens the panel) the stub draws only a host that shows `open`
// redesign stores 3.C, G1-20: the host is the only ImportersButton at every width; the stub shows what it gets
// it also keeps the `returnFocusRef` it got, to read where the focus would go
vi.mock('../../ImportersButton', () => ({
  ImportersButton: (props) => {
    mockState.returnFocusRef = props.returnFocusRef
    return props.hideTrigger
      ? (
        <div
          data-testid='importers-host'
          data-open={String(props.open)}
          data-has-success={props.onImportSuccess ? 'yes' : 'no'}
          data-has-return={props.returnFocusRef ? 'yes' : 'no'}
        >
          <button type='button' onClick={() => props.onImportSuccess?.()}>import done</button>
          <button type='button' onClick={() => props.onOpenChange?.(false)}>close importers</button>
        </div>
        )
      : <button type='button' data-legacy-trigger>Importers</button>
  }
}))

import { StoresHeader } from '../StoresHeader'

const handlers = () => ({
  handleRefreshBusinesses: vi.fn(),
  handleGotToAdd: vi.fn(),
  handleChangeBusinessActiveState: vi.fn(),
  handleViewMethod: vi.fn()
})

const draw = (props = {}, route = '/stores/list') => {
  const h = handlers()
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      <StoresHeader
        loading={false}
        noBusinesses={false}
        allowBusinessRegister
        pagination={{ total: 12 }}
        selectedBusinessActiveState
        isUseQuery={false}
        viewMethod='list'
        {...h}
        {...props}
      />
    </MemoryRouter>
  )
  return { ...utils, ...h }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockState.level = 0
})

describe('title and count', () => {
  it('is the h1 «Stores» with the total of the tab beside it', () => {
    draw()
    expect(screen.getByRole('heading', { level: 1, name: 'Stores' })).toBeInTheDocument()
    expect(screen.getByText('12 stores')).toBeInTheDocument()
  })

  it('reads «1 store» for one and draws no count while the total is not known', () => {
    const { rerender, container } = draw({ pagination: { total: 1 } })
    expect(screen.getByText('1 store')).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <StoresHeader loading noBusinesses={false} pagination={{}} selectedBusinessActiveState viewMethod='list' />
      </MemoryRouter>
    )
    expect(container.querySelector('.odc-count')).toBeNull()
  })

  it('shows «Open menu» only when the page asks for it (sidebar collapsed)', async () => {
    const onOpenMenu = vi.fn()
    draw({ onOpenMenu })
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
  })

  it('has no «Open menu» button by default', () => {
    draw()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })
})

describe('actions in view, with the conditions of main', () => {
  // main: no Sync button
  it('shows Importers, Refresh and the primary «Add new store», all as buttons on the row (no menu), and no Sync', async () => {
    const user = userEvent.setup()
    const { handleRefreshBusinesses, handleGotToAdd } = draw()
    expect(screen.getByRole('button', { name: 'Importers' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sync' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(handleRefreshBusinesses).toHaveBeenCalledTimes(1)
    const add = screen.getByRole('button', { name: 'Add new store' })
    expect(add).toHaveAttribute('data-variant', 'primary')
    await user.click(add)
    expect(handleGotToAdd).toHaveBeenCalledTimes(1)
    expect(handleGotToAdd).toHaveBeenCalledWith() // no arguments, as main
    // nothing hides behind a «More» menu
    expect(screen.queryByRole('button', { name: /more/i })).toBeNull()
  })

  it('draws them as direct children of the header actions, so they wrap there and are not cut', () => {
    const { container } = draw()
    const group = container.querySelector('.odc-pagehead-actions')
    const names = Array.from(group.children).map(node => node.textContent.trim())
    expect(names).toEqual(expect.arrayContaining(['Importers', 'Refresh', 'Add new store']))
    expect(names[names.length - 1]).toBe('Add new store') // the primary action stays last
  })

  // redesign stores 3.C, G1-20: the panel host is mounted outside the actions at every width, so a reload of the list does
  // not close it; with that, a finished import refreshes the list (it was left out only because of the unmount)
  it('Importers is a Product button that opens the panel host, which lives outside the actions', async () => {
    const user = userEvent.setup()
    const { container } = draw()
    const host = screen.getByTestId('importers-host')
    expect(host).toHaveAttribute('data-open', 'false')
    expect(container.querySelector('.odc-pagehead-actions').contains(host)).toBe(false)
    const importers = screen.getByRole('button', { name: 'Importers' })
    expect(importers).not.toHaveAttribute('data-legacy-trigger')
    expect(importers).toHaveClass('odc-btn')
    await user.click(importers)
    expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'true')
  })

  it('keeps the panel host mounted (and open) while the list reloads', async () => {
    const user = userEvent.setup()
    const { rerender, handleRefreshBusinesses, handleGotToAdd, handleChangeBusinessActiveState, handleViewMethod } = draw()
    const h = { handleRefreshBusinesses, handleGotToAdd, handleChangeBusinessActiveState, handleViewMethod }
    await user.click(screen.getByRole('button', { name: 'Importers' }))
    rerender(
      <MemoryRouter initialEntries={['/stores/list']}>
        <StoresHeader loading noBusinesses={false} allowBusinessRegister pagination={{ total: 12 }} selectedBusinessActiveState isUseQuery={false} viewMethod='list' {...h} />
      </MemoryRouter>
    )
    expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'true')
  })

  it('a finished import refreshes the list; the host gets a place to give the focus back', async () => {
    const user = userEvent.setup()
    const { handleRefreshBusinesses } = draw()
    const host = screen.getByTestId('importers-host')
    expect(host).toHaveAttribute('data-has-success', 'yes')
    expect(host).toHaveAttribute('data-has-return', 'yes')
    await user.click(screen.getByRole('button', { name: 'import done' }))
    expect(handleRefreshBusinesses).toHaveBeenCalledTimes(1)
  })

  it('shows no Add new store without allowBusinessRegister', () => {
    draw({ allowBusinessRegister: false })
    expect(screen.queryByRole('button', { name: 'Add new store' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  it('hides Importers, Refresh and Add while the list loads', () => {
    draw({ loading: true })
    ;['Importers', 'Refresh', 'Add new store'].forEach(name => {
      expect(screen.queryByRole('button', { name })).toBeNull()
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Stores' })).toBeInTheDocument()
  })

  // bugs E: a project with no stores imports its first ones from here, so Importers stays; the rest of the head does not change
  it('keeps only Importers when the project has no stores, and it opens the importers panel', async () => {
    const user = userEvent.setup()
    draw({ noBusinesses: true })
    ;['Refresh', 'Add new store'].forEach(name => {
      expect(screen.queryByRole('button', { name })).toBeNull()
    })
    expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'false')
    await user.click(screen.getByRole('button', { name: 'Importers' }))
    expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'true')
  })

  // a failed load has an empty list; the tabs and the view switch stay, the actions are the ones of «no stores»
  it('keeps the tabs and the view switch over a failed load, with the actions as before', () => {
    draw({ noBusinesses: true, loadFailed: true })
    expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Inactive' })).toBeInTheDocument()
    ;['Refresh', 'Add new store'].forEach(name => {
      expect(screen.queryByRole('button', { name })).toBeNull()
    })
  })
})

// redesign stores 3.A, P-1: on the phone Importers and Refresh go to the «More actions» menu of the PageHeader;
// Learn and «Add new store» stay in view. Off the phone nothing changes (the describe above).
describe('phone: Importers and Refresh in the «More actions» menu', () => {
  const openMore = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    return screen.findAllByRole('menuitem')
  }

  it('has no Importers or Refresh button on the row; a «More actions» menu has the two', async () => {
    const user = userEvent.setup()
    draw({ isPhone: true })
    ;['Importers', 'Refresh'].forEach(name => {
      expect(screen.queryByRole('button', { name })).toBeNull()
    })
    const items = await openMore(user)
    expect(items.map(item => item.textContent.trim())).toEqual(['Importers', 'Refresh'])
  })

  it('keeps Learn and the primary «Add new store» in view', async () => {
    const user = userEvent.setup()
    const { handleGotToAdd } = draw({ isPhone: true })
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add new store' }))
    expect(handleGotToAdd).toHaveBeenCalledTimes(1)
  })

  it('has no Sync item, and Refresh calls handleRefreshBusinesses', async () => {
    const user = userEvent.setup()
    const { handleRefreshBusinesses } = draw({ isPhone: true })
    await openMore(user)
    expect(screen.queryByRole('menuitem', { name: 'Sync' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Refresh' }))
    expect(handleRefreshBusinesses).toHaveBeenCalledTimes(1)
  })

  it('Importers opens the importers panel (ImportersButton, trigger hidden, controlled) and the panel host stays mounted outside the actions', async () => {
    const user = userEvent.setup()
    const { container } = draw({ isPhone: true })
    const host = screen.getByTestId('importers-host')
    expect(host).toHaveAttribute('data-open', 'false')
    expect(container.querySelector('.odc-pagehead-actions').contains(host)).toBe(false)
    await openMore(user)
    await user.click(screen.getByRole('menuitem', { name: 'Importers' }))
    expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'true')
  })

  it('keeps the importers host mounted while the list loads (the panel does not close under the user)', () => {
    draw({ isPhone: true, loading: true })
    expect(screen.getByTestId('importers-host')).toBeInTheDocument()
  })

  // redesign stores 3.A, review F4: the «⋯» stays while the list loads, so Refresh from it does not drop the focus to <body>
  it('keeps the «More actions» menu while the list loads', () => {
    draw({ isPhone: true, loading: true })
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
  })

  // bugs E: without stores the «More actions» menu has only Importers, to import the first ones
  it('has only Importers in the menu when the project has no stores, and it opens the panel', async () => {
    const user = userEvent.setup()
    draw({ isPhone: true, noBusinesses: true })
    const items = await openMore(user)
    expect(items.map(item => item.textContent.trim())).toEqual(['Importers'])
    await user.click(screen.getByRole('menuitem', { name: 'Importers' }))
    expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'true')
  })

  it('off the phone there is no menu; the same host serves the Importers button', () => {
    draw({ isPhone: false })
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(screen.getAllByTestId('importers-host')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Importers' })).toBeInTheDocument()
  })

  // redesign stores 3.C: the «⋯» menu item that opened the panel is gone when it closes; the focus goes back to the «⋯»
  it('gives the host the «More actions» button as the place to give the focus back', async () => {
    const user = userEvent.setup()
    draw({ isPhone: true })
    await openMore(user)
    await user.click(screen.getByRole('menuitem', { name: 'Importers' }))
    await user.click(screen.getByRole('button', { name: 'close importers' }))
    expect(screen.getByTestId('importers-host')).toHaveAttribute('data-open', 'false')
    expect(screen.getByTestId('importers-host')).toHaveAttribute('data-has-return', 'yes')
  })

  // (Y leftover): Learn, in the same row, also announces `aria-haspopup="menu"` and comes first; the place to give the
  // focus back is the «⋯», found by its name, not Learn
  it('the place to give the focus back is «More actions», not the Learn menu beside it', () => {
    draw({ isPhone: true })
    expect(screen.getByRole('button', { name: 'Learn' })).toHaveAttribute('aria-haspopup', 'menu')
    expect(mockState.returnFocusRef.current).toBe(screen.getByRole('button', { name: 'More actions' }))
  })
})

describe('Learn', () => {
  it('opens the 14 store help articles for a level-zero session', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByRole('button', { name: 'Learn' }))
    const items = await screen.findAllByRole('menuitem')
    expect(items).toHaveLength(14)
    expect(items[0]).toHaveTextContent('Stores | General overview')
    expect(items[13]).toHaveTextContent('Webhooks')
  })

  it('is not there for other levels (as LearnDropDown decides)', () => {
    mockState.level = 2
    draw()
    expect(screen.queryByRole('button', { name: 'Learn' })).toBeNull()
  })
})

describe('Active / Inactive tabs (BusinessActiveStateFilter)', () => {
  it('selects the tab of the controller state', () => {
    const { unmount } = draw({ selectedBusinessActiveState: true })
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Inactive' })).toHaveAttribute('aria-selected', 'false')
    unmount()
    draw({ selectedBusinessActiveState: false })
    expect(screen.getByRole('tab', { name: 'Inactive' })).toHaveAttribute('aria-selected', 'true')
  })

  it('a click changes the state and writes ?active= once', async () => {
    const user = userEvent.setup()
    const { handleChangeBusinessActiveState } = draw({ selectedBusinessActiveState: true })
    await user.click(screen.getByRole('tab', { name: 'Inactive' }))
    expect(handleChangeBusinessActiveState).toHaveBeenCalledTimes(1)
    expect(handleChangeBusinessActiveState).toHaveBeenCalledWith(false)
    expect(mockState.addQueryToUrl).toHaveBeenCalledTimes(1)
    expect(mockState.addQueryToUrl).toHaveBeenCalledWith({ active: false })
  })

  it('with isUseQuery it reads ?active= on mount', () => {
    const { handleChangeBusinessActiveState } = draw({ isUseQuery: true, selectedBusinessActiveState: true }, '/stores/list?active=false')
    expect(handleChangeBusinessActiveState).toHaveBeenCalledTimes(1)
    expect(handleChangeBusinessActiveState).toHaveBeenCalledWith(false)
    expect(mockState.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('with isUseQuery and no ?active= it writes active=true', () => {
    const { handleChangeBusinessActiveState } = draw({ isUseQuery: true })
    expect(mockState.addQueryToUrl).toHaveBeenCalledTimes(1)
    expect(mockState.addQueryToUrl).toHaveBeenCalledWith({ active: 'true' })
    expect(handleChangeBusinessActiveState).not.toHaveBeenCalled()
  })

  it('without isUseQuery it neither reads nor writes the URL on mount', () => {
    const { handleChangeBusinessActiveState } = draw({ isUseQuery: false }, '/stores/list?active=false')
    expect(handleChangeBusinessActiveState).not.toHaveBeenCalled()
    expect(mockState.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('is only there when the project has stores', () => {
    draw({ noBusinesses: true })
    expect(screen.queryByRole('tab')).toBeNull()
  })
})

describe('List / Card switch', () => {
  it('shows the view on screen and asks for the other with one call', async () => {
    const user = userEvent.setup()
    const { handleViewMethod } = draw({ viewMethod: 'list' })
    const group = screen.getByRole('group', { name: 'View' })
    expect(within(group).getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'Card view' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(within(group).getByRole('button', { name: 'Card view' }))
    expect(handleViewMethod).toHaveBeenCalledTimes(1)
    expect(handleViewMethod).toHaveBeenCalledWith('card')
  })

  it('pressing the view already on screen does nothing', async () => {
    const user = userEvent.setup()
    const { handleViewMethod } = draw({ viewMethod: 'card' })
    await user.click(screen.getByRole('button', { name: 'Card view' }))
    expect(handleViewMethod).not.toHaveBeenCalled()
  })

  it('is only there when the project has stores', () => {
    draw({ noBusinesses: true })
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull()
  })
})

// owner decision 35 (batch AE): on a phone the table draws cards in both views, so the List / Card switch would do nothing visible
describe('List / Card switch on a phone', () => {
  it('is not drawn on a phone, and the Active / Inactive tabs stay', () => {
    draw({ isPhone: true })
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Card view' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'List view' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Inactive' })).toBeInTheDocument()
  })

  it('stays on desktop', () => {
    draw({ isPhone: false })
    expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Card view' })).toBeInTheDocument()
  })

  it('keeps the batch AA «⋯» menu with Importers and the focus return on a phone', async () => {
    const user = userEvent.setup()
    draw({ isPhone: true })
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect((await screen.findAllByRole('menuitem')).map(item => item.textContent.trim())).toEqual(['Importers', 'Refresh'])
    expect(mockState.returnFocusRef.current).toBe(screen.getByRole('button', { name: 'More actions' }))
  })
})
