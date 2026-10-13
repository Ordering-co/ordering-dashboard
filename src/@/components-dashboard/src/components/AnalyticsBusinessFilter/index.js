import React, { useState, useEffect } from 'react'
import PropTypes, { string } from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

export const AnalyticsBusinessFilter = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    filterList,
    handleChangeFilterList,
    propsToFetch,
    onClose,
    isFranchise,
    isSearchByName,
    countryCode
  } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()

  /**
   * This state save the business type info from API
   */
  const [businessList, setBusinessList] = useState({ loading: true, error: null, businesses: [], pagination: null })
  const [businessIds, setBusinessIds] = useState([])
  const [searchValue, setSearchValue] = useState(null)
  const rex = new RegExp(/^[A-Za-z0-9\s]+$/g)
  const PAGE_SIZE = 10

  /**
   * Method to toggle a business in the selection (cumulative across pages)
   * @param {number} id
   */
  const handleChangeBusinessId = (id) => {
    const current = businessIds || []
    if (current.includes(id)) {
      setBusinessIds(current.filter(businessId => businessId !== id))
    } else {
      setBusinessIds([...current, id])
    }
  }

  /**
   * Method to change filter list
   */
  const handleClickFilterButton = () => {
    handleChangeFilterList({ ...filterList, businessIds: businessIds || [] })
    onClose && onClose()
  }

  // The backoffice endpoint is paginated, so "All" toggles every business on
  // the current page; selection accumulates across pages.
  const pageBusinessIds = (businessList?.businesses || []).map(business => business.id)
  const isAllCheck = pageBusinessIds.length > 0 && pageBusinessIds.every(id => (businessIds || []).includes(id))

  const handleChangeAllCheck = () => {
    const current = businessIds || []
    if (isAllCheck) {
      setBusinessIds(current.filter(id => !pageBusinessIds.includes(id)))
    } else {
      const merged = [...current]
      pageBusinessIds.forEach(id => {
        if (!merged.includes(id)) merged.push(id)
      })
      setBusinessIds(merged)
    }
  }

  /**
   * Method to get business types from API
   * @param {number} page page to fetch
   * @param {number} pageSize page size
   */
  const getBusinessTypes = async (page = 1, pageSize = PAGE_SIZE) => {
    try {
      setBusinessList(prev => ({ ...prev, loading: true }))

      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : PAGE_SIZE

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
      // Franchise filter applied server-side so pagination stays consistent
      if (isFranchise && filterList?.franchises_id?.length > 0) {
        conditions.push({
          attribute: 'franchise_id',
          value: filterList.franchises_id
        })
      }
      const where = conditions.length ? { conditions, conector: 'AND' } : null

      let content = null
      if (user?.level === 0) {
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        if (countryCode) headers['X-Country-Code-X'] = countryCode
        const params = (propsToFetch || []).join(',')
        const whereParam = where ? `&where=${JSON.stringify(where)}` : ''
        const response = await fetch(
          `${ordering.root}/backoffice/businesses?params=${params}&page=${safePage}&page_size=${safePageSize}${whereParam}`,
          { method: 'GET', headers }
        )
        content = await response.json()
      } else {
        let fetchEndpoint = ordering.businesses().asDashboard().select(propsToFetch)
        if (where) {
          fetchEndpoint = fetchEndpoint.where(where)
        }
        const options = { query: { page: safePage, page_size: safePageSize } }
        if (countryCode) options.headers = { 'X-Country-Code-X': countryCode }
        const response = await fetchEndpoint.get(options)
        content = response.content
      }
      const { error, result, pagination } = content || {}
      if (!error) {
        setBusinessList(prev => ({
          ...prev,
          loading: false,
          businesses: result || [],
          pagination,
          error: null
        }))
      } else {
        setBusinessList(prev => ({
          ...prev,
          loading: false,
          error: result
        }))
      }
    } catch (error) {
      setBusinessList(prev => ({
        ...prev,
        loading: false,
        error: [error || error?.toString() || error?.message]
      }))
    }
  }

  const handleChangeBusinessPage = (page) => {
    getBusinessTypes(page, businessList?.pagination?.page_size || PAGE_SIZE)
  }

  const handleChangeBusinessPageSize = (pageSize) => {
    getBusinessTypes(1, pageSize)
  }

  useEffect(() => {
    getBusinessTypes()
  }, [searchValue])

  // Initialize selection once from the current filter
  useEffect(() => {
    setBusinessIds(filterList?.businessIds?.length > 0 ? [...filterList.businessIds] : [])
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessList={businessList}
          businessIds={businessIds}
          handleChangeBusinessId={handleChangeBusinessId}
          handleClickFilterButton={handleClickFilterButton}
          isAllCheck={isAllCheck}
          handleChangeAllCheck={handleChangeAllCheck}
          handleChangeBusinessPage={handleChangeBusinessPage}
          handleChangeBusinessPageSize={handleChangeBusinessPageSize}
          searchValue={searchValue}
          onSearch={setSearchValue}
        />
      )}
    </>
  )
}

AnalyticsBusinessFilter.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * filterList, this must be contains an object with filter list
   */
  filterList: PropTypes.object,
  /**
  * Method to change filter list
  */
  handleChangeFilterList: PropTypes.func,
  /**
  * Method to close business filter Modal
  */
  onClose: PropTypes.func,
  /**
   * Array of business props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: ['id', 'name', 'header', 'logo', 'name', 'schedule', 'open', 'delivery_price', 'distance', 'delivery_time', 'pickup_time', 'reviews', 'featured', 'offers', 'food', 'laundry', 'alcohol', 'groceries', 'slug']
}
