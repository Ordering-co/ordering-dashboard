import React from 'react'

import { useLanguage } from '../../../../../index'
import { Tooltip } from '../../Shared/Product'
import { PlatformIcon } from '../BuilderShared'
import { getBuildKind, getBuildStatusLabel, getPlatformLabel } from '../utils'

// redesign B1: moved from BuilderShared (only the list uses it) onto P/Tooltip instead of react-bootstrap's.

/**
 * A platform icon colored by its last build. A tooltip (hover or focus)
 * and the accessible name say the status.
 */
export const PlatformBuildIcon = ({ platform, status }) => {
  const [, t] = useLanguage()
  const label = `${getPlatformLabel(platform)}: ${getBuildStatusLabel(status, t)}`
  return (
    <Tooltip content={label}>
      <span className='odc-builder-platform' data-kind={getBuildKind(status)} role='img' aria-label={label} tabIndex={0}>
        <PlatformIcon platform={platform} />
      </span>
    </Tooltip>
  )
}
