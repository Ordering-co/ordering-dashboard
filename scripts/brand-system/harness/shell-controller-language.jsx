export const useSession = () => [{ token: 'fixture-shell-controller-token' }]
export const useApi = () => [{ root: `${location.origin}/__brand-fixture__/shell-controller` }]
export const ToastType = { Error: 'error' }
export const useToast = () => [null, { showToast: (...args) => { globalThis.__OD_SHELL_CONTROLLER_TOASTS__ = [...(globalThis.__OD_SHELL_CONTROLLER_TOASTS__ || []), args] } }]
const nativeFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.origin)
  if (!url.pathname.startsWith('/__brand-fixture__/shell-controller')) return nativeFetch(input, options)
  if ((options.method || 'GET') !== 'GET') throw new Error('Shell controller fixture is read-only')
  globalThis.__OD_SHELL_CONTROLLER_REQUESTS__ = [...(globalThis.__OD_SHELL_CONTROLLER_REQUESTS__ || []), { path: url.pathname, method: options.method, authorization: options.headers?.Authorization }]
  if (url.pathname.endsWith('/builder/apps')) return { json: async () => ({ error: false, result: [{ id: 901, name: 'Fixture application', base: { code: 'native_app' } }, { id: 902, name: 'Fixture website', base: { code: 'web_marketplace' } }] }) }
  if (url.pathname.endsWith('/integrations/internal/tokens/current/')) return { json: async () => ({ error: false, result: { access_token: 'fixture-billing-token', referer_url: 'billing.example.test' } }) }
  throw new Error('Unexpected shell controller fixture request')
}
