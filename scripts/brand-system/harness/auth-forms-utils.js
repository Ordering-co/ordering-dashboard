export { formatSeconds } from '../../../src/@/components-dashboard/src/ui/src/utils/formatSeconds'
export { getOrderingSubdomains } from '../../../src/@/components-dashboard/src/ui/src/utils/getOrderingSubdomains'
export { getDashboardLogoUrl } from '../../../src/utils/dashboardBranding'
export { Alert } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Confirm'
export { InputPhoneNumber } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/InputPhoneNumber'
export { SpinnerLoader } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SpinnerLoader'

export const captureDashboardOperation = payload => {
  globalThis.__OD_AUTH_ANALYTICS__ = [...(globalThis.__OD_AUTH_ANALYTICS__ || []), payload]
}

// The login of `main` reports validation through its own login-v2 helpers. Same seam
// as above: the payload is recorded in memory and nothing reaches PostHog.
export const getLoginAnalyticsAction = loginTab => `login_${['email', 'cellphone', 'otp'].includes(loginTab) ? loginTab : 'email'}`
export const captureDashboardLoginValidation = payload => {
  globalThis.__OD_AUTH_ANALYTICS__ = [...(globalThis.__OD_AUTH_ANALYTICS__ || []), { kind: 'validation', ...payload }]
}
export const captureDashboardLoginOperation = payload => {
  globalThis.__OD_AUTH_ANALYTICS__ = [...(globalThis.__OD_AUTH_ANALYTICS__ || []), { kind: 'operation', ...payload }]
}
