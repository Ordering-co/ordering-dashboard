import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useApi } from '../../contexts/ApiContext'

export const BusinessBasicInformation = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    business,
    businessId,
    businessParams
  } = props

  const [ordering] = useApi()
  const [businessState, setBusinessState] = useState({ business: {}, loading: false, error: null })
  const requestsState = {}

  /**
   * Method to get business from SDK
   */
  const getBusiness = async (id) => {
    const source = {}
    requestsState.business = source
    return await ordering.businesses(id)
      .select(businessParams)
      .parameters({ location: '40.7539143,-73.9810162', type: 1 })
      .get({ cancelToken: source })
  }

  /**
   * Method to call business get method
   */
  const loadBusiness = async () => {
    try {
      setBusinessState({
        ...businessState,
        loading: true
      })
      const { content: { result } } = await getBusiness(businessId)
      setBusinessState({
        ...businessState,
        loading: false,
        business: result
      })
    } catch (err) {
      setBusinessState({
        ...businessState,
        loading: false,
        error: [err]
      })
    }
  }

  useEffect(() => {
    if (business) {
      setBusinessState({
        ...businessState,
        business
      })
    } else {
      loadBusiness()
    }
    return () => {
      if (requestsState.business) {
        requestsState.business.cancel()
      }
    }
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessState={businessState}
        />
      )}
    </>
  )
}

BusinessBasicInformation.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Contain basic information for a business
   */
  business: PropTypes.object,
  businessParams: PropTypes.arrayOf(string)
}

const defaultProps = {
  businessParams: ['header', 'logo', 'name', 'today', 'delivery_price', 'minimum', 'description', 'distance', 'delivery_time', 'pickup_time', 'reviews']
}
