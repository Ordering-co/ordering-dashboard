import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { BREAKPOINT_PHONE } from '../../../../../utils/breakpoints'
import { BusinessDeliveryZoneDetails } from '../BusinessDeliveryZoneDetails'
import { SectionSplit } from '../../Shared/Product'
import { zoneNameOf } from '../../Shared/DeliveryZones/ZonesTable'
import { visibleZones } from '../../Shared/DeliveryZones/zoneData'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'

// redesign stores 5.8: the Delivery tab is the LIST of a P/SectionSplit and the open zone is its DETAIL (a sibling of the
// list, never inside the <form> of the tab: forms do not nest). The list (BusinessDeliveryZoneList) reads what it needs from
// `useDeliveryZonesSplit()`: `{ currentId, openZone(zone), addZone(), notFound }`. Without a provider it answers an inert value.
//
// `current` is `null` (nothing open) or `{ zone }`, where `zone` is `null` for a new one. Every way to open, switch and leave goes
// through `requestLeave` of the split, so unsaved work of the open zone is asked about first. The URL (`?zone=`) is read once on
// arrival (from window.location: the tab is also drawn outside a Router, as in the 5.7 test) and resolved the first time the zones are an array; `zone` and `zone_tab` leave the URL when the zone closes.

const URL_KEYS_OF_ZONE = ['zone', 'zone_tab']
const SPLIT_CLASS = 'odc-delivery-zones-split'

const DEFAULT_VALUE = { currentId: null, openZone: () => {}, addZone: () => {}, notFound: false }
const DeliveryZonesSplitContext = createContext(null)

export const useDeliveryZonesSplit = () => useContext(DeliveryZonesSplitContext) || DEFAULT_VALUE

export const DeliveryZonesSplit = ({ business, setIsExtendExtraOpen, handleSuccessUpdate, children }) => {
  const [, t] = useLanguage()
  const splitRef = useRef(null)
  const [current, setCurrent] = useState(null)
  const [notFound, setNotFound] = useState(false)

  const zones = business?.zones
  const loaded = Array.isArray(zones)
  const open = current != null
  const detailKey = current?.zone?.id ?? 'new'
  const currentId = current?.zone?.id ?? null

  const closeDetail = useCallback(() => {
    setCurrent(null)
    removeQueryToUrl(URL_KEYS_OF_ZONE)
  }, [])

  // ── The URL on arrival: `zone` is read once and looked up when the zones have arrived ──
  const initialZone = useRef(null)
  if (initialZone.current === null) initialZone.current = new URLSearchParams(window.location.search).get('zone') || ''
  const resolved = useRef(false)

  useEffect(() => {
    if (resolved.current || !loaded) return
    resolved.current = true
    const id = initialZone.current
    if (!id) return
    const found = visibleZones(zones).find(zone => Number(zone.id) === Number(id))
    if (found) {
      // it is what the URL already says: nothing is rewritten (zone_tab stays)
      setCurrent({ zone: found })
    } else {
      setNotFound(true)
      removeQueryToUrl(URL_KEYS_OF_ZONE)
    }
  }, [loaded, zones])

  // ── The ways to open and switch: all of them go through the guards of the detail ──
  const openZone = useCallback((zone) => {
    if (zone?.id == null || zone.id === currentId) return
    splitRef.current?.requestLeave(() => {
      setCurrent({ zone })
      setNotFound(false)
      addQueryToUrl({ zone: zone.id })
    })
  }, [currentId])

  const addZone = useCallback(() => {
    splitRef.current?.requestLeave(() => {
      setCurrent({ zone: null })
      setNotFound(false)
      removeQueryToUrl(URL_KEYS_OF_ZONE)
    })
  }, [])

  const value = useMemo(() => ({ currentId, openZone, addZone, notFound }), [currentId, openZone, addZone, notFound])

  // the title follows the list: a rename shows without waiting for the editor to hand the new zone back
  const liveZone = current?.zone ? (loaded ? zones.find(zone => zone.id === current.zone.id) : null) : null
  const detailTitle = current?.zone
    ? zoneNameOf(liveZone ?? current.zone, t)
    : t('ZONE_DELIVERY_SETTINGS', 'Zone delivery settings')

  const detail = open
    ? (
      <BusinessDeliveryZoneDetails
        key={detailKey}
        zone={current.zone}
        business={business}
        businessZones={zones}
        handleSuccessUpdate={handleSuccessUpdate}
        onClose={closeDetail}
      />
      )
    : null

  return (
    <DeliveryZonesSplitContext.Provider value={value}>
      <SectionSplit
        ref={splitRef}
        className={SPLIT_CLASS}
        // review R5.8-02: stacked (phone), a zone opened low in the list starts at its header (the piece does it: stores 5.18, )
        revealDetail
        open={open}
        detailKey={detailKey}
        splitFrom={BREAKPOINT_PHONE}
        onExtendChange={setIsExtendExtraOpen}
        detailTitle={detailTitle}
        closeLabel={t('CLOSE', 'Close')}
        backLabel={t('BACK', 'Back')}
        onClose={closeDetail}
        list={children}
        detail={detail}
      />
    </DeliveryZonesSplitContext.Provider>
  )
}
