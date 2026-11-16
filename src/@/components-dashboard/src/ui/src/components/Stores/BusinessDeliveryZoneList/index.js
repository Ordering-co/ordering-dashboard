import React from 'react'
import { useLanguage } from '../../../../../index'
import { Button, InlineNotice } from '../../Shared/Product'
import { Plus, TriangleAlert } from '../../Shared/Icon'
import { ZonesTable } from '../../Shared/DeliveryZones/ZonesTable'
import { visibleZones } from '../../Shared/DeliveryZones/zoneData'
import { useDeliveryZonesSplit } from './DeliveryZonesSplit'
import './delivery-zones.css'

// redesign stores 5.8: the zones of the store are the rows of the shared ZonesTable (the one of the delivery groups). Opening a
// zone and adding one belong to DeliveryZonesSplit, which wraps the whole Delivery tab (the open zone is the detail of its P/SectionSplit);
// this list reads them from `useDeliveryZonesSplit()`. The props are the contract of 5.7: `zoneListState { changes, isCheckAll }` and
// the two handlers come from the Delivery controller, whose pending map is saved by the tab's Save bar.

export const BusinessDeliveryZoneList = (props) => {
  const {
    business,
    zoneListState,
    handleChangeZoneState,
    handleChangeAllZoneState
  } = props

  const [, t] = useLanguage()
  const { currentId, openZone, addZone, notFound } = useDeliveryZonesSplit()

  const loading = !Array.isArray(business?.zones)
  const zones = visibleZones(business?.zones)
  const title = t('DELIVERY_ZONES_TITLE', 'Delivery zones')

  return (
    <section className='odc-delivery-zones'>
      <h2 className='odc-delivery-zones-title'>{title}</h2>

      {notFound && (
        <InlineNotice tone='warning' icon={TriangleAlert}>
          {t('STORE_ZONE_NOT_FOUND', "This delivery zone doesn't exist or was deleted.")}
        </InlineNotice>
      )}

      <ZonesTable
        zones={zones}
        isActive={zone => !!zoneListState?.changes?.[zone.id]}
        onToggle={(zone, next) => handleChangeZoneState(zone.id, next)}
        onToggleAll={handleChangeAllZoneState}
        allChecked={zones.length > 0 && !!zoneListState?.isCheckAll}
        activeControl='switch'
        selectedId={currentId}
        currentId={currentId}
        getRowAttributes={zone => ({ 'data-section-split-key': zone.id })}
        onOpen={openZone}
        loading={loading}
        label={title}
        loadingLabel={t('DRIVERS_GROUPS_ZONES_LOADING', 'Loading delivery zones')}
      />

      {!loading && zones.length === 0 && (
        <p className='odc-delivery-zones-empty'>{t('DRIVERS_GROUPS_ZONES_EMPTY', 'No delivery zones yet')}</p>
      )}

      <div className='odc-delivery-zones-add'>
        <Button type='button' icon={Plus} onClick={addZone}>
          {t('ADD_DELIVERY_ZONE', 'Add delivery zone')}
        </Button>
      </div>
    </section>
  )
}
