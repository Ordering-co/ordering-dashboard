// redesign (AD-8): the API returns the levels by id with no order field; the list shows them by the points that earn each one.
import { describe, expect, it } from 'vitest'

import { sortLevels } from '../levelOrder'

describe('sortLevels · the order of the levels (AD-8)', () => {
  it('orders by minimum_points ascending, as the live data needs (ids 1..5 named 1, 2, 4, 5, 3)', () => {
    const levels = [
      { id: 1, name: 'Level 1', minimum_points: 0 },
      { id: 2, name: 'Level 2', minimum_points: 10 },
      { id: 3, name: 'Level 4', minimum_points: 50 },
      { id: 4, name: 'Level 5', minimum_points: 100 },
      { id: 5, name: 'Level 3', minimum_points: 18 }
    ]
    expect(sortLevels(levels).map(level => level.name)).toEqual(['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'])
  })

  it('breaks a tie by id ascending', () => {
    const levels = [
      { id: 9, minimum_points: 10 },
      { id: 3, minimum_points: 10 },
      { id: 5, minimum_points: 10 }
    ]
    expect(sortLevels(levels).map(level => level.id)).toEqual([3, 5, 9])
  })

  it('compares numbers, not texts, and accepts numeric strings from the API', () => {
    const levels = [
      { id: 1, minimum_points: 100 },
      { id: 2, minimum_points: '9' },
      { id: 3, minimum_points: 18 }
    ]
    expect(sortLevels(levels).map(level => level.id)).toEqual([2, 3, 1])
  })

  it('puts a level without minimum_points (null, undefined or not a number) last, by id', () => {
    const levels = [
      { id: 4, minimum_points: null },
      { id: 2, minimum_points: 5 },
      { id: 3 },
      { id: 1, minimum_points: 'abc' },
      { id: 5, minimum_points: 0 }
    ]
    expect(sortLevels(levels).map(level => level.id)).toEqual([5, 2, 1, 3, 4])
  })

  it('does not mutate the list it receives', () => {
    const levels = [{ id: 2, minimum_points: 10 }, { id: 1, minimum_points: 0 }]
    const copy = [...levels]
    const result = sortLevels(levels)
    expect(levels).toEqual(copy)
    expect(levels[0]).toBe(copy[0])
    expect(result).not.toBe(levels)
  })

  it('returns an empty list for anything that is not a list', () => {
    expect(sortLevels(undefined)).toEqual([])
    expect(sortLevels(null)).toEqual([])
    expect(sortLevels([])).toEqual([])
  })
})
