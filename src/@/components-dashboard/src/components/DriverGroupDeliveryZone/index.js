import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const DriverGroupDeliveryZone = (props) => {
  const {
    drivergroup,
    zone,
    driverGroupsZones,
    UIComponent,
    handleSuccessUpdate,
    setZoneList
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
   * Method to update the drivergroup delivery zone from API
   */
  const handleUpdateDriverGroupDeliveryZone = async () => {
    try {
      let currentChanges = { ...formState.changes }
      currentChanges = {
        ...currentChanges,
        data: JSON.stringify(formState.changes.data)
      }
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(currentChanges)
      }
      const response = await fetch(`${ordering.root}/drivergroups/${drivergroup?.id}/deliveryzones/${zone.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({
          ...formState,
          loading: false,
          changes: {}
        })
        const zones = driverGroupsZones?.zones?.filter(_zone => {
          if (_zone?.id === zone.id) {
            Object.assign(zone, content.result)
          }
          return true
        })
        setZoneList({
          zones,
          loading: false,
          error: null
        })
        showToast(ToastType.Success, t('DELIVERYZONE_SAVED', 'Delivery zone saved'))
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to add new drivergroup delivery zone from API
   */
  const handleAddDriverGroupDeliveryZone = async () => {
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
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(currentChanges)
      }
      const response = await fetch(`${ordering.root}/drivergroups/${drivergroup?.id}/deliveryzones`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({
          ...formState,
          changes: {},
          loading: false
        })
        const zones = [
          ...driverGroupsZones?.zones,
          content.result
        ]
        setZoneList({
          zones,
          loading: false,
          error: null
        })
        showToast(ToastType.Success, t('DELIVERYZONE_ADDED', 'Delivery zone added'))
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        error: err.message,
        loading: false
      })
    }
  }

  /**
   * Method to delete the drivergroup delivery zone
   * @param {Number} zoneId id of drivergroup dleivery zone
   */
  const handleDeleteDriverGroupDeliveryZone = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true
      })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/drivergroups/${drivergroup?.id}/deliveryzones/${zone.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const zones = driverGroupsZones?.zones?.filter(_zone => _zone?.id !== zone.id)
        setFormState({
          ...formState,
          loading: false
        })
        setZoneList({
          zones,
          loading: false,
          error: null
        })
        handleSuccessUpdate && handleSuccessUpdate(driverGroupsZones)
        showToast(ToastType.Success, t('DELIVERYZONE_DELETED', 'Driver group delivery zone deleted'))
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to change the drivergroup dleivey zone name, price, minimum
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e, unit) => {
    if (e.target.name === 'distance') {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          data: {
            [e.target.name]: e.target.value,
            unit
          }
        }
      })
    } else {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          [e.target.name]: e.target.value
        }
      })
    }
  }

  /**
   * Method to change the form state
   * @param {Object} updatedChange changes to update
   */
  const handleChangeFormState = (updatedChange) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        ...updatedChange
      }
    })
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
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(plainText, 'text/xml')
    const googlePolygons = []
    let placeMarkName = ''

    if (xmlDoc.documentElement.nodeName === 'kml') {
      for (const item of xmlDoc.getElementsByTagName('Placemark')) {
        placeMarkName = item.getElementsByTagName('name')[0].childNodes[0].nodeValue.trim()
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
      setFormState({
        ...formState,
        error: t('INVALID_KML_FILE', 'Invalid KML file')
      })
    }

    if (googlePolygons.length === 1) {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          type: 2,
          name: placeMarkName,
          data: googlePolygons[0]
        }
      })
      setKmlData(googlePolygons[0])
    } else {
      setFormState({
        ...formState,
        error: t('INVALID_KML_FILE', 'Invalid KML file')
      })
    }
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
            handleDeleteDriverGroupDeliveryZone={handleDeleteDriverGroupDeliveryZone}
            handleUpdateDriverGroupDeliveryZone={handleUpdateDriverGroupDeliveryZone}
            handleAddDriverGroupDeliveryZone={handleAddDriverGroupDeliveryZone}
            handleUploadKmlFiles={handleUploadKmlFiles}
          />
        )
      }
    </>
  )
}

DriverGroupDeliveryZone.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
  * drivergroup, this must be contains an object with all drivergroup info
  */
  drivergroup: PropTypes.object
}
