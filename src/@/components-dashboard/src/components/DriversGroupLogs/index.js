import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const DriversGroupLogs = (props) => {
  props = { ...defaultProps, ...props }
  const {
    driversGroupId,
    UIComponent,
    paginationSettings
  } = props

  const [ordering] = useApi()
  const [session] = useSession()

  /**
   * Array to save logistics
   */
  const [logsList, setLogsList] = useState({ logs: [], loading: true, error: null })

  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage - 1 : 0,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })
  /**
   * Method to get logistics from API
   */
  const getDriversGroupLogs = async (page, pageSize) => {
    try {
      setLogsList({ ...logsList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/drivergroups/${driversGroupId}/logs?orderBy=-id&page=${page}&page_size=${pageSize}`, requestOptions)
      const { error, pagination, result } = await response.json()
      if (!error) {
        setLogsList({ ...logsList, loading: false, logs: result })
        setPaginationProps({
          ...paginationProps,
          currentPage: pagination.current_page,
          totalPages: pagination.total_pages,
          totalItems: pagination.total,
          from: pagination.from,
          to: pagination.to
        })
      } else {
        setLogsList({ ...logsList, loading: false, error })
      }
    } catch (err) {
      setLogsList({ ...logsList, loading: false, error: err.message })
    }
  }

  useEffect(() => {
    getDriversGroupLogs(1, null)
  }, [driversGroupId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          logsList={logsList}
          paginationProps={paginationProps}
          getDriversGroupLogs={getDriversGroupLogs}
        />
      )}
    </>
  )
}

DriversGroupLogs.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
