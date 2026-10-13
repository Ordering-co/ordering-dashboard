export const getLocalStorageItem = (storageKey, isJson) => {
  const value = window.localStorage.getItem(storageKey)
  if (!isJson || value === null) return value

  try {
    return JSON.parse(value)
  } catch {
    window.localStorage.removeItem(storageKey)
    return null
  }
}

export class WebStrategy {
  async getItem (storageKey, isJson) {
    return getLocalStorageItem(storageKey, isJson)
  }

  async setItem (key, val, isJson) {
    const value = isJson ? JSON.stringify(val) : val
    await window.localStorage.setItem(key, value)
  }

  async removeItem (key) {
    await window.localStorage.removeItem(key)
  }
}
