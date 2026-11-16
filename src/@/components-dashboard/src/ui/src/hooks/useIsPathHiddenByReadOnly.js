import { useApi, useConfig, useSession } from '../../../index'
import { isHiddenByReadOnly } from '../../../utils/dashboardNavigation'

/**
 * (R-4): `true` when the route guard of would send this user away from `path` (a read-only admin or
 * delivery manager, for a page the menu hides from them). A shortcut to that page must not be offered. It gets the user, the
 * configs and the project the same way `src/App.js` does and leaves which levels see what to `isHiddenByReadOnly`.
 */
export const useIsPathHiddenByReadOnly = (path) => {
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()
  const [ordering] = useApi()
  return isHiddenByReadOnly({ path, user, configs, project: ordering?.project })
}
