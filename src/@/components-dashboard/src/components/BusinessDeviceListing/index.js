import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

/**
 * Component to manage BusinessDeviceListing behavior without UI component
 */
export const BusinessDeviceListing = (props) => {
  const {
    UIComponent
  } = props

  const [searchValue, setSearchValue] = useState(null)
  const [{ token, loading }] = useSession()
  const [ordering] = useApi()

  // redesign stores-devices (G5-36): the list starts loading, so the page never paints «No devices» before the first answer
  const [deviceListState, setDeviceListState] = useState({ loading: true, devices: [], error: null })

  /**
   * Method to update device list
   */
  const handleUpdateDeviceList = (devices) => {
    setDeviceListState(prev => ({ ...prev, devices }))
  }

  /**
   * Method to get device list
   * redesign stores-devices (G5-36): a new load clears the previous error, so «Retry» can recover a failed list
   */
  const getDevices = async () => {
    if (loading) return
    try {
      setDeviceListState(prev => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const functionFetch = `${ordering.root}/devices`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setDeviceListState(prev => ({
          ...prev,
          loading: false,
          devices: result || [],
          error: null
        }))
      } else {
        setDeviceListState(prev => ({
          ...prev,
          loading: false,
          error: result
        }))
      }
    } catch (err) {
      setDeviceListState(prev => ({
        ...prev,
        loading: false,
        error: err?.message ?? err
      }))
    }
  }

  useEffect(() => {
    getDevices()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          searchValue={searchValue}
          onSearch={setSearchValue}
          handleUpdateDeviceList={handleUpdateDeviceList}
          deviceListState={deviceListState}
          reloadDevices={getDevices}
        />
      )}
    </>
  )
}

BusinessDeviceListing.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
