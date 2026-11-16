// Narrow providers and a fail-closed gallery boundary for the media fixture.
import {
  useApi as useBaseApi,
  useLanguage as useBaseLanguage,
  useSession as useBaseSession,
  useUtils as useBaseUtils
} from './language'

const servicePath = '/__brand-fixture__/media'
const isMediaSurface = () => ['media', 'media-consumers'].includes(new URLSearchParams(window.location.search).get('surface'))
const state = globalThis.__OD_MEDIA_SERVICE__ = { optimizeCalls: [], requests: [] }
const nativeFetch = globalThis.fetch.bind(globalThis)

globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin)
  if (!url.pathname.startsWith(servicePath)) return nativeFetch(input, options)
  const method = options.method || 'GET'
  const body = options.body ? JSON.parse(options.body) : undefined
  state.requests.push({
    authorization: options.headers?.Authorization,
    body,
    method,
    pathname: url.pathname
  })
  if (method === 'POST' && url.pathname === `${servicePath}/themes/1/gallery`) {
    return { json: async () => ({ error: false, result: { image: body?.file } }), ok: true, status: 200 }
  }
  if (method === 'POST' && url.pathname === `${servicePath}/themes/2/gallery`) {
    return { json: async () => ({ error: true, result: ['Fixture gallery error'] }), ok: true, status: 200 }
  }
  throw new Error(`Unexpected media fixture request: ${method} ${url.pathname}`)
}

export const useLanguage = () => useBaseLanguage()
export const useApi = () => {
  const base = useBaseApi()
  return isMediaSurface() ? [{ root: `${window.location.origin}${servicePath}` }] : base
}
export const useSession = () => {
  const base = useBaseSession()
  return isMediaSurface() ? [{ token: 'fixture-media-token', user: { id: 900, level: 0 } }] : base
}
export const useUtils = () => {
  const base = useBaseUtils()
  if (!isMediaSurface()) return base
  return [{
    ...base[0],
    optimizeImage: (value, options) => {
      state.optimizeCalls.push({ options, value })
      return value
    }
  }]
}
