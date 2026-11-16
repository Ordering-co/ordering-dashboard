import React, { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

// redesign stores 5.7 · Delivery of «Delivery, pickup & more». The zones' enables are kept as the SAVED map (from
// `business.zones`, without the type 3 ones) and a PENDING map of only the zones whose value differs from it; the list shows the
// two merged. `saveDelivery(fieldChanges)` writes every pending zone in series (a failure does not stop the rest), then the
// changed fields of the business (even if a zone failed), tells the editor ONCE and answers what failed. No toasts: the form
// shows the failure in its save bar.

const isListed = (zone) => zone?.type !== 3

// The first text of an API answer or an error (a string or a list of them), or null
const firstMessage = (value) => {
  const message = Array.isArray(value) ? value.find(item => typeof item === 'string' && item.trim()) : value
  return typeof message === 'string' && message.trim() ? message : null
}

const savedMapOf = (zones) => {
  const saved = {}
  ;(Array.isArray(zones) ? zones : []).filter(isListed).forEach(zone => { saved[zone.id] = !!zone.enabled })
  return saved
}

// the pending enables that still differ from the saved ones, of the zones that still exist
const prunePending = (pending, saved) => {
  const next = {}
  Object.keys(pending).forEach(id => {
    if (id in saved && pending[id] !== saved[id]) next[id] = pending[id]
  })
  return next
}

const sameKeys = (a, b) => {
  const keysA = Object.keys(a)
  return keysA.length === Object.keys(b).length && keysA.every(key => key in b && a[key] === b[key])
}

export const BusinessDeliveryDetails = (props) => {
  props = { ...defaultProps, ...props }
  const {
    business,
    UIComponent,
    handleUpdateBusinessState,
    propsToFetch
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [pending, setPending] = useState({})
  const mounted = useRef(true)

  const saved = useMemo(() => savedMapOf(business?.zones), [business?.zones])
  const livePending = useMemo(() => prunePending(pending, saved), [pending, saved])

  // the props the save reads when it ends, not the ones of the render that started it
  const latest = useRef({})
  latest.current = { business, ordering, session, handleUpdateBusinessState, saved, pending: livePending }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  /**
  * Method to get the business zones from API
  */
  const getBusinessZones = async () => {
    try {
      const { content: { error, result } } = await ordering.setAccessToken(session.token).businesses(business.id).select(propsToFetch).asDashboard().get()
      const _business = Array.isArray(result) ? null : result
      if (!error) {
        handleUpdateBusinessState(_business)
      } else {
        setActionState({
          loading: false,
          error: [result]
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to update the business delivery zone enable state from API
   */
  const handleUpdateDeliveryZoneState = async (zoneId, enabled) => {
    const { ordering: api, session: current, business: currentBusiness } = latest.current
    const response = await fetch(`${api.root}/business/${currentBusiness?.id}/deliveryzones/${zoneId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${current.token}`
      },
      body: JSON.stringify({ enabled })
    })
    const content = await response.json()
    if (content.error) {
      throw new Error(firstMessage(content.result) ?? '')
    }
    return content.result
  }

  /**
   * Method to update the business from the API
   */
  const handleDeliveryStateSave = async (changes) => {
    const { ordering: api, session: current, business: currentBusiness } = latest.current
    const { content: { error, result } } = await api.businesses(currentBusiness.id).save(changes, {
      accessToken: current.token
    })
    if (error) throw new Error(firstMessage(result) ?? firstMessage(error) ?? '')
    return result
  }

  const saveDelivery = async (fieldChanges = {}) => {
    const { business: startBusiness, pending: toSave } = latest.current
    const zonesById = {}
    ;(startBusiness?.zones || []).forEach(zone => { zonesById[zone.id] = zone })

    // 1. every pending zone, in series; a failure is collected and the next one goes on
    const savedZones = {}
    const failedZones = []
    for (const key of Object.keys(toSave)) {
      const zoneId = Number(key)
      try {
        await handleUpdateDeliveryZoneState(zoneId, toSave[key])
        savedZones[zoneId] = toSave[key]
      } catch (err) {
        failedZones.push({ id: zoneId, name: zonesById[zoneId]?.name ?? '', message: err?.message ?? '' })
      }
    }

    // 2. the fields of the business, even if a zone failed
    let savedFields = null
    let error = null
    if (fieldChanges && Object.keys(fieldChanges).length) {
      try {
        savedFields = await handleDeliveryStateSave(fieldChanges)
      } catch (err) {
        error = err?.message ?? ''
      }
    }

    // 3. the editor learns once, from the latest props; `zones` goes last so a stale one in the result never wins
    const savedIds = Object.keys(savedZones)
    if (savedIds.length || savedFields) {
      const zones = (latest.current.business?.zones || []).map(zone => (
        zone.id in savedZones ? { ...zone, enabled: savedZones[zone.id] } : zone
      ))
      latest.current.handleUpdateBusinessState?.({ ...(savedFields && typeof savedFields === 'object' ? savedFields : {}), zones })
    }
    if (savedIds.length && mounted.current) {
      // what was sent leaves pending, unless the user changed it again while it was saving
      setPending(current => {
        const next = { ...current }
        savedIds.forEach(id => { if (next[id] === savedZones[id]) delete next[id] })
        return next
      })
    }

    return { ok: !failedZones.length && error === null, error, failedZones }
  }

  const discardZones = () => setPending({})

  const handleChangeZoneState = (zoneId, enabled) => {
    setPending(current => {
      const next = { ...current }
      if (latest.current.saved[zoneId] === enabled) delete next[zoneId]
      else next[zoneId] = enabled
      return next
    })
  }

  const handleChangeAllZoneState = (enabled) => {
    const next = {}
    Object.keys(latest.current.saved).forEach(id => {
      if (latest.current.saved[id] !== enabled) next[id] = enabled
    })
    setPending(next)
  }

  // a zone that was deleted or whose saved value caught up leaves the pending state for good
  useEffect(() => {
    setPending(current => {
      const next = prunePending(current, saved)
      return sameKeys(current, next) ? current : next
    })
  }, [saved])

  useEffect(() => {
    if (!business?.zones) getBusinessZones()
  }, [business?.zones])

  const zoneListState = useMemo(() => {
    const ids = Object.keys(saved)
    const changes = {}
    ids.forEach(id => { changes[id] = id in livePending ? livePending[id] : saved[id] })
    return {
      changes,
      isCheckAll: ids.length > 0 && ids.every(id => changes[id]),
      isDirty: Object.keys(livePending).length > 0
    }
  }, [saved, livePending])

  const pendingZones = useMemo(() => {
    const zones = business?.zones || []
    return Object.keys(livePending).map(key => ({ id: Number(key), name: zones.find(zone => zone.id === Number(key))?.name ?? '' }))
  }, [livePending, business?.zones])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            actionState={actionState}
            zoneListState={zoneListState}
            pendingZones={pendingZones}
            saveDelivery={saveDelivery}
            discardZones={discardZones}
            handleChangeAllZoneState={handleChangeAllZoneState}
            handleChangeZoneState={handleChangeZoneState}
          />
        )
      }
    </>
  )
}

BusinessDeliveryDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of delivery zone props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: ['id', 'zones', 'header', 'logo', 'timezone']
}
