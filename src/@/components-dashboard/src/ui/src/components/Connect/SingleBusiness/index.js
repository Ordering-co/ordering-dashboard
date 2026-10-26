import React, { useRef, useState } from 'react'
import { usePluginMessages } from '../../../hooks/usePluginMessages'
import { pluginModalSize } from '../../../../../utils/pluginMessages'
import { PluginPageFrame } from '../PluginPageFrame'
import { useShowPluginPage } from '../../../hooks/usePluginPage'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useUtils, useLanguage, useSession, PosMenuBusinessDetails as BusinessController } from '../../../../../index'
import { useTheme } from 'styled-components'
import { Modal } from '../../Shared'
import { isSalesCallRestricted } from '../../../utils'
import { getIntegrationSetupStatus, getIntegrationSetupAction } from '../../../../../utils/integrationSetupStatus'
import { getPluginSetupPath } from '../../../../../utils/posPluginCatalog'
import { IntegrationStatusBadge } from '../IntegrationStatusBadge'

import { WrapperImage, PosImage, StatusCell } from '../shared/styles'

import {
  SingleBusinessContainer,
  Image,
  BusinessGeneralInfo,
  InfoBlock,
  BusinessEnableWrapper,
  BusinessIdWrapper,
  ConnectToContainer,
  PosCell,
  EmptyCell,
  RowAction,
  ActionCell,
  MoreChannels
} from './styles'

// Logos shown in the Sales Channels column; the rest are counted as "+N".
const MAX_SALES_CHANNEL_LOGOS = 3

const SingleBusinessUI = (props) => {
  const {
    isSkeleton,
    viewMethod,
    allowColumns,
    businessState,
    handleOpenBusinessDetails,
    detailsBusinessId,
    citiesList,
    fromSalesChannels,
    fromImporters,
    integrationsList,
    updateBusiness
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage, parseDate }] = useUtils()
  const [sessionState] = useSession()
  const theme = useTheme()
  const [pluginSelected, setPluginSelected] = useState({ open: false, title: null, url: null })
  // The plugin page reports its result to the API, not to this page, so
  // read the store again when it closes: its state shows without a reload.
  const reloadStore = () => {
    updateBusiness && updateBusiness()
  }
  const handleClosePluginModal = () => {
    setPluginSelected(prev => ({ ...prev, open: false }))
    reloadStore()
  }
  // The plugin page can also say it finished, or ask to close
  // (docs/PLUGIN_PAGES.md).
  const pluginFrameRef = useRef(null)
  const pluginFrame = usePluginMessages({
    open: pluginSelected.open,
    iframeRef: pluginFrameRef,
    url: pluginSelected.url,
    businessId: businessState?.business?.id ?? null,
    name: pluginSelected.title,
    closeModal: handleClosePluginModal,
    reload: reloadStore,
    fits: Boolean(pluginSelected.fits),
    frameKey: pluginSelected.frameKey ?? null
  })
  const pluginModal = pluginModalSize({ fits: Boolean(pluginSelected.fits), ...pluginFrame })

  const posIntegration = businessState?.business?.third_party_integrations?.find(integration => integration?.third_party_integration?.type === 'pos' && businessState?.business?.id === integration?.business_id)
  const posStatus = getIntegrationSetupStatus(posIntegration, t)
  const salesChannels = businessState?.business?.third_party_integrations?.filter(integration => integration?.third_party_integration?.type === 'sales_channel') || []
  const posCatalogIntegration = integrationsList?.thirdPartyIntegrations?.find(integration => integration?.id === posIntegration?.third_party_integration_id)
  const posPlugin = posCatalogIntegration?.plugin
  // Same rule as the panel: a setup that is a sales call only opens for admins.
  const isSetupRestricted = isSalesCallRestricted(sessionState?.user, getPluginSetupPath(posPlugin), posPlugin?.root)
  // Same rule as the business panel: the list only offers fixing a failed or
  // pending connection.
  const setupAction = getIntegrationSetupAction(posIntegration, posCatalogIntegration, t)
  const showSetupAction = !fromSalesChannels && setupAction?.kind === 'fix' && !isSetupRestricted
  const statusUpdatedAt = posIntegration?.setup_status_updated_at
    ? parseDate(posIntegration.setup_status_updated_at)
    : null

  const showPluginPage = useShowPluginPage(setPluginSelected)

  // The action opens the plugin's setup page, the same one the panel's Setup
  // button opens, without opening the panel.
  const handleOpenSetup = async (e) => {
    e.stopPropagation()
    await showPluginPage(posPlugin, 'setup', { businessId: businessState?.business?.id ?? null })
  }

  const handleClickBusiness = (e) => {
    const isInvalid = e.target.closest('.business_enable_control') ||
      e.target.closest('.business_actions') ||
      e.target.closest('.business-id')
    if (isInvalid) return
    handleOpenBusinessDetails(businessState?.business)
  }

  const getCityName = (id) => {
    const found = citiesList?.find(city => city.id === id)
    return found?.name || ''
  }

  return (
    <>
      {viewMethod === 'list' && (
        <>
          {(businessState?.loading || isSkeleton)
            ? (
            <SingleBusinessContainer>
              <tr>
                <td>
                  <BusinessIdWrapper>
                    <Skeleton width={18} height={18} />
                    <Skeleton width={40} style={{ margin: '0px 5px' }} />
                  </BusinessIdWrapper>
                </td>
                {allowColumns?.business && (
                  <td className='business'>
                    <BusinessGeneralInfo>
                      <WrapperImage isSkeleton={businessState?.loading || isSkeleton}>
                        <Skeleton width={45} height={45} />
                      </WrapperImage>
                      <InfoBlock>
                        <p className='bold'><Skeleton width={120} /></p>
                        <p><Skeleton width={80} /></p>
                      </InfoBlock>
                    </BusinessGeneralInfo>
                  </td>
                )}
                {allowColumns?.pos && (
                  <td>
                    <Skeleton width={100} />
                  </td>
                )}
                {allowColumns?.status && (
                  <td>
                    <InfoBlock>
                      <p className='bold'><Skeleton width={60} /></p>
                    </InfoBlock>
                  </td>
                )}
                {allowColumns?.sales_channels && (
                  <td>
                    <Skeleton width={100} />
                  </td>
                )}
                {!fromImporters && (
                  <td>
                    <Skeleton width={100} />
                  </td>
                )}
              </tr>
            </SingleBusinessContainer>
              )
            : (
            <SingleBusinessContainer
              active={businessState?.business.id === parseInt(detailsBusinessId)}
              onClick={(e) => handleClickBusiness(e)}
            >
              <tr>
                <td>
                  <BusinessIdWrapper>
                    {businessState?.business?.id}
                  </BusinessIdWrapper>
                </td>
                {allowColumns?.business && (
                  <td className='business'>
                    <BusinessGeneralInfo>
                      <WrapperImage>
                        <Image bgimage={optimizeImage(businessState?.business?.logo || theme.images?.dummies?.businessLogo, 'h_50,c_limit')} />
                      </WrapperImage>
                      <InfoBlock>
                        <p className='bold'>{businessState?.business?.name}</p>
                        <p>{getCityName(businessState?.business?.city_id)}</p>
                      </InfoBlock>
                    </BusinessGeneralInfo>
                  </td>
                )}
                {allowColumns?.pos && (
                  <td>
                    {posIntegration
                      ? (
                        <PosCell>
                          <WrapperImage>
                            <PosImage bgimage={posIntegration?.third_party_integration?.logo || theme.images?.dummies?.businessLogo} />
                          </WrapperImage>
                          <p>{posIntegration?.third_party_integration?.name}</p>
                        </PosCell>
                        )
                      : <EmptyCell>—</EmptyCell>}
                  </td>
                )}
                {allowColumns?.status && (
                  <td>
                    <StatusCell>
                      <IntegrationStatusBadge row={posIntegration} integration={posCatalogIntegration} />
                      {posStatus.message && <p className='status-detail'>{posStatus.message}</p>}
                      {statusUpdatedAt && <p className='status-detail'>{statusUpdatedAt}</p>}
                    </StatusCell>
                  </td>
                )}
                {allowColumns?.sales_channels && (
                  <td>
                    <ConnectToContainer>
                      {salesChannels.length === 0 && <EmptyCell>—</EmptyCell>}
                      {salesChannels.slice(0, MAX_SALES_CHANNEL_LOGOS).map(integration => (
                        <WrapperImage key={integration?.id} title={integration?.third_party_integration?.name}>
                          <PosImage bgimage={integration?.third_party_integration?.logo || theme.images?.dummies?.businessLogo} />
                        </WrapperImage>
                      ))}
                      {salesChannels.length > MAX_SALES_CHANNEL_LOGOS && (
                        <MoreChannels
                          title={salesChannels.slice(MAX_SALES_CHANNEL_LOGOS).map(integration => integration?.third_party_integration?.name).join(', ')}
                        >
                          +{salesChannels.length - MAX_SALES_CHANNEL_LOGOS}
                        </MoreChannels>
                      )}
                    </ConnectToContainer>
                  </td>
                )}
                {!fromImporters && (
                  <ActionCell>
                    <BusinessEnableWrapper className='business_actions'>
                      {showSetupAction && (
                        <RowAction
                          color='lightPrimary'
                          borderRadius='8px'
                          onClick={handleOpenSetup}
                        >
                          {setupAction.label}
                        </RowAction>
                      )}
                    </BusinessEnableWrapper>
                    {pluginSelected.open && (
                      // The modal renders in a portal, but React still bubbles its
                      // clicks to the row, which would open the panel behind it.
                      <div onClick={(e) => e.stopPropagation()}>
                        <Modal
                          open={pluginSelected.open}
                          title={pluginSelected.title}
                          onClose={handleClosePluginModal}
                          height={pluginModal.height}
                          width={pluginModal.width}
                          anchorTop
                        >
                          <PluginPageFrame
                            ref={pluginFrameRef}
                            url={pluginSelected.url}
                            name={pluginSelected.title}
                            height={pluginFrame.height}
                            fits={pluginSelected.fits}
                            initialHeight={pluginSelected.initialHeight}
                          />
                        </Modal>
                      </div>
                    )}
                  </ActionCell>
                )}
              </tr>
            </SingleBusinessContainer>
              )}
        </>
      )}
    </>
  )
}

export const SingleBusiness = (props) => {
  const { isSkeleton } = props
  const singleBusinessProps = {
    ...props,
    // A refetch of the row (updateBusiness) needs the dashboard mode: without
    // it the business comes without third_party_integrations, and the row
    // would show "Not connected".
    asDashboard: true,
    UIComponent: SingleBusinessUI
  }
  return (
    <>
      {isSkeleton
        ? (
        <SingleBusinessUI {...props} />
          )
        : (
        <BusinessController {...singleBusinessProps} />
          )}
    </>
  )
}
