/**
 * My products sidebar rules.
 *
 * Websites, dashboard and enabled apps share `/my-products`.
 * Config add-ons stay in Settings. The purchase catalog stays in Apps & Addons.
 */

export const MY_PRODUCTS_PATH = '/my-products'

/**
 * @param {Array<{ enabled?: boolean }>} apps
 * @returns {Array}
 */
export const getEnabledProductApps = (apps = []) => {
  return (apps || []).filter(app => !!app?.enabled)
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export const isMyProductsPath = (pathname = '') => {
  return String(pathname).startsWith(MY_PRODUCTS_PATH)
}

/**
 * @param {{ app?: { id?: string|number }, search?: string, state?: { productId?: string|number } }} params
 * @returns {boolean}
 */
export const isProductAppActive = ({ app, search = '', state } = {}) => {
  if (app?.id == null) return false
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  return params.get('id') === String(app.id) || state?.productId === app.id
}
