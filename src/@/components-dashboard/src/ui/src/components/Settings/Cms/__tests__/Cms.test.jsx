import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ addQueryToUrl: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  PagesList: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../../../utils', () => ({
  addQueryToUrl: mocks.addQueryToUrl
}))

// The page editor: it shows which page it edits and offers its own cancel, as PageForm does.
vi.mock('../../PageForm', () => ({
  PageForm: ({ pageId, handleCancel }) => (
    <div data-testid='page-form' data-page-id={String(pageId)}>
      <button type='button' onClick={handleCancel}>Cancel editor</button>
    </div>
  )
}))

vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => (open ? <div role='dialog' aria-label='Page editor'>{children}</div> : null)
}))

import { Cms } from '../index'

const pages = [
  { id: 11, name: 'About us', enabled: true },
  { id: 12, name: 'Terms and conditions', enabled: false }
]

const manyPages = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: `Page ${i + 1}`, enabled: true }))

const renderCms = (overrides = {}) => {
  const props = {
    avoidExpand: true,
    pagesListState: { loading: false, pages, error: null },
    handleChangeState: vi.fn(),
    handleUpdatePageList: vi.fn(),
    handleDeletePage: vi.fn(),
    ...overrides
  }
  renderWithProviders(<Cms {...props} />)
  return props
}

const openRowMenu = async (user, name) => {
  await user.click(screen.getByRole('button', { name: `Actions for ${name}` }))
  return screen.findByRole('menu')
}

beforeEach(() => {
  mocks.addQueryToUrl.mockClear()
})

// Website pages on the Product pieces, with the actions of main.
describe('Settings › Website pages on Product', () => {
  it('prints no title of its own inside the hub (the hub prints it)', () => {
    renderCms()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByText('Static Pages Manager')).not.toBeInTheDocument()
  })

  it('keeps its title and menu button when it is not inside the hub', () => {
    renderCms({ avoidExpand: false })
    expect(screen.getByRole('heading', { level: 1, name: 'Static Pages Manager' })).toBeInTheDocument()
  })

  it('«Add page» is a primary Product button that opens the editor for a new page', async () => {
    const user = userEvent.setup()
    renderCms()
    const add = screen.getByRole('button', { name: 'Add page' })
    expect(add).toHaveClass('odc-btn')
    expect(add).toHaveAttribute('data-variant', 'primary')

    await user.click(add)
    expect(screen.getByTestId('page-form')).toHaveAttribute('data-page-id', 'null')
  })

  it('«Add new static page» below the list opens the editor for a new page too', async () => {
    const user = userEvent.setup()
    renderCms()
    const link = screen.getByRole('button', { name: 'Add new static page' })
    expect(link).toHaveClass('odc-btn')
    await user.click(link)
    expect(screen.getByTestId('page-form')).toHaveAttribute('data-page-id', 'null')
  })

  it('a row click opens the editor for that page and the editor closes with its cancel', async () => {
    const user = userEvent.setup()
    renderCms()
    await user.click(screen.getByText('Terms and conditions'))
    expect(screen.getByTestId('page-form')).toHaveAttribute('data-page-id', '12')

    await user.click(screen.getByRole('button', { name: 'Cancel editor' }))
    expect(screen.queryByTestId('page-form')).not.toBeInTheDocument()
  })

  it('the search is a labelled Product search field that filters the pages and clears', async () => {
    const user = userEvent.setup()
    renderCms()
    const search = screen.getByRole('searchbox', { name: 'Search' })

    await user.type(search, 'terms')
    expect(screen.queryByText('About us')).not.toBeInTheDocument()
    expect(screen.getByText('Terms and conditions')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(search).toHaveValue('')
    expect(screen.getByText('About us')).toBeInTheDocument()
  })

  it('says so when a search finds no page, and not when it does', async () => {
    const user = userEvent.setup()
    renderCms()
    expect(screen.queryByText('No results found')).not.toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz')

    expect(await screen.findByRole('status')).toHaveTextContent('No results found')
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument()
  })

  it('names each Enable switch after its page and toggles the page enabled state', async () => {
    const user = userEvent.setup()
    const { handleChangeState } = renderCms()
    expect(screen.getByRole('switch', { name: 'Enable: About us' })).toBeChecked()
    const terms = screen.getByRole('switch', { name: 'Enable: Terms and conditions' })
    expect(terms).not.toBeChecked()

    await user.click(terms)
    expect(handleChangeState).toHaveBeenCalledWith(12, 'enabled', true)
    expect(screen.queryByTestId('page-form')).not.toBeInTheDocument()
  })

  it('the row menu is named after its page and offers Edit and Delete', async () => {
    const user = userEvent.setup()
    renderCms()
    const menu = await openRowMenu(user, 'About us')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Edit', 'Delete'])

    await user.click(within(menu).getByRole('menuitem', { name: 'Edit' }))
    expect(screen.getByTestId('page-form')).toHaveAttribute('data-page-id', '11')
  })

  it('Delete asks first; Cancel keeps the page', async () => {
    const user = userEvent.setup()
    const { handleDeletePage } = renderCms()
    await openRowMenu(user, 'About us')
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Are you sure that you want to delete this page?' })
    expect(handleDeletePage).not.toHaveBeenCalled()
    expect(screen.queryByTestId('page-form')).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(handleDeletePage).not.toHaveBeenCalled()
  })

  it('«Delete page» deletes that page once', async () => {
    const user = userEvent.setup()
    const { handleDeletePage } = renderCms()
    await openRowMenu(user, 'Terms and conditions')
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete page' }))

    expect(handleDeletePage).toHaveBeenCalledTimes(1)
    expect(handleDeletePage).toHaveBeenCalledWith(12)
  })

  it('paginates with the Product foot: 10 per page by default, next page, and the page in the URL', async () => {
    const user = userEvent.setup()
    renderCms({ pagesListState: { loading: false, pages: manyPages, error: null } })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(screen.getByText('Page 10')).toBeInTheDocument()
    expect(screen.queryByText('Page 11')).not.toBeInTheDocument()

    await user.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 11')).toBeInTheDocument()
    expect(screen.queryByText('Page 1')).not.toBeInTheDocument()
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ page: 2, pageSize: 10 })
  })

  it('offers the page sizes of main (10, 25, 50)', async () => {
    const user = userEvent.setup()
    renderCms({ pagesListState: { loading: false, pages: manyPages, error: null } })
    await user.click(screen.getByRole('button', { name: /Items per page/ }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitemradio').map(item => item.textContent)).toEqual(['10', '25', '50'])

    await user.click(within(menu).getByRole('menuitemradio', { name: '25' }))
    expect(screen.getByText('Page 12')).toBeInTheDocument()
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ page: 1, pageSize: 25 })
  })

  it('shows loading rows while the pages load, with no foot', () => {
    renderCms({ pagesListState: { loading: true, pages: [], error: null } })
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add new static page' })).not.toBeInTheDocument()
  })

  it('uses no legacy control', () => {
    renderCms()
    expect(document.querySelector('.dropdown, .dropdown-toggle, .btn')).toBeNull()
  })
})
