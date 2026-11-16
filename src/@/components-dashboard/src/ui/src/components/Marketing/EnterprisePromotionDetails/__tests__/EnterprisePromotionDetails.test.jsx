/* eslint-disable import/first */
// redesign PE-B3 (decisions 5, 9 and 17; decision 35; PE-07, PE-13, PE-14, PE-16, PE-18): the advanced editor of a promotion, a RecordPanel with a
// SectionNav. K/EnterprisePromotionDetails is a stub that keeps the state the way the controller does (handleChangeItem merges into
// `formState.changes`, add mode stages its defaults, a delete that fails puts its error in `actionState` and returns it) and records the calls
// the panel makes; the sections are stubs (General, Sites, Business, Users, Loyalty levels) except Rules, whose stub stages `{ rate_type, target }`
// on mount as the real one does (inventory D10). RecordPanel, SectionNav, Menu, Switch, ConfirmDialog, AlertDialog and EmptyState are the real
// Product wrappers. In the last describe the real Rules is mounted to see where Conditions opens. Nothing is ever sent.
import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  add: false,
  promotionState: null,
  handleChangeItem: null,
  handleUpdateClick: null,
  handleAddPromotion: null,
  handleDeletePromotion: null,
  getPromotion: null,
  api: null,
  RulesImpl: null,
  rulesProps: null
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const Controller = (props) => {
    const { UIComponent } = props
    const [changes, setChanges] = React.useState({})
    const [actionState, setActionState] = React.useState({ loading: false, error: null })
    const [promotionState, setPromotionState] = React.useState(mocks.promotionState)
    React.useEffect(() => {
      if (mocks.add) {
        setChanges({ enabled: true, auto: false, public: true, condition_type: 1, type: 1, target: 1, rate_type: 1, stackable: false, rate: 0, sponsor: 'business' })
      }
    }, [])
    mocks.api = { setChanges, setActionState, setPromotionState }
    const handleChangeItem = (patch) => {
      mocks.handleChangeItem(patch)
      setChanges(current => ({ ...current, ...patch }))
    }
    const handleDeletePromotion = async () => {
      const result = await mocks.handleDeletePromotion()
      if (result && !result.ok) setActionState({ loading: false, error: result.error })
      return result
    }
    return (
      <UIComponent
        {...props}
        isAddMode={mocks.add}
        promotionState={promotionState}
        formState={{ loading: false, changes }}
        actionState={actionState}
        sitesState={{ sites: [] }}
        businessesList={{ loading: false, businesses: [] }}
        selectedBusinessIds={[]}
        selectedSitesIds={[]}
        selectedUserIds={[]}
        selectedLoyaltyLevelIds={[]}
        handleChangeItem={handleChangeItem}
        handleChangeInput={vi.fn()}
        handleUpdateClick={mocks.handleUpdateClick}
        handleAddPromotion={mocks.handleAddPromotion}
        handleDeletePromotion={handleDeletePromotion}
        getPromotion={mocks.getPromotion}
        handleSelectBusiness={(id) => setChanges(current => ({ ...current, businesses: [id] }))}
      />
    )
  }
  return {
    EnterprisePromotionDetails: Controller,
    useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text]
  }
})

vi.mock('../../../Shared', () => ({
  SelectSites: () => <div data-testid='sites'>sites</div>,
  SelectBusinesses: (props) => (
    <div data-testid='businesses'>
      <button type='button' onClick={() => props.handleSelectBusiness(7, true)}>pick business</button>
    </div>
  ),
  SelectUsers: () => <div data-testid='users'>users</div>,
  SelectLoyaltyLevels: () => <div data-testid='levels'>levels</div>,
  Alert: () => null,
  Modal: ({ open, children }) => (open ? <div data-testid='conditions-modal'>{children}</div> : null),
  SideBar: ({ open, children }) => (open ? <div data-testid='conditions-sidebar'>{children}</div> : null),
  RecipientSelect: () => null
}))

vi.mock('../../../../styles/Select/FirstSelect', () => ({ Select: () => <div /> }))
vi.mock('../../EnterprisePromotionConditions', () => ({ EnterprisePromotionConditions: () => <div data-testid='conditions'>conditions</div> }))

vi.mock('../../EnterprisePromotionGeneralDetails', () => ({
  EnterprisePromotionGeneralDetails: (props) => (
    <div data-testid='general'>
      <input
        aria-label='Name'
        value={props.formState.changes.name ?? props.promotionState.promotion?.name ?? ''}
        onChange={event => props.handleChangeItem({ name: event.target.value })}
      />
    </div>
  )
}))

vi.mock('../../EnterprisePromotionRules', () => ({
  EnterprisePromotionRules: (props) => mocks.RulesImpl(props)
}))

import { EnterprisePromotionDetails } from '..'

const weekend = {
  id: 5,
  name: 'Weekend 15%',
  enabled: true,
  condition_type: 1,
  rate_type: 1,
  rate: 15,
  target: 1,
  type: 1
}

const RulesStub = (props) => {
  mocks.rulesProps = props
  const { formState, promotionState, handleChangeItem } = props
  const condition = formState.changes.condition_type ?? promotionState.promotion?.condition_type
  React.useEffect(() => {
    if (condition !== 1) handleChangeItem({ rate_type: 2, target: 1 })
  }, [condition])
  return <div data-testid='rules'><input id='discount_value' aria-label='Value' defaultValue='' /></div>
}

let spies
const showing = (promotion, extra = {}) => {
  mocks.promotionState = { promotion, loading: false, error: null, ...extra }
}

const Host = (props) => {
  const [expanded, setExpanded] = React.useState(false)
  return (
    <EnterprisePromotionDetails
      promotion={mocks.promotionState.promotion}
      promotionId={mocks.promotionState.promotion?.id ?? null}
      onClose={spies.onClose}
      expanded={expanded}
      onExpandedChange={(next) => { spies.onExpandedChange(next); setExpanded(next) }}
      onDirtyChange={spies.onDirtyChange}
      {...props}
    />
  )
}

const nav = () => screen.getByRole('navigation', { name: 'Promotion sections' })
const goTo = async (user, name) => user.click(within(nav()).getByRole('button', { name }))
const close = (user) => user.click(screen.getByRole('button', { name: 'Close' }))

beforeEach(() => {
  mocks.add = false
  mocks.rulesProps = null
  mocks.RulesImpl = RulesStub
  showing(weekend)
  mocks.handleChangeItem = vi.fn()
  mocks.handleUpdateClick = vi.fn()
  mocks.handleAddPromotion = vi.fn()
  mocks.handleDeletePromotion = vi.fn().mockResolvedValue({ ok: true })
  mocks.getPromotion = vi.fn()
  spies = { onClose: vi.fn(), onExpandedChange: vi.fn(), onDirtyChange: vi.fn() }
  window.matchMedia = vi.fn((query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(() => {
  cleanup()
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

describe('Details · the sections (decision 35)', () => {
  it('titles the panel with the offer and lists the six sections of main, in order, as a navigation with the current one marked', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Weekend 15%')
    const buttons = within(nav()).getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual(['General', 'Sites', 'Business', 'Users', 'Loyalty Levels', 'Rules'])
    expect(buttons[0]).toHaveAttribute('aria-current', 'page')
    buttons.slice(1).forEach(button => expect(button).not.toHaveAttribute('aria-current'))
  })

  it('mounts ONE section at a time: changing section unmounts the one before and moves aria-current', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(screen.getByTestId('general')).toBeInTheDocument()
    expect(screen.queryByTestId('rules')).toBeNull()

    await goTo(user, 'Sites')
    expect(screen.getByTestId('sites')).toBeInTheDocument()
    expect(screen.queryByTestId('general')).toBeNull()
    expect(within(nav()).getByRole('button', { name: 'Sites' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav()).getByRole('button', { name: 'General' })).not.toHaveAttribute('aria-current')

    await goTo(user, 'Users')
    expect(screen.getByTestId('users')).toBeInTheDocument()
    await goTo(user, 'Loyalty Levels')
    expect(screen.getByTestId('levels')).toBeInTheDocument()
    await goTo(user, 'Rules')
    expect(screen.getByTestId('rules')).toBeInTheDocument()
    expect(screen.queryByTestId('levels')).toBeNull()
  })

  it('gives Rules isExpand from «Open as page», and no host mechanics (setMoveDistance, setSideBarWidth) are passed on', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await goTo(user, 'Rules')
    expect(mocks.rulesProps.isExpand).toBe(false)
    expect(mocks.rulesProps.setMoveDistance).toBeUndefined()
    expect(mocks.rulesProps.setSideBarWidth).toBeUndefined()
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(mocks.rulesProps.isExpand).toBe(true)
  })

  it('«Open as page» asks the host to expand and turns into «Back to split view»', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.onExpandedChange).toHaveBeenCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Back to split view' }))
    expect(spies.onExpandedChange).toHaveBeenLastCalledWith(false)
  })
})

describe('Details · leaving Rules and the auto-save (main\'s handleClickTab)', () => {
  it('leaving Rules with 150% is blocked: the alert names the field, Rules stays, and closing it focuses the field', async () => {
    const user = userEvent.setup()
    showing({ ...weekend, rate: 150 })
    render(<Host />)
    await goTo(user, 'Rules')
    await goTo(user, 'General')

    const alert = await screen.findByRole('alertdialog', { name: 'Discount percentage' })
    expect(alert).toHaveTextContent('The Discount percentage may not be greater than 100.')
    expect(screen.getByTestId('rules')).toBeInTheDocument()
    expect(screen.queryByTestId('general')).toBeNull()
    // the page behind a dialog is hidden from the accessibility tree: ask for it as hidden
    const hiddenNav = screen.getByRole('navigation', { name: 'Promotion sections', hidden: true })
    expect(within(hiddenNav).getByRole('button', { name: 'Rules', hidden: true })).toHaveAttribute('aria-current', 'page')

    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.getElementById('discount_value')).toHaveFocus())
  })

  it('leaving Rules with 100% or less just goes', async () => {
    const user = userEvent.setup()
    showing({ ...weekend, rate: 100 })
    render(<Host />)
    await goTo(user, 'Rules')
    await goTo(user, 'General')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('general')).toBeInTheDocument()
  })

  it('a price discount over 100 is not a percentage: it leaves', async () => {
    const user = userEvent.setup()
    showing({ ...weekend, rate_type: 2, rate: 150 })
    render(<Host />)
    await goTo(user, 'Rules')
    await goTo(user, 'General')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  // n.º 2, D-56 (b), promotions-enterprise P-4 (owner, 2026-10-20): main saved here (PE-11); now only «Save» writes, and the staged
  // businesses stay pending, so closing asks first
  it('changing section does not save what is staged when businesses were changed, in edit mode; closing asks first', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await goTo(user, 'Business')
    await user.click(screen.getByRole('button', { name: 'pick business' }))
    await goTo(user, 'Users')
    expect(mocks.handleUpdateClick).not.toHaveBeenCalled()
    expect(mocks.handleAddPromotion).not.toHaveBeenCalled()
    await close(user)
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('in add mode nothing is saved by changing section', async () => {
    const user = userEvent.setup()
    mocks.add = true
    showing({})
    render(<Host promotion={{}} promotionId={null} />)
    await goTo(user, 'Business')
    await user.click(screen.getByRole('button', { name: 'pick business' }))
    await goTo(user, 'Users')
    expect(mocks.handleUpdateClick).not.toHaveBeenCalled()
    expect(mocks.handleAddPromotion).not.toHaveBeenCalled()
  })
})

describe('Details · the discard guard (decision 17, PE-16)', () => {
  it('closes at once when nothing changed', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await close(user)
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks «Discard your changes?» after a typed name: Keep editing stays, Discard closes', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    await close(user)

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(dialog).toHaveTextContent('What you changed here is not saved yet.')
    expect(spies.onClose).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()

    await close(user)
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Discard' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('a change made with the header switch counts too', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const enable = screen.getByRole('switch', { name: 'Enable' })
    expect(enable).toHaveAttribute('aria-checked', 'true')
    await user.click(enable)
    expect(mocks.handleChangeItem).toHaveBeenLastCalledWith({ enabled: false })
    expect(enable).toHaveAttribute('aria-checked', 'false')
    await close(user)
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
  })

  it('a NEW offer with only the defaults staged closes at once; once something is typed it asks', async () => {
    const user = userEvent.setup()
    mocks.add = true
    showing({})
    render(<Host promotion={{}} promotionId={null} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Add promotion')
    await waitFor(() => expect(screen.getByTestId('general')).toBeInTheDocument())

    await close(user)
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'S')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('S')
    await close(user)
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('Rules staging its two values when it mounts is not a change of the user', async () => {
    const user = userEvent.setup()
    showing({ ...weekend, condition_type: 2, rate_type: 2, target: 1 })
    render(<Host />)
    await goTo(user, 'Rules')
    await waitFor(() => expect(mocks.handleChangeItem).toHaveBeenCalledWith({ rate_type: 2, target: 1 }))
    await close(user)
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('but a real change made after Rules mounted does count', async () => {
    const user = userEvent.setup()
    showing({ ...weekend, condition_type: 2 })
    render(<Host />)
    await goTo(user, 'Rules')
    await waitFor(() => expect(mocks.handleChangeItem).toHaveBeenCalledWith({ rate_type: 2, target: 1 }))
    act(() => mocks.api.setChanges(current => ({ ...current, rate: 30 })))
    await close(user)
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
  })

  it('after a save that worked the new state is the clean one; after one that failed it stays dirty', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')

    // a save that fails
    act(() => mocks.api.setActionState({ loading: true, error: null }))
    act(() => mocks.api.setActionState({ loading: false, error: ['Offer name taken'] }))
    expect(await screen.findByRole('alertdialog', { name: "We couldn't save the promotion" })).toHaveTextContent('Offer name taken')
    await user.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await close(user)
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    // a save that works: the controller cleans the staged changes
    act(() => mocks.api.setActionState({ loading: true, error: null }))
    act(() => {
      mocks.api.setActionState({ loading: false, error: null })
      mocks.api.setChanges({})
    })
    await close(user)
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  // redesign (row 20b): the save that worked disables «Save» (a real `disabled`), which takes the focus with it
  it('after a save that worked and left the focus on <body>, the focus goes to the panel itself', async () => {
    const user = userEvent.setup()
    const { container } = render(<Host />)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    act(() => mocks.api.setActionState({ loading: true, error: null }))
    act(() => {
      document.activeElement.blur()
      mocks.api.setActionState({ loading: false, error: null })
      mocks.api.setChanges({})
    })

    const panel = container.querySelector('.odc-record')
    expect(panel).toHaveAttribute('tabindex', '-1')
    await waitFor(() => expect(panel).toHaveFocus())
  })

  it('and leaves the focus alone when it is still somewhere in the panel, or after a save that failed', async () => {
    const user = userEvent.setup()
    const { container } = render(<Host />)
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.type(name, '!')
    act(() => mocks.api.setActionState({ loading: true, error: null }))
    act(() => {
      mocks.api.setActionState({ loading: false, error: null })
      mocks.api.setChanges({})
    })
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(name).toHaveFocus()

    await user.type(name, '?')
    act(() => mocks.api.setActionState({ loading: true, error: null }))
    act(() => {
      document.activeElement.blur()
      mocks.api.setActionState({ loading: false, error: ['Offer name taken'] })
    })
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(container.querySelector('.odc-record')).not.toHaveFocus()
  })

  it('reports its dirty state to the page on every change, and false when it unmounts', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Host />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})

describe('Details · delete (decision 9, PE-07)', () => {
  const openDelete = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    return screen.findByRole('alertdialog', { name: 'Delete "Weekend 15%"?' })
  }

  it('has a «More actions» menu with Delete; a new offer has none', () => {
    const { unmount } = render(<Host />)
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
    unmount()
    mocks.add = true
    showing({})
    render(<Host promotion={{}} promotionId={null} />)
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('asks with the name of the offer, says it cannot be undone, names the verb and puts the focus on Cancel', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openDelete(user)
    expect(dialog).toHaveTextContent("This can't be undone.")
    expect(within(dialog).getByRole('button', { name: 'Delete promotion' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleDeletePromotion).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.handleDeletePromotion).not.toHaveBeenCalled()
  })

  it('confirming calls the controller\'s handleDeletePromotion once', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete promotion' }))
    expect(mocks.handleDeletePromotion).toHaveBeenCalledTimes(1)
  })

  it('a failed delete keeps the dialog open and shows the message INSIDE it, not as a «couldn\'t save» alert', async () => {
    const user = userEvent.setup()
    mocks.handleDeletePromotion = vi.fn().mockResolvedValue({ ok: false, error: ['The offer is in use'] })
    render(<Host />)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete promotion' }))

    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('The offer is in use'))
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    expect(screen.queryByRole('alertdialog', { name: "We couldn't save the promotion" })).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Delete promotion' })).toBeEnabled()
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('a delete that throws shows a message too', async () => {
    const user = userEvent.setup()
    mocks.handleDeletePromotion = vi.fn().mockRejectedValue(new Error('Network down'))
    render(<Host />)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete promotion' }))
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Network down'))
  })
})

describe('Details · the record loads (PE-13)', () => {
  it('shows a skeleton, not empty sections, while the offer opened by ?id= has no record yet', () => {
    showing({}, { loading: true })
    render(<Host promotion={{}} promotionId={5} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Promotion sections' })).toBeNull()
    expect(screen.queryByTestId('general')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('the skeleton goes away when the record arrives, and an offer that was not loaded is not dirty', async () => {
    const user = userEvent.setup()
    showing({}, { loading: true })
    render(<Host promotion={{}} promotionId={5} />)
    act(() => mocks.api.setPromotionState({ promotion: weekend, loading: false, error: null }))
    expect(await screen.findByTestId('general')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Weekend 15%')
    await close(user)
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('when the load fails with no record it says so, with the message and a Retry that asks the controller again', async () => {
    const user = userEvent.setup()
    showing({}, { error: ['Offer not found'] })
    render(<Host promotion={{}} promotionId={5} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this promotion.")
    expect(alert).toHaveTextContent('Offer not found')
    expect(screen.queryByTestId('general')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(mocks.getPromotion).toHaveBeenCalledTimes(1)
  })
})

describe('Details · Rules › Conditions opens in its dialog at every width (§2b)', () => {
  it('with the real Rules, Apply opens the dialog at 1600px, never a second side bar, with no host mechanics passed', async () => {
    const user = userEvent.setup()
    const actual = await vi.importActual('../../EnterprisePromotionRules')
    mocks.RulesImpl = actual.EnterprisePromotionRules
    const previous = window.innerWidth
    window.innerWidth = 1600
    try {
      renderWithProviders(<Host />)
      await goTo(user, 'Rules')
      expect(screen.queryByTestId('conditions-modal')).toBeNull()
      await user.click(screen.getByText('Apply'))
      expect(await screen.findByTestId('conditions-modal')).toBeInTheDocument()
      expect(screen.getByTestId('conditions')).toBeInTheDocument()
      expect(screen.queryByTestId('conditions-sidebar')).toBeNull()
    } finally {
      window.innerWidth = previous
    }
  })
})
