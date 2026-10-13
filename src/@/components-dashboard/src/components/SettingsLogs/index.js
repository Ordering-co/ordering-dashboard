import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'

/**
 * Component to get settings logs without UI component
 */
export const SettingsLogs = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings
  } = props

  const [ordering] = useApi()

  const [logsList, setLogsList] = useState({ logs: [], loading: true, error: null })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage - 1 : 0,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })

  /**
   * Method to get settings logs from API
   */
  const getSettingsLogs = async (page, pageSize) => {
    try {
      setLogsList({ ...logsList, loading: true })
      const response = await fetch(`${ordering.root}/configs/logs?orderBy=-id&page=${page}&page_size=${pageSize}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      const res = await response.json()
      setLogsList({
        loading: false,
        logs: res.error ? [] : res.result,
        error: res.error
          ? Array.isArray(res.result) ? res.result[0] : res.result
          : null
      })
      setPaginationProps({
        ...paginationProps,
        currentPage: res?.pagination?.current_page,
        totalPages: res?.pagination?.total_pages,
        totalItems: res?.pagination?.total,
        from: res?.pagination?.from,
        to: res?.pagination?.to
      })
    } catch (error) {
      setLogsList({
        ...logsList,
        loading: false,
        error: error?.message ?? error
      })
    }
  }

  useEffect(() => {
    getSettingsLogs(1, null)
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          logsList={logsList}
          paginationProps={paginationProps}
          getSettingsLogs={getSettingsLogs}
        />
      )}
    </>
  )
}

SettingsLogs.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Pagination settings to config pagination behavior
   * {initialPage, pageSize, controlType}
   * initialPage: Initial page to show
   * pageSize: Number of logs to show per page
   * controlType: Can be 'infinity' or 'pages'
   * - infinity: Will show all logs in one page
   * - pages: Will show logs with pages
   */
  paginationSettings: PropTypes.shape({
    initialPage: PropTypes.number,
    pageSize: PropTypes.number,
    controlType: PropTypes.string
  })
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
