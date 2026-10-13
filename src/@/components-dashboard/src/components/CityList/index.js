import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useApi } from '../../contexts/ApiContext'

export const CityList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    cities,
    propsToFetch,
    UIComponent
  } = props

  const [ordering] = useApi()

  /**
   * Array to save cities
   */
  const [citiesList, setCitiesList] = useState({ cities: [], loading: true, error: null })

  /**
   * Method to get cities from API
   */
  const getCities = async () => {
    try {
      setCitiesList({ ...citiesList, loading: true })
      const { content: { error, result } } = await ordering.countries().select(propsToFetch).get()

      let cities = []
      if (!error) {
        for (const country of result) {
          if (country?.enabled) {
            cities = [...cities, ...country?.cities]
          }
        }
        setCitiesList({ ...citiesList, loading: false, cities })
      }
    } catch (err) {
      setCitiesList({ ...citiesList, loading: false, error: err.message })
    }
  }

  useEffect(() => {
    if (cities) {
      setCitiesList({ ...citiesList, loading: false, cities })
    } else {
      getCities()
    }
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          citiesList={citiesList}
        />
      )}
    </>
  )
}

CityList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of cities props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: ['id', 'name', 'enabled', 'cities']
}
