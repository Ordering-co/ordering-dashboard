// redesign DL-B2 (decisions 2, 3): what the drivers list reads from a user the API returns. Pure: no React.
import { driverState, fullName } from '../../../../../utils/driverState'
import { phoneOf as contactPhone } from '../../../../../utils/userContact'

export const DRIVER_STATUSES = ['available', 'busy', 'offline', 'inactive']

// The state of /drivers-dashboard with one layer on top: a disabled account is Inactive, whatever else it says
export const driverStatus = (user) => (user && !user.enabled ? 'inactive' : driverState(user))

// Offline with orders still assigned, as the dashboard says it («Offline · Busy»)
export const isOfflineBusy = (user) => driverStatus(user) === 'offline' && !!user?.busy

export const driverName = (user, t) => fullName(user) || t('DRIVERS_NO_NAME', 'No name')

// the users lists' reading (a cellphone saved with «+code» is not prefixed twice); '' rather than null, as before
export const phoneOf = (user) => contactPhone(user) ?? ''
