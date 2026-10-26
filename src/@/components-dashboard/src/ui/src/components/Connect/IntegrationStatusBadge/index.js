import React from 'react'
import { ExclamationTriangleFill } from 'react-bootstrap-icons'
import { useLanguage } from '../../../../../index'
import { getIntegrationSetupStatus, getIntegrationSetupWarning } from '../../../../../utils/integrationSetupStatus'
import { FeaturedWrapper, StatusBadgeRow, StatusWarningIcon } from './styles'

/**
 * The state of a business integration as a badge, with a warning icon when
 * the plugin behind it is uninstalled or disabled, in any state. One badge
 * for the list, the business panel and the integration detail.
 */
export const IntegrationStatusBadge = (props) => {
  const { row, integration } = props
  const [, t] = useLanguage()
  const status = getIntegrationSetupStatus(row, t)
  const warning = getIntegrationSetupWarning(row, integration, t)

  return (
    <StatusBadgeRow>
      <FeaturedWrapper tone={status.tone}>
        <p>{status.label}</p>
      </FeaturedWrapper>
      {warning && (
        <StatusWarningIcon role='img' tabIndex={0} aria-label={warning} title={warning}>
          <ExclamationTriangleFill size={14} />
        </StatusWarningIcon>
      )}
    </StatusBadgeRow>
  )
}
