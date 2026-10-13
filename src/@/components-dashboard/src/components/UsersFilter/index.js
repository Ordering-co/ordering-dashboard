import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

export const USERS_FILTER_INITIAL_VALUES = {
  id: null,
  externalId: null,
  name: null,
  lastname: null,
  email: null,
  cityIds: [],
  cellphone: null,
  countryPhoneCode: null,
  phoneVerified: null,
  emailVerified: null,
  userType: null,
  loyaltyLevel: null,
  enabled: null,
  ordersCount: { value: '', condition: 'eq' },
  dateType: null,
  deliveryFromDatetime: null,
  deliveryEndDatetime: null
}

const getInitialFilterValues = () => JSON.parse(JSON.stringify(USERS_FILTER_INITIAL_VALUES))

export const UsersFilter = (props) => {
  const {
    UIComponent,
    filterSeed
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  /**
   * This property is used to set in state the current value
  */
  const [filterValues, setFilterValues] = useState(() => ({ ...getInitialFilterValues(), ...(filterSeed?.values || {}) }))

  // Filters carried from the command palette (`/users/customers?q=`)
  const appliedSeedKey = useRef(filterSeed?.key || null)
  useEffect(() => {
    if (!filterSeed?.values || filterSeed.key === appliedSeedKey.current) return
    appliedSeedKey.current = filterSeed.key
    setFilterValues({ ...getInitialFilterValues(), ...filterSeed.values })
  }, [filterSeed?.key])

  const [loyaltyLevelState, setLoyaltyLevelState] = useState({ loading: false, error: null, levels: [] })

  /**
   * Changer order Id
   * @param {object} changes filter values
   */
  const handleChangeValue = (changes) => {
    setFilterValues({ ...filterValues, ...changes })
  }

  /**
   * Change city
   * * @param {number} cityId city id of business
  */
  const handleChangeCity = (cityId) => {
    let _cityIds = [...filterValues.cityIds]
    if (!_cityIds.includes(cityId)) {
      _cityIds.push(cityId)
    } else {
      _cityIds = _cityIds.filter((_cityId) => _cityId !== cityId)
    }
    setFilterValues({ ...filterValues, cityIds: _cityIds })
  }

  /**
   * Reset filter values
  */
  const handleResetFilterValues = () => {
    setFilterValues(getInitialFilterValues())
  }

  const getLoyaltyLevels = async () => {
    try {
      setLoyaltyLevelState({ ...loyaltyLevelState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const fetchEndpoint = `${ordering.root}/loyalty_levels`
      const response = await fetch(fetchEndpoint, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setLoyaltyLevelState({
          ...loyaltyLevelState,
          loading: false,
          error: null,
          levels: result
        })
      } else {
        setLoyaltyLevelState({
          ...loyaltyLevelState,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setLoyaltyLevelState({
        ...loyaltyLevelState,
        loading: false,
        error: error.message
      })
    }
  }

  /**
   * Change date type
   * * @param {string} dateType date type
  */
  const handleChangeDateType = (dateType) => {
    const now = dayjs()
    switch (dateType) {
      case 'default':
        setFilterValues({ ...filterValues, dateType: 'default', deliveryFromDatetime: null, deliveryEndDatetime: null })
        break
      case 'today': {
        const today = now.format('YYYY-MM-DD')
        const todayDatetime = dayjs(today).format('YYYY-MM-DD HH:mm:ss')
        setFilterValues({ ...filterValues, dateType: 'today', deliveryFromDatetime: todayDatetime })
        break
      }
      case 'yesterday': {
        const yesterday = now.subtract('1', 'day').format('YYYY-MM-DD')
        const yesterdayDatetime = dayjs(yesterday).format('YYYY-MM-DD HH:mm:ss')
        setFilterValues({ ...filterValues, dateType: 'yesterday', deliveryFromDatetime: yesterdayDatetime })
        break
      }
      case 'last7': {
        const last7day = now.subtract('7', 'day').format('YYYY-MM-DD')
        const last7Datetime = dayjs(last7day).format('YYYY-MM-DD HH:mm:ss')
        setFilterValues({ ...filterValues, dateType: 'last7', deliveryFromDatetime: last7Datetime })
        break
      }
      case 'last30': {
        const last30day = now.subtract('30', 'day').format('YYYY-MM-DD')
        const last30Datetime = dayjs(last30day).format('YYYY-MM-DD HH:mm:ss')
        setFilterValues({ ...filterValues, dateType: 'last30', deliveryFromDatetime: last30Datetime })
        break
      }
      case 'term':
        setFilterValues({ ...filterValues, dateType: 'term', deliveryFromDatetime: null, deliveryEndDatetime: null })
    }
  }

  /**
   * Change start date
   * * @param {date} fromDate start date
  */
  const handleChangeFromDate = (fromDate) => {
    let fromDatetime
    if (fromDate !== null) {
      fromDatetime = dayjs(fromDate).format('YYYY-MM-DD HH:mm:ss')
    } else {
      fromDatetime = null
    }
    setFilterValues({ ...filterValues, deliveryFromDatetime: fromDatetime })
  }

  /**
   * Change end date
   * * @param {date} endDate end date
  */
  const handleChangeEndDate = (endDate) => {
    let endDatetime
    if (endDate !== null) {
      endDatetime = dayjs(endDate).format('YYYY-MM-DD HH:mm:ss')
    } else {
      endDate = null
    }
    setFilterValues({ ...filterValues, deliveryEndDatetime: endDatetime })
  }

  useEffect(() => {
    getLoyaltyLevels()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          filterValues={filterValues}
          handleChangeValue={handleChangeValue}
          handleChangeCity={handleChangeCity}
          handleResetFilterValues={handleResetFilterValues}
          loyaltyLevelState={loyaltyLevelState}
          handleChangeDateType={handleChangeDateType}
          handleChangeFromDate={handleChangeFromDate}
          handleChangeEndDate={handleChangeEndDate}
        />
      )}
    </>
  )
}

UsersFilter.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
