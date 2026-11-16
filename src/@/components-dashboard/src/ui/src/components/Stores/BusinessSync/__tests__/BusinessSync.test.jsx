/* eslint-disable import/first */
// redesign stores 3.D, order 2.1: the Sync content (tabs Deliverect / ItsaCheckmate / synced stores) on the Product
// wrappers, its Sheet, and the two provider pages. The synced-stores body is a stand-in (another order owns it); the tabs, the
// URL contract, the Sheet and the provider pages are the real pieces.
import React from 'react'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ storeProps: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../../../utils', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, addQueryToUrl: vi.fn() }
})
vi.mock('../../BusinessSyncStore', () => ({
  BusinessSyncStore: (props) => {
    mockState.storeProps = props
    return <div data-testid='sync-store' />
  }
}))

import { addQueryToUrl } from '../../../../utils'
import { BusinessSync, BusinessSyncSheet } from '..'
import { BusinessSyncBasic } from '../../BusinessSyncBasic'
import { BusinessSyncItsaCheckmate } from '../../BusinessSyncItsaCheckmate'

const HERE = __dirname
// read on demand, so a missing sheet fails the tests that need it and not the whole file
const readCss = () => readFileSync(path.resolve(HERE, '../business-sync.css'), 'utf8')
const STORES = path.resolve(HERE, '../..')

const theme = { images: { general: { deliverect: 'deliverect.png', ItsaCheckmateLogo: 'itsa.png' } } }

const DELIVERECT_FORM = 'https://share.hsforms.com/1uGzNQ71IS2KXCAFC0mTBCg3neff'
const ITSA_FORM = 'https://share.hsforms.com/1vuXwaFtfTTeZf362zJgqSg3neff'

// the component reads the address bar (the app writes `?tab=` with history.replaceState, which the router never sees), so the
// entry is set there and also given to the router
const mount = (ui, entry = '/stores/list?header=sync') => {
  window.history.replaceState(null, '', entry)
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
    </ThemeProvider>
  )
}

const selectedTabs = () => screen.queryAllByRole('tab').filter(tab => tab.getAttribute('aria-selected') === 'true')

beforeEach(() => {
  addQueryToUrl.mockClear()
  mockState.storeProps = null
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  document.getElementById('app-modals')?.remove()
})

describe('BusinessSync: tabs and URL', () => {
  it('opens on Deliverect and writes tab=deliverect when the URL has no tab', () => {
    const move = vi.fn()
    mount(<BusinessSync handleParentSidebarMove={move} />)
    expect(addQueryToUrl).toHaveBeenCalledTimes(1)
    expect(addQueryToUrl).toHaveBeenCalledWith({ tab: 'deliverect' })
    expect(move).toHaveBeenCalledWith(0)
    expect(screen.getByRole('tablist', { name: 'Sync with' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Deliverect' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'ItsaCheckmate' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('link', { name: 'Send Form' })).toHaveAttribute('href', DELIVERECT_FORM)
  })

  it('opens the tab of the URL without rewriting it', () => {
    const move = vi.fn()
    mount(<BusinessSync handleParentSidebarMove={move} />, '/stores/list?header=sync&tab=itsacheckmate')
    expect(addQueryToUrl).not.toHaveBeenCalled()
    expect(move).toHaveBeenCalledWith(0)
    expect(screen.getByRole('tab', { name: 'ItsaCheckmate' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Deliverect' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('link', { name: 'Send Form' })).toHaveAttribute('href', ITSA_FORM)
  })

  it('writes ?tab= when the tab changes, and shows that body', async () => {
    const user = userEvent.setup()
    const move = vi.fn()
    mount(<BusinessSync handleParentSidebarMove={move} />)
    addQueryToUrl.mockClear()
    move.mockClear()

    await user.click(screen.getByRole('tab', { name: 'ItsaCheckmate' }))
    expect(addQueryToUrl).toHaveBeenCalledTimes(1)
    expect(addQueryToUrl).toHaveBeenCalledWith({ tab: 'itsacheckmate' })
    expect(move).toHaveBeenCalledWith(0)
    expect(screen.getByRole('tab', { name: 'ItsaCheckmate' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('link', { name: 'Send Form' })).toHaveAttribute('href', ITSA_FORM)

    await user.click(screen.getByRole('tab', { name: 'Deliverect' }))
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'deliverect' })
    expect(screen.getByRole('link', { name: 'Send Form' })).toHaveAttribute('href', DELIVERECT_FORM)
  })

  it('mounts the synced stores for tab=synced_store with no tab marked, and hands them onDetailChange', () => {
    const move = vi.fn()
    mount(<BusinessSync handleParentSidebarMove={move} />, '/stores/list?header=sync&tab=synced_store')
    expect(screen.getByTestId('sync-store')).toBeInTheDocument()
    expect(selectedTabs()).toHaveLength(0)
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(addQueryToUrl).not.toHaveBeenCalled()
    expect(mockState.storeProps.handleParentSidebarMove).toBe(move)
    expect(mockState.storeProps.onDetailChange).toEqual(expect.any(Function))
    expect(screen.queryByRole('link', { name: 'Send Form' })).toBeNull()
  })

  it('shows no body for an unknown tab, as before', () => {
    mount(<BusinessSync handleParentSidebarMove={vi.fn()} />, '/stores/list?header=sync&tab=nope')
    expect(addQueryToUrl).not.toHaveBeenCalled()
    expect(selectedTabs()).toHaveLength(0)
    expect(screen.queryByRole('link', { name: 'Send Form' })).toBeNull()
    expect(screen.queryByTestId('sync-store')).toBeNull()
  })

  // redesign bugs F row 26: addQueryToUrl / removeQueryToUrl write with history.replaceState, which the router never
  // sees. Closing Sync unmounts it with the router still holding the old `?tab=`, so the remount must read the real address bar.
  it('reopens on the default tab when the address bar lost its tab, even if the router still holds the old one', () => {
    window.history.replaceState(null, '', '/stores/list?header=sync&tab=itsacheckmate')
    const sync = <BusinessSync handleParentSidebarMove={vi.fn()} />
    const app = (children) => (
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/stores/list?header=sync&tab=itsacheckmate']}>{children}</MemoryRouter>
      </ThemeProvider>
    )
    const view = render(app(sync))
    expect(screen.getByRole('tab', { name: 'ItsaCheckmate' })).toHaveAttribute('aria-selected', 'true')
    expect(addQueryToUrl).not.toHaveBeenCalled()

    // closing: the sheet unmounts, and the app removes header and tab from the address bar with replaceState
    view.rerender(app(null))
    window.history.replaceState(null, '', '/stores/list?header=sync')

    view.rerender(app(sync))
    expect(screen.getByRole('tab', { name: 'Deliverect' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'ItsaCheckmate' })).toHaveAttribute('aria-selected', 'false')
    expect(addQueryToUrl).toHaveBeenCalledTimes(1)
    expect(addQueryToUrl).toHaveBeenCalledWith({ tab: 'deliverect' })
  })

  it('works without handleParentSidebarMove', () => {
    expect(() => mount(<BusinessSync />)).not.toThrow()
    expect(addQueryToUrl).toHaveBeenCalledWith({ tab: 'deliverect' })
  })

  it('keeps its own «Sync with» title in the legacy side bar', () => {
    mount(<BusinessSync handleParentSidebarMove={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Sync with' })).toBeInTheDocument()
  })
})

describe('BusinessSyncSheet', () => {
  it('is a dialog named «Sync with» whose only title is the sheet header', () => {
    mount(<BusinessSyncSheet open onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Sync with' })
    expect(dialog).toHaveClass('stores-sync-sheet')
    expect(within(dialog).getAllByRole('heading', { name: 'Sync with' })).toHaveLength(1)
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Deliverect' })).toBeInTheDocument()
    expect(dialog).not.toHaveAttribute('data-detail')
  })

  it('renders nothing while closed', () => {
    mount(<BusinessSyncSheet open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('calls onClose with Escape and with the close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mount(<BusinessSyncSheet open onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('doubles its width while the synced stores say their detail is beside the list', async () => {
    mount(<BusinessSyncSheet open onClose={vi.fn()} />, '/stores/list?header=sync&tab=synced_store')
    const dialog = screen.getByRole('dialog', { name: 'Sync with' })
    expect(dialog).not.toHaveAttribute('data-detail')

    act(() => mockState.storeProps.onDetailChange(true))
    await waitFor(() => expect(dialog).toHaveAttribute('data-detail', 'true'))

    act(() => mockState.storeProps.onDetailChange(false))
    await waitFor(() => expect(dialog).not.toHaveAttribute('data-detail', 'true'))

    // the rule that reads it, with no media query of its own (review r1 #2: the synced stores decide the width)
    expect(readCss()).toMatch(/\.stores-sync-sheet\[data-detail='true'\]\s*\{\s*inline-size:\s*calc\(var\(--od-x-sheet\) \* 2\)/)
    expect(readCss()).not.toMatch(/@media[^{]*\{[^@]*data-detail/)
  })

  it('forgets an open detail when the synced stores go away', async () => {
    const user = userEvent.setup()
    mount(<BusinessSyncSheet open onClose={vi.fn()} />, '/stores/list?header=sync&tab=synced_store')
    const dialog = screen.getByRole('dialog', { name: 'Sync with' })
    act(() => mockState.storeProps.onDetailChange(true))
    await waitFor(() => expect(dialog).toHaveAttribute('data-detail', 'true'))
    await user.click(screen.getByRole('tab', { name: 'Deliverect' }))
    await waitFor(() => expect(dialog).not.toHaveAttribute('data-detail', 'true'))
  })
})

describe('provider pages', () => {
  it.each([
    ['Deliverect', BusinessSyncBasic, DELIVERECT_FORM, 'Deliverect video', 'https://www.youtube.com/embed/_v8nPmW_E-0?playlist=_v8nPmW_E-0&loop=1'],
    ['ItsaCheckmate', BusinessSyncItsaCheckmate, ITSA_FORM, 'ItsaCheckmate video', 'https://www.youtube.com/embed/_caZDl4ZFp0?feature=oembed']
  ])('%s: «Send Form» is one link that looks like the primary button', (_name, Page, href) => {
    mount(<Page />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    const link = screen.getByRole('link', { name: 'Send Form' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveClass('odc-btn')
    expect(link).toHaveAttribute('data-variant', 'primary')
    expect(link.querySelector('button')).toBeNull()
    // the only button on the page is the video's Play facade; «Send Form» is not one
    expect(screen.getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual([expect.stringMatching(/^Play video: /)])
  })

  it.each([
    ['Deliverect', BusinessSyncBasic, 'Deliverect video', 'https://www.youtube.com/embed/_v8nPmW_E-0?playlist=_v8nPmW_E-0&loop=1'],
    ['ItsaCheckmate', BusinessSyncItsaCheckmate, 'ItsaCheckmate video', 'https://www.youtube.com/embed/_caZDl4ZFp0?feature=oembed']
  ])('%s: the video is a facade; pressing Play mounts the lazy, titled, autoplaying iframe and keeps 16:9 in CSS', async (_name, Page, title, src) => {
    const user = userEvent.setup()
    const { container } = mount(<Page />)
    expect(container.querySelector('iframe')).toBeNull()
    await user.click(screen.getByRole('button', { name: `Play video: ${title}` }))
    const frame = container.querySelector('iframe')
    expect(frame).toHaveAttribute('loading', 'lazy')
    expect(frame).toHaveAttribute('title', title)
    expect(frame).toHaveAttribute('src', `${src}${src.includes('?') ? '&' : '?'}autoplay=1`)
    expect(readCss()).toMatch(/aspect-ratio:\s*16\s*\/\s*9/)
  })

  it('Deliverect: logo, texts and the Delivery Manager app copy', () => {
    const { container } = mount(<BusinessSyncBasic />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'deliverect.png')
    expect(screen.getByText('The easiest way to manage all your online orders.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Get started right here' })).toBeInTheDocument()
    expect(screen.getByText('Fill up this form to request more information')).toBeInTheDocument()
    expect(container.textContent).toContain('Delivery Manager app')
    expect(container.textContent).not.toContain('Manger')
    expect(container.querySelectorAll('span')).toHaveLength(3)
  })

  it('ItsaCheckmate: logo, header, four bullets with the Product check icon', () => {
    const { container } = mount(<BusinessSyncItsaCheckmate />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'itsa.png')
    expect(container.querySelector('.stores-sync-lead strong')).toHaveTextContent('Ordering Platform Menus')
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveTextContent('86 items & modifiers')
    expect(items[3]).toHaveTextContent('Add, edit, or delete items')
    items.forEach(item => {
      const icon = item.querySelector('svg')
      expect(icon).toHaveClass('odc-icon')
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    })
  })
})

describe('no styled-components left in the Sync content', () => {
  it.each(['BusinessSync', 'BusinessSyncBasic', 'BusinessSyncItsaCheckmate'])('%s has no styles.js and does not import styled-components', (dir) => {
    expect(existsSync(path.join(STORES, dir, 'styles.js'))).toBe(false)
    const source = readFileSync(path.join(STORES, dir, 'index.js'), 'utf8')
    expect(source).not.toMatch(/from '\.\/styles'/)
    expect(source).not.toMatch(/\bstyled\./)
    expect(source).not.toMatch(/react-bootstrap-icons/)
    expect(source).not.toMatch(/from '\.\.\/\.\.\/\.\.\/styles'/)
  })
})
