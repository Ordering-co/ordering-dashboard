import React from 'react'
import { Redirect } from 'react-router-dom'
import { useConfig, useSession } from '~components'
import { canRegisterStores } from '../../@/components-dashboard/src/utils/storeAdd'

/**
 * bugs E: the /stores/add route only checked the level (`allowedLevels={[0, 2]}`), so a store owner whose project
 * turned `allow_business_owner_register_business` off reached the add page by URL. This applies the rule of the list's
 * «Add new store» and ⌘K (`canRegisterStores`): without it, the stores list. Nothing is drawn while the settings load (for an
 * owner, until the session's own settings arrive), so there is neither a flash of the form nor a redirect before the project
 * says what it allows.
 */
export const RegisterStoresGate = ({ children }) => {
  const [{ user }] = useSession()
  const [{ configs, loading, fetchedWithToken }] = useConfig()
  if (loading) return null
  // The Worker's first load (`__FIRST_LOAD__`) gives only the public settings, with `loading` already false: the owner rule
  // waits for the settings of the session. An admin does not depend on the setting.
  if (user?.level === 2 && !fetchedWithToken) return null
  return canRegisterStores(user, configs) ? children : <Redirect to='/stores/list' />
}
