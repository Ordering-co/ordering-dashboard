/* eslint-disable import/first */
// redesign RA-B5 (decisions 1-6): the cart recovery rules page. The controller (K/RecoveryActionListing), the header, the table, the panel
// and the message dialog are other pieces (RA-B1 to RA-B4) and are stubs here that record what they receive: what is tested is how they are
// composed, what the page passes to each, and what the page owns (the URL, the open rule, the discard guard, the message dialog and its
// handlers, the hidden columns, the focus). `SplitView` and the discard `ConfirmDialog` are the real ones.
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({ controller: null, header: null, table: null, panel: null, dialog: null }))
const ctl = vi.hoisted(() => ({ props: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  // the controller hands its props to the UI as the real one does; the test plays the controller
  RecoveryActionListing: ({ UIComponent, ...props }) => {
    seen.controller = props
    return <UIComponent {...props} {...ctl.props} />
  }
}))

// the ids the person hid, read from the state the page hands to the table
const hiddenIds = () => seen.table.columnsState.columns.filter(column => !column.visible).map(column => column.id)

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../../RecoveryRules/RulesHeader', () => ({
  RulesHeader: (props) => {
    seen.header = props
    return (
      <header data-testid='rules-header'>
        {/* as the header's FilterBar: the column manager (the page's) is its `tools` slot */}
        <div role='group' aria-label='Rules filter bar'>{props.tools}</div>
        <h1>Cart recovery rules</h1>
        {props.onOpenMenu && <button type='button' onClick={props.onOpenMenu}>Open menu</button>}
        <button type='button' title='New rule' onClick={props.onNew}>New rule</button>
        <button type='button' onClick={() => props.onSearch('spring')}>Search spring</button>
      </header>
    )
  }
}))

// CM-1: the column choice and its manager are the real ones (they are the page's now); only the table is a stub
vi.mock('../../RecoveryRules/RulesTable', async (importOriginal) => ({
  ...(await importOriginal()),
  RulesTable: (props) => {
    seen.table = props
    return (
      <div className='odc-table-scroll' role='region' aria-label='Rules table'>
        {props.rules.map(rule => (
          // as DataTable's rows: `data-row-id`, a row that can take the focus
          <div key={rule.id} data-row-id={rule.id} tabIndex={-1}>
            <button type='button' onClick={() => props.onOpen(rule)}>Open {rule.id}</button>
            <button type='button' onClick={() => props.onToggle(rule, !rule.enabled)}>Switch {rule.id}</button>
          </div>
        ))}
        <button type='button' onClick={() => props.onPageChange(2)}>To page 2</button>
        <button type='button' onClick={() => props.onPageSizeChange(25, 1)}>To 25 per page</button>
        <button type='button' onClick={() => props.onRetry()}>Table retry</button>
        <button type='button' onClick={() => props.onRetryChannels(2)}>Retry channels of 2</button>
        <button type='button' onClick={() => props.onNew()}>Table new</button>
      </div>
    )
  }
}))

const panelHooks = vi.hoisted(() => ({ channelActions: null, noAddButton: false }))
vi.mock('../../RecoveryRules/RulePanel', () => ({
  RulePanel: (props) => {
    seen.panel = props
    const rule = { id: 2, name: 'Rule 2', enabled: true }
    return (
      <div data-testid='rule-panel'>
        {/* as RecordPanel's title and RuleMessages' section: where the page sends the focus back to (redesign R2-F1, R1-05) */}
        <h2 className='odc-record-title'>Title of the panel</h2>
        {props.actionId != null && !panelHooks.noAddButton && (
          <section className='odc-ra-messages' data-rule-id={props.actionId}>
            <button type='button'>Add message</button>
          </section>
        )}
        <span>Panel of {props.actionId == null ? 'new' : props.actionId}</span>
        <button type='button' onClick={props.onClose}>Close panel</button>
        <button type='button' onClick={() => props.onExpandedChange(!props.expanded)}>Expand</button>
        <button type='button' onClick={() => props.onDirtyChange(true)}>Draft dirty</button>
        <button type='button' onClick={() => props.onDirtyChange(false)}>Draft clean</button>
        <button type='button' onClick={() => props.onToggleRule(props.action, false)}>Panel switch off</button>
        <button type='button' onClick={() => props.onEditMessage({ mode: 'add', rule, channel: null, channelActions: panelHooks.channelActions })}>Panel add message</button>
        <button
          type='button'
          onClick={() => props.onEditMessage({ mode: 'edit', rule, channel: { id: 5, channel: 'sms', title: 'Hi', body: 'Body' }, channelActions: panelHooks.channelActions })}
        >
          Panel edit message
        </button>
        <button type='button' onClick={() => props.onCreated({ id: 99, name: 'Brand new', enabled: true })}>Panel created</button>
        <button
          type='button'
          onClick={() => props.onCreated({ id: 99, name: 'Brand new', enabled: true }, { pendingMessage: { channel: 'email', title: 'T', body: '<p>B</p>', error: ['No'] } })}
        >
          Panel created, message failed
        </button>
        <button
          type='button'
          onClick={() => {
            props.handleSuccessDeleteRecoveryAction(props.actionId)
            props.onClose()
          }}
        >
          Delete from panel
        </button>
      </div>
    )
  }
}))

const dialogResult = vi.hoisted(() => ({ value: null }))
vi.mock('../../RecoveryRules/RuleMessageDialog', () => ({
  RuleMessageDialog: (props) => {
    seen.dialog = props
    if (!props.open) return null
    const done = async (promise) => {
      const result = await promise
      dialogResult.value = result
      if (result?.ok) props.onOpenChange(false)
    }
    return (
      <div role='dialog' aria-label='Message dialog'>
        <span>Dialog {props.mode}{props.pending ? ' pending' : ''}</span>
        <button type='button' onClick={() => done(props.onSave({ channel: 'email', title: 'New title', body: '<p>New</p>' }))}>Save message</button>
        <button type='button' onClick={() => done(props.onDelete(props.channel))}>Delete message</button>
        <button type='button' onClick={() => props.onOpenChange(false)}>Cancel message</button>
      </div>
    )
  }
}))

import { RecoveryActionListing } from '../index'

const rule = (id, extra = {}) => ({ id, name: `Rule ${id}`, description: `Description ${id}`, enabled: true, times: [260], ...extra })
const RULES = [rule(1), rule(2), rule(3)]

const channelActions = () => ({
  add: vi.fn(() => Promise.resolve({ ok: true, error: null, channel: { id: 8 } })),
  save: vi.fn(() => Promise.resolve({ ok: true, error: null })),
  remove: vi.fn(() => Promise.resolve({ ok: true, error: null })),
  reload: vi.fn()
})

const baseCtl = (overrides = {}) => ({
  recoveryActionList: { actions: RULES, loading: false, error: null },
  paginationProps: { currentPage: 1, pageSize: 10, totalItems: 42, totalPages: 5, from: 1, to: 3 },
  searchValue: '',
  channelsByRule: { 1: { loading: false, channels: [], error: null } },
  getRecoveryList: vi.fn(),
  reloadRuleChannels: vi.fn(),
  setRuleChannels: vi.fn(),
  handleChangeSearch: vi.fn(),
  handleUpdateAction: vi.fn(() => Promise.resolve({ ok: true, error: null })),
  handleSuccessAddRecoveryAction: vi.fn(),
  handleSuccessUpdateRecoveryAction: vi.fn(),
  handleSuccessDeleteRecoveryAction: vi.fn(),
  ...overrides
})

const ROUTE = '/cart-recovery/recovery-actions'
const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))

const historyRef = { current: null }
const Capture = () => {
  historyRef.current = useHistory()
  return null
}

let view
const renderPage = (ctlOverrides = {}, route = ROUTE, pageProps = {}) => {
  window.history.replaceState(null, '', route)
  ctl.props = baseCtl(ctlOverrides)
  const element = () => <><Capture /><RecoveryActionListing isUseQuery {...pageProps} /></>
  const utils = renderWithProviders(element(), { initialEntries: [route] })
  view = {
    ...utils,
    // the controller answers with new props (a new list, a new page)
    update: (changes) => {
      Object.assign(ctl.props, changes)
      utils.rerender(element())
    }
  }
  return view
}

// jsdom answers matchMedia with `matches: false`: the split view reads (min|max)-width queries, so one is installed that evaluates them
// against a width (1440: the split mode, the panel sits beside the list)
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? width >= Number(value) : width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  window.innerWidth = width
  return () => Object.assign(window, original)
}

let restoreViewport
beforeEach(() => {
  window.history.replaceState(null, '', ROUTE)
  restoreViewport = installViewport(1440)
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
  Object.keys(seen).forEach(key => { seen[key] = null })
  panelHooks.channelActions = channelActions()
  panelHooks.noAddButton = false
  dialogResult.value = null
})

afterEach(() => {
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

const click = (name) => userEvent.click(screen.getByRole('button', { name }))

describe('wrapper: what it passes the controller', () => {
  it('searches by name and description and hands the controller the page UI', () => {
    renderPage()
    expect(seen.controller).toMatchObject({ isSearchByName: true, isSearchByDescription: true, isUseQuery: true })
  })

  it('reads the page and the page size from the URL', () => {
    renderPage({}, `${ROUTE}?page=3&pageSize=25`)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 3, pageSize: 25, controlType: 'pages' })
  })

  it('reads the page size even when there is no page (it was gated by the page)', () => {
    renderPage({}, `${ROUTE}?pageSize=50`)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 50, controlType: 'pages' })
  })

  it('page 1 and 10 per page by default; values that are not numbers fall back', () => {
    renderPage()
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
    view.unmount()
    renderPage({}, `${ROUTE}?page=abc&pageSize=abc`)
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it('without isUseQuery the URL is not read', () => {
    renderPage({}, `${ROUTE}?page=3&pageSize=25`, { isUseQuery: false })
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })
})

describe('composition', () => {
  it('draws the header and the table, and no panel', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Cart recovery rules' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Rules table' })).toBeInTheDocument()
    expect(screen.queryByTestId('rule-panel')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the header gets the count, the «N of M on» summary, the search and the learn options', () => {
    ctl.props = {}
    // redesign RA-I1: the summary is the controller's (every rule), not the page's: the page shows 2 of 3 on, the controller read 12 rules
    renderPage({
      recoveryActionList: { actions: [rule(1), rule(2, { enabled: false }), rule(3)], loading: false, error: null },
      rulesSummary: { on: 7, total: 12 },
      searchValue: 'sp'
    })
    expect(seen.header.count).toBe(42)
    expect(seen.header.summary).toEqual({ on: 7, total: 12 })
    expect(seen.header.search).toBe('sp')
    expect(Array.isArray(seen.header.learnOptions)).toBe(true)
    expect(seen.header.learnOptions.length).toBeGreaterThan(0)
  })

  it('the summary is unknown (null) until the controller knows the total', () => {
    renderPage({ paginationProps: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null }, recoveryActionList: { actions: [], loading: true, error: null }, rulesSummary: null })
    expect(seen.header.summary).toBeNull()
    expect(seen.header.count).toBeNull()
    view.update({ paginationProps: { currentPage: 1, pageSize: 10, totalItems: 3, totalPages: 1 }, recoveryActionList: { actions: RULES, loading: false, error: null }, rulesSummary: { on: 3, total: 3 } })
    expect(seen.header.summary).toEqual({ on: 3, total: 3 })
  })

  // redesign RA-I1: null (not read yet) holds the line, an object draws it, an error leaves it out (undefined)
  describe('the summary the page hands the header', () => {
    it('is null while the controller has not read the rules, even if the page and its total are known', () => {
      renderPage({ rulesSummary: null })
      expect(ctl.props.paginationProps.totalItems).toBe(42)
      expect(ctl.props.recoveryActionList.actions).toHaveLength(3)
      expect(seen.header.summary).toBeNull()
    })

    it('is null when the controller does not expose it at all', () => {
      renderPage({ rulesSummary: undefined })
      expect(seen.header.summary).toBeNull()
    })

    it('is the controller\'s object, as it is, whatever the page or the search show', () => {
      const rulesSummary = { on: 4, total: 9 }
      renderPage({ rulesSummary, recoveryActionList: { actions: [rule(1)], loading: false, error: null }, searchValue: 'sp' })
      expect(seen.header.summary).toBe(rulesSummary)
      view.update({ recoveryActionList: { actions: RULES, loading: false, error: null }, searchValue: '' })
      expect(seen.header.summary).toBe(rulesSummary)
    })

    it('follows the controller when it moves (a switch, a new rule, a delete)', () => {
      renderPage({ rulesSummary: { on: 4, total: 9 } })
      view.update({ rulesSummary: { on: 5, total: 9 } })
      expect(seen.header.summary).toEqual({ on: 5, total: 9 })
      view.update({ rulesSummary: { on: 5, total: 10 } })
      expect(seen.header.summary).toEqual({ on: 5, total: 10 })
    })

    it('is undefined when the controller could not read it (the header leaves the line out)', () => {
      renderPage({ rulesSummary: { error: ['No access'] } })
      expect(seen.header.summary).toBeUndefined()
      // the rest of the header is still given
      expect(seen.header.count).toBe(42)
    })

    it('goes from null to undefined to the object as the controller answers or recovers', () => {
      renderPage({ rulesSummary: null })
      expect(seen.header.summary).toBeNull()
      view.update({ rulesSummary: { error: ['boom'] } })
      expect(seen.header.summary).toBeUndefined()
      view.update({ rulesSummary: { on: 1, total: 2 } })
      expect(seen.header.summary).toEqual({ on: 1, total: 2 })
    })
  })

  it('a null search shows as empty', () => {
    renderPage({ searchValue: null })
    expect(seen.header.search).toBe('')
    expect(seen.table.searching).toBe('')
  })

  it('the search goes to handleChangeSearch', async () => {
    renderPage()
    await click('Search spring')
    expect(ctl.props.handleChangeSearch).toHaveBeenCalledWith('spring')
  })

  it('the table gets the list, the state, the channels, the pagination and the active rule', () => {
    renderPage({ searchValue: 'sp' })
    expect(seen.table.rules).toBe(RULES)
    expect(seen.table.loading).toBe(false)
    expect(seen.table.error).toBeNull()
    expect(seen.table.channelsByRule).toBe(ctl.props.channelsByRule)
    expect(seen.table.pagination).toBe(ctl.props.paginationProps)
    expect(seen.table.activeId).toBeNull()
    expect(seen.table.searching).toBe('sp')
    expect(hiddenIds()).toEqual([])
    expect(within(screen.getByRole('group', { name: 'Rules filter bar' })).getByRole('button', { name: 'Manage columns' })).toBeInTheDocument()
  })

  it('the menu button shows while the sidebar is collapsed and opens it', async () => {
    infoShare.isCollapse = true
    renderPage()
    await click('Open menu')
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('no menu button while the sidebar is open', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })

  it('the table pages, retries and channel retries go to the controller', async () => {
    renderPage({ paginationProps: { currentPage: 2, pageSize: 25, totalItems: 80, totalPages: 4 } })
    await click('To page 2')
    expect(ctl.props.getRecoveryList).toHaveBeenLastCalledWith(2, 25)
    await click('To 25 per page')
    expect(ctl.props.getRecoveryList).toHaveBeenLastCalledWith(1, 25)
    await click('Table retry')
    expect(ctl.props.getRecoveryList).toHaveBeenLastCalledWith(2, 25)
    await click('Retry channels of 2')
    expect(ctl.props.reloadRuleChannels).toHaveBeenCalledWith(2)
  })

  // CM-1: the manager is the header's filter bar's tool (not a row above the table) and the page holds what it chose
  it('the column manager is in the header\'s filter bar, controlled by the page: hide and reset', async () => {
    renderPage()
    const bar = screen.getByRole('group', { name: 'Rules filter bar' })
    await click('Manage columns')
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Description' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Channels' }))
    expect(hiddenIds()).toEqual(['description', 'channels'])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(hiddenIds()).toEqual([])
    expect(within(bar).getByRole('button', { name: 'Manage columns' })).toBeInTheDocument()
    expect(document.querySelector('.odc-ra-tools')).toBeNull()
  })

  it('keeps the header and the first row in place when the panel opens, with the panel beside the list', async () => {
    renderPage()
    const header = screen.getByTestId('rules-header')
    const row = document.querySelector('[data-row-id="1"]')
    const list = header.parentElement
    expect(list.contains(row)).toBe(true)
    await click('Open 2')
    expect(screen.getByTestId('rule-panel')).toBeInTheDocument()
    expect(screen.getByTestId('rules-header')).toBe(header)
    expect(document.querySelector('[data-row-id="1"]')).toBe(row)
    expect(list.contains(screen.getByTestId('rule-panel'))).toBe(false)
  })
})

describe('the panel and the URL', () => {
  it('?id=7 opens the panel of rule 7 even when it is not on the page (the panel loads it)', () => {
    renderPage({}, `${ROUTE}?id=7`)
    expect(screen.getByText('Panel of 7')).toBeInTheDocument()
    expect(seen.panel.actionId).toBe(7)
    expect(seen.panel.action).toEqual({})
    expect(seen.table.activeId).toBe(7)
  })

  it('?id=7 with the rule on the page gives the panel the list\'s row', () => {
    renderPage({ recoveryActionList: { actions: [rule(7)], loading: false, error: null } }, `${ROUTE}?id=7`)
    expect(seen.panel.action).toBe(ctl.props.recoveryActionList.actions[0])
  })

  it('an ?id= that is not an id opens nothing', () => {
    renderPage({}, `${ROUTE}?id=abc`)
    expect(screen.queryByTestId('rule-panel')).toBeNull()
  })

  it('?add=1 (command palette) opens the create panel once and takes `add` out of the URL', async () => {
    renderPage({}, `${ROUTE}?add=1`)
    await waitFor(() => expect(screen.getByText('Panel of new')).toBeInTheDocument())
    expect(urlParams().add).toBeUndefined()
    expect(seen.panel.actionId).toBeNull()
    expect(seen.panel.action).toEqual({})
  })

  it('«New rule» opens the create panel and keeps the URL clean of an id; the empty state does too', async () => {
    renderPage({}, `${ROUTE}?page=1&pageSize=10`)
    await click('New rule')
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    expect(urlParams().id).toBeUndefined()
    expect(seen.table.activeId).toBeNull()
    await click('Close panel')
    await click('Table new')
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
  })

  it('creating while a rule is open drops the id from the URL', async () => {
    renderPage()
    await click('Open 2')
    expect(urlParams().id).toBe('2')
    await click('New rule')
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    expect(urlParams().id).toBeUndefined()
  })

  it('?tab=notifications with an id opens the panel on Messages (initialSection)', () => {
    renderPage({}, `${ROUTE}?id=2&tab=notifications`)
    expect(seen.panel.initialSection).toBe('messages')
  })

  it('without ?tab, or from a row click, the panel has no initial section', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    expect(seen.panel.initialSection).toBeUndefined()
    await click('Close panel')
    view.unmount()
    renderPage({}, `${ROUTE}?tab=notifications`)
    expect(screen.queryByTestId('rule-panel')).toBeNull()
    await click('Open 1')
    expect(seen.panel.initialSection).toBeUndefined()
  })

  it('a row click opens the panel with the row and writes ?id=', async () => {
    renderPage()
    await click('Open 2')
    expect(screen.getByText('Panel of 2')).toBeInTheDocument()
    expect(seen.panel.action).toBe(RULES[1])
    expect(seen.panel.actionId).toBe(2)
    expect(urlParams().id).toBe('2')
    expect(seen.table.activeId).toBe(2)
  })

  it('the panel is told what it needs from the page', async () => {
    renderPage()
    await click('Open 1')
    expect(seen.panel.recoveryActionList).toBe(ctl.props.recoveryActionList)
    expect(seen.panel.handleSuccessAddRecoveryAction).toBe(ctl.props.handleSuccessAddRecoveryAction)
    expect(seen.panel.handleSuccessUpdateRecoveryAction).toBe(ctl.props.handleSuccessUpdateRecoveryAction)
    expect(typeof seen.panel.handleSuccessDeleteRecoveryAction).toBe('function')
    expect(seen.panel.onChannelsChange).toBe(ctl.props.setRuleChannels)
    expect(typeof seen.panel.onToggleRule).toBe('function')
    expect(typeof seen.panel.onEditMessage).toBe('function')
    expect(typeof seen.panel.onCreated).toBe('function')
    expect(typeof seen.panel.onDirtyChange).toBe('function')
    expect(seen.panel.channelActionsRef).toEqual({ current: null })
    expect(seen.panel.expanded).toBe(false)
  })

  it('opening another row switches the panel and the id', async () => {
    renderPage()
    await click('Open 1')
    await click('Open 3')
    expect(screen.getByText('Panel of 3')).toBeInTheDocument()
    expect(urlParams().id).toBe('3')
    expect(seen.table.activeId).toBe(3)
  })

  it('shows the list\'s own version of the open rule (a switch changed it)', async () => {
    renderPage()
    await click('Open 2')
    const updated = [RULES[0], { ...RULES[1], enabled: false }, RULES[2]]
    view.update({ recoveryActionList: { actions: updated, loading: false, error: null } })
    expect(seen.panel.action).toBe(updated[1])
  })

  it('keeps the row it opened when it leaves the list (another page, a search)', async () => {
    renderPage()
    await click('Open 2')
    view.update({ recoveryActionList: { actions: [RULES[0]], loading: false, error: null } })
    expect(seen.panel.action).toBe(RULES[1])
  })

  it('closing removes id and tab and keeps page and pageSize', async () => {
    renderPage({}, `${ROUTE}?id=2&tab=notifications&page=1&pageSize=10`)
    await click('Close panel')
    expect(screen.queryByTestId('rule-panel')).toBeNull()
    expect(urlParams()).toEqual({ page: '1', pageSize: '10' })
    expect(seen.table.activeId).toBeNull()
  })

  it('closing a create panel leaves the URL as it was', async () => {
    renderPage({ paginationProps: { currentPage: 2, pageSize: 25, totalItems: 80, totalPages: 4 } }, `${ROUTE}?page=2&pageSize=25`)
    await click('New rule')
    await click('Close panel')
    expect(urlParams()).toEqual({ page: '2', pageSize: '25' })
  })

  it('the panel can open as a page and is not expanded on the next rule', async () => {
    renderPage()
    await click('Open 1')
    await click('Expand')
    expect(seen.panel.expanded).toBe(true)
    await click('Close panel')
    await click('Open 2')
    expect(seen.panel.expanded).toBe(false)
  })

  it('the panel is named after the rule, «New rule» when creating, «Recovery action» until the row is known', async () => {
    renderPage()
    await click('Open 2')
    expect(document.querySelector('aside[aria-label="Rule 2"]')).not.toBeNull()
    await click('New rule')
    expect(document.querySelector('aside[aria-label="New rule"]')).not.toBeNull()
    view.unmount()
    renderPage({ recoveryActionList: { actions: [], loading: true, error: null } }, `${ROUTE}?id=40`)
    expect(document.querySelector('aside[aria-label="Recovery action"]')).not.toBeNull()
  })

  it('?id= keeps the row it saw when it leaves the page, so the panel does not load it again', () => {
    renderPage({ recoveryActionList: { actions: [rule(7)], loading: false, error: null } }, `${ROUTE}?id=7`)
    const row = seen.panel.action
    view.update({ recoveryActionList: { actions: [rule(1)], loading: false, error: null } })
    expect(seen.panel.action).toBe(row)
  })
})

// redesign D-76 (owner, 2026-10-19): turning a rule ON asks first. The page hosts the one question (useConfirmStep, the real one) and
// hands `confirmTurnOn(rule)` to the table and to the panel, which give it to their switch as `confirmChange`; turning OFF never asks
describe('turning a rule on asks first (the table and the panel share the one question)', () => {
  const ask = (rule) => {
    let answer
    act(() => { seen.table.confirmTurnOn(rule).then(value => { answer = value }) })
    return () => answer
  }

  it('hands the same question to the table and to the panel', async () => {
    renderPage()
    await click('Open 1')
    expect(typeof seen.table.confirmTurnOn).toBe('function')
    expect(seen.panel.confirmTurnOn).toBe(seen.table.confirmTurnOn)
  })

  it('asks with the name, the consequence and a verb, in the primary tone, with the focus on Cancel; nothing is saved', async () => {
    renderPage()
    const answered = ask(RULES[1])
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Turn on "Rule 2"?')).toBeInTheDocument()
    expect(within(dialog).getByText('Customers who leave a cart start getting its messages.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Turn on rule' })).toHaveAttribute('data-variant', 'primary') // tone 'primary', not the danger red
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(answered()).toBeUndefined()
    expect(ctl.props.handleUpdateAction).not.toHaveBeenCalled()
  })

  it('«Turn on rule» answers yes', async () => {
    renderPage()
    const answered = ask(RULES[1])
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn on rule' }))
    await waitFor(() => expect(answered()).toBe(true))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('Cancel answers no and writes nothing', async () => {
    renderPage()
    const answered = ask(RULES[1])
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(answered()).toBe(false))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(ctl.props.handleUpdateAction).not.toHaveBeenCalled()
  })

  it('a rule with no name is named as the screens name it: «Recovery action»', async () => {
    renderPage()
    ask({ id: 9, name: '', enabled: false })
    expect(await screen.findByText('Turn on "Recovery action"?')).toBeInTheDocument()
  })

  it('a name that is already a question keeps one mark (live: «Turn on Did something interrupt your order??»)', async () => {
    renderPage()
    ask({ id: 9, name: 'Did something interrupt your order?', enabled: false })
    expect(await screen.findByText('Turn on "Did something interrupt your order"?')).toBeInTheDocument()
  })

  it('turning off stays immediate: the page asks nothing', async () => {
    renderPage()
    await click('Switch 2')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(ctl.props.handleUpdateAction).toHaveBeenCalledWith(2, { enabled: false })
  })
})

describe('the switch of a rule (the table and the panel use the same one)', () => {
  it('the table asks the controller to save only `enabled`', async () => {
    renderPage()
    await click('Switch 2')
    expect(ctl.props.handleUpdateAction).toHaveBeenCalledWith(2, { enabled: false })
  })

  it('the table\'s handler resolves the controller\'s answer (the switch shows its failure)', async () => {
    renderPage({ handleUpdateAction: vi.fn(() => Promise.resolve({ ok: false, error: ['Not allowed'] })) })
    await expect(seen.table.onToggle(RULES[0], false)).resolves.toEqual({ ok: false, error: ['Not allowed'] })
  })

  it('the panel\'s header switch is the same handler and saves only `enabled`', async () => {
    renderPage()
    await click('Open 1')
    expect(seen.panel.onToggleRule).toBe(seen.table.onToggle)
    await click('Panel switch off')
    expect(ctl.props.handleUpdateAction).toHaveBeenCalledWith(1, { enabled: false })
  })
})

// redesign R2-F1 (R1-01): the panel's rule may have left the list (a search, another page); the row the page holds for it must not stay behind
describe('the switch of a rule that is no longer on the page', () => {
  const saved = { id: 2, name: 'Rule 2', description: 'Description 2', enabled: false, times: [260] }

  it('a saved switch folds the answer into the rule the panel holds', async () => {
    const handleUpdateAction = vi.fn(() => Promise.resolve({ ok: true, error: null, rule: saved }))
    renderPage({ handleUpdateAction })
    await click('Open 2')
    view.update({ recoveryActionList: { actions: [RULES[0]], loading: false, error: null } })
    expect(seen.panel.action).toBe(RULES[1])
    await act(async () => { await seen.panel.onToggleRule(seen.panel.action, false) })
    expect(handleUpdateAction).toHaveBeenCalledWith(2, { enabled: false })
    expect(seen.panel.action).toMatchObject({ id: 2, enabled: false, name: 'Rule 2' })
  })

  it('also a rule opened by ?id= that is not on the page: the panel\'s record is the row it gets', async () => {
    const handleUpdateAction = vi.fn(() => Promise.resolve({ ok: true, error: null, rule: { id: 7, enabled: true } }))
    renderPage({ handleUpdateAction }, `${ROUTE}?id=7`)
    expect(seen.panel.action).toEqual({})
    await act(async () => { await seen.panel.onToggleRule({ id: 7, name: 'Seven', enabled: false }, true) })
    expect(seen.panel.action).toEqual({ id: 7, name: 'Seven', enabled: true })
    expect(seen.panel.actionId).toBe(7)
  })

  it('a refused switch changes nothing', async () => {
    const handleUpdateAction = vi.fn(() => Promise.resolve({ ok: false, error: ['Nope'] }))
    renderPage({ handleUpdateAction })
    await click('Open 2')
    view.update({ recoveryActionList: { actions: [RULES[0]], loading: false, error: null } })
    let outcome
    await act(async () => { outcome = await seen.panel.onToggleRule(seen.panel.action, false) })
    expect(outcome).toEqual({ ok: false, error: ['Nope'] })
    expect(seen.panel.action).toBe(RULES[1])
  })

  it('the switch of ANOTHER rule does not touch the rule that is open', async () => {
    const handleUpdateAction = vi.fn(() => Promise.resolve({ ok: true, error: null, rule: { id: 3, enabled: false } }))
    renderPage({ handleUpdateAction })
    await click('Open 2')
    view.update({ recoveryActionList: { actions: [RULES[0]], loading: false, error: null } })
    await act(async () => { await seen.table.onToggle(RULES[2], false) })
    expect(seen.panel.action).toBe(RULES[1])
  })

  it('the table\'s switch resolves what the controller answered, saved record included', async () => {
    const answer = { ok: true, error: null, rule: saved }
    renderPage({ handleUpdateAction: vi.fn(() => Promise.resolve(answer)) })
    await expect(seen.table.onToggle(RULES[1], false)).resolves.toEqual(answer)
  })
})

// redesign R2-F1 (R1-06): edits to a rule (the panel reports them) are guarded like the draft of a new one
describe('the discard guard of a rule with unsaved changes', () => {
  it('opening another row asks first; Keep editing stays on the rule', async () => {
    renderPage()
    await click('Open 1')
    await click('Draft dirty')
    await click('Open 2')
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Discard your changes?')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByText('Panel of 1')).toBeInTheDocument()
    expect(urlParams().id).toBe('1')
  })

  it('Discard goes on to the other row', async () => {
    renderPage()
    await click('Open 1')
    await click('Draft dirty')
    await click('Open 2')
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.getByText('Panel of 2')).toBeInTheDocument())
    expect(urlParams().id).toBe('2')
    // the draft was spent: the next row does not ask
    await click('Open 3')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('«New rule» asks too, and Discard opens the empty form', async () => {
    renderPage()
    await click('Open 1')
    await click('Draft dirty')
    await click('New rule')
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.getByText('Panel of new')).toBeInTheDocument())
  })

  it('pressing the row that is already open does not ask (nothing would be dropped)', async () => {
    renderPage()
    await click('Open 1')
    await click('Draft dirty')
    await click('Open 1')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Panel of 1')).toBeInTheDocument()
  })

  it('a clean rule is replaced without asking', async () => {
    renderPage()
    await click('Open 1')
    await click('Draft dirty')
    await click('Draft clean')
    await click('Open 2')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('the discard guard of the create form', () => {
  it('opening another row with an unsaved create form asks first; Keep editing stays', async () => {
    renderPage()
    await click('New rule')
    await click('Draft dirty')
    await click('Open 2')
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Discard your changes?')).toBeInTheDocument()
    expect(within(dialog).getByText('What you changed here is not saved yet.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    expect(urlParams().id).toBeUndefined()
  })

  it('Discard goes on to the row', async () => {
    renderPage()
    await click('New rule')
    await click('Draft dirty')
    await click('Open 2')
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.getByText('Panel of 2')).toBeInTheDocument())
    expect(urlParams().id).toBe('2')
  })

  it('a clean create form is replaced without asking', async () => {
    renderPage()
    await click('New rule')
    await click('Open 2')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Panel of 2')).toBeInTheDocument()
  })

  it('«New rule» with a dirty create form asks, and Discard starts a new form', async () => {
    renderPage()
    await click('New rule')
    await click('Draft dirty')
    const first = seen.panel
    await click('New rule')
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    expect(seen.panel).not.toBe(first)
  })

  it('a clean create panel that is already open is not replaced by an identical one', async () => {
    renderPage()
    await click('New rule')
    const panel = screen.getByTestId('rule-panel')
    await click('New rule')
    expect(screen.getByTestId('rule-panel')).toBe(panel)
  })

  it('closing the panel forgets the draft', async () => {
    renderPage()
    await click('New rule')
    await click('Draft dirty')
    await click('Close panel')
    await click('Open 2')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('after the panel creates a rule', () => {
  it('the panel moves to the new rule (view mode, id in the URL) and no dialog opens', async () => {
    renderPage()
    await click('New rule')
    await click('Draft dirty')
    await click('Panel created')
    expect(screen.getByText('Panel of 99')).toBeInTheDocument()
    expect(seen.panel.action).toEqual({ id: 99, name: 'Brand new', enabled: true })
    expect(seen.panel.actionId).toBe(99)
    expect(urlParams().id).toBe('99')
    expect(screen.queryByRole('dialog', { name: 'Message dialog' })).toBeNull()
    // the draft was spent: another row does not ask
    await click('Open 1')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('with a pending message the dialog opens in add mode with those values', async () => {
    renderPage()
    await click('New rule')
    await click('Panel created, message failed')
    expect(screen.getByText('Panel of 99')).toBeInTheDocument()
    expect(urlParams().id).toBe('99')
    expect(screen.getByRole('dialog', { name: 'Message dialog' })).toBeInTheDocument()
    expect(screen.getByText('Dialog add pending')).toBeInTheDocument()
    expect(seen.dialog.pending).toEqual({ channel: 'email', title: 'T', body: '<p>B</p>', error: ['No'] })
    expect(seen.dialog.mode).toBe('add')
    expect(seen.dialog.rule).toEqual({ id: 99, name: 'Brand new', enabled: true })
  })

  it('saving the pending message uses the actions the new panel put in channelActionsRef', async () => {
    renderPage()
    await click('New rule')
    await click('Panel created, message failed')
    // the panel of the new rule mounts its Messages and puts the actions in the ref
    seen.panel.channelActionsRef.current = panelHooks.channelActions
    await click('Save message')
    expect(panelHooks.channelActions.add).toHaveBeenCalledWith({ channel: 'email', title: 'New title', body: '<p>New</p>' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Message dialog' })).toBeNull())
  })

  it('if the new panel has not put its actions yet, saving waits for the next render', async () => {
    renderPage()
    await click('New rule')
    await click('Panel created, message failed')
    const pressed = userEvent.click(screen.getByRole('button', { name: 'Save message' }))
    await new Promise(resolve => setTimeout(resolve, 60))
    expect(panelHooks.channelActions.add).not.toHaveBeenCalled()
    seen.panel.channelActionsRef.current = panelHooks.channelActions
    await pressed
    await waitFor(() => expect(panelHooks.channelActions.add).toHaveBeenCalledTimes(1))
  })

  it('if the actions never arrive, the save fails (the dialog keeps its values and says so)', async () => {
    renderPage()
    await click('New rule')
    await click('Panel created, message failed')
    await click('Save message')
    await waitFor(() => expect(dialogResult.value).toEqual({ ok: false, error: null }), { timeout: 3000 })
    expect(screen.getByRole('dialog', { name: 'Message dialog' })).toBeInTheDocument()
  })
})

describe('the message dialog (mounted once)', () => {
  it('is closed until the panel asks for it', () => {
    renderPage()
    expect(seen.dialog.open).toBe(false)
  })

  it('Add message from the panel opens it in add mode; saving calls channelActions.add and closes', async () => {
    renderPage()
    await click('Open 2')
    await click('Panel add message')
    expect(screen.getByText('Dialog add')).toBeInTheDocument()
    expect(seen.dialog.mode).toBe('add')
    expect(seen.dialog.pending).toBeUndefined()
    expect(seen.dialog.rule).toEqual({ id: 2, name: 'Rule 2', enabled: true })
    await click('Save message')
    expect(panelHooks.channelActions.add).toHaveBeenCalledWith({ channel: 'email', title: 'New title', body: '<p>New</p>' })
    expect(panelHooks.channelActions.save).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Message dialog' })).toBeNull())
  })

  it('Edit opens it in edit mode with the channel; saving calls channelActions.save(id, { title, body })', async () => {
    renderPage()
    await click('Open 2')
    await click('Panel edit message')
    expect(screen.getByText('Dialog edit')).toBeInTheDocument()
    expect(seen.dialog.channel).toEqual({ id: 5, channel: 'sms', title: 'Hi', body: 'Body' })
    await click('Save message')
    expect(panelHooks.channelActions.save).toHaveBeenCalledWith(5, { title: 'New title', body: '<p>New</p>' })
    expect(panelHooks.channelActions.add).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Message dialog' })).toBeNull())
  })

  it('Delete message calls channelActions.remove(id) and closes', async () => {
    renderPage()
    await click('Open 2')
    await click('Panel edit message')
    await click('Delete message')
    expect(panelHooks.channelActions.remove).toHaveBeenCalledWith(5)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Message dialog' })).toBeNull())
  })

  it('a save that fails resolves the controller\'s error and the dialog stays open', async () => {
    panelHooks.channelActions.save = vi.fn(() => Promise.resolve({ ok: false, error: ['Nope'] }))
    renderPage()
    await click('Open 2')
    await click('Panel edit message')
    await click('Save message')
    await waitFor(() => expect(dialogResult.value).toEqual({ ok: false, error: ['Nope'] }))
    expect(screen.getByRole('dialog', { name: 'Message dialog' })).toBeInTheDocument()
  })

  // redesign R2-F1 (R1-05): a dialog with no opener on the page (a pending message) or whose opener is gone (a deleted message) gives the
  // focus back to a control that exists: «Add message» of the panel, else its title
  describe('where the focus goes when it closes (returnFocus)', () => {
    it('is always given, a function', async () => {
      renderPage()
      expect(typeof seen.dialog.returnFocus).toBe('function')
      await click('Open 2')
      await click('Panel edit message')
      expect(typeof seen.dialog.returnFocus).toBe('function')
    })

    it('«Add message» of the panel of the rule the dialog belongs to', async () => {
      renderPage()
      await click('Open 2')
      await click('Panel edit message')
      const target = seen.dialog.returnFocus()
      expect(target).toBe(within(screen.getByTestId('rule-panel')).getByRole('button', { name: 'Add message' }))
    })

    it('after a rule is created with its first message failed, the dialog has no opener and returns to the new panel\'s «Add message»', async () => {
      renderPage()
      await click('New rule')
      await click('Panel created, message failed')
      expect(seen.dialog.pending).toBeDefined()
      const target = seen.dialog.returnFocus()
      expect(target).toBe(within(screen.getByTestId('rule-panel')).getByRole('button', { name: 'Add message' }))
      expect(screen.getByText('Panel of 99')).toBeInTheDocument()
    })

    it('with no «Add message» there (the messages did not load) it is the title of the panel, which can take the focus', async () => {
      panelHooks.noAddButton = true
      renderPage()
      await click('Open 2')
      await click('Panel edit message')
      const target = seen.dialog.returnFocus()
      expect(target).toBe(screen.getByRole('heading', { level: 2, name: 'Title of the panel' }))
      expect(target.getAttribute('tabindex')).toBe('-1')
    })

    it('nothing to return to when the panel is not there', async () => {
      renderPage()
      expect(seen.dialog.returnFocus()).toBeNull()
    })
  })

  it('Cancel closes it without touching the channels', async () => {
    renderPage()
    await click('Open 2')
    await click('Panel add message')
    await click('Cancel message')
    expect(screen.queryByRole('dialog', { name: 'Message dialog' })).toBeNull()
    expect(panelHooks.channelActions.add).not.toHaveBeenCalled()
  })
})

describe('focus', () => {
  it('closing the panel gives the focus back to the row', async () => {
    renderPage()
    await click('Open 2')
    act(() => { document.body.focus() })
    await click('Close panel')
    await waitFor(() => expect(document.querySelector('[data-row-id="2"]').contains(document.activeElement)).toBe(true))
  })

  it('closing a panel that was opened by ?id= (no opener) puts the focus on its row', async () => {
    renderPage({}, `${ROUTE}?id=2`)
    await click('Close panel')
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="2"]')))
  })

  it('a delete from the panel reaches the controller, closes the panel and the URL', async () => {
    renderPage()
    await click('Open 2')
    await click('Delete from panel')
    expect(ctl.props.handleSuccessDeleteRecoveryAction).toHaveBeenCalledWith(2)
    expect(screen.queryByTestId('rule-panel')).toBeNull()
    expect(urlParams().id).toBeUndefined()
  })

  it('after a delete the focus goes to the row that took its place, not to the first', async () => {
    renderPage()
    await click('Open 2')
    await click('Delete from panel')
    // the dialog hands the focus back to the table's tab stop, the first row, as the browser does
    act(() => { document.querySelector('[data-row-id="1"]').focus() })
    view.update({ recoveryActionList: { actions: [RULES[0], RULES[2]], loading: false, error: null } })
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="3"]')))
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(document.activeElement).toBe(document.querySelector('[data-row-id="3"]'))
  })

  it('the last row deleted: the focus goes to the previous one', async () => {
    renderPage()
    await click('Open 3')
    await click('Delete from panel')
    view.update({ recoveryActionList: { actions: [RULES[0], RULES[1]], loading: false, error: null } })
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="2"]')))
  })

  it('the only row deleted: the focus goes to «New rule» of the header', async () => {
    renderPage({ recoveryActionList: { actions: [RULES[0]], loading: false, error: null } })
    await click('Open 1')
    await click('Delete from panel')
    view.update({ recoveryActionList: { actions: [], loading: false, error: null }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 1 } })
    await waitFor(() => expect(document.activeElement).toBe(within(screen.getByTestId('rules-header')).getByRole('button', { name: 'New rule' })))
  })

  it('a focus the person put on a control of the list (not a row) is left alone', async () => {
    renderPage()
    await click('Open 2')
    await click('Delete from panel')
    const retry = screen.getByRole('button', { name: 'Table retry' })
    act(() => { retry.focus() })
    view.update({ recoveryActionList: { actions: [RULES[0], RULES[2]], loading: false, error: null } })
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(document.activeElement).toBe(retry)
  })
})

describe('page and page size in the URL', () => {
  it('writes ?page and ?pageSize once the controller knows the pages, and again when the page changes', () => {
    renderPage({ paginationProps: { currentPage: 2, pageSize: 25, totalItems: 80, totalPages: 4 } })
    expect(urlParams()).toMatchObject({ page: '2', pageSize: '25' })
    view.update({ paginationProps: { currentPage: 3, pageSize: 25, totalItems: 80, totalPages: 4 } })
    expect(urlParams()).toMatchObject({ page: '3', pageSize: '25' })
  })

  it('writes nothing before the pages are known, nor without isUseQuery', () => {
    renderPage({ paginationProps: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null } })
    expect(urlParams().page).toBeUndefined()
    view.unmount()
    renderPage({}, ROUTE, { isUseQuery: false })
    expect(urlParams().page).toBeUndefined()
  })
})

describe('a page left empty asks again', () => {
  it('goes to the page before when the last page is empty', () => {
    renderPage({
      recoveryActionList: { actions: [], loading: false, error: null },
      paginationProps: { currentPage: 3, pageSize: 10, totalItems: 20, totalPages: 3 }
    })
    expect(ctl.props.getRecoveryList).toHaveBeenCalledWith(2, 10)
  })

  it('asks for the same page when it is not the last', () => {
    renderPage({
      recoveryActionList: { actions: [], loading: false, error: null },
      paginationProps: { currentPage: 2, pageSize: 10, totalItems: 40, totalPages: 4 }
    })
    expect(ctl.props.getRecoveryList).toHaveBeenCalledWith(2, 10)
  })

  it('does not ask while loading, on a single page or on an error', () => {
    renderPage({
      recoveryActionList: { actions: [], loading: true, error: null },
      paginationProps: { currentPage: 3, pageSize: 10, totalItems: 20, totalPages: 3 }
    })
    view.update({ recoveryActionList: { actions: [], loading: false, error: ['boom'] } })
    view.update({ recoveryActionList: { actions: [], loading: false, error: null }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 1 } })
    expect(ctl.props.getRecoveryList).not.toHaveBeenCalled()
  })
})

describe('the results of each rule', () => {
  const entry = { loading: false, error: null, sent_count: 5, recovered_count: 2, recovered_total: 30 }

  it('hands the table the map and the open rule\'s panel its own entry and a retry', async () => {
    const statsByRule = { 1: entry, 2: { loading: true, error: null } }
    renderPage({ statsByRule, reloadRuleStats: vi.fn() })
    expect(seen.table.statsByRule).toBe(statsByRule)
    await click('Open 2')
    expect(seen.panel.stats).toBe(statsByRule[2])
    seen.panel.onRetryStats()
    expect(ctl.props.reloadRuleStats).toHaveBeenCalledWith(2)
  })

  it('asks once for a rule opened through ?id= that has no entry, and does not ask again when it re-renders', () => {
    renderPage({ statsByRule: { 1: entry }, reloadRuleStats: vi.fn() }, `${ROUTE}?id=7`)
    expect(ctl.props.reloadRuleStats).toHaveBeenCalledTimes(1)
    expect(ctl.props.reloadRuleStats).toHaveBeenCalledWith(7)
    view.update({ statsByRule: { 1: entry } })
    expect(ctl.props.reloadRuleStats).toHaveBeenCalledTimes(1)
  })

  it('waits for the page before it asks: a rule that is on the page gets its results with it', () => {
    renderPage({ recoveryActionList: { actions: [], loading: true, error: null }, statsByRule: {}, reloadRuleStats: vi.fn() }, `${ROUTE}?id=7`)
    expect(ctl.props.reloadRuleStats).not.toHaveBeenCalled()
    view.update({ recoveryActionList: { actions: [], loading: false, error: null } })
    expect(ctl.props.reloadRuleStats).toHaveBeenCalledTimes(1)
    expect(ctl.props.reloadRuleStats).toHaveBeenCalledWith(7)
  })

  it('stops asking once the entry exists, even a failed one', () => {
    renderPage({ statsByRule: {}, reloadRuleStats: vi.fn() }, `${ROUTE}?id=7`)
    view.update({ statsByRule: { 7: { loading: false, error: ['x'] } } })
    expect(ctl.props.reloadRuleStats).toHaveBeenCalledTimes(1)
  })

  it('does not ask for a rule that has an entry, nor in create mode', async () => {
    renderPage({ statsByRule: { 2: entry }, reloadRuleStats: vi.fn() }, `${ROUTE}?id=2`)
    expect(ctl.props.reloadRuleStats).not.toHaveBeenCalled()
    view.unmount()
    renderPage({ statsByRule: {}, reloadRuleStats: vi.fn() })
    await click('New rule')
    expect(screen.getByText('Panel of new')).toBeInTheDocument()
    expect(seen.panel.stats).toBeUndefined()
    expect(ctl.props.reloadRuleStats).not.toHaveBeenCalled()
  })

  it('renders without the controller\'s stats props', async () => {
    renderPage({ statsByRule: undefined, reloadRuleStats: undefined }, `${ROUTE}?id=7`)
    expect(screen.getByText('Panel of 7')).toBeInTheDocument()
    expect(seen.panel.stats).toBeUndefined()
    seen.panel.onRetryStats()
  })
})
