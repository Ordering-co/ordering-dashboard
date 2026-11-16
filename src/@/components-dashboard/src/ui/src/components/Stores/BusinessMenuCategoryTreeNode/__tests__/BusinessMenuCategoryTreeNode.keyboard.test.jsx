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
  subcategories: []
}

const renderNode = (selectedProductsIds = []) => {
  const props = {
    category,
    index: 0,
    selectedProductsIds,
    setSelectedProductsIds: vi.fn(),
    selectedProducts: undefined,
    setSelectedProducts: vi.fn(),
    subCategoriesList: [{ id: 10, productIds: [101, 102] }]
  }
  renderWithProviders(<BusinessMenuCategoryTreeNode {...props} />)
  return props
}

describe('BusinessMenuCategoryTreeNode checkboxes', () => {
  it('exposes each product as a named checkbox with its exact state', () => {
    renderNode([101])

    const selected = screen.getByRole('checkbox', { name: 'Club sandwich' })
    const unselected = screen.getByRole('checkbox', { name: 'Veggie wrap' })
    expect(selected.tagName).toBe('BUTTON')
    expect(selected.getAttribute('type')).toBe('button')
    expect(selected.getAttribute('aria-checked')).toBe('true')
    expect(unselected.getAttribute('aria-checked')).toBe('false')
    expect(selected.querySelector('svg').getAttribute('aria-hidden')).toBe('true')
  })

  it('toggles a product with Space and with Enter', async () => {
    const user = userEvent.setup()
    const props = renderNode([])

    screen.getByRole('checkbox', { name: 'Club sandwich' }).focus()
    await user.keyboard(' ')
    expect(props.setSelectedProductsIds).toHaveBeenLastCalledWith([101])

    screen.getByRole('checkbox', { name: 'Veggie wrap' }).focus()
    await user.keyboard('{Enter}')
    expect(props.setSelectedProductsIds).toHaveBeenLastCalledWith([102])
    expect(props.setSelectedProductsIds).toHaveBeenCalledTimes(2)
  })

  it('exposes the category as a checkbox that is mixed when only some products are selected', async () => {
    const user = userEvent.setup()
    const props = renderNode([101])

    const all = screen.getByRole('checkbox', { name: 'Sandwiches' })
    expect(all.getAttribute('aria-checked')).toBe('mixed')

    all.focus()
    await user.keyboard(' ')
    expect(props.setSelectedProductsIds).toHaveBeenCalledTimes(1)
    expect(props.setSelectedProductsIds).toHaveBeenLastCalledWith([101, 102])
  })

  it('reports the category checked only when every product is selected', () => {
    renderNode([101, 102])
    expect(screen.getByRole('checkbox', { name: 'Sandwiches' }).getAttribute('aria-checked')).toBe('true')
  })

  it('does not expand or collapse the accordion when the category checkbox is activated', async () => {
    const user = userEvent.setup()
    renderNode([])

    const content = screen.getByRole('checkbox', { name: 'Club sandwich' }).closest('div[style]')
    expect(content.style.maxHeight).toBe('0px')
    screen.getByRole('checkbox', { name: 'Sandwiches' }).focus()
    await user.keyboard(' ')
    expect(content.style.maxHeight).toBe('0px')
  })
})

// jsdom does not implement `inert`, so user-event would still Tab into an inert subtree
// where a real browser skips it. Walk the tab order with user-event and drop every stop
// inside an `[inert]` ancestor: what is left is what a browser would let Tab reach, and it
// depends on the component actually setting the attribute.
const tabStopsFrom = async (user, start, presses = 6) => {
  start.focus()
  const stops = []
  for (let i = 0; i < presses; i++) {
    await user.tab()
    const active = document.activeElement
    if (active !== document.body && !active.closest('[inert]')) stops.push(active.getAttribute('aria-label'))
  }
  return stops
}

describe('BusinessMenuCategoryTreeNode expander', () => {
  const expander = () => screen.getByRole('button', { name: 'Sandwiches' })

  it('exposes the expander as a native button wired to the content it controls', () => {
    renderNode([])

    expect(expander().tagName).toBe('BUTTON')
    expect(expander().getAttribute('type')).toBe('button')
    expect(expander().getAttribute('aria-expanded')).toBe('false')
    const content = document.getElementById(expander().getAttribute('aria-controls'))
    expect(content).not.toBeNull()
    expect(content.contains(screen.getByRole('checkbox', { name: 'Club sandwich', hidden: true }))).toBe(true)
    expect(expander().querySelector('svg').getAttribute('aria-hidden')).toBe('true')
  })

  it('does not nest the expander in, or around, the category checkbox', () => {
    renderNode([])

    const category = screen.getByRole('checkbox', { name: 'Sandwiches' })
    expect(expander().contains(category)).toBe(false)
    expect(category.contains(expander())).toBe(false)
  })

  it('keeps the products out of the tab order while the category is collapsed', async () => {
    const user = userEvent.setup()
    renderNode([])

    const content = document.getElementById(expander().getAttribute('aria-controls'))
    expect(content.hasAttribute('inert')).toBe(true)

    const stops = await tabStopsFrom(user, screen.getByRole('checkbox', { name: 'Sandwiches' }))
    expect(stops).toContain('Sandwiches')
    expect(stops).not.toContain('Club sandwich')
    expect(stops).not.toContain('Veggie wrap')
  })

  it('opens with Enter: aria-expanded flips and Tab now reaches the products', async () => {
    const user = userEvent.setup()
    renderNode([])

    expander().focus()
    await user.keyboard('{Enter}')

    expect(expander().getAttribute('aria-expanded')).toBe('true')
    const content = document.getElementById(expander().getAttribute('aria-controls'))
    expect(content.hasAttribute('inert')).toBe(false)
    expect(content.style.maxHeight).toBe('')

    const stops = await tabStopsFrom(user, expander(), 2)
    expect(stops).toEqual(['Club sandwich', 'Veggie wrap'])
  })

  it('closes again with Space and takes the products back out of the tab order', async () => {
    const user = userEvent.setup()
    renderNode([])

    expander().focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(expander().getAttribute('aria-expanded')).toBe('false')
    const content = document.getElementById(expander().getAttribute('aria-controls'))
    expect(content.hasAttribute('inert')).toBe(true)
    const stops = await tabStopsFrom(user, expander())
    expect(stops).not.toContain('Club sandwich')
    expect(stops).not.toContain('Veggie wrap')
  })
})
