/* eslint-disable import/first */
// redesign stores 5.5a (S1, S4-S6, G3-10, G3-13): the detail of a menu inside P/SectionSplit. The controller, the bodies of
// the tabs (Basic, Channels, Share with, Logs, shared products), Snooze and Custom fields are stand-ins (other orders own them); the
// tabs, the actions, the URL contract, the Delete confirmation and the leave guard are the real pieces.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  addQueryToUrl: vi.fn(),
  removeQueryToUrl: vi.fn(),
  useLeaveGuard: null,
  basicProps: [],
  customFieldsProps: []
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))
vi.mock('../../../../../../components/BusinessMenuOptions', () => ({
  BusinessMenuOptions: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../../utils', () => ({
  addQueryToUrl: mocks.addQueryToUrl,
  removeQueryToUrl: mocks.removeQueryToUrl
}))
vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => (open ? <div data-testid='modal'>{children}</div> : null),
  IntegrationLogs: ({ model, modelId }) => <div data-testid='logs' data-model={model} data-id={String(modelId)} />
}))
// the real hook, spied: the arguments are checked and the real guard registers in the real piece
vi.mock('../../../Shared/Product/LeaveGuard', async (importOriginal) => {
  const actual = await importOriginal()
  mocks.useLeaveGuard = vi.fn(actual.useLeaveGuard)
  return { ...actual, useLeaveGuard: mocks.useLeaveGuard }
})
// records the props it gets (the leave guard's Save talks to Basic through `validationAttempt`)
vi.mock('../../BusinessMenuBasicOptions', () => ({
  BusinessMenuBasicOptions: (props) => {
    mocks.basicProps.push(props)
    return <div data-testid='basic' />
  }
}))
vi.mock('../../BusinessMenuChannels', () => ({ BusinessMenuChannels: () => <div data-testid='channels' /> }))
vi.mock('../../BusinessMenuShare', () => ({ BusinessMenuShare: () => <div data-testid='share' /> }))
// records the props it gets: the dialog lives inside the real component (stores 5.6), the detail only says `open`, `onClose` and where the focus goes back
vi.mock('../../BusinessMenuCustomFields', () => ({
  BusinessMenuCustomFields: (props) => {
    mocks.customFieldsProps.push(props)
    return (
      <div data-testid='custom-fields' data-open={String(props.open)} data-business={String(props.businessId)} data-menu={String(props.menuId)}>
        <button type='button' onClick={props.onClose}>Close custom fields</button>
      </div>
    )
  }
}))
vi.mock('../../BusinessSharedMenuProducts', () => ({ BusinessSharedMenuProducts: () => <div data-testid='shared-products' /> }))
vi.mock('../../SnoozeComponent', () => ({ SnoozeComponent: () => <div data-testid='snooze' /> }))

import { LeaveGuardContext, SectionSplit } from '../../../Shared/Product'
import { BusinessMenuOptions } from '../index'

const OWN_MENU = { id: 11, name: 'Lunch menu', enabled: true, sites: [] }

const buildProps = (overrides = {}) => ({
  business: { id: 7 },
  menu: OWN_MENU,
  onClose: vi.fn(),
  handleUpdateBusinessState: vi.fn(),
  isSelectedSharedMenus: false,
  isOpenSharedProduct: false,
  setIsOpenSharedProduct: vi.fn(),
  sitesState: { sites: [{ id: 1, name: 'Main site' }] },
  menuList: { menus: [OWN_MENU], menusShared: [] },
  setMenuList: vi.fn(),
  setCurrentMenu: vi.fn(),
  isDirty: false,
  pendingChangeKeys: [],
  discardChanges: vi.fn(),
  handleDeleteMenu: vi.fn().mockResolvedValue({ ok: true }),
  handleUpdateBusinessMenuOption: vi.fn().mockResolvedValue({ ok: true }),
  handleAddBusinessMenuOption: vi.fn().mockResolvedValue({ ok: true }),
  handleChangeInput: vi.fn(),
  formState: { loading: false, changes: {}, error: null },
  businessMenuState: { loading: false, error: null, menu: OWN_MENU },
  ...overrides
})

const renderDetail = (overrides, search = '') => renderWithProviders(
  <BusinessMenuOptions {...buildProps(overrides)} />,
  { initialEntries: [`/stores/list${search}`] }
)

const SHARED_MENU = { id: 21, name: 'Shared lunch', enabled: true }

beforeEach(() => {
  mocks.addQueryToUrl.mockClear()
  mocks.removeQueryToUrl.mockClear()
  mocks.useLeaveGuard.mockClear()
  mocks.basicProps.length = 0
  mocks.customFieldsProps.length = 0
})
afterEach(() => cleanup())

describe('BusinessMenuOptions · a new menu', () => {
  it('has neither tabs nor actions, only Basic', () => {
    renderDetail({ menu: {} })
    expect(screen.getByTestId('basic')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Snooze' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(screen.queryByTestId('custom-fields')).toBeNull()
  })

  it('writes no setting_tab and takes the one in the URL off', () => {
    renderDetail({ menu: {} }, '?setting_tab=logs')
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
    expect(mocks.removeQueryToUrl).toHaveBeenCalledWith(['setting_tab'])
  })

  it('does not inherit Logs from the URL (G3-10)', () => {
    renderDetail({ menu: {} }, '?setting_tab=logs')
    expect(screen.queryByTestId('logs')).toBeNull()
    expect(screen.getByTestId('basic')).toBeTruthy()
  })

  it('also reads as new when the menu is missing', () => {
    renderDetail({ menu: undefined })
    expect(screen.getByTestId('basic')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
  })
})

describe('BusinessMenuOptions · an own saved menu', () => {
  it('shows Basic, Channels, Share with and Logs, Basic selected, and writes nothing on mount', () => {
    renderDetail()
    const tabs = screen.getAllByRole('tab').map(tab => tab.textContent)
    expect(tabs).toEqual(['Basic', 'Channels', 'Share with', 'Logs'])
    expect(screen.getByRole('tab', { name: 'Basic' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('basic')).toBeTruthy()
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
    expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
  })

  it('has no Channels tab without sites', () => {
    renderDetail({ sitesState: { sites: [] } })
    expect(screen.queryByRole('tab', { name: 'Channels' })).toBeNull()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  it('opens Logs from ?setting_tab=logs, as today, without writing it', () => {
    renderDetail({}, '?setting_tab=logs')
    expect(screen.getByRole('tab', { name: 'Logs' }).getAttribute('aria-selected')).toBe('true')
    const logs = screen.getByTestId('logs')
    expect(logs.getAttribute('data-model')).toBe('Menu')
    expect(logs.getAttribute('data-id')).toBe('11')
    expect(screen.queryByTestId('basic')).toBeNull()
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('opens Channels and Share with from their URL value', () => {
    renderDetail({}, '?setting_tab=channels')
    expect(screen.getByTestId('channels')).toBeTruthy()
    cleanup()
    renderDetail({}, '?setting_tab=share_with')
    expect(screen.getByTestId('share')).toBeTruthy()
  })

  it('paints Basic, never a blank body, for an unknown value', () => {
    renderDetail({}, '?setting_tab=nonsense')
    expect(screen.getByTestId('basic')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Basic' }).getAttribute('aria-selected')).toBe('true')
  })

  it('paints Basic for channels when there are no sites to show', () => {
    renderDetail({ sitesState: { sites: [] } }, '?setting_tab=channels')
    expect(screen.getByTestId('basic')).toBeTruthy()
    expect(screen.queryByTestId('channels')).toBeNull()
  })

  it('writes setting_tab only when a tab is clicked', async () => {
    const user = userEvent.setup()
    renderDetail()
    await user.click(screen.getByRole('tab', { name: 'Logs' }))
    expect(mocks.addQueryToUrl).toHaveBeenCalledTimes(1)
    expect(mocks.addQueryToUrl).toHaveBeenCalledWith({ setting_tab: 'logs' })
    expect(screen.getByTestId('logs')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ setting_tab: 'channels' })
    expect(screen.getByTestId('channels')).toBeTruthy()
  })

  it('has Snooze and a More actions menu with Custom fields and Delete', async () => {
    const user = userEvent.setup()
    renderDetail()
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    const items = (await screen.findAllByRole('menuitem')).map(item => item.textContent)
    expect(items).toEqual(['Custom fields', 'Delete'])
  })

  // redesign bugs F row 25 (S-4): Snooze opens in the Product Dialog with a title, not in the untitled legacy modal
  it('opens Snooze in a Dialog named Snooze, closes it with its X, and does not use the legacy modal', async () => {
    const user = userEvent.setup()
    renderDetail()
    expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Snooze' }))
    const dialog = await screen.findByRole('dialog', { name: 'Snooze' })
    expect(within(dialog).getByTestId('snooze')).toBeTruthy()
    expect(screen.queryByTestId('modal')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Snooze' })).toBeNull())
  })

  it('opens Custom fields in their own dialog, as today', async () => {
    const user = userEvent.setup()
    renderDetail()
    // stores 5.6: Custom fields draw their own dialog (they are not inside the legacy modal) and open when asked
    expect(screen.getByTestId('custom-fields').getAttribute('data-open')).toBe('false')
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Custom fields' }))
    const customFields = screen.getByTestId('custom-fields')
    expect(customFields.getAttribute('data-open')).toBe('true')
    expect(customFields.getAttribute('data-business')).toBe('7')
    expect(customFields.getAttribute('data-menu')).toBe('11')
    expect(screen.queryByTestId('modal')).toBeNull()
    await user.click(within(customFields).getByRole('button', { name: 'Close custom fields' }))
    expect(screen.getByTestId('custom-fields').getAttribute('data-open')).toBe('false')
  })

  it('sends the focus back to the More actions button when Custom fields close (the menu item is gone by then)', () => {
    renderDetail()
    const { returnFocus } = mocks.customFieldsProps.at(-1)
    expect(typeof returnFocus).toBe('function')
    expect(returnFocus()).toBe(screen.getByRole('button', { name: 'More actions' }))
  })
})

describe('BusinessMenuOptions · a shared menu', () => {
  const sharedProps = () => ({ menu: SHARED_MENU, isSelectedSharedMenus: true })

  it('has no tabs, shows its products, and has Snooze and Delete (no Custom fields)', async () => {
    const user = userEvent.setup()
    renderDetail(sharedProps(), '?setting_tab=logs')
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByTestId('shared-products')).toBeTruthy()
    expect(screen.queryByTestId('logs')).toBeNull()
    expect(screen.queryByTestId('custom-fields')).toBeNull()
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    const items = (await screen.findAllByRole('menuitem')).map(item => item.textContent)
    expect(items).toEqual(['Delete'])
  })

  it('writes no setting_tab', () => {
    renderDetail(sharedProps())
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
    expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
  })
})

describe('BusinessMenuOptions · Delete (S6)', () => {
  const openDelete = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    return screen.findByRole('alertdialog')
  }

  it('asks with the name of the menu and the consequence', async () => {
    const user = userEvent.setup()
    const props = buildProps()
    renderWithProviders(<BusinessMenuOptions {...props} />)
    const dialog = await openDelete(user)
    expect(within(dialog).getByText('Delete menu "Lunch menu"?')).toBeTruthy()
    expect(within(dialog).getByText("This can't be undone.")).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(props.handleDeleteMenu).not.toHaveBeenCalled()
  })

  it('does not delete on Cancel', async () => {
    const user = userEvent.setup()
    const props = buildProps()
    renderWithProviders(<BusinessMenuOptions {...props} />)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(props.handleDeleteMenu).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('stays open and says why when the delete fails', async () => {
    const user = userEvent.setup()
    const props = buildProps({ handleDeleteMenu: vi.fn().mockResolvedValue({ ok: false, error: ['Menu is in use'] }) })
    renderWithProviders(<BusinessMenuOptions {...props} />)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete menu' }))
    expect(props.handleDeleteMenu).toHaveBeenCalledTimes(1)
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Menu is in use')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('falls back to its own text when the API gave no message', async () => {
    const user = userEvent.setup()
    const props = buildProps({ handleDeleteMenu: vi.fn().mockResolvedValue({ ok: false }) })
    renderWithProviders(<BusinessMenuOptions {...props} />)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete menu' }))
    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't delete this menu. Try again.")
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('closes the dialog when the delete works', async () => {
    const user = userEvent.setup()
    const props = buildProps()
    renderWithProviders(<BusinessMenuOptions {...props} />)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete menu' }))
    expect(props.handleDeleteMenu).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})

describe('BusinessMenuOptions · leave guard (decision 4)', () => {
  const lastGuardArgs = () => mocks.useLeaveGuard.mock.calls.at(-1)[0]

  it('registers the form with the dirty state and the count of the controller', () => {
    renderDetail({ isDirty: true, pendingChangeKeys: ['name', 'sites'] })
    const args = lastGuardArgs()
    expect(args.dirty).toBe(true)
    expect(args.count).toBe(2)
    expect(typeof args.registerCloseGuard).toBe('function')
  })

  it('is clean when the controller says so, and counts at least one', () => {
    renderDetail()
    const args = lastGuardArgs()
    expect(args.dirty).toBe(false)
    expect(args.count).toBe(1)
  })

  it('saves a saved menu with update and discards with discardChanges', async () => {
    const props = buildProps({ isDirty: true, pendingChangeKeys: ['name'] })
    renderWithProviders(<BusinessMenuOptions {...props} />)
    const args = lastGuardArgs()
    await args.save()
    expect(props.handleUpdateBusinessMenuOption).toHaveBeenCalledTimes(1)
    expect(props.handleAddBusinessMenuOption).not.toHaveBeenCalled()
    args.discard()
    expect(props.discardChanges).toHaveBeenCalledTimes(1)
  })

  it('saves a new menu with add', async () => {
    const props = buildProps({ menu: {}, isDirty: true, pendingChangeKeys: ['name'] })
    renderWithProviders(<BusinessMenuOptions {...props} />)
    await lastGuardArgs().save()
    expect(props.handleAddBusinessMenuOption).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateBusinessMenuOption).not.toHaveBeenCalled()
  })

  describe('Save validates like Basic does (it never sends a blank name nor a menu without products)', () => {
    const lastBasicProps = () => mocks.basicProps.at(-1)

    it('with a blank name: answers { ok: false }, calls no API, brings the user to Basic and asks it to mark the name', async () => {
      const props = buildProps({ isDirty: true, pendingChangeKeys: ['name'], formState: { loading: false, changes: { name: '   ' }, error: null } })
      renderWithProviders(<BusinessMenuOptions {...props} />, { initialEntries: ['/stores/list?setting_tab=logs'] })
      expect(screen.getByTestId('logs')).toBeTruthy()
      expect(lastBasicProps()).toBeUndefined()
      let result
      await act(async () => { result = await lastGuardArgs().save() })
      expect(result).toEqual({ ok: false })
      expect(props.handleUpdateBusinessMenuOption).not.toHaveBeenCalled()
      expect(props.handleAddBusinessMenuOption).not.toHaveBeenCalled()
      expect(screen.getByRole('tab', { name: 'Basic' }).getAttribute('aria-selected')).toBe('true')
      expect(screen.queryByTestId('logs')).toBeNull()
      expect(mocks.addQueryToUrl).toHaveBeenCalledWith({ setting_tab: 'basic' })
      expect(lastBasicProps().validationAttempt).toBe(1)
    })

    it('counts every refused attempt', async () => {
      const props = buildProps({ isDirty: true, formState: { loading: false, changes: { name: '' }, error: null } })
      renderWithProviders(<BusinessMenuOptions {...props} />)
      expect(lastBasicProps().validationAttempt).toBe(0)
      await act(async () => { await lastGuardArgs().save() })
      await act(async () => { await lastGuardArgs().save() })
      expect(lastBasicProps().validationAttempt).toBe(2)
    })

    it('a new menu without products nor All products: answers { ok: false } and does not add, writing no setting_tab', async () => {
      const props = buildProps({ menu: {}, businessMenuState: { loading: false, error: null, menu: {} }, isDirty: true, formState: { loading: false, changes: { name: 'Brunch' }, error: null }, selectedProductsIds: [] })
      renderWithProviders(<BusinessMenuOptions {...props} />)
      let result
      await act(async () => { result = await lastGuardArgs().save() })
      expect(result).toEqual({ ok: false })
      expect(props.handleAddBusinessMenuOption).not.toHaveBeenCalled()
      expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
      expect(lastBasicProps().validationAttempt).toBe(1)
    })

    it('a new menu with a name and products adds it and resolves what the controller answered', async () => {
      const answer = { ok: true, content: { id: 99 } }
      const props = buildProps({
        menu: {},
        businessMenuState: { loading: false, error: null, menu: {} },
        isDirty: true,
        formState: { loading: false, changes: { name: 'Brunch' }, error: null },
        selectedProductsIds: [11],
        handleAddBusinessMenuOption: vi.fn().mockResolvedValue(answer)
      })
      renderWithProviders(<BusinessMenuOptions {...props} />)
      let result
      await act(async () => { result = await lastGuardArgs().save() })
      expect(props.handleAddBusinessMenuOption).toHaveBeenCalledTimes(1)
      expect(result).toBe(answer)
      expect(lastBasicProps().validationAttempt).toBe(0)
    })

    it('a saved menu with a valid name updates it once and resolves its answer', async () => {
      const answer = { ok: true, content: OWN_MENU }
      const props = buildProps({
        isDirty: true,
        formState: { loading: false, changes: { name: 'Lunch 2' }, error: null },
        handleUpdateBusinessMenuOption: vi.fn().mockResolvedValue(answer)
      })
      renderWithProviders(<BusinessMenuOptions {...props} />)
      let result
      await act(async () => { result = await lastGuardArgs().save() })
      expect(props.handleUpdateBusinessMenuOption).toHaveBeenCalledTimes(1)
      expect(result).toBe(answer)
      expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
    })
  })

  describe('inside the piece', () => {
    const renderInSplit = (overrides) => {
      const host = {
        register: vi.fn(() => () => {}),
        registerNested: vi.fn(() => () => {}),
        requestLeave: vi.fn(() => true)
      }
      const onClose = vi.fn()
      renderWithProviders(
        <LeaveGuardContext.Provider value={host}>
          <SectionSplit
            open
            detailKey='11'
            detailTitle='Lunch menu'
            closeLabel='Close'
            backLabel='Back'
            splitFrom={100000}
            onClose={onClose}
            list={<div>the list</div>}
            detail={<BusinessMenuOptions {...buildProps(overrides)} />}
          />
        </LeaveGuardContext.Provider>
      )
      return { host, onClose }
    }

    it('«‹ Back» asks first when there is unsaved work, and does not close', async () => {
      const user = userEvent.setup()
      const { host, onClose } = renderInSplit({ isDirty: true, pendingChangeKeys: ['name'] })
      await act(async () => { await user.click(screen.getByRole('button', { name: 'Back' })) })
      expect(host.requestLeave).toHaveBeenCalledTimes(1)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('«‹ Back» leaves at once without changes', async () => {
      const user = userEvent.setup()
      const { host, onClose } = renderInSplit({ isDirty: false })
      await act(async () => { await user.click(screen.getByRole('button', { name: 'Back' })) })
      expect(host.requestLeave).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('the title of the piece is the name of the menu, with no second «Menu settings» heading', () => {
      renderInSplit({})
      expect(screen.getByRole('heading', { name: 'Lunch menu' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'Menu settings' })).toBeNull()
    })
  })
})

describe('BusinessMenuOptions · source', () => {
  const source = readFileSync(path.resolve(__dirname, '../index.js'), 'utf8')

  it('sets no width by hand (G3-13) and has no id of its own to find', () => {
    expect(source).not.toMatch(/getElementById/)
    expect(source).not.toMatch(/\.style\./)
    expect(source).not.toMatch(/menu_options/)
  })

  it('does not use react-bootstrap or its icons any more', () => {
    expect(source).not.toMatch(/react-bootstrap/)
  })
})
