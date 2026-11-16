import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import { DriverGroupDeliveryZoneDetails } from '../DriversGroupsDeliveryZoneDetails'
import { SideBar } from '../../Shared'
import { ChevronRight } from 'react-bootstrap-icons'
import { Checkbox } from '../../../styles'

import {
  ZoneContainer,
  DeliveryZonesTable,
  AddDeliveryZoneButton,
  ZoneRow,
  ZoneOpenButton,
  ZoneOpenIconButton,
  CheckboxWrapper,
  DeliveryZonesTableWrapper,
  CheckSkeleteon,
  InfoBlock
} from './styles'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

export const DriverGroupDeliveryZoneList = (props) => {
  const {
    drivergroup,
    setIsExtendExtraOpen,
    handleSuccessUpdate,
    zoneListState,
    handleChangeZoneState,
    handleChangeAllZoneState,
    handleParentSidebarMove,
    zoneList,
    setZoneList,
    setIsOpenDetails,
    isOpenDetails
  } = props

  const [, t] = useLanguage()
  const [curZone, setCurZone] = useState(null)

  const handleCloseOption = () => {
    setIsOpenDetails(false)
    setIsExtendExtraOpen(false)
    setCurZone(null)
    handleParentSidebarMove(0)
  }

  const handleOpenZone = (zone) => {
    setCurZone(zone)
    handleParentSidebarMove(500)
    setIsExtendExtraOpen(true)
    setIsOpenDetails(true)
  }

  return (
    <>
      <ZoneContainer>
        {zoneList.loading
          ? (
              [...Array(5).keys()].map(i => (
            <DeliveryZonesTableWrapper key={i}>
              <CheckSkeleteon>
                <Skeleton width={18} height={18} />
              </CheckSkeleteon>
              <InfoBlock>
                <Skeleton width='100%' height={18} />
              </InfoBlock>
            </DeliveryZonesTableWrapper>
              ))
            )
          : (
          <DeliveryZonesTable aria-label={t('DELIVERY_ZONES_TITLE', 'Delivery zones')}>
            <thead>
              <tr>
                <th scope='col'>
                  <CheckboxWrapper>
                    <Checkbox
                      aria-label={t('SELECT_ALL', 'Select all')}
                      checked={zoneListState?.isCheckAll}
                      onChange={e => handleChangeAllZoneState(e.target.checked)}
                    />
                  </CheckboxWrapper>
                </th>
                <th scope='col'>{t('NAME', 'Name')}</th>
                <th scope='col'>{t('MINIMUM', 'Minimum')}</th>
                <th scope='col'>{t('PRICE', 'Price')}</th>
                <th scope='col'><span className='visually-hidden'>{t('ACTIONS', 'Actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {zoneList?.zones?.filter(zone => zone?.type !== 3)?.map(zone => (
                <ZoneRow
                  key={zone?.id}
                  active={zone?.id === curZone?.id}
                >
                  <td>
                    <CheckboxWrapper className='zone-enabled'>
                      <Checkbox
                        aria-labelledby={`drivers-group-zone-name-${zone.id}`}
                        checked={!!zoneListState?.changes[zone.id]}
                        onChange={e => handleChangeZoneState(zone?.id, e?.target?.checked)}
                      />
                    </CheckboxWrapper>
                  </td>
                  <th scope='row'>
                    <ZoneOpenButton
                      type='button'
                      id={`drivers-group-zone-name-${zone.id}`}
                      onClick={() => handleOpenZone(zone)}
                    >
                      {zone?.name}
                    </ZoneOpenButton>
                  </th>
                  <td>{zone?.minimum}</td>
                  <td>{zone?.price}</td>
                  <td className='arrow'>
                    <ZoneOpenIconButton
                      type='button'
                      aria-labelledby={`drivers-group-zone-name-${zone.id}`}
                      onClick={() => handleOpenZone(zone)}
                    >
                      <ChevronRight aria-hidden='true' />
                    </ZoneOpenIconButton>
                  </td>
                </ZoneRow>
              ))}
            </tbody>
          </DeliveryZonesTable>
            )}
        <AddDeliveryZoneButton
          type='button'
          onClick={() => handleOpenZone(null)}
        >
          {t('ADD_DELIVERY_ZONE', 'Add delivery zone')}
        </AddDeliveryZoneButton>
      </ZoneContainer>
      {isOpenDetails && (
        <SideBar
          isBorderShow
          open={isOpenDetails}
          onClose={() => handleCloseOption()}
        >
          <DriverGroupDeliveryZoneDetails
            zone={curZone}
            setZoneList={setZoneList}
            drivergroup={drivergroup}
            onClose={() => handleCloseOption()}
            handleSuccessUpdate={handleSuccessUpdate}
            driverGroupsZones={zoneList}
          />
        </SideBar>
      )}
    </>
  )
}
