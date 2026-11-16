import React from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../../../../index'
import { InlineNotice } from '../../Shared/Product'
import { canOpenDashboardRoute, getDashboardRoleFlags } from '../../../../../utils/dashboardNavigation'

export const MissingResourceNotice = ({ message, path, linkText }) => {
  const [{ user }] = useSession()
  const canOpenPath = canOpenDashboardRoute(path, user?.level) && !getDashboardRoleFlags(user).isReadOnly

  return (
    <InlineNotice tone='info' action={canOpenPath && <Link to={`${path}?add=1`}>{linkText}</Link>}>
      {message}
    </InlineNotice>
  )
}
