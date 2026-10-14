import { getDashboardStorageKey } from '../../../../utils/local-tenant'

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
  constructor (settings) {
    this.settings = settings
  }

  async getItem (storageKey, isJson) {
    return getLocalStorageItem(getDashboardStorageKey(this.settings, storageKey), isJson)
  }

  async setItem (key, val, isJson) {
    const value = isJson ? JSON.stringify(val) : val
    await window.localStorage.setItem(getDashboardStorageKey(this.settings, key), value)
  }

  async removeItem (key) {
    await window.localStorage.removeItem(getDashboardStorageKey(this.settings, key))
  }
}
