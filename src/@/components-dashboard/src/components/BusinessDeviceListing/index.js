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

  const [deviceListState, setDeviceListState] = useState({ loading: false, devices: [], error: null })

  /**
   * Method to update device list
   */
  const handleUpdateDeviceList = (devices) => {
    setDeviceListState({ ...deviceListState, devices })
  }

  /**
   * Method to get device list
   */
  const getDevices = async () => {
    if (loading) return
    try {
      setDeviceListState({ ...deviceListState, loading: true })
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
        setDeviceListState({
          ...deviceListState,
          loading: false,
          devices: result
        })
      } else {
        setDeviceListState({
          ...deviceListState,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setDeviceListState({
        ...deviceListState,
        loading: false,
        error: err
      })
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
