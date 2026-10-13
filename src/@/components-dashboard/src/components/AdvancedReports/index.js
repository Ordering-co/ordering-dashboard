import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { normalizeTimezone } from '../../utils'

/**
 * Component to manage Advance Reports page behavior without UI component
 */
export const AdvancedReports = (props) => {
  const {
    UIComponent,
    endpoint,
    endpoint1
  } = props

  const [ordering] = useApi()
  const [{ token, loading }] = useSession()
  const [businessDistanceList, setBusinessDistanceList] = useState({ content: [], loading: false, error: null })
  const [businessDistanceList1, setBusinessDistanceList1] = useState({ content: [], loading: false, error: null })
  const [countryCode, setCountryCode] = useState('')

  const now = dayjs()
  const last7day = now.subtract('7', 'day').format('YYYY-MM-DD')

  const [filterList, setFilterList] = useState(
    {
      from: endpoint === 'drivers_operation_events' ? now : dayjs(last7day),
      to: now,
      businessIds: null,
      drivers_ids: null,
      franchises_id: null,
      driver_companies_ids: null,
      driver_groups_ids: null,
      delivery_types_ids: null,
      app_ids: null,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  )

  const handleChangeCode = (code) => {
    if (code === countryCode) setCountryCode('')
    else setCountryCode(code)
  }

  /**
   * Function to get Business distance list from API
   */
  const getBusinessDistanceList = async () => {
    if (loading) return
    try {
      setBusinessDistanceList({ ...businessDistanceList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      let params = `timezone=${normalizeTimezone(filterList?.timeZone)}`
      if (filterList?.from !== '' && filterList?.to !== '') params = `${params}&from=${dayjs(filterList?.from).format('YYYY-MM-DD')} 00:00:00&to=${dayjs(filterList?.to).format('YYYY-MM-DD')} 23:59:59`
      if (filterList?.businessIds && filterList?.businessIds.length > 0) params = `${params}&businesses_ids=${JSON.stringify(filterList?.businessIds)}`
      if (filterList?.drivers_ids && filterList?.drivers_ids.length > 0) params = `${params}&drivers_ids=${JSON.stringify(filterList?.drivers_ids)}`
      if (filterList?.franchises_id && filterList?.franchises_id.length > 0) params = `${params}&franchises_id=${JSON.stringify(filterList?.franchises_id)}`
      if (filterList?.driver_companies_ids && filterList?.driver_companies_ids.length > 0) params = `${params}&driver_companies_ids=${JSON.stringify(filterList?.driver_companies_ids)}`
      if (filterList?.driver_groups_ids && filterList?.driver_groups_ids.length > 0) params = `${params}&driver_groups_ids=${JSON.stringify(filterList?.driver_groups_ids)}`
      if (filterList?.delivery_types_ids && filterList?.delivery_types_ids.length > 0) params = `${params}&delivery_types_ids=${JSON.stringify(filterList?.delivery_types_ids)}`
      if (filterList?.app_ids && filterList?.app_ids.length > 0) params = `${params}&app_ids=${JSON.stringify(filterList?.app_ids)}`

      const functionFetch = `${ordering.root}/reports/${endpoint}?${params}`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setBusinessDistanceList({
          ...businessDistanceList,
          loading: false,
          content: result
        })
      } else {
        setBusinessDistanceList({
          ...businessDistanceList,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setBusinessDistanceList({
        ...businessDistanceList,
        loading: false,
        error: err
      })
    }
  }

  /**
   * Function to get Business report data list from API
   */
  const getReportsData = async () => {
    if (loading) return
    try {
      setBusinessDistanceList1({ ...businessDistanceList1, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      let params = ''
      if (filterList?.from !== '' && filterList?.to !== '') params = `from=${dayjs(filterList?.from).format('YYYY-MM-DD')} 00:00:00&to=${dayjs(filterList?.to).format('YYYY-MM-DD')} 23:59:59`
      if (filterList?.businessIds && filterList?.businessIds.length > 0) params = `${params}&businesses_ids=${JSON.stringify(filterList?.businessIds)}`
      if (filterList?.drivers_ids && filterList?.drivers_ids.length > 0) params = `${params}&drivers_ids=${JSON.stringify(filterList?.drivers_ids)}`
      if (filterList?.franchises_id && filterList?.franchises_id.length > 0) params = `${params}&franchises_id=${JSON.stringify(filterList?.franchises_id)}`
      if (filterList?.driver_companies_ids && filterList?.driver_companies_ids.length > 0) params = `${params}&driver_companies_ids=${JSON.stringify(filterList?.driver_companies_ids)}`
      if (filterList?.driver_groups_ids && filterList?.driver_groups_ids.length > 0) params = `${params}&driver_groups_ids=${JSON.stringify(filterList?.driver_groups_ids)}`
      if (filterList?.delivery_types_ids && filterList?.delivery_types_ids.length > 0) params = `${params}&delivery_types_ids=${JSON.stringify(filterList?.delivery_types_ids)}`
      if (filterList?.app_ids && filterList?.app_ids.length > 0) params = `${params}&app_ids=${JSON.stringify(filterList?.app_ids)}`

      const functionFetch = `${ordering.root}/reports/${endpoint1}?${params}`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setBusinessDistanceList1({
          ...businessDistanceList1,
          loading: false,
          content: result
        })
      } else {
        setBusinessDistanceList1({
          ...businessDistanceList1,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setBusinessDistanceList1({
        ...businessDistanceList1,
        loading: false,
        error: err
      })
    }
  }

  useEffect(() => {
    getBusinessDistanceList()
    if (endpoint1) getReportsData()
  }, [filterList])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          filterList={filterList}
          handleChangeFilterList={setFilterList}
          reportData={businessDistanceList}
          reportData1={businessDistanceList1}
          countryCode={countryCode}
          handleChangeCode={handleChangeCode}
        />
      )}
    </>
  )
}

AdvancedReports.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * String to send API request
   */
  endpoint: PropTypes.string,
  /**
   * String to send API request
   */
  endpoint1: PropTypes.string
}
