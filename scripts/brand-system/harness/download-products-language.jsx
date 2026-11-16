import { useLanguage as useBaseLanguage } from './language'

const apiStates = new Map()

export const useLanguage = () => useBaseLanguage()
export const useApi = () => {
  const subdomain = new URLSearchParams(window.location.search).get('tenant') || 'ordering'
  if (!apiStates.has(subdomain)) apiStates.set(subdomain, [{ project: 'fixture-downloads' }, { configurations: { subdomain } }])
  return apiStates.get(subdomain)
}
