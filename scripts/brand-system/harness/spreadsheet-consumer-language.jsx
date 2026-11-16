import React from 'react'
export { useLanguage } from './language'
export { LanguageTransSpread } from '../../../src/@/components-dashboard/src/components/LanguageTransSpread'
export { default as SpreadSheetEditor } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SpreadSheetEditor'
export { Alert } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Confirm'
// Product UI props are synthetic; product persistence is outside this fixture.
export const BusinessSpreadSheet = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
export const useSession = () => [{ token: 'fixture-spreadsheet-token', loading: false }]
export const useApi = () => [{ root: `${window.location.origin}/__brand-fixture__/spreadsheet` }]
export const ToastType = { Info: 'info', Success: 'success', Error: 'error' }
export const useToast = () => [null, { showToast: (...args) => { globalThis.__OD_SPREADSHEET_TOASTS__ = [...(globalThis.__OD_SPREADSHEET_TOASTS__ || []), args] } }]
const nativeFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin)
  if (!url.pathname.startsWith('/__brand-fixture__/spreadsheet')) return nativeFetch(input, options)
  if (url.pathname !== '/__brand-fixture__/spreadsheet/bulks/translations' || !['PUT', 'POST'].includes(options.method)) throw new Error('Unexpected spreadsheet fixture request')
  const body = JSON.parse(options.body)
  globalThis.__OD_SPREADSHEET_REQUESTS__ = [...(globalThis.__OD_SPREADSHEET_REQUESTS__ || []), { method: options.method, body }]
  return { json: async () => ({ error: false, result: JSON.parse(body.translations) }) }
}
