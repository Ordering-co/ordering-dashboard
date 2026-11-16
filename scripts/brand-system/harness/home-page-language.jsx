import React from 'react'
import moment from 'moment'
import { useLanguage as useBaseLanguage } from './language'
import { SessionContext } from '../../../src/@/components-dashboard/src/contexts/SessionContext'
import { ApiContext } from '../../../src/@/components-dashboard/src/contexts/ApiContext'
import { Home as HomeController } from '../../../src/@/components-dashboard/src/components/Home'

// redesign home F3: the fake API answers the real controller's requests; this is the root it calls (see home-page.jsx)
export const HOME_API_ROOT = 'https://api.home-fixture.test/v2'

const params = () => new URLSearchParams(window.location.search)
const configStates = new Map()
const apiStates = new Map()
const siteStates = new Map()
const utilsState = [{
  parsePrice: value => `$${Number(value ?? 0).toFixed(2)}`,
  // redesign home F3: the new Home formats dates and percentages through the project formatter
  parseNumber: (value, { decimal } = {}) => Number(value ?? 0).toFixed(decimal ?? 0),
  parseDate: (value, { omitYear, inputFormat } = {}) => (inputFormat ? moment(value, inputFormat) : moment(value)).format(omitYear ? 'MMM D' : 'MMM D, YYYY')
}]

export const useLanguage = () => useBaseLanguage()
export const useUtils = () => utilsState
export const useEvent = () => [{
  emit: (name, payload) => {
    globalThis.__OD_HOME_EVENTS__ = [...(globalThis.__OD_HOME_EVENTS__ || []), { name, payload }]
  }
}]
export const useSession = () => [{
  token: 'fixture-home-token',
  user: {
    id: 81,
    level: Number(params().get('role') ?? 0),
    name: 'Alexandria Home Fixture With A Long Tenant Name',
    email: 'home@example.com',
    user_system_id: 991
  }
}]
export const useConfig = () => {
  const whiteLabel = params().get('whiteLabel') === '1'
  if (!configStates.has(whiteLabel)) {
    configStates.set(whiteLabel, [{
      loading: false,
      configs: {
        white_label_module: { value: whiteLabel },
        addon_catering: { value: true },
        addon_gift_cards: { value: true }
      }
    }])
  }
  return configStates.get(whiteLabel)
}
export const useApi = () => {
  const project = params().get('project') || 'fixture-home'
  if (!apiStates.has(project)) apiStates.set(project, [{ project, root: HOME_API_ROOT }, { configurations: { subdomain: 'ordering' } }])
  return apiStates.get(project)
}
export const useSite = () => {
  const variant = params().get('site') || 'live'
  if (!siteStates.has(variant)) {
    siteStates.set(variant, [{
      loading: false,
      sites: variant === 'temporary'
        ? [{ code: 'web_marketplace_26', ssl_process_status: 'pending', temporal_domain: 'temporary-shop.example.test' }]
        : [{ code: 'web_marketplace_26', domain: 'live-shop.example.test', ssl_process_status: 'ended', temporal_domain: 'temporary-shop.example.test' }]
    }])
  }
  return siteStates.get(variant)
}

// redesign home F3: the REAL controller runs against the fake fetch of home-page.jsx; it reads the session and the API
// from the SDK contexts, so those are fed with the same fixture values the UI gets from the hooks above.
export const Home = (props) => {
  const session = useSession()
  const api = useApi()
  return (
    <SessionContext.Provider value={session}>
      <ApiContext.Provider value={api}>
        <HomeController {...props} />
      </ApiContext.Provider>
    </SessionContext.Provider>
  )
}
