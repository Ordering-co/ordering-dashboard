import React from 'react'
export { useLanguage } from './language'
export { IntegrationLogs } from '../../../src/@/components-dashboard/src/components/IntegrationLogs'
export { PushTokens } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/PushTokens'
export { Modal } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Modal'
export { Confirm } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Confirm'
export { addQueryToUrl } from '../../../src/@/components-dashboard/src/ui/src/utils/queryString'
export const useSession = () => [{ token: 'fixture-log-token', loading: false, user: { id: 900, level: 0 } }]
export const useApi = () => [{ root: `${window.location.origin}/__brand-fixture__/technical-tables` }]
export const useUtils = () => [{ parseDate: (value, options) => `${value} [utc:${options?.utc}]` }]
export const UserDetails = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
// Non-token tabs and their provider operations are outside this fixture.
export const UserDetailsMenu = () => null
export const UserMetaFields = () => null
export const UserProfileForm = () => null
export const AddressList = () => null
export const OrdersManager = () => null
export const BusinessManagerBusinesses = () => null
export const SchoolUserStudents = () => null
export { Personalization } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Personalization'
const basePath = '/__brand-fixture__/technical-tables'
const nativeFetch = globalThis.fetch.bind(globalThis)
const summary = { id: 81, model: 'Business', model_id: 51, event: 'fixture.updated', type: 0, created_at: '2026-01-02 12:00:00', group_key: 'fixture-group' }
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.origin)
  if (!url.pathname.startsWith(basePath)) return nativeFetch(input, options)
  if ((options.method || 'GET') !== 'GET') throw new Error('Technical fixture is read-only')
  globalThis.__OD_TECHNICAL_REQUESTS__ = [...(globalThis.__OD_TECHNICAL_REQUESTS__ || []), { path: url.pathname, query: Object.fromEntries(url.searchParams) }]
  if (url.pathname === `${basePath}/logs`) return { json: async () => ({ error: false, result: [summary], pagination: { current_page: Number(url.searchParams.get('page')), total_pages: 2, total: 11, from: 1, to: 10 } }) }
  if (url.pathname === `${basePath}/logs/81`) return { json: async () => ({ error: false, result: { ...summary, exception: { message: 'Fixture detail preserved' }, request: { method: 'POST', payload_type: 'json', payload: '{"fixture":true}' }, response: { content_type: 'json', content: '{"ok":true}' } } }) }
  throw new Error('Unexpected technical fixture endpoint')
}
export { Pagination } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Pagination'
