// redesign J2 (, row 9, D-43 (a)): the reorder piece. Move up / Move down send the request the drag already sends: the rank of
// the previous or the next sibling, siblings sorted by rank. Ranks are unique per list but may have gaps.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { focusReorderTrigger, getReorderState, reorderMenuItems, reorderTriggerProps } from '../reorder'

const item = (id, rank) => ({ id, rank })

describe('getReorderState', () => {
  it('a middle sibling can move both ways, to the rank of each neighbour', () => {
    const state = getReorderState([item(1, 1), item(2, 2), item(3, 3)], 2)
    expect(state).toEqual({ canMoveUp: true, canMoveDown: true, upRank: 1, downRank: 3, canReorder: true })
  })

  it('the first sibling cannot move up', () => {
    const state = getReorderState([item(1, 1), item(2, 2), item(3, 3)], 1)
    expect(state.canMoveUp).toBe(false)
    expect(state.upRank).toBeNull()
    expect(state.canMoveDown).toBe(true)
    expect(state.downRank).toBe(2)
  })

  it('the last sibling cannot move down', () => {
    const state = getReorderState([item(1, 1), item(2, 2), item(3, 3)], 3)
    expect(state.canMoveDown).toBe(false)
    expect(state.downRank).toBeNull()
    expect(state.canMoveUp).toBe(true)
    expect(state.upRank).toBe(2)
  })

  it('uses the neighbour rank as it is when ranks have gaps', () => {
    const state = getReorderState([item(1, 3), item(2, 10), item(3, 40)], 2)
    expect(state.upRank).toBe(3)
    expect(state.downRank).toBe(40)
  })

  it('sorts by rank whatever the order of the input, and does not reorder the input', () => {
    const siblings = [item(3, 30), item(1, 10), item(2, 20)]
    const state = getReorderState(siblings, 1)
    expect(state).toMatchObject({ canMoveUp: false, canMoveDown: true, downRank: 20 })
    expect(siblings.map(s => s.id)).toEqual([3, 1, 2])
  })

  it('compares ids as text (a route or dataset id is a string)', () => {
    expect(getReorderState([item(1, 1), item(2, 2)], '2')).toMatchObject({ canMoveUp: true, upRank: 1 })
  })

  it('numeric ranks that arrive as text still sort as numbers', () => {
    const state = getReorderState([item(1, '9'), item(2, '10')], 1)
    expect(state).toMatchObject({ canMoveDown: true, downRank: 10 })
  })

  it('a lone sibling, an unknown id or no list cannot move', () => {
    const none = { canMoveUp: false, canMoveDown: false, upRank: null, downRank: null, canReorder: false }
    expect(getReorderState([item(1, 1)], 1)).toEqual(none)
    expect(getReorderState([item(1, 1), item(2, 2)], 99)).toEqual(none)
    expect(getReorderState(undefined, 1)).toEqual(none)
    expect(getReorderState(null, 1)).toEqual(none)
  })

  it('a sibling with no rank is never a target and cannot move (there is no request to send)', () => {
    const siblings = [item(1, 1), item(2, null), item(3, 3)]
    expect(getReorderState(siblings, 2)).toMatchObject({ canMoveUp: false, canMoveDown: false })
    expect(getReorderState(siblings, 3)).toMatchObject({ canMoveUp: true, upRank: 1, canMoveDown: false })
  })
})

describe('reorderMenuItems', () => {
  const labels = { up: 'Move up', down: 'Move down' }

  it('builds the two Menu items in order, with their labels and keys', () => {
    const items = reorderMenuItems({ state: getReorderState([item(1, 1), item(2, 2), item(3, 3)], 2), labels, onMove: vi.fn() })
    expect(items.map(({ key, label, disabled }) => ({ key, label, disabled }))).toEqual([
      { key: 'move-up', label: 'Move up', disabled: false },
      { key: 'move-down', label: 'Move down', disabled: false }
    ])
  })

  it('disables the impossible move at each end', () => {
    const siblings = [item(1, 1), item(2, 2)]
    expect(reorderMenuItems({ state: getReorderState(siblings, 1), labels, onMove: vi.fn() }).map(i => i.disabled)).toEqual([true, false])
    expect(reorderMenuItems({ state: getReorderState(siblings, 2), labels, onMove: vi.fn() }).map(i => i.disabled)).toEqual([false, true])
  })

  it('choosing an item hands the neighbour rank and the direction to onMove', () => {
    const onMove = vi.fn()
    const [up, down] = reorderMenuItems({ state: getReorderState([item(1, 5), item(2, 8), item(3, 13)], 2), labels, onMove })
    up.onSelect()
    expect(onMove).toHaveBeenLastCalledWith(5, 'up')
    down.onSelect()
    expect(onMove).toHaveBeenLastCalledWith(13, 'down')
  })

  it('a disabled item never calls onMove', () => {
    const onMove = vi.fn()
    const [up] = reorderMenuItems({ state: getReorderState([item(1, 1), item(2, 2)], 1), labels, onMove })
    up.onSelect()
    expect(onMove).not.toHaveBeenCalled()
  })
})

describe('focus after a move', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('names the trigger of a row by kind and id', () => {
    expect(reorderTriggerProps('product', 7)).toEqual({ 'data-odc-reorder': 'product:7' })
  })

  it('puts the focus back on the trigger of the moved row, which may have been drawn again', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<button data-odc-reorder="product:7"></button><button data-odc-reorder="product:8"></button>'
    focusReorderTrigger('product', 7)
    vi.runAllTimers()
    expect(document.activeElement).toBe(document.querySelector('[data-odc-reorder="product:7"]'))
  })

  it('does nothing when the row is gone', () => {
    vi.useFakeTimers()
    expect(() => { focusReorderTrigger('product', 404); vi.runAllTimers() }).not.toThrow()
  })
})

// J2 review H2: the edge of a page says why a move is not possible there
describe('reorderMenuItems · notes', () => {
  const labels = { up: 'Move up', down: 'Move down' }
  it('a note is the description of its item only while that item is disabled', () => {
    const edge = getReorderState([{ id: 1, rank: 4 }, { id: 2, rank: 9 }], 1)
    const [up, down] = reorderMenuItems({ state: edge, labels, onMove: () => {}, notes: { up: 'First on this page', down: 'Last on this page' } })
    expect(up).toMatchObject({ disabled: true, description: 'First on this page' })
    expect(down.disabled).toBe(false)
    expect(down).not.toHaveProperty('description')
  })

  it('without notes nothing changes', () => {
    const [up] = reorderMenuItems({ state: getReorderState([{ id: 1, rank: 1 }], 1), labels, onMove: () => {} })
    expect(up).not.toHaveProperty('description')
  })
})
