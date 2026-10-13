import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const DriversAdvancedLogs = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    userId
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
  const getDriversAdvancedLogs = async (page, pageSize) => {
    try {
      setLogsList({ ...logsList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const conditions = [{
        attribute: 'author_id',
        value: userId
      }]
      const query = {
        page,
        page_size: pageSize,
        orderBy: '-created_at'
      }
      let queryString = ''
      Object.keys(query).map(param => {
        queryString = queryString + `${param}=${query[param]}&`
      })
      const response = await fetch(`${ordering.root}/tracking_events?${queryString}&where=${JSON.stringify(conditions)}`, requestOptions)
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
    getDriversAdvancedLogs(1, null)
  }, [userId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          logsList={logsList}
          paginationProps={paginationProps}
          getDriversAdvancedLogs={getDriversAdvancedLogs}
        />
      )}
    </>
  )
}

DriversAdvancedLogs.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Components types before drivers group logs
   * Array of type components, the parent props will pass to these components
   */
  beforeComponents: PropTypes.arrayOf(PropTypes.elementType),
  /**
   * Components types after drivers group logs
   * Array of type components, the parent props will pass to these components
   */
  afterComponents: PropTypes.arrayOf(PropTypes.elementType),
  /**
   * Elements before drivers group logs
   * Array of HTML/Components elements, these components will not get the parent props
   */
  beforeElements: PropTypes.arrayOf(PropTypes.element),
  /**
   * Elements after drivers group logs
   * Array of HTML/Components elements, these components will not get the parent props
   */
  afterElements: PropTypes.arrayOf(PropTypes.element)
}

const defaultProps = {
  beforeComponents: [],
  afterComponents: [],
  beforeElements: [],
  afterElements: [],
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
