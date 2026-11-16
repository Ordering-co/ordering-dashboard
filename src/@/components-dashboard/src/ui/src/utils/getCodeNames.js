import { capitalize } from './capitalize'

export const getCodeNames = (code, t) => {
  const codeNames = {
    app_marketplace_x: t('APP_MARKETPLACE_X', 'Marketplace App'),
    app_business_x: t('APP_BUSINESS_X', 'Business App'),
    app_driver_x: t('APP_DRIVER_X', 'Driver App'),
    app_franchises_x: t('APP_FRANCHISES_X', 'App Franchises'),
    web_dashboard_x: t('WEB_DASHBOARD_X', 'Dashboard'),
    web_franchises_x: t('WEB_FRANCHISES_X', 'Franchises')
  }
  return codeNames[code] ?? t(code.replace(/ /g, '_').toUpperCase(), capitalize(code.replace(/_/g, ' ').toLowerCase()))
}
