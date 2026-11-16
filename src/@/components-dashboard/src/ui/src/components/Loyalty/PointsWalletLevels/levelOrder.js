// redesign (AD-8): `GET /loyalty_levels` answers by id and has no order field, so ids 1..5 can be named Level 1, 2, 4, 5, 3.
// What ranks a level is the points that earn it (`minimum_points`): the list shows them from the lowest, a level without a number last.

const pointsOf = (level) => {
  const value = level?.minimum_points
  if (value === null || value === undefined || value === '') return null
  const points = Number(value)
  return Number.isFinite(points) ? points : null
}

/**
 * The levels by `minimum_points` ascending, ties by `id` ascending, a level without a number at the end (also by `id`).
 * Pure: it sorts a copy and never touches the list it receives.
 */
export const sortLevels = (levels) => {
  if (!Array.isArray(levels)) return []
  return [...levels].sort((a, b) => {
    const pointsA = pointsOf(a)
    const pointsB = pointsOf(b)
    if (pointsA !== pointsB) {
      if (pointsA === null) return 1
      if (pointsB === null) return -1
      return pointsA - pointsB
    }
    return (Number(a?.id) || 0) - (Number(b?.id) || 0)
  })
}

export const levelPoints = pointsOf
