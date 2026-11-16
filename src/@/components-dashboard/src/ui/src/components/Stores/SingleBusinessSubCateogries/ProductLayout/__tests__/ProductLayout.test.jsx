/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'

// (D-9 c): moving a product to another category (Product details › Categories) closed the section and wrote
// ?category= even when the API refused the move, and left the new category ticked. It closes only on a good save now.
// The controller (SingleBusinessCategory) is a pass-through here: only the move is under test.
vi.mock('../../../../../../../index', () => ({
  SingleBusinessCategory: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

import { SingleBusinessSubCateogries } from '../index'

const theme = { colors: { secundary: '#eee', lightPrimary: '#eef', primary: '#00f', backgroundPage: '#fff' } }
const pizzas = { id: 7, name: 'Pizzas', enabled: true, subcategories: [] }
const drinks = { id: 3, name: 'Drinks', enabled: true }

const renderRow = (handleUpdateClickProduct) => {
  const props = {
    index: 0,
    category: pizzas,
    product: { id: 42 },
    productCategorySelected: drinks,
    setProductCategorySelected: vi.fn(),
    handleUpdateClickProduct,
    handleCloseExtraOpen: vi.fn()
  }
  render(<ThemeProvider theme={theme}><SingleBusinessSubCateogries {...props} /></ThemeProvider>)
  return props
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('ProductLayout · move a product to another category', () => {
  it('a refused move keeps the section open, writes no ?category= and ticks the category it had again', async () => {
    const props = renderRow(vi.fn(async () => ({ ok: false, error: ['The category does not exist'] })))
    await userEvent.click(screen.getByText('Pizzas'))
    await waitFor(() => expect(props.handleUpdateClickProduct).toHaveBeenCalledWith({ category_id: 7 }, { refreshProducts: true }))
    await waitFor(() => expect(props.setProductCategorySelected).toHaveBeenLastCalledWith(drinks))
    expect(props.handleCloseExtraOpen).not.toHaveBeenCalled()
    expect(window.location.search).not.toMatch(/category=/)
  })

  it('a good move writes ?category= and ?product= and closes the section, as before', async () => {
    const props = renderRow(vi.fn(async () => ({ ok: true })))
    await userEvent.click(screen.getByText('Pizzas'))
    await waitFor(() => expect(props.handleCloseExtraOpen).toHaveBeenCalledTimes(1))
    expect(props.setProductCategorySelected).toHaveBeenLastCalledWith(pizzas)
    expect(window.location.search).toMatch(/category=7/)
    expect(window.location.search).toMatch(/product=42/)
  })

  // bugs E D21: the radio was a span with onClick, out of the tab order and with no name
  it('the radio is a named, focusable radio that reports whether the product is in that category', async () => {
    renderRow(vi.fn(async () => ({ ok: true })))
    const radio = screen.getByRole('radio', { name: 'Pizzas' })
    expect(radio).toHaveAttribute('aria-checked', 'false')
    expect(radio).toHaveAttribute('tabindex', '0')
  })

  it('the ticked category is the checked radio', () => {
    const props = {
      index: 0,
      category: drinks,
      product: { id: 42 },
      productCategorySelected: drinks,
      setProductCategorySelected: vi.fn(),
      handleUpdateClickProduct: vi.fn()
    }
    render(<ThemeProvider theme={theme}><SingleBusinessSubCateogries {...props} /></ThemeProvider>)
    expect(screen.getByRole('radio', { name: 'Drinks' })).toHaveAttribute('aria-checked', 'true')
  })

  it.each([['{Enter}'], [' ']])('%j on the focused radio moves the product in one step, as the click does', async (key) => {
    const props = renderRow(vi.fn(async () => ({ ok: true })))
    screen.getByRole('radio', { name: 'Pizzas' }).focus()
    await userEvent.keyboard(key)
    await waitFor(() => expect(props.handleUpdateClickProduct).toHaveBeenCalledTimes(1))
    expect(props.handleUpdateClickProduct).toHaveBeenCalledWith({ category_id: 7 }, { refreshProducts: true })
    await waitFor(() => expect(props.handleCloseExtraOpen).toHaveBeenCalledTimes(1))
  })

  it('a refused move through the keyboard also ticks the previous category again', async () => {
    const props = renderRow(vi.fn(async () => ({ ok: false, error: ['No'] })))
    screen.getByRole('radio', { name: 'Pizzas' }).focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(props.setProductCategorySelected).toHaveBeenLastCalledWith(drinks))
    expect(props.handleCloseExtraOpen).not.toHaveBeenCalled()
  })
})
