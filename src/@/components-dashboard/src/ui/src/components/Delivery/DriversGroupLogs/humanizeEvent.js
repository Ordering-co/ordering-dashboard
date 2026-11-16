// an event with no catalog entry reads as words ('driver_group_updated' → 'Driver group updated'), not as its raw key
export const humanizeEvent = (event) => {
  const text = (event || '').replace(/_/g, ' ').trim().toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
