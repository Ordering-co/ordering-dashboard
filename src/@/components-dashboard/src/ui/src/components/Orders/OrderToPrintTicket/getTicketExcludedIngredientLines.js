export const getTicketExcludedIngredientLines = (ingredients, t) => {
  if (!Array.isArray(ingredients)) return []

  const translateNo = typeof t === 'function'
    ? t
    : (_key, fallback) => fallback

  return ingredients
    .filter((ingredient) => ingredient && !ingredient.selected && ingredient.name)
    .map((ingredient) => `${translateNo('NO', 'No')} ${ingredient.name}`)
}
