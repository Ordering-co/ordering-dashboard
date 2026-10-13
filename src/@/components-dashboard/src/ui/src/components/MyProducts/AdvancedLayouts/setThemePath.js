export const setThemePath = (object, newValue, path) => {
  const stack = path.split('.')
  let current = object
  while (stack.length > 1) {
    const key = stack.shift()
    const next = current[key]
    if (next == null || typeof next !== 'object' || Array.isArray(next)) {
      current[key] = {}
    }
    current = current[key]
  }
  current[stack.shift()] = newValue
}
