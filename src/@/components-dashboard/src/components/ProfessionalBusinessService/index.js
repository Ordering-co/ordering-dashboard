import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

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
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
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
   * Take the professional out of one store: one DELETE per service of that store, in order, with the same call the services
   * controller sends when one service is unticked (`DELETE users/:id/products/:serviceId`). The ones that fail stay in the list.
   * @param {number} businessId business id
   * @returns {Promise<{removed: number, failed: number}>} how many services were removed and how many could not be
   */
  const handleRemoveBusinessServices = async (businessId) => {
    const current = Array.isArray(userServiceList?.services) ? userServiceList.services : []
    const targets = current.filter(service => service.business_id === businessId)
    if (!targets.length) return { removed: 0, failed: 0 }
    const removedIds = []
    let failed = 0
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    for (const service of targets) {
      try {
        const response = await fetch(`${ordering.root}/users/${user?.id}/products/${service.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        })
        const content = await response.json()
        if (content?.error) failed += 1
        else removedIds.push(service.id)
      } catch (error) {
        failed += 1
      }
    }
    if (removedIds.length) {
      handleUpdateServices(current.filter(service => !removedIds.includes(service.id)))
    }
    if (failed) {
      showToast(
        ToastType.Error,
        failed === 1
          ? t('PROFESSIONALS_STORE_REMOVE_FAILED_ONE', "1 service couldn't be removed")
          : t('PROFESSIONALS_STORE_REMOVE_FAILED_OTHER', "_count_ services couldn't be removed").replace('_count_', () => String(failed))
      )
    } else {
      showToast(
        ToastType.Success,
        removedIds.length === 1
          ? t('PROFESSIONALS_STORE_REMOVED_ONE', '1 service removed')
          : t('PROFESSIONALS_STORE_REMOVED_OTHER', '_count_ services removed').replace('_count_', () => String(removedIds.length))
      )
    }
    return { removed: removedIds.length, failed }
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
          handleRemoveBusinessServices={handleRemoveBusinessServices}
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
