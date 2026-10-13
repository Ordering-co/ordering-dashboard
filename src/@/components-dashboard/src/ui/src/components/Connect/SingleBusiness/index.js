import React from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import FaStoreAlt from '@meronex/icons/fa/FaStoreAlt'
import { useUtils, useLanguage, PosMenuBusinessDetails as BusinessController } from '../../../../../index'
import { useTheme } from 'styled-components'
import { Button } from '../../../styles'

import {
  SingleBusinessContainer,
  WrapperImage,
  Image,
  BusinessGeneralInfo,
  InfoBlock,
  BusinessEnableWrapper,
  BusinessIdWrapper,
  FeaturedWrapper,
  ConnectToContainer,
  WrapperSalesChannelsImage
} from './styles'

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
    fromImporters
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const theme = useTheme()

  const posIntegration = businessState?.business?.third_party_integrations?.find(integration => integration?.third_party_integration?.type === 'pos' && businessState?.business?.id === integration?.business_id)

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
                {allowColumns?.status && (
                  <td>
                    <InfoBlock>
                      <p className='bold'><Skeleton width={60} /></p>
                    </InfoBlock>
                  </td>
                )}
                {!fromImporters && (
                  <>
                    <td>
                      <Skeleton width={100} />
                    </td>
                    <td>
                      <Skeleton width={100} />
                    </td>
                  </>
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
                {allowColumns?.status && (
                  <td>
                    <FeaturedWrapper isConnected={!!posIntegration?.setup_status}>
                      <p>{posIntegration?.setup_status || t('BUSINESS_POS_STATUS_NOT_CONNECTED', 'Not connected')}</p>
                    </FeaturedWrapper>
                  </td>
                )}
                {allowColumns?.pos && (
                  <td>
                    <ConnectToContainer>
                      {businessState?.business?.third_party_integrations?.filter(integration => integration?.third_party_integration?.type === 'pos').slice(0, 5).map(integration => (
                          <div key={integration?.id}>
                            <WrapperSalesChannelsImage>
                              {integration?.third_party_integration?.logo
                                ? (
                                  <Image bgimage={integration?.third_party_integration?.logo} />
                                  )
                                : (
                                  <FaStoreAlt />
                                  )}
                            </WrapperSalesChannelsImage>
                          </div>
                      ))}
                        {businessState?.business?.third_party_integrations?.filter(integration => integration?.third_party_integration?.type === 'pos').length > 5 && (
                          <div>
                            {t('LENGTH_CHANNELS_MORE', '...(_length_ channels more)').replace('_length_', businessState?.business?.third_party_integrations?.filter(integration => integration?.type === 'pos').length - 5)}
                          </div>
                        )}
                    </ConnectToContainer>
                  </td>
                )}
                {allowColumns?.sales_channels && (
                  <td>
                    <ConnectToContainer>
                      {businessState?.business?.third_party_integrations?.filter(integration => integration?.third_party_integration?.type === 'sales_channel').slice(0, 5).map(integration => (
                        <div key={integration?.id}>
                          <WrapperSalesChannelsImage>
                            {integration?.third_party_integration?.logo
                              ? (
                                <Image bgimage={integration?.third_party_integration?.logo} />
                                )
                              : (
                                <FaStoreAlt />
                                )}
                          </WrapperSalesChannelsImage>
                        </div>
                      ))}
                      {businessState?.business?.third_party_integrations?.filter(integration => integration?.third_party_integration?.type === 'sales_channel').length > 5 && (
                        <div>
                          {t('LENGTH_CHANNELS_MORE', '...(_length_ channels more)').replace('_length_', businessState?.business?.third_party_integrations?.filter(integration => integration?.third_party_integration?.type === 'sales_channel').length - 5)}
                        </div>
                      )}
                    </ConnectToContainer>
                </td>
                )}
                {!fromImporters && !fromSalesChannels && (
                  <td>
                    {!posIntegration && (
                      <BusinessEnableWrapper>
                        <Button color='primary'>{t('CONNECT_POS', 'Connect POS')}</Button>
                      </BusinessEnableWrapper>
                    )}
                    {posIntegration && (
                      <BusinessEnableWrapper>
                        <img src={posIntegration?.third_party_integration?.logo || theme.images?.dummies?.businessLogo} alt='business logo' />
                      </BusinessEnableWrapper>
                    )}
                  </td>
                )}
                {!fromImporters && fromSalesChannels && (
                  <td>
                    <BusinessEnableWrapper>
                      <Button color='primary'>{t('ADD_SALES_CHANNELS', 'Add Sales Channels')}</Button>
                    </BusinessEnableWrapper>
                  </td>
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
