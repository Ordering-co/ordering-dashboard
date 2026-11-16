/* eslint-disable import/first */
import React from 'react'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  removeProduct: vi.fn(),
  productForm: { current: null },
  confirm: { current: null }
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url, parsePrice: value => `$${Number(value ?? 0).toFixed(2)}` }],
  useOrder: () => [{}, { removeProduct: mocks.removeProduct }]
}))

vi.mock('../../../Shared', () => ({
  Confirm: props => {
    mocks.confirm.current = props
    return props.open ? <div role='alertdialog' aria-label='confirm'>{props.content}</div> : null
  }
}))

vi.mock('../ProductForm', () => ({
  ProductForm: props => {
    mocks.productForm.current = props
    return <div data-testid='product-form'>{props.isCartProduct ? 'editing' : 'adding'}</div>
  }
}))

import { SelectProducts } from '../SelectProducts'

const burger = { id: 10, name: 'Burger', price: 8, images: 'burger.png', category_id: 3 }
const fries = { id: 11, name: 'Fries', price: 3.5, images: null, category_id: 3 }
const cartLine = { id: 10, name: 'Burger', quantity: 2, total: 16, images: 'burger.png', maximum_per_order: 5, category_id: 3 }

const setup = (overrides = {}) => {
  const props = {
    productList: { loading: false, products: [burger, fries] },
    getProducts: vi.fn(),
    handeUpdateProductCart: vi.fn(),
    cart: { products: [cartLine] },
    business: { id: 5, slug: 'corner' },
    ...overrides
  }
  const view = renderWithProviders(<SelectProducts {...props} />)
  return { props, ...view, update: next => view.rerender(<SelectProducts {...props} {...next} />) }
}

const cartLine_ = name => within(screen.getByRole('list', { name: 'Items' })).getAllByRole('listitem').find(item => item.textContent.includes(name))

beforeEach(() => {
  mocks.removeProduct.mockClear()
  mocks.productForm.current = null
  mocks.confirm.current = null
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('SelectProducts · step content (5.5-B)', () => {
  it('shows a search and the products as rows with their price', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'What do you want us to buy?' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Select product' })
    const rows = within(list).getAllByRole('button')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Burger')
    expect(rows[0]).toHaveTextContent('$8.00')
    expect(rows[1]).toHaveTextContent('$3.50')
  })

  it('filters the list with the search and asks the server for more when few match, like before', async () => {
    const { props } = setup()
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'fri')
    const list = screen.getByRole('list', { name: 'Select product' })
    expect(within(list).queryByRole('button', { name: /Burger/ })).not.toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /Fries/ })).toBeInTheDocument()
    expect(props.getProducts).toHaveBeenLastCalledWith('fri')
    await user.clear(screen.getByRole('searchbox', { name: 'Search products' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'zzz')
    expect(screen.getByText('No products found.')).toBeInTheDocument()
  })

  it('is busy while the products load', () => {
    setup({ productList: { loading: true, products: undefined } })
    expect(screen.getByRole('list', { name: 'Select product' })).toHaveAttribute('aria-busy', 'true')
  })

  it('opens ProductForm in a Product dialog of the product name, with the same props, and closes it', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(within(screen.getByRole('list', { name: 'Select product' })).getByRole('button', { name: /Fries/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Fries' })
    expect(dialog).toHaveAttribute('data-size', 'md')
    expect(within(dialog).getByTestId('product-form')).toHaveTextContent('adding')
    const form = mocks.productForm.current
    expect(form).toMatchObject({
      isCartProduct: false,
      product: fries,
      productCart: null,
      businessSlug: 'corner',
      businessId: 5,
      categoryId: 3,
      productId: 11,
      productAddedToCartLength: 0
    })
    form.onSave()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fries' })).not.toBeInTheDocument())

    await user.click(within(screen.getByRole('list', { name: 'Select product' })).getByRole('button', { name: /Burger/ }))
    expect(mocks.productForm.current.productAddedToCartLength).toBe(2)
    await user.click(within(await screen.findByRole('dialog', { name: 'Burger' })).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Burger' })).not.toBeInTheDocument())
  })

  it('edits a cart line in the same dialog', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Edit product' }))
    const dialog = await screen.findByRole('dialog', { name: 'Burger' })
    expect(within(dialog).getByTestId('product-form')).toHaveTextContent('editing')
    expect(mocks.productForm.current).toMatchObject({ isCartProduct: true, product: null, productCart: cartLine, productId: 10 })
  })

  it('shows the cart lines with quantity steppers that keep the controller calls', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    const line = cartLine_('Burger')
    expect(within(line).getByText('Quantity')).toBeInTheDocument()
    expect(line).toHaveTextContent('2')
    expect(line).toHaveTextContent('$16.00')
    await user.click(within(line).getByRole('button', { name: 'Increase quantity' }))
    expect(props.handeUpdateProductCart).toHaveBeenLastCalledWith(cartLine, true)
    await user.click(within(line).getByRole('button', { name: 'Decrease quantity' }))
    expect(props.handeUpdateProductCart).toHaveBeenLastCalledWith(cartLine, false)
  })

  it('blocks the steppers at the limits, as before', () => {
    setup({ cart: { products: [{ ...cartLine, quantity: 1 }, { ...cartLine, id: 12, name: 'Soda', quantity: 3, maximum_per_order: 3 }] } })
    const burgerLine = cartLine_('Burger')
    const sodaLine = cartLine_('Soda')
    expect(within(burgerLine).getByRole('button', { name: 'Decrease quantity' })).toBeDisabled()
    expect(within(sodaLine).getByRole('button', { name: 'Increase quantity' })).toBeDisabled()
  })

  it('asks before deleting a cart line and removes it through the order context', async () => {
    const user = userEvent.setup()
    const cart = { products: [cartLine] }
    setup({ cart })
    await user.click(screen.getByRole('button', { name: 'Delete product' }))
    expect(mocks.confirm.current.open).toBe(true)
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Are you sure that you want to delete the product?')
    mocks.confirm.current.onAccept()
    expect(mocks.removeProduct).toHaveBeenCalledWith(cartLine, cart)
  })
})
