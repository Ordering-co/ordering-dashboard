import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

export const CountryList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    isSearchByName,
    countryCode,
    filterList,
    handleChangeFilterList,
    onClose,
    handleChangeCode,
    propsToFetch
  } = props
  const [ordering] = useApi()
  const [{ user }] = useSession()

  const [countriesState, setCountriesState] = useState({ countries: [], loading: true, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [searchValue, setSearchValue] = useState(null)
  const [code, setCode] = useState(countryCode)

  const rex = new RegExp(/^[A-Za-z0-9\s]+$/g)

  /**
   * Method to change filter list
   */
  const handleClickFilterButton = async () => {
    await applyCountryFilter()
    handleChangeCode(code)
    onClose && onClose()
  }

  /**
   * Method to apply the country filter
   */
  const applyCountryFilter = async () => {
    if (!code) {
      handleChangeFilterList({ ...filterList, businessIds: null })
      return
    }

    // Admin: the backoffice endpoint is paginated (max page_size 50) and
    // reports require explicit business ids, so a whole country can't be
    // auto-enumerated. The user picks businesses from the country-scoped
    // business filter instead.
    if (user?.level === 0) {
      handleChangeFilterList({ ...filterList, businessIds: null })
      return
    }

    // Non-admin: few businesses, resolve the country to ids via the SDK.
    try {
      setActionState({ ...actionState, loading: true })
      const options = {
        headers: { 'X-Country-Code-X': code },
        query: {
          params: propsToFetch
        }
      }
      const { content: { error, result } } = await ordering.businesses().asDashboard().get(options)
      if (!error) {
        const _businessIds = result.map(business => business.id)
        handleChangeFilterList({ ...filterList, businessIds: _businessIds })
      }
      setActionState({ loading: false, error: error ? result : null })
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get the countries from API
   */
  const getCountries = async () => {
    try {
      setCountriesState({ ...countriesState, loading: true })
      let where = null
      const conditions = []
      if (searchValue) {
        const searchConditions = []
        const isSpecialCharacter = rex.test(searchValue)
        if (isSearchByName) {
          searchConditions.push(
            {
              attribute: 'name',
              value: {
                condition: 'ilike',
                value: !isSpecialCharacter ? `%${searchValue}%` : encodeURI(`%${searchValue}%`)
              }
            }
          )
        }
        conditions.push({
          conector: 'OR',
          conditions: searchConditions
        })
      }
      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const fetchEndpoint = where
        ? ordering.countries().where(where)
        : ordering.countries()
      const { content: { error, result } } = await fetchEndpoint.get()
      if (!error) {
        setCountriesState({ ...countriesState, loading: false, countries: result })
      } else {
        setCountriesState({ ...countriesState, loading: false, error: result })
      }
    } catch (err) {
      setCountriesState({ ...countriesState, loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    getCountries()
  }, [searchValue])

  useEffect(() => {
    if (!searchValue && !countriesState?.loading && countriesState?.countries?.length <= 1) {
      onClose && onClose()
    }
  }, [searchValue, countriesState])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          searchValue={searchValue}
          countriesState={countriesState}
          onSearch={setSearchValue}
          handleClickFilterButton={handleClickFilterButton}
          code={code}
          setCode={setCode}
          actionState={actionState}
        />
      )}
    </>
  )
}

CountryList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  propsToFetch: ['id', 'name', 'slug', 'franchise_id']
}
