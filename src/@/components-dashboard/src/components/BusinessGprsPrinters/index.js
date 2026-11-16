import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

/**
 * Component to manage BusinessGprsPrinters behavior without UI component
 */
export const BusinessGprsPrinters = (props) => {
  const {
    UIComponent
  } = props

  const [{ token, loading }] = useSession()
  const [ordering] = useApi()

  const [printersListState, setPrintersListState] = useState({ loading: false, printers: [], error: null })

  /**
   * Method to get printer list
   */
  const getPrinters = async () => {
    if (loading) return
    try {
      setPrintersListState(prev => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const functionFetch = `${ordering.root}/printers`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setPrintersListState(prev => ({
          ...prev,
          loading: false,
          error: null,
          printers: result
        }))
      } else {
        setPrintersListState(prev => ({
          ...prev,
          loading: false,
          error: result
        }))
      }
    } catch (err) {
      setPrintersListState(prev => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  useEffect(() => {
    getPrinters()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          printersListState={printersListState}
          getPrinters={getPrinters}
        />
      )}
    </>
  )
}

BusinessGprsPrinters.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
