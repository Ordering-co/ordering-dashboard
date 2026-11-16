import React from 'react'
import PropTypes from 'prop-types'
import { useHistory } from 'react-router-dom'
import { useLanguage, useSession } from '../../../../../index'
import { canOpenDashboardRoute, getDashboardRoleFlags } from '../../../../../utils/dashboardNavigation'
import { Button, InlineNotice } from '../../Shared/Product'

const DRIVERS_GROUPS_PATH = '/delivery/drivers-groups'

// (main #487): the page lists every active store, but its drivers come from driver groups. When no group
// has an active store, a notice says so, with the way to create a group (or to open Delivery Groups when some exist).
export const MissingGroupsState = (props) => {
  const { hasGroups } = props
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const history = useHistory()

  const canOpenDriversGroups = canOpenDashboardRoute(DRIVERS_GROUPS_PATH, user?.level) && !getDashboardRoleFlags(user).isReadOnly

  return (
    <InlineNotice
      tone='info'
      action={canOpenDriversGroups && (
        <Button size='sm' onClick={() => history.push(hasGroups ? DRIVERS_GROUPS_PATH : `${DRIVERS_GROUPS_PATH}?add=1`)}>
          {hasGroups
            ? t('DRIVER_STORE_STATUS_OPEN_GROUPS', 'Open Delivery Groups')
            : t('ADD_DRIVER_GROUP', 'Add driver group')}
        </Button>
      )}
    >
      {hasGroups
        ? t('DRIVER_STORE_STATUS_NO_GROUP_STORES', 'None of your active stores is in a driver group yet. Add them to a driver group to see their drivers here.')
        : t('DRIVER_STORE_STATUS_NO_GROUPS', 'Your stores are not in a driver group yet. Create a driver group and add your stores to it to see their drivers here.')}
    </InlineNotice>
  )
}

MissingGroupsState.propTypes = {
  hasGroups: PropTypes.bool
}
