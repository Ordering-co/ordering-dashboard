import React, { memo } from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { useTheme } from 'styled-components'
import { getMarkerStatus, useMarkerDisclosure } from '../mapMarkerShared'

import {
  WrapperMapMarker,
  MapMarkerImg,
  DriverInfo,
  TextContainer,
  Text
} from './styles'

const DriverMapMarkerPropsAreEqual = (prevProps, nextProps) => {
  return JSON.stringify(prevProps.driver) === JSON.stringify(nextProps.driver) &&
    prevProps.timeStatus === nextProps.timeStatus
}

export const DriverMapMarkerAndInfo = memo((props) => {
  const {
    driver,
    timeStatus
  } = props
  const [, t] = useLanguage()
  const theme = useTheme()
  const [{ parseDate, optimizeImage }] = useUtils()
  const { infoShow, infoId, infoRef, infoTop, markerRef, handlers } = useMarkerDisclosure()
  // redesign drivers-dashboard B2 (DD-11): trimmed parts joined by one space, inner spaces collapsed («Marco » + « Test» -> «Marco Test»)
  const driverName = [driver.name, driver.lastname]
    .map(part => (typeof part === 'string' ? part.trim() : part))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
  // redesign drivers-dashboard B2 (DD-07): the page asks for `driver_groups`; the old lists send `drivergroups`. Only the named ones.
  const driverGroups = (driver.drivergroups?.length ? driver.drivergroups : (driver.driver_groups || [])).filter(group => group?.name)
  const status = getMarkerStatus({ timeStatus, driver })
  const driverStatus = {
    delayed: t('DELAYED', 'Delayed'),
    offline: t('OFFLINE', 'Offline'),
    busy: t('BUSY', 'Busy'),
    available: t('AVAILABLE', 'Available')
  }[status]
  const detailsLabel = `${t('SHOW_DETAILS_FOR', 'Show details for')} ${driverName || t('DRIVER', 'Driver')}, ${driverStatus}`

  return (
    <>
      {infoShow && (
        <DriverInfo id={infoId} role='tooltip' ref={infoRef} style={{ transform: `translate(-50%, ${infoTop})` }}>
          <TextContainer>
            <Text fontWeight='bold'>
              {t('NAME', 'Name')}:
            </Text>
            <Text>{driverName}</Text>
          </TextContainer>
          {driver?.last_order_assigned_at && (
            <TextContainer>
              <Text fontWeight='bold'>
                {t('LAST_ORDER_AT', 'Last order at')}:
              </Text>
              <Text>{parseDate(driver.last_order_assigned_at)}</Text>
            </TextContainer>
          )}
          {driverGroups.length > 0 && (
            <TextContainer>
              <Text fontWeight='bold'>
                {t('DRIVER_GROUP', 'Driver group')}:
              </Text>
              {/* redesign drivers-dashboard B2 (DD-07): names joined by «, », no trailing comma */}
              <Text>{driverGroups.map(group => group.name).join(', ')}</Text>
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
        </DriverInfo>
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
        offline={!(driver.enabled && driver.available && !driver.busy)}
      >
        {driver.photo
          ? (
            <MapMarkerImg bgimage={optimizeImage(driver.photo, 'h_50,c_limit')} />
            )
          : (
            <MapMarkerImg bgimage={theme?.images?.icons?.noDriver} />
            )}
      </WrapperMapMarker>
    </>
  )
}, DriverMapMarkerPropsAreEqual)

DriverMapMarkerAndInfo.displayName = 'DriverMapMarkerAndInfo'
