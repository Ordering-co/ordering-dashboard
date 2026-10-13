import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { normalizeTimezone } from '../../utils'

export const EcommerceAnalitycs = (props) => {
  const {
    UIComponent
  } = props

  const [{ token, loading }] = useSession()
  const [ordering] = useApi()

  const [filterList, setFilterList] = useState({
    from: null,
    to: null,
    userIds: null,
    businessIds: null,
    app_id: 'all',
    driver_groups_ids: null,
    franchises_id: null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
  const [trackingEventsList, setTrackingEventsList] = useState({ loading: true, data: [], error: null })

  const [countryCode, setCountryCode] = useState('')

  const handleChangeCode = (code) => {
    if (code === countryCode) setCountryCode('')
    else setCountryCode(code)
  }

  const paramsForAPI = (type) => {
    const rootUrl = `${ordering.root}/reports/${type}`
    let params = `timezone=${normalizeTimezone(filterList?.timeZone)}`
    if (filterList?.from) params = `${params}&from=${filterList?.from}`
    if (filterList?.to) params = `${params}&to=${filterList?.to}`
    if (filterList?.userIds) params = `${params}&drivers=${filterList?.userIds?.toString()}`
    if (filterList?.businessIds && filterList?.businessIds.length > 0) params = `${params}&businesses=${filterList?.businessIds?.toString()}`
    if (filterList?.app_id && filterList.app_id !== 'all') params = `${params}&app_id=${filterList?.app_id}`
    if (filterList?.driver_groups_ids) params = `${params}&driver_groups_ids=${JSON.stringify(filterList?.driver_groups_ids)}`
    if (filterList?.franchises_id) params = `${params}&franchises_id=${JSON.stringify(filterList?.franchises_id)}`
    return `${rootUrl}?${params}`
  }

  const getTrackingEvents = async () => {
    if (loading) return
    try {
      setTrackingEventsList({ ...trackingEventsList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const functionFetch = paramsForAPI('tracking_events')

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setTrackingEventsList({
          ...trackingEventsList,
          loading: false,
          data: result
        })
      } else {
        setTrackingEventsList({
          ...trackingEventsList,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setTrackingEventsList({
        ...trackingEventsList,
        loading: false,
        error: err
      })
    }
  }

  useEffect(() => {
    getTrackingEvents()
  }, [filterList])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          filterList={filterList}
          trackingEventsList={trackingEventsList}
          handleChangeFilterList={setFilterList}
          countryCode={countryCode}
          handleChangeCode={handleChangeCode}
        />
      )}
    </>
  )
}

EcommerceAnalitycs.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
