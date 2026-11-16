/* eslint-disable import/first */
// bugs E D10 and D21 of the category list of the store catalog.
// D10: the global click listener was added as `listener = window.addEventListener(...)` (undefined) and «removed» with that undefined, so
// every render of the effect left one more listener on the window. D21: the header of the product layout that opens the category list was
// a div with onClick, out of the tab order.
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../SingleBusinessSubCateogries', () => ({
  SingleBusinessSubCateogries: ({ category }) => <div>{category?.name}</div>
}))
vi.mock('../../SingleBusinessSubCateogries/ProductLayout', () => ({
  SingleBusinessSubCateogries: ({ category }) => <div>{category?.name}</div>
}))

import { BusinessProductsCategories } from '../index'

const theme = { colors: { secundary: '#eee', lightPrimary: '#eef', primary: '#00f', backgroundPage: '#fff', secundaryLight: '#ccc', headingColor: '#000' } }
const businessState = { loading: false, business: { id: 1, categories: [{ id: 1, name: 'Mains', rank: 1 }, { id: 2, name: 'Drinks', rank: 2 }] } }

const draw = (props = {}) => render(
  <ThemeProvider theme={theme}>
    <BusinessProductsCategories businessState={businessState} handleChangeCategory={vi.fn()} {...props} />
  </ThemeProvider>
)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BusinessProductsCategories — the click listener on the window (D10)', () => {
  it('removes the very listener it added', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const categoryListRef = document.createElement('div')
    const { unmount } = draw({ categoryListRef })
    const added = add.mock.calls.filter(([type]) => type === 'click').map(([, fn]) => fn)
    expect(added).toHaveLength(1)
    unmount()
    const removed = remove.mock.calls.filter(([type]) => type === 'click').map(([, fn]) => fn)
    expect(removed).toEqual(added)
  })

  it('a click in the list area after unmounting no longer deselects the category', async () => {
    const categoryListRef = document.createElement('div')
    document.body.appendChild(categoryListRef)
    const handleChangeCategory = vi.fn()
    const { unmount } = draw({ categoryListRef, handleChangeCategory })
    await userEvent.click(categoryListRef)
    expect(handleChangeCategory).toHaveBeenCalledTimes(1)
    unmount()
    await userEvent.click(categoryListRef)
    expect(handleChangeCategory).toHaveBeenCalledTimes(1)
    categoryListRef.remove()
  })
})

describe('BusinessProductsCategories — the category picker of the product layout (D21)', () => {
  it('opens and closes the list from the keyboard, with a name and its state', async () => {
    draw({ productLayout: true, productCategorySelected: { id: 1, name: 'Mains' } })
    const trigger = screen.getByRole('button', { name: 'Mains' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByPlaceholderText('Search')).toBeNull()
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Mains' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument()
    await userEvent.keyboard(' ')
    expect(screen.queryByPlaceholderText('Search')).toBeNull()
  })

  it('still opens with a click', async () => {
    draw({ productLayout: true, productCategorySelected: { id: 1, name: 'Mains' } })
    await userEvent.click(screen.getByRole('button', { name: 'Mains' }))
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument()
  })

  it('has a name even before a category is chosen', () => {
    draw({ productLayout: true, productCategorySelected: null })
    expect(screen.getByRole('button', { name: 'Business category' })).toBeInTheDocument()
  })
})
