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
      setPrintersListState({ ...printersListState, loading: true })
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
        setPrintersListState({
          ...printersListState,
          loading: false,
          printers: result
        })
      } else {
        setPrintersListState({
          ...printersListState,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setPrintersListState({
        ...printersListState,
        loading: false,
        error: err
      })
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
