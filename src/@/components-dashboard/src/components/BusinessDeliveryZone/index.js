import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const BusinessDeliveryZone = (props) => {
  const {
    business,
    zone,
    UIComponent,
    handleSuccessUpdate
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [zoneState, setZoneState] = useState({ zone })
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  const [kmlData, setKmlData] = useState(null)

  /**
   * Clean formState
   */
  const cleanFormState = () => setFormState({ loading: false, changes: {}, error: null })

  /**
   * Method to update the business delivery zone from API
   * redesign stores 2.F: `handleUpdateBusinessDeliveryZone({ snooze_until }, { keepPendingChanges: true })`
   * saves only the given keys and leaves the other pending edits of the form (and `error`) alone. Without the option it
   * sends every pending change, as before.
   * @param {Object} partialChanges changes to send, only read with `options.keepPendingChanges`
   * @param {Object} options { keepPendingChanges }
   * @returns {Promise<{ ok: true } | { ok: false, error }>}
   */
  const handleUpdateBusinessDeliveryZone = async (partialChanges, options) => {
    const keepPending = !!options?.keepPendingChanges &&
      !!partialChanges && Object.getPrototypeOf(partialChanges) === Object.prototype
    const finishKeepingPending = (sentKeys) => setFormState(prev => {
      const sentPending = sentKeys.some(key => key in prev.changes)
      return {
        ...prev,
        loading: false,
        changes: sentPending
          ? Object.fromEntries(Object.entries(prev.changes).filter(([key]) => !sentKeys.includes(key)))
          : prev.changes
      }
    })
    try {
      const currentChanges = { ...(keepPending ? partialChanges : formState.changes) }
      if (currentChanges.data) {
        currentChanges.data = JSON.stringify(currentChanges.data)
      }
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      if (keepPending) {
        setFormState(prev => ({ ...prev, loading: true }))
      } else {
        // G3-20: a new request starts without the error of the last one
        setFormState(prev => ({ ...prev, loading: true, error: null }))
      }
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(currentChanges)
      }
      const response = await fetch(`${ordering.root}/business/${business?.id}/deliveryzones/${zone.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        if (keepPending) {
          finishKeepingPending(Object.keys(partialChanges))
        } else {
          setFormState(prev => ({ ...prev, loading: false, changes: {} }))
        }
        const zones = business.zones.filter(_zone => {
          if (_zone?.id === zone.id) {
            Object.assign(zone, content.result)
          }
          return true
        })
        const _business = { ...business, zones }
        handleSuccessUpdate && handleSuccessUpdate(_business)
        showToast(ToastType.Success, t('DELIVERYZONE_SAVED', 'Delivery zone saved'))
        return { ok: true }
      } else {
        if (keepPending) {
          setFormState(prev => ({ ...prev, loading: false }))
        } else {
          setFormState(prev => ({ ...prev, loading: false, error: content.result }))
        }
        return { ok: false, error: content.result }
      }
    } catch (err) {
      if (keepPending) {
        setFormState(prev => ({ ...prev, loading: false }))
      } else {
        setFormState(prev => ({ ...prev, loading: false, error: [err.message] }))
      }
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to add new business delivery zone from API
   * redesign stores 5.8: answers `{ ok: true }` or `{ ok: false, error }`, like the update does. The request, the
   * body, the toasts, `handleSuccessUpdate` and `props.onClose()` are as they were.
   * @returns {Promise<{ ok: true } | { ok: false, error }>}
   */
  const handleAddBusinessDeliveryZone = async () => {
    try {
      let currentChanges = { ...formState.changes }
      currentChanges = {
        ...currentChanges,
        data: JSON.stringify(formState.changes.data),
        type: formState.changes?.type || 2,
        enabled: true,
        schedule: JSON.stringify([
          { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
          { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
          { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
          { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
          { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
          { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
          { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] }
        ])
      }
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState(prev => ({ ...prev, loading: true, error: null })) // G3-20
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(currentChanges)
      }
      const response = await fetch(`${ordering.root}/business/${business?.id}/deliveryzones`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState(prev => ({ ...prev, changes: {}, loading: false }))
        const zones = [
          ...business.zones,
          content.result
        ]
        const _business = { ...business, zones }
        handleSuccessUpdate && handleSuccessUpdate(_business)
        showToast(ToastType.Success, t('DELIVERYZONE_ADDED', 'Delivery zone added'))
        props.onClose && props.onClose()
        return { ok: true }
      } else {
        setFormState(prev => ({ ...prev, loading: false, error: content.result }))
        return { ok: false, error: content.result }
      }
    } catch (err) {
      setFormState(prev => ({ ...prev, error: err.message, loading: false }))
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to delete the business delivery zone
   * redesign stores 5.8: answers `{ ok: true }` or `{ ok: false, error }` (the confirmation dialog stays open and says
   * why). The request, the toasts, `handleSuccessUpdate` and `props.onClose()` are as they were.
   * @returns {Promise<{ ok: true } | { ok: false, error }>}
   */
  const handleDeleteBusinessDeliveryZone = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState(prev => ({ ...prev, loading: true, error: null })) // G3-20
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business?.id}/deliveryzones/${zone.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const zones = business.zones.filter(_zone => _zone?.id !== zone.id)
        setFormState(prev => ({ ...prev, loading: false }))
        const _business = { ...business, zones }
        handleSuccessUpdate && handleSuccessUpdate(_business)
        showToast(ToastType.Success, t('DELIVERYZONE_DELETED', 'Business delivery zone deleted'))
        props.onClose && props.onClose()
        return { ok: true }
      } else {
        // review R5.8-01: the caller (the delete confirmation) says why; the form's own error is not set, or it says it twice
        setFormState(prev => ({ ...prev, loading: false }))
        return { ok: false, error: content.result }
      }
    } catch (err) {
      setFormState(prev => ({ ...prev, loading: false }))
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to change the business dleivey zone name, price, minimum
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e, unit) => {
    // G3-20: functional updates (an edit never overwrites another one made in the same tick) that also clear `error`, so the
    // notice of the last request does not reopen while the user types. The event is read now: the updater may run later.
    const { name, value } = e.target
    if (name === 'distance') {
      setFormState(prev => ({
        ...prev,
        error: null,
        changes: {
          ...prev.changes,
          data: {
            [name]: value,
            unit
          }
        }
      }))
    } else {
      setFormState(prev => ({
        ...prev,
        error: null,
        changes: {
          ...prev.changes,
          [name]: value
        }
      }))
    }
  }

  /**
   * Method to change the form state
   * @param {Object} updatedChange changes to update
   */
  const handleChangeFormState = (updatedChange) => {
    // G3-20: functional update that also clears `error` (see handleChangeInput)
    setFormState(prev => ({
      ...prev,
      error: null,
      changes: {
        ...prev.changes,
        ...updatedChange
      }
    }))
  }

  const handleUploadKmlFiles = (files) => {
    if (files.length === 1) {
      const reader = new window.FileReader()
      reader.readAsText(files[0])
      reader.onload = () => {
        extractGoogleCoords(reader.result)
      }
    }
  }

  const extractGoogleCoords = (plainText) => {
    try {
      setFormState(prevState => ({ ...prevState, error: null }))
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(plainText, 'text/xml')
      const googlePolygons = []
      let placeMarkName = ''

      if (xmlDoc.documentElement.nodeName === 'kml') {
        placeMarkName = xmlDoc.getElementsByTagName('name')[0].childNodes[0].nodeValue.trim()
        for (const item of xmlDoc.getElementsByTagName('Placemark')) {
          const polygons = item.getElementsByTagName('Polygon')
          for (const polygon of polygons) {
            let coords = polygon.getElementsByTagName('coordinates')[0].childNodes[0].nodeValue.trim()
            coords = coords.replace(/\n/g, ' ').replace(/\s+/g, ' ')
            const points = coords.split(' ')
            const googlePolygonsPaths = []
            for (const point of points) {
              const coord = point.split(',')
              googlePolygonsPaths.push({ lat: +coord[1], lng: +coord[0] })
            }
            googlePolygons.push(googlePolygonsPaths)
          }
        }
      } else {
        setFormState(prevState => ({ ...prevState, error: t('INVALID_KML_FILE', 'Invalid KML file') }))
      }
      if (googlePolygons.length === 0) {
        setFormState(prevState => ({ ...prevState, error: t('NO_POLYGONS_FOUND', 'No polygons found in KML file') }))
        return
      }

      const MAX_POINTS = 1000
      const simplifiedPolygons = googlePolygons.map(polygon => simplifyPolygon(polygon, MAX_POINTS))

      if (simplifiedPolygons.length === 1) {
        setFormState(prevState => {
          return {
            ...prevState,
            changes: {
              ...prevState.changes,
              type: 2,
              name: placeMarkName,
              data: simplifiedPolygons[0]
            }
          }
        })
        setKmlData(simplifiedPolygons[0])
      } else {
        setFormState(prevState => ({ ...prevState, error: t('INVALID_KML_FILE', 'Invalid KML file') }))
      }
    } catch (error) {
      setFormState(prevState => ({ ...prevState, error: t('INVALID_KML_FILE', 'Invalid KML file') }))
    }
  }

  const simplifyPolygon = (polygon, maxPoints) => {
    const totalPoints = polygon.length
    if (totalPoints <= maxPoints) {
      return polygon
    }

    const interval = Math.floor(totalPoints / maxPoints)
    return polygon.filter((point, index) => index % interval === 0)
  }

  useEffect(() => {
    cleanFormState()
    setZoneState({
      zone
    })
  }, [zone])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            zoneState={zoneState}
            formState={formState}
            kmlData={kmlData}
            handleChangeInput={handleChangeInput}
            handleChangeFormState={handleChangeFormState}
            handleDiscardChanges={cleanFormState}
            handleDeleteBusinessDeliveryZone={handleDeleteBusinessDeliveryZone}
            handleUpdateBusinessDeliveryZone={handleUpdateBusinessDeliveryZone}
            handleAddBusinessDeliveryZone={handleAddBusinessDeliveryZone}
            handleUploadKmlFiles={handleUploadKmlFiles}
          />
        )
      }
    </>
  )
}

BusinessDeliveryZone.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
  * Business, this must be contains an object with all business info
  */
  business: PropTypes.object
}
