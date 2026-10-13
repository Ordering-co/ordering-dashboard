import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

/**
 * Component to manage ProfessionalBusinessService behavior without UI component
 */
export const ProfessionalBusinessService = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    propsToFetch,
    isSearchByName,
    user
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [searchValue, setSearchValue] = useState(null)
  const [businessList, setBusinessList] = useState({ loading: false, businesses: [], result: { error: null } })
  const [userServiceList, setUserServiceList] = useState({ loading: false, services: [], result: { error: null } })
  const [businessIds, setBusinessIds] = useState()

  const rex = new RegExp(/^[A-Za-z0-9\s]+$/g)

  /**
   * Change businessIds for checkbox
   * @param {number} businessId business id
   */
  const handleChangeCheckBox = (businessId) => {
    let _businessIds = []
    if (businessIds?.includes(businessId)) {
      _businessIds = businessIds.filter(id => id !== businessId)
    } else {
      _businessIds = businessIds ? [...businessIds, businessId] : [businessId]
    }
    setBusinessIds(_businessIds)
  }

  /**
   * Update businessIds
   * @param {Array} ids arrary of business id
   */
  const handleUpdateBusinessIds = (ids) => {
    setBusinessIds(ids)
  }

  /**
   * Update services
   * @param {Array} services arrary of service
   */
  const handleUpdateServices = (services) => {
    setUserServiceList({
      ...userServiceList,
      services
    })
  }

  /**
   * Method to get business list from API
   */
  const getBusinessList = async () => {
    try {
      setBusinessList({
        ...businessList,
        loading: true
      })

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
        ? ordering.businesses().asDashboard().select(propsToFetch).where(where)
        : ordering.businesses().asDashboard().select(propsToFetch)
      const { content: { error, result, pagination } } = await fetchEndpoint.get()
      if (!error) {
        setBusinessList({
          ...businessList,
          loading: false,
          businesses: result,
          pagination
        })
      } else {
        setBusinessList({
          ...businessList,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setBusinessList({
        ...businessList,
        loading: false,
        error: [error || error?.toString() || error?.message]
      })
    }
  }

  // Method to get service list from API
  const getUserProducts = async () => {
    try {
      setUserServiceList({
        ...userServiceList,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const functionFetch = `${ordering.root}/users/${user?.id}/products`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result, pagination } = await response.json()
      if (!error) {
        setUserServiceList({
          ...userServiceList,
          loading: false,
          services: result,
          pagination
        })
      } else {
        setUserServiceList({
          ...userServiceList,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setUserServiceList({
        ...userServiceList,
        loading: false,
        error: [error || error?.toString() || error?.message]
      })
    }
  }

  useEffect(() => {
    getUserProducts()
    // getBusinessList()
  }, [user?.id])

  useEffect(() => {
    getBusinessList()
  }, [searchValue])

  useEffect(() => {
    if (businessIds !== undefined) return
    if (businessList?.businesses?.length > 0 && userServiceList?.services?.length > 0) {
      const _businessIds = []
      businessList.businesses.forEach(business => {
        if (userServiceList?.services.reduce((prev, current) => [...prev, current.business_id], []).includes(business.id)) {
          _businessIds.push(business.id)
        }
      })
      setBusinessIds(_businessIds)
    }
  }, [businessList?.businesses, userServiceList?.services, businessIds])

  useEffect(() => {
    if (businessIds === undefined) return
    if (businessList?.businesses?.length > 0 && userServiceList?.services?.length > 0) {
      const _businessIds = []
      businessList.businesses.forEach(business => {
        if (userServiceList?.services.reduce((prev, current) => [...prev, current.business_id], []).includes(business.id)) {
          _businessIds.push(business.id)
        }
      })
      setBusinessIds(_businessIds)
    }
  }, [user?.id, userServiceList?.services])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          searchValue={searchValue}
          businessIds={businessIds}
          onSearch={setSearchValue}
          businessList={businessList}
          userServiceList={userServiceList}
          handleChangeCheckBox={handleChangeCheckBox}
          handleUpdateBusinessIds={handleUpdateBusinessIds}
          handleUpdateServices={handleUpdateServices}
        />
      )}
    </>
  )
}

ProfessionalBusinessService.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of business props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: ['id', 'name', 'header', 'logo', 'name', 'schedule', 'open', 'delivery_price', 'distance', 'delivery_time', 'pickup_time', 'reviews', 'featured', 'offers', 'food', 'laundry', 'alcohol', 'groceries', 'slug']
}
