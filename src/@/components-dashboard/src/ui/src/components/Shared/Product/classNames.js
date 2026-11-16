/** Joins class names, dropping falsy values and duplicates. */
export const cx = (...values) => [...new Set(
  values.filter(Boolean).flatMap(value => String(value).split(/\s+/)).filter(Boolean)
)].join(' ')
