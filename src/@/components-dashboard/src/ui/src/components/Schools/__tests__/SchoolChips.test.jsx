/* eslint-disable import/first */
// redesign SC-B1 (M-SC05): allergens and dietary tags as words, not as database values.
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ catalog: {} }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text]
}))

import { SchoolChips } from '../SchoolChips'

beforeEach(() => { mockState.catalog = {} })
afterEach(cleanup)

const items = () => within(screen.getByRole('list')).getAllByRole('listitem')

describe('SchoolChips', () => {
  it('is a list named by label, one item per value, in the words of the catalog', () => {
    render(<SchoolChips kind='dietary' values={['gluten_free', 'low_sugar']} label='Dietary tags' />)
    expect(screen.getByRole('list', { name: 'Dietary tags' })).toBeInTheDocument()
    expect(items().map(item => item.textContent)).toEqual(['Gluten free', 'Low sugar'])
    expect(screen.queryByText('gluten_free')).toBeNull()
  })

  it('allergens are translated with the allergen map', () => {
    mockState.catalog = { SCHOOL_ALLERGEN_PEANUTS: 'Cacahuetes' }
    render(<SchoolChips kind='allergen' values={['peanuts', 'nuts']} label='Allergens' />)
    expect(items().map(item => item.textContent)).toEqual(['Cacahuetes', 'Nuts'])
  })

  it('marks allergens with the attention tone and leaves dietary tags neutral', () => {
    const { unmount } = render(<SchoolChips kind='allergen' values={['eggs']} label='Allergens' />)
    expect(items()[0]).toHaveClass('odc-school-chip')
    expect(items()[0]).toHaveAttribute('data-tone', 'warning')
    unmount()
    render(<SchoolChips kind='dietary' values={['vegan']} label='Dietary tags' />)
    expect(items()[0]).toHaveClass('odc-school-chip')
    expect(items()[0]).not.toHaveAttribute('data-tone')
  })

  it('a value the catalog does not know is shown as it came', () => {
    render(<SchoolChips kind='allergen' values={['lupin']} label='Allergens' />)
    expect(items().map(item => item.textContent)).toEqual(['lupin'])
  })

  it.each([[[]], [undefined], [null]])('with no values (%j) it shows the empty label, muted, and no list', (values) => {
    render(<SchoolChips kind='allergen' values={values} emptyLabel='None' label='Allergens' />)
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText('None')).toHaveClass('odc-school-chip-empty')
  })

  it('the empty label is a dash by default', () => {
    render(<SchoolChips kind='dietary' values={[]} label='Dietary tags' />)
    expect(screen.getByText('—')).toHaveClass('odc-school-chip-empty')
  })
})
