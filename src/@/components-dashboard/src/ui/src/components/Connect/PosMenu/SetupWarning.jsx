import React from 'react'

import { TriangleAlert } from '../../Shared/Icon'
import { Tooltip } from '../../Shared/Product'

/**
 * main #394 (IntegrationStatusBadge), the warning next to the state of a connected integration whose plugin is uninstalled,
 * disabled or not done installing, in any state (getIntegrationSetupWarning). It can be reached with the keyboard and names itself.
 */
export const SetupWarning = ({ warning }) => {
  if (!warning) return null
  return (
    <Tooltip content={warning}>
      <span className='psp-setup-warning' role='img' aria-label={warning}>
        <TriangleAlert className='odc-icon' aria-hidden='true' />
      </span>
    </Tooltip>
  )
}
