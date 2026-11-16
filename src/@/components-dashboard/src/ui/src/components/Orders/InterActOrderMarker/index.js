import React from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { User } from '../../Shared/Icon'
import { getMarkerStatus, useMarkerDisclosure } from '../mapMarkerShared'
import { useTheme } from 'styled-components'
import {
  InfoContainer,
  TextContainer,
  Text,
  WrapperMapMarker,
  MapMarkerImg
} from './styles'

export const InterActOrderMarker = (props) => {
  const {
    image,
    customer,
    business,
    timeStatus,
    driver
  } = props
  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()

  const theme = useTheme()
  const { infoShow, infoId, infoRef, infoTop, markerRef, handlers } = useMarkerDisclosure()
  const entityName = business?.name || `${customer?.name || driver?.name || ''} ${customer?.lastname || driver?.lastname || ''}`.trim()
  const entityType = business
    ? t('BUSINESS', 'Business')
    : customer
      ? t('CUSTOMER', 'Customer')
      : t('DRIVER', 'Driver')
  const status = getMarkerStatus({ timeStatus, driver })
  const markerStatus = status && {
    delayed: t('DELAYED', 'Delayed'),
    offline: t('OFFLINE', 'Offline'),
    busy: t('BUSY', 'Busy'),
    available: t('AVAILABLE', 'Available')
  }[status]
  const detailsLabel = `${t('SHOW_DETAILS_FOR', 'Show details for')} ${entityName || entityType}${markerStatus ? `, ${markerStatus}` : ''}`

  return (
    <>
      {infoShow && (
        <InfoContainer id={infoId} role='tooltip' ref={infoRef} style={{ transform: `translate(-50%, ${infoTop})` }}>
          {business && (
            <>
              <TextContainer>
                <Text fontWeight='bold'>
                  {t('NAME', 'Name')}:
                </Text>
                <Text>{business.name}</Text>
              </TextContainer>
              {business?.email && (
                <TextContainer>
                  <Text fontWeight='bold'>
                    {t('EMAIL', 'Email')}:
                  </Text>
                  <Text>{business.email}</Text>
                </TextContainer>
              )}
              {business?.phone && (
                <TextContainer>
                  <Text fontWeight='bold'>
                    {t('PHONE', 'Phone')}:
                  </Text>
                  <Text>{business.phone}</Text>
                </TextContainer>
              )}
            </>
          )}
          {customer && (
            <>
              <TextContainer>
                <Text fontWeight='bold'>
                  {t('NAME', 'Name')}:
                </Text>
                <Text>{customer.name} {customer.lastname}</Text>
              </TextContainer>
              {customer?.order_id && (
                <TextContainer>
                  <Text fontWeight='bold'>
                    {t('INVOICE_ORDER_NO', 'Order number')}
                  </Text>
                  <Text>{customer.order_id}</Text>
                </TextContainer>
              )}
              {customer?.email && (
                <TextContainer>
                  <Text fontWeight='bold'>
                    {t('EMAIL', 'Email')}:
                  </Text>
                  <Text>{customer.email}</Text>
                </TextContainer>
              )}
              {customer?.cellphone && (
                <TextContainer>
                  <Text fontWeight='bold'>
                    {t('CELLPHONE', 'Cellphone')}:
                  </Text>
                  <Text>{customer.cellphone}</Text>
                </TextContainer>
              )}
            </>
          )}
          {driver && (
            <>
              <TextContainer>
                <Text fontWeight='bold'>
                  {t('NAME', 'Name')}:
                </Text>
                <Text>{driver.name} {driver.lastname}</Text>
              </TextContainer>
              {driver?.email && (
                <TextContainer>
                  <Text fontWeight='bold'>
                    {t('EMAIL', 'Email')}:
                  </Text>
                  <Text>{driver.email}</Text>
                </TextContainer>
              )}
              {driver?.cellphone && (
                <TextContainer>
                  <Text fontWeight='bold'>
                    {t('CELLPHONE', 'Cellphone')}:
                  </Text>
                  <Text>{driver.cellphone}</Text>
                </TextContainer>
              )}
              {driver?.drivergroups?.length > 0 && (
                <TextContainer>
                  <Text fontWeight='bold'>
                    {t('DRIVER_GROUP', 'Driver group')}:
                  </Text>
                  {driver.drivergroups.map(group => (
                    <Text key={group.id}>{group.name},</Text>
                  ))}
                </TextContainer>
              )}
              {driver?.last_location_at && (
                <TextContainer>
                  <Text fontWeight='bold'>
                    {t('LAST_LOCATION', 'Last location')}:
                  </Text>
                  <Text>{parseDate(driver.last_location_at)}</Text>
                </TextContainer>
              )}
            </>
          )}
        </InfoContainer>
      )}
      <WrapperMapMarker
        ref={markerRef}
        type='button'
        aria-label={detailsLabel}
        aria-expanded={infoShow}
        aria-describedby={infoShow ? infoId : undefined}
        data-status={status || undefined}
        onMouseEnter={handlers.onMouseEnter}
        onMouseLeave={handlers.onMouseLeave}
        onFocus={handlers.onFocus}
        onBlur={handlers.onBlur}
        onClick={handlers.onClick}
        onKeyDown={handlers.onKeyDown}
      >
        {image
          ? (
          <MapMarkerImg bgimage={image} />
            )
          : (
          <>
            {customer && <User />}
            {driver && (
              <MapMarkerImg bgimage={theme?.images?.icons?.noDriver} />
            )}
          </>
            )}
      </WrapperMapMarker>
    </>
  )
}
