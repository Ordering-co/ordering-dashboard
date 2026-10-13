import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { getDistance } from '../../utils'

/**
 * Component to manage ProductStep behavior without UI component
 */
export const ProductStep = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    orderingBusiness
  } = props

  const [ordering] = useApi()
  const [session] = useSession()

  const [countriesState, setCountriesState] = useState({ countries: [], loading: true, error: null, enabled: false })
  const [actionState, setActionState] = useState({ loading: false, error: null, content: null })
  const [businessListState, setBusinessListState] = useState({ loading: false, businesses: [], error: null })
  const [business, setBusiness] = useState()

  const allowCodes = ['us', 'usa', 'united states', 'united states of american', 'ca', 'canada']

  /**
   * Method to get business from location
   */
  const handleChangeAddress = async (ad) => {
    try {
      setBusinessListState({
        ...businessListState,
        loading: true
      })

      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const lat = ad?.location?.lat
      const lng = ad?.location?.lng
      const url = `https://integrations.ordering.co/network/search.php?latitude=${lat}&longitude=${lng}&project=${ordering.project}`

      const response = await fetch(url, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const sortedBusinessList = result.sort((a, b) => getDistance(a?.address?.lat, a?.address.lon, lat, lng) - getDistance(b?.address?.lat, b?.address.lon, lat, lng))
        setBusinessListState({
          loading: false,
          businesses: sortedBusinessList,
          error: null
        })
      } else {
        setBusinessListState({
          ...businessListState,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setBusinessListState({
        ...businessListState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to update the business from the API
   */
  const handleImport = async () => {
    try {
      setActionState({ ...actionState, loading: true })
      const { content: { error, result } } = await ordering.setAccessToken(session.token).businesses(orderingBusiness?.id).save({ external_id: business?._id })
      if (!error) {
        await importBusiness()
      } else {
        setActionState({ ...actionState, loading: false, error: result })
      }
    } catch (err) {
      setActionState({ ...actionState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to import business
   */
  const importBusiness = async () => {
    try {
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify(business)
      }
      const functionFetch = `https://integrations.ordering.co/network/sync_store.php?project=${ordering.project}`
      const response = await fetch(functionFetch, requestOptions)
      const content = await response.json()

      setActionState({
        ...actionState,
        loading: false,
        content: content?.result,
        error: content?.error ? content?.result : null
      })
    } catch (err) {
      setActionState({ ...actionState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get the countries from API
   */
  const getCountries = async () => {
    try {
      setCountriesState({ ...countriesState, loading: true })
      const { content: { error, result } } = await ordering.countries().get()
      if (!error) {
        const enabled = result.filter(country => country?.enabled).some(country => (allowCodes.includes(country?.code?.toLowerCase()) || allowCodes.includes(country?.name?.toLowerCase())))
        setCountriesState({ ...countriesState, loading: false, countries: result, enabled })
      } else {
        setCountriesState({ ...countriesState, loading: false, error: result })
      }
    } catch (err) {
      setCountriesState({ ...countriesState, loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    if (orderingBusiness?.location) handleChangeAddress({ location: orderingBusiness?.location })
  }, [orderingBusiness?.location])

  useEffect(() => {
    getCountries()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessListState={businessListState}
          setBusiness={setBusiness}
          handleImport={handleImport}
          actionState={actionState}
          business={business}
          handleChangeAddress={handleChangeAddress}
          countriesState={countriesState}
        />
      )}
    </>
  )
}

ProductStep.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  loadMorePageSize: 10,
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
