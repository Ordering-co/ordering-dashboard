/**
 * Reorder without a mouse (redesign J2, , row 9, owner decision D-43 (a)): the «Move up» and «Move down» items of the ⋯ menu
 * of a row, for lists that can also be reordered by drag (products of a category, categories of a parent).
 *
 * The drag stays as it is. Moving a row one place is the request the drag already sends: the `rank` of the previous (up) or the next
 * (down) sibling, with the siblings sorted by `rank`. Ranks are unique per list but may have gaps, so the target is the neighbour's
 * own rank, never `rank ± 1`. This file only decides what is possible and builds the menu items; the request, its toasts and the
 * state updates stay in the controller of each list (`handleChangeProductRank`, `handleChangeCategoryRank`).
 *
 * Not a component: it needs no entry in the barrel or the gallery. The items are the ones of `P/Menu`:
 * `{ key, label, onSelect(), disabled }`. A move that is not possible is a disabled item, like the other row menus.
 */

const NONE = { canMoveUp: false, canMoveDown: false, upRank: null, downRank: null, canReorder: false }

const toRank = (rank) => (rank === null || rank === undefined || rank === '' ? NaN : Number(rank))

/**
 * @param {Array<{id: *, rank: *}>} siblings The list the row belongs to, in any order (it is not changed).
 * @param {*} id Id of the row (compared as text: a route or a dataset id is a string).
 * @returns {{canMoveUp: boolean, canMoveDown: boolean, upRank: number|null, downRank: number|null, canReorder: boolean}}
 *   `upRank` / `downRank`: the rank to send for each move; null when that move is not possible. A neighbour with no rank
 *   cannot be a target (there would be no request to send).
 */
export const getReorderState = (siblings, id) => {
  if (!Array.isArray(siblings) || id === null || id === undefined) return NONE
  const sorted = siblings
    .filter(sibling => sibling && sibling.id !== null && sibling.id !== undefined)
    .map((sibling, position) => ({ id: String(sibling.id), rank: toRank(sibling.rank), position }))
    .sort((a, b) => {
      // a sibling with no rank goes last (a consistent order); it can never be a target
      if (Number.isNaN(a.rank) !== Number.isNaN(b.rank)) return Number.isNaN(a.rank) ? 1 : -1
      return (a.rank - b.rank || 0) || a.position - b.position
    })
  const index = sorted.findIndex(sibling => sibling.id === String(id))
  if (index === -1 || Number.isNaN(sorted[index].rank)) return NONE // unknown, or a row with no rank of its own
  const up = index > 0 ? sorted[index - 1].rank : NaN
  const down = index < sorted.length - 1 ? sorted[index + 1].rank : NaN
  const canMoveUp = Number.isFinite(up)
  const canMoveDown = Number.isFinite(down)
  return {
    canMoveUp,
    canMoveDown,
    upRank: canMoveUp ? up : null,
    downRank: canMoveDown ? down : null,
    canReorder: canMoveUp || canMoveDown
  }
}

/**
 * The two items for `P/Menu`.
 * @param {object} options
 * @param {ReturnType<typeof getReorderState>} options.state
 * @param {{up: string, down: string}} options.labels Already translated by the caller.
 * @param {(rank: number, direction: 'up'|'down') => *} options.onMove Called with the rank to send; never for a disabled item.
 * @param {{up?: string, down?: string}} [options.notes] Why a disabled move is not possible (J2 review H2: the edge of a page of a
 *   paged list, whose neighbour is not loaded). Shown as the item's description only while that item is disabled.
 */
export const reorderMenuItems = ({ state, labels, onMove, notes = {} }) => [
  {
    key: 'move-up',
    label: labels.up,
    disabled: !state.canMoveUp,
    ...(!state.canMoveUp && notes.up ? { description: notes.up } : {}),
    onSelect: () => { if (state.canMoveUp) onMove(state.upRank, 'up') }
  },
  {
    key: 'move-down',
    label: labels.down,
    disabled: !state.canMoveDown,
    ...(!state.canMoveDown && notes.down ? { description: notes.down } : {}),
    onSelect: () => { if (state.canMoveDown) onMove(state.downRank, 'down') }
  }
]

const SELECTOR = 'data-odc-reorder'

/** Attributes for the ⋯ trigger of a row, so the focus can find it again after the list is drawn in its new order. */
export const reorderTriggerProps = (kind, id) => ({ [SELECTOR]: `${kind}:${id}` })

/**
 * After a move the list is drawn in its new order and the row may be mounted again, which drops the focus. This puts it back on the
 * ⋯ trigger of the moved row (the menu has closed), once the new order is on screen, so the same move can be repeated by keyboard.
 */
export const focusReorderTrigger = (kind, id) => {
  if (typeof document === 'undefined') return
  setTimeout(() => {
    document.querySelector(`[${SELECTOR}="${kind}:${id}"]`)?.focus?.()
  }, 0)
}
