import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useUtils } from '../../contexts/UtilsContext'
import { capitalize, fallbackLogisticEventsText as fallbackText } from '~ui'
import { parseLog as buildParseLog } from './parseLog'

export const Logistics = (props) => {
  const {
    orderId,
    UIComponent
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, t] = useLanguage()
  const [{ getOrderState, parseDistance }] = useUtils()

  /**
   * Array to save logistics
   */
  const [logisticList, setLogisticList] = useState({ logs: [], loading: true, error: null })

  /**
   * Method to get logistics from API
   */
  const getLogistics = async () => {
    try {
      setLogisticList({ ...logisticList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/orders/${orderId}/logs?order_id=${orderId}`, requestOptions)
      const { result } = await response.json()
      setLogisticList({ ...logisticList, loading: false, logs: result })
    } catch (err) {
      setLogisticList({ ...logisticList, loading: false, error: err.message })
    }
  }

  const parseLog = (log) => buildParseLog(log, {
    t,
    parseDistance,
    getOrderState,
    capitalize,
    fallbackText
  })

  useEffect(() => {
    getLogistics()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          logisticList={logisticList}
          parseLog={parseLog}
          getLogistics={getLogistics}
        />
      )}
    </>
  )
}

Logistics.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}
