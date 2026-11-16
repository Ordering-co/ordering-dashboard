/* eslint-disable import/first */
// redesign (lot B): the table of the sites of /ordering-products (Product, Code, URL; cards under 768px).
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({ phone: false }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))

import { SitesTable } from '../SitesTable'

const WEBSITE = { id: 1, name: 'Marketplace', code: 'website', description: 'The main site', url: 'https://shop.example.com' }
const TWIN_A = { id: 2, name: 'orderingplus', code: 'orderingplus-a', description: null, url: null }
const TWIN_B = { id: 3, name: 'orderingplus', code: 'orderingplus-b', description: '', url: '' }

const renderTable = (props = {}) => render(
  <SitesTable sites={[WEBSITE, TWIN_A, TWIN_B]} loading={false} onOpen={() => {}} {...props} />
)

beforeEach(() => { probe.phone = false })

describe('SitesTable · the table', () => {
  it('has the columns Product, Code and URL, in that order', () => {
    renderTable()
    expect(screen.getAllByRole('columnheader').map(node => node.textContent.trim())).toEqual(['Product', 'Code', 'Url'])
  })

  it('puts the description under the name, in the same cell', () => {
    renderTable()
    const row = screen.getByRole('row', { name: /Marketplace/ })
    const cell = within(row).getByRole('rowheader')
    expect(within(cell).getByRole('button', { name: 'Marketplace, View details' })).toBeInTheDocument()
    expect(within(cell).getByText('The main site')).toBeInTheDocument()
  })

  it('draws the code in mono, left to right, and the url as it comes', () => {
    renderTable()
    const row = screen.getByRole('row', { name: /Marketplace/ })
    const code = within(row).getByText('website')
    expect(code).toHaveClass('odc-op-code')
    expect(code).toHaveAttribute('dir', 'ltr')
    expect(within(row).getByText('https://shop.example.com')).toHaveAttribute('dir', 'ltr')
  })

  it('says a dash where a site has no url', () => {
    renderTable()
    // the two twins have no url: a dash each (the description of none is not drawn)
    expect(within(screen.getByRole('row', { name: /orderingplus-a/ })).getByText('—')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /orderingplus-b/ })).getByText('—')).toBeInTheDocument()
  })

  it('tells two sites with the same name apart by their code (OP-05)', () => {
    renderTable()
    expect(screen.getAllByRole('button', { name: 'orderingplus, View details' })).toHaveLength(2)
    expect(screen.getByText('orderingplus-a')).toBeInTheDocument()
    expect(screen.getByText('orderingplus-b')).toBeInTheDocument()
  })

  it('opens a site with Enter on its focused row (OP-04)', async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    renderTable({ onOpen })
    const row = screen.getByRole('row', { name: /orderingplus-b/ })
    act(() => { row.focus() })
    await user.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith(TWIN_B)
  })

  it('opens a site with a click on the name button, once', async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    renderTable({ onOpen })
    await user.click(screen.getByRole('button', { name: 'Marketplace, View details' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith(WEBSITE)
  })

  it('marks the open site as the current row', () => {
    renderTable({ activeId: 2 })
    expect(screen.getByRole('row', { name: /orderingplus-a/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('row', { name: /Marketplace/ })).not.toHaveAttribute('aria-current')
  })

  it('paints as many loading rows as the page size', () => {
    const { container } = renderTable({ sites: [], loading: true, skeletonRows: 4 })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(4)
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })
})

describe('SitesTable · empty', () => {
  it('says «No results found» for a search, with no button', () => {
    renderTable({ sites: [], searching: true, onAdd: () => {} })
    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add product' })).toBeNull()
  })

  it('says «No products found.» with «Add product» when there is no search', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    renderTable({ sites: [], onAdd })
    expect(screen.getByText('No products found.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})

describe('SitesTable · under 768px', () => {
  beforeEach(() => { probe.phone = true })

  it('draws cards with the name, the code and the url, and the description', () => {
    renderTable()
    expect(screen.getByRole('list', { name: 'Ordering products' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Marketplace, View details' })
    const card = link.closest('li')
    expect(card.textContent.replace(/\s+/g, ' ')).toContain('website · https://shop.example.com')
    expect(within(card).getByText('The main site')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('tells the twins apart by their code in the cards', () => {
    renderTable()
    expect(screen.getByText('orderingplus-a')).toBeInTheDocument()
    expect(screen.getByText('orderingplus-b')).toBeInTheDocument()
  })

  it('opens a site from its card', async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    renderTable({ onOpen })
    await user.click(screen.getByRole('link', { name: 'Marketplace, View details' }))
    expect(onOpen).toHaveBeenCalledWith(WEBSITE)
  })
})
