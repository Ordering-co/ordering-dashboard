// a folded category keeps its service checkboxes out of the Tab order (inert), so Space cannot tick one that is not seen
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfessionalCategoryTreeNode } from '..'

const category = {
  id: 1,
  name: 'Strips',
  products: [{ id: 131, name: '3 Piece Strips' }, { id: 132, name: '4 Piece Strips' }],
  subcategories: [{ id: 2, name: 'Meals', parent_category_id: 1, products: [{ id: 140, name: 'Strips Meal' }], subcategories: [] }]
}
const subCategoriesList = [{ id: 1, productIds: [131, 132, 140] }, { id: 2, productIds: [140] }]

const renderNode = (props = {}) => {
  const spies = { handleCreateService: vi.fn(), handleDeleteService: vi.fn() }
  render(
    <ThemeProvider theme={{ colors: {}, images: {} }}>
      <ProfessionalCategoryTreeNode
        category={category}
        index={0}
        selectedProductsIds={[]}
        subCategoriesList={subCategoriesList}
        {...spies}
        {...props}
      />
    </ThemeProvider>
  )
  return spies
}
const content = (name) => screen.getByRole('button', { name }).nextElementSibling

afterEach(cleanup)

describe('ProfessionalCategoryTreeNode folded categories', () => {
  it('a folded category is inert: its checkboxes (and its subcategories) are out of reach', () => {
    renderNode()
    const header = screen.getByRole('button', { name: 'Strips' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(content('Strips')).toHaveAttribute('inert')
  })

  it('opening it removes inert; folding it again puts it back', async () => {
    const user = userEvent.setup()
    renderNode()
    await user.click(screen.getByRole('button', { name: 'Strips' }))
    expect(content('Strips')).not.toHaveAttribute('inert')
    // the subcategory inside is folded on its own
    expect(content('Meals')).toHaveAttribute('inert')
    await user.click(screen.getByRole('button', { name: 'Strips' }))
    expect(content('Strips')).toHaveAttribute('inert')
  })

  it('a search opens it, so its matches are reachable', () => {
    renderNode({ searchValue: 'strips' })
    expect(content('Strips')).not.toHaveAttribute('inert')
  })

  it('an open category still ticks a service as before', async () => {
    const user = userEvent.setup()
    const spies = renderNode()
    await user.click(screen.getByRole('button', { name: 'Strips' }))
    await user.click(screen.getByRole('checkbox', { name: '3 Piece Strips' }))
    expect(spies.handleCreateService).toHaveBeenCalledWith(131)
  })
})
