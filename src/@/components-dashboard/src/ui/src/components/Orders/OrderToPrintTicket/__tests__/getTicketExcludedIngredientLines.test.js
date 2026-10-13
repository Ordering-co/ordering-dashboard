import { describe, expect, it } from 'vitest'

import { getTicketExcludedIngredientLines } from '../getTicketExcludedIngredientLines'

const t = (key, fallback) => fallback

describe('getTicketExcludedIngredientLines', () => {
  it('prints No {name} for unselected ingredients', () => {
    const lines = getTicketExcludedIngredientLines([
      { id: 1, name: 'Onion', selected: false },
      { id: 2, name: 'Cheese', selected: true },
      { id: 3, name: 'Pickles', selected: false }
    ], t)

    expect(lines).toEqual(['No Onion', 'No Pickles'])
  })

  it('returns an empty list when every ingredient is selected', () => {
    expect(getTicketExcludedIngredientLines([
      { id: 1, name: 'Onion', selected: true }
    ], t)).toEqual([])
  })

  it('returns an empty list when ingredients are missing', () => {
    expect(getTicketExcludedIngredientLines(undefined, t)).toEqual([])
    expect(getTicketExcludedIngredientLines(null, t)).toEqual([])
    expect(getTicketExcludedIngredientLines([], t)).toEqual([])
  })
})
