import React, { useState, useEffect } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const DeliveryzoneList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    propsToFetch,
    businessIds,
    paginationSettings
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [deliveryzoneList, setDeliveryzoneList] = useState({ zones: [], loading: false, error: null })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage - 1 : 0,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })

  /**
   * Method to get businesses from API
   */
  const getDeliveryzones = async (page, pageSize) => {
    try {
      setDeliveryzoneList({ ...deliveryzoneList, loading: true })
      let where = null
      const conditions = []

      conditions.push({
        attribute: 'type',
        value: {
          condition: '!=',
          value: 3
        }
      })

      if (businessIds) {
        conditions.push({
          attribute: 'businesses',
          conditions: [
            {
              attribute: 'business_id',
              value: businessIds
            }
          ]
        })
      }

      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }

      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const fetchEndpoint = where
        ? `${ordering.root}/delivery_zones?page=${page}&page_size=${pageSize}8&params=${propsToFetch.toString()}&filtered_by_business=[${businessIds}]&&where=${JSON.stringify(where)}`
        : `${ordering.root}/delivery_zones?page=${page}&page_size=${pageSize}8&params=${propsToFetch.toString()}&filtered_by_business=[${businessIds}]`

      const response = await fetch(fetchEndpoint, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setDeliveryzoneList({ loading: false, zones: content.result, error: null })
        setPaginationProps({
          ...paginationProps,
          currentPage: content.pagination.current_page,
          totalPages: content.pagination.total_pages,
          totalItems: content.pagination.total,
          from: content.pagination.from,
          to: content.pagination.to
        })
      }
    } catch (err) {
      setDeliveryzoneList({ ...deliveryzoneList, loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    getDeliveryzones(1, paginationProps.pageSize)
  }, [])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            deliveryzoneList={deliveryzoneList}
            paginationProps={paginationProps}
            setPaginationProps={setPaginationProps}
            getDeliveryzones={getDeliveryzones}
          />
        )
      }
    </>
  )
}

DeliveryzoneList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' },
  propsToFetch: ['name', 'minimum', 'price', 'type', 'data', 'enabled', 'business_id']
}
