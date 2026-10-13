import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const LogisticInformation = (props) => {
  const {
    orderId,
    UIComponent
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  /**
   * Array to save logistics
   */
  const [logisticInformation, setLogisticInformation] = useState({ data: [], loading: true, error: null })

  /**
   * Method to get logistics from API
   */
  const getLogistics = async () => {
    try {
      setLogisticInformation({ ...logisticInformation, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/logistic/orders/${orderId}/information`, requestOptions)
      const { result } = await response.json()
      if (response.ok) {
        setLogisticInformation({ error: null, loading: false, data: result })
      } else {
        setLogisticInformation({ ...logisticInformation, loading: false, error: result })
      }
    } catch (err) {
      setLogisticInformation({ ...logisticInformation, loading: false, error: err.message })
    }
  }

  useEffect(() => {
    getLogistics()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          logisticInformation={logisticInformation}
          getLogistics={getLogistics}
        />
      )}
    </>
  )
}

LogisticInformation.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}
