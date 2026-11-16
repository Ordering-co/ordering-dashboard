// redesign stores 5.5b: the optional props Basic uses for «Expand all» and the product search. Without them the
// node behaves as before (its keyboard tests); with them the open state and the listed products come from Basic.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import { BusinessMenuCategoryTreeNode } from '../index'

const category = {
  id: 10,
  name: 'Sandwiches',
  products: [
    { id: 101, name: 'Club sandwich' },
    { id: 102, name: 'Veggie wrap' }
  ],
  subcategories: [
    { id: 11, name: 'Hot', products: [{ id: 111, name: 'Melt' }], subcategories: [] }
  ]
}

const subCategoriesList = [
  { id: 10, productIds: [101, 102, 111] },
  { id: 11, productIds: [111] }
]

const renderNode = (extra = {}) => {
  const props = {
    category,
    index: 0,
    selectedProductsIds: [],
    setSelectedProductsIds: vi.fn(),
    selectedProducts: undefined,
    setSelectedProducts: vi.fn(),
    subCategoriesList,
    ...extra
  }
  const view = renderWithProviders(<BusinessMenuCategoryTreeNode {...props} />)
  return { props, ...view }
}

const expander = (name) => screen.getByRole('button', { name })
const contentOf = (name) => document.getElementById(expander(name).getAttribute('aria-controls'))

describe('BusinessMenuCategoryTreeNode · controlled open state (expandedIds)', () => {
  it('opens the categories in expandedIds and keeps the others closed', () => {
    renderNode({ expandedIds: new Set([10]), onToggleExpanded: vi.fn() })
    expect(expander('Sandwiches').getAttribute('aria-expanded')).toBe('true')
    expect(contentOf('Sandwiches').hasAttribute('inert')).toBe(false)
    expect(expander('Hot').getAttribute('aria-expanded')).toBe('false')
    expect(contentOf('Hot').hasAttribute('inert')).toBe(true)
  })

  it('asks Basic to toggle instead of toggling itself', async () => {
    const user = userEvent.setup()
    const onToggleExpanded = vi.fn()
    renderNode({ expandedIds: new Set(), onToggleExpanded })

    expander('Sandwiches').focus()
    await user.keyboard('{Enter}')
    expect(onToggleExpanded).toHaveBeenCalledWith(10)
    expect(expander('Sandwiches').getAttribute('aria-expanded')).toBe('false')
  })

  it('ignores the row and the chevron while searching (forceExpanded): the hidden open state stays as it was', async () => {
    const user = userEvent.setup()
    const onToggleExpanded = vi.fn()
    renderNode({ expandedIds: new Set([10]), onToggleExpanded, forceExpanded: true })

    expander('Sandwiches').focus()
    await user.keyboard('{Enter}')
    await user.click(expander('Hot'))
    expect(onToggleExpanded).not.toHaveBeenCalled()
    expect(expander('Sandwiches').getAttribute('aria-expanded')).toBe('true')
  })

  it('does not toggle when the category checkbox is used', async () => {
    const user = userEvent.setup()
    const onToggleExpanded = vi.fn()
    renderNode({ expandedIds: new Set(), onToggleExpanded })

    await user.click(screen.getByRole('checkbox', { name: 'Sandwiches' }))
    expect(onToggleExpanded).not.toHaveBeenCalled()
  })

  it('opens every category with forceExpanded', () => {
    renderNode({ expandedIds: new Set(), forceExpanded: true })
    expect(expander('Sandwiches').getAttribute('aria-expanded')).toBe('true')
    expect(expander('Hot').getAttribute('aria-expanded')).toBe('true')
  })
})

describe('BusinessMenuCategoryTreeNode · visibleProductIds', () => {
  it('lists only the visible products and the subcategories that still have one', () => {
    renderNode({ forceExpanded: true, visibleProductIds: new Set([102]) })
    expect(screen.getByRole('checkbox', { name: 'Veggie wrap' })).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'Club sandwich' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hot' })).toBeNull()
  })

  it('renders nothing when no descendant product is visible', () => {
    const { container } = renderNode({ forceExpanded: true, visibleProductIds: new Set([999]) })
    expect(container.querySelector('[role="checkbox"]')).toBeNull()
  })

  it('keeps the category checkbox acting on the whole category, as in main (S4)', async () => {
    const user = userEvent.setup()
    const { props } = renderNode({ forceExpanded: true, visibleProductIds: new Set([102]) })

    await user.click(screen.getByRole('checkbox', { name: 'Sandwiches' }))
    expect(props.setSelectedProductsIds).toHaveBeenLastCalledWith([101, 102, 111])
  })
})
