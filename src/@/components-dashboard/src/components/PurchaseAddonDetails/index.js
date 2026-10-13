import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

/**
 * Component to manage Purchase addon page behavior without UI component
 */
export const PurchaseAddonDetails = (props) => {
  const {
    UIComponent,
    selectedAddon
  } = props

  const [{ user, token, loading }] = useSession()
  const [ordering] = useApi()
  const [addonPurchaseState, setAddonPurchaseState] = useState({ result: {}, loading: false, error: null })

  /**
   * Method purchase addon
   */
  const handlePurchaseAddon = async () => {
    if (loading) return
    try {
      setAddonPurchaseState({ ...addonPurchaseState, loading: true, isWaitReload: true })
      const payload = {
        user_id: user?.id,
        period: 'monthly',
        addons: [
          selectedAddon?.id
        ]
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }

      const functionFetch = `${ordering.root}/billing/subscriptions/addons`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()

      setAddonPurchaseState({
        ...addonPurchaseState,
        loading: false,
        isWaitReload: !error,
        result: error ? null : result,
        error: error ? result : null
      })
    } catch (err) {
      setAddonPurchaseState({
        ...addonPurchaseState,
        loading: false,
        error: err
      })
    }
  }

  const handleResetState = () => {
    setAddonPurchaseState({ result: {}, loading: false, error: null })
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          addonPurchaseState={addonPurchaseState}
          handlePurchaseAddon={handlePurchaseAddon}
          handleResetState={handleResetState}
        />
      )}
    </>
  )
}

PurchaseAddonDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Object of selected addon
   */
  selectedAddon: PropTypes.object
}
