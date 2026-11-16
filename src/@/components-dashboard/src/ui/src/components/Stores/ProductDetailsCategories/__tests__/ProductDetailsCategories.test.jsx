/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'

// (D-9 c): a refused move of the product to another category says so in the section, with the API's text; the next
// attempt clears it. The tree (BusinessProductsCategories) is a stub with one button that moves the product to category 7.
vi.mock('~components', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback ?? key]
}))
vi.mock('../../BusinessProductsCategories', () => ({
  BusinessProductsCategories: ({ handleUpdateClickProduct }) => (
    <button type='button' onClick={() => handleUpdateClickProduct({ category_id: 7 }, { refreshProducts: true })}>Move to Pizzas</button>
  )
}))

import { ProductDetailsCategories } from '../index'

const theme = { colors: { headingColor: '#111' } }

const renderSection = (handleUpdateClick) => {
  render(
    <ThemeProvider theme={theme}>
      <ProductDetailsCategories product={{ id: 42 }} business={{ id: 1 }} productState={{ product: { id: 42, category: { id: 3 } } }} handleUpdateClick={handleUpdateClick} />
    </ThemeProvider>
  )
}

describe('ProductDetailsCategories · a refused move', () => {
  it('shows the error with the API text, and passes the move and its answer through', async () => {
    const handleUpdateClick = vi.fn(async () => ({ ok: false, error: ['The category does not exist'] }))
    renderSection(handleUpdateClick)
    await userEvent.click(screen.getByRole('button', { name: 'Move to Pizzas' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The product was not moved.')
    expect(alert).toHaveTextContent('The category does not exist')
    expect(handleUpdateClick).toHaveBeenCalledWith({ category_id: 7 }, { refreshProducts: true })
  })

  it('without a text from the API it still says the product was not moved', async () => {
    renderSection(vi.fn(async () => ({ ok: false, error: undefined })))
    await userEvent.click(screen.getByRole('button', { name: 'Move to Pizzas' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/^The product was not moved\.$/)
  })

  it('the next attempt clears the error; a good move shows none', async () => {
    const handleUpdateClick = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: ['Nope'] })
      .mockResolvedValueOnce({ ok: true })
    renderSection(handleUpdateClick)
    await userEvent.click(screen.getByRole('button', { name: 'Move to Pizzas' }))
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Move to Pizzas' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
