import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

const BUSINESS_PARAMS = ['id', 'name', 'logo', 'slug', 'city', 'enabled', 'google_actions']

/**
 * The stores of the project on Google Actions Center: a page of
 * GET backoffice/businesses (the list of Connect › POS & menu sync: by id,
 * with the city) with each store's `google_actions`, of the Active or
 * Inactive tab, filtered by state (`google_actions_status`) and name. The project status (counts, feed) is
 * not fetched here: the caller passes it as `statusState`, from the request
 * the whole dashboard shares.
 */
export const GoogleActionsStores = (props) => {
  const { UIComponent, defaultPageSize = 10, defaultFilter = null } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [storesState, setStoresState] = useState({ loading: true, stores: [], error: null })
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: defaultPageSize, totalPages: 1, total: 0 })
  const [filter, setFilter] = useState(defaultFilter)
  const [searchValue, setSearchValue] = useState('')
  const [activeState, setActiveState] = useState(true)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const getStores = async (page = 1, pageSize = pagination.pageSize) => {
    try {
      setStoresState(prev => ({ ...prev, loading: true, error: null }))
      const conditions = [{ attribute: 'enabled', value: activeState }]
      if (searchValue) conditions.push({ attribute: 'name', value: { condition: 'ilike', value: `%${searchValue}%` } })
      const query = new URLSearchParams({
        params: BUSINESS_PARAMS.join(','),
        page: String(page),
        page_size: String(pageSize),
        where: JSON.stringify({ conector: 'AND', conditions })
      })
      if (filter) query.set('google_actions_status', filter)
      const response = await fetch(`${ordering.root}/backoffice/businesses?${query.toString()}`, { method: 'GET', headers })
      const content = await response.json()
      if (content.error) {
        setStoresState({ loading: false, stores: [], error: content.result })
        return
      }
      setStoresState({ loading: false, stores: content.result || [], error: null })
      setPagination({
        currentPage: content.pagination?.current_page || page,
        pageSize: content.pagination?.page_size || pageSize,
        totalPages: content.pagination?.total_pages || 1,
        total: content.pagination?.total || 0
      })
    } catch (err) {
      setStoresState({ loading: false, stores: [], error: [err.message] })
    }
  }

  useEffect(() => {
    getStores(1)
  }, [filter, searchValue, activeState])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          storesState={storesState}
          pagination={pagination}
          filter={filter}
          searchValue={searchValue}
          activeState={activeState}
          handleChangeActiveState={setActiveState}
          handleChangeFilter={(value) => setFilter(prev => (prev === value ? null : value))}
          handleChangeSearch={setSearchValue}
          handleChangePage={(page) => getStores(page)}
          handleChangePageSize={(pageSize) => getStores(1, pageSize)}
        />
      )}
    </>
  )
}

GoogleActionsStores.propTypes = {
  UIComponent: PropTypes.elementType,
  /** The project status ({ loading, data }), shared with the rest of the dashboard */
  statusState: PropTypes.object,
  defaultPageSize: PropTypes.number,
  /** The state the list opens filtered on (`google_actions_status`), or null */
  defaultFilter: PropTypes.string
}
