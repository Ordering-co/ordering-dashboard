import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

// redesign CA-B1 (decision 2): attributes of the filter pills; unknown keys in filterValues.changes are ignored
const FILTER_ATTRIBUTES = ['contact_type', 'audience_type', 'status']

/**
 * Component to manage campaign form behavior without UI component
 */
export const CampaignListing = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    isSearchByName,
    isSearchByContactType
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const firstRender = useRef(true)
  const requestCounter = useRef(0)
  const searchValueRef = useRef(null)
  const filterValuesRef = useRef({ clear: false, changes: {} })
  const [searchValue, setSearchValue] = useState(null)
  const [campaignList, setCampaignList] = useState({ campaigns: [], loading: false, error: null })
  const [filterValues, setFilterValues] = useState({ clear: false, changes: {} })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage : 1,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })

  /**
   * Change text to search
   * @param {string} search Search value
   */
  const handleChangeSearch = (search) => {
    setSearchValue(search)
  }

  // redesign CA-B1 (decision 2, M-CA8): always the latest values for the request that is about to start
  searchValueRef.current = searchValue
  filterValuesRef.current = filterValues

  /**
   * Method to get the sites from API
   */
  const getCampaignList = async (page, pageSize) => {
    // redesign CA-B1 (M-CA8): only the latest request may paint; older responses are dropped
    const requestId = ++requestCounter.current
    const isLatest = () => requestId === requestCounter.current
    try {
      setCampaignList(prev => ({ ...prev, loading: true }))
      // redesign CA-B1 (decision 2): read the latest search and filters, not the closure of the render that started the call
      const currentSearch = searchValueRef.current
      const currentFilters = filterValuesRef.current
      let where = null
      const conditions = []
      if (currentSearch) {
        const searchConditions = []
        if (isSearchByName) {
          searchConditions.push(
            {
              attribute: 'name',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${currentSearch}%`)
              }
            }
          )
        }
        if (isSearchByContactType) {
          searchConditions.push(
            {
              attribute: 'contact_type',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${currentSearch}%`)
              }
            }
          )
        }
        conditions.push({
          conector: 'OR',
          conditions: searchConditions
        })
      }

      // redesign CA-B1 (decision 2): one OR group of equalities per non-empty filter attribute (the API rejects `in`)
      if (!currentFilters?.clear) {
        FILTER_ATTRIBUTES.forEach(attribute => {
          const values = currentFilters?.changes?.[attribute]
          if (Array.isArray(values) && values.length > 0) {
            conditions.push({
              conector: 'OR',
              conditions: values.map(value => ({ attribute, value }))
            })
          }
        })
      }

      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const fetchEndpoint = where
        ? `${ordering.root}/marketing_campaigns?page=${page}&page_size=${pageSize}&where=${JSON.stringify(where)}`
        : `${ordering.root}/marketing_campaigns?page=${page}&page_size=${pageSize}`

      const response = await fetch(fetchEndpoint, requestOptions)
      const content = await response.json()
      if (!isLatest()) return
      if (!content.error) {
        setCampaignList({
          loading: false,
          campaigns: content.result,
          error: null
        })
        setPaginationProps(prev => ({
          ...prev,
          currentPage: content.pagination.current_page,
          totalPages: content.pagination.total_pages,
          totalItems: content.pagination.total,
          from: content.pagination.from,
          to: content.pagination.to,
          pageSize: content.pagination.page_size
        }))
      } else {
        setCampaignList(prev => ({
          ...prev,
          loading: false,
          error: content.result
        }))
      }
      firstRender.current = false
    } catch (err) {
      if (!isLatest()) return
      setCampaignList(prev => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  /**
   * Default fuction for campaign workflow
   */
  const handleUpdateCampaign = async (id, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/marketing_campaigns/${id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        // redesign CA-B1 (inventory 8.18): new objects, the previous state is never mutated
        setCampaignList(prev => ({
          ...prev,
          campaigns: prev.campaigns.map(_campaign => _campaign.id === id ? { ..._campaign, ...content.result } : _campaign)
        }))
        showToast(ToastType.Success, t('CAMPAIGN_SAVED', 'Campaign saved'))
        return { ok: true, error: null }
      }
      // redesign CA-B1 (M-CA5): the caller decides how to paint the failure
      return { ok: false, error: content.result }
    } catch (err) {
      return { ok: false, error: [err.message] }
    }
  }
  /**
   * Method to add the campaign in the campaign list
   * @param {Object} result campaign to add
   */
  const handleSuccessAddCampaign = (result) => {
    const campaigns = [...campaignList.campaigns, result]
    setPaginationProps({
      ...paginationProps,
      to: paginationProps?.to + 1,
      // redesign CA-B1 (inventory 8.18): the field is totalItems, `total` is never read
      totalItems: paginationProps?.totalItems + 1
    })
    setCampaignList({ ...campaignList, campaigns })
  }

  /**
   * Method to update the campaign list
   */
  const handleSuccessUpdateCampaign = (result) => {
    setCampaignList({
      ...campaignList,
      campaigns: result
    })
  }

  /**
   * Method to delete the campaign in the campaign list
   * @param {Number} campaignId campaign to delete
   */
  const handleSuccessDeleteCampaign = (campaignId) => {
    const filteredCampaigns = campaignList.campaigns.filter(campaign => campaign.id !== campaignId)
    setPaginationProps({
      ...paginationProps,
      // redesign CA-B1 (inventory 8.18): the field is totalItems, `total` is never read
      totalItems: paginationProps?.totalItems - 1
    })
    setCampaignList({ ...campaignList, campaigns: filteredCampaigns })
  }

  // redesign CA-B1 (M-CA8): no early return while loading, a change made during a load is not lost
  useEffect(() => {
    getCampaignList(firstRender.current && requestCounter.current === 0 ? paginationProps.currentPage : 1, paginationProps.pageSize)
  }, [searchValue])

  useEffect(() => {
    if (Object.keys(filterValues?.changes).length > 0 || filterValues.clear) getCampaignList(1, paginationProps.pageSize)
  }, [filterValues])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          searchValue={searchValue}
          filterValues={filterValues}
          paginationProps={paginationProps}
          campaignList={campaignList}
          getCampaignList={getCampaignList}
          setFilterValues={setFilterValues}
          setPaginationProps={setPaginationProps}
          handleChangeSearch={handleChangeSearch}
          handleUpdateCampaign={handleUpdateCampaign}
          handleSuccessAddCampaign={handleSuccessAddCampaign}
          handleSuccessUpdateCampaign={handleSuccessUpdateCampaign}
          handleSuccessDeleteCampaign={handleSuccessDeleteCampaign}
        />
      )}
    </>
  )
}

CampaignListing.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Enable/disable search by name
   */
  isSearchByName: PropTypes.bool,
  /**
    * Enable/disable search by contact type
    */
  isSearchByContactType: PropTypes.bool
}

const defaultProps = {
  isSearchByName: true,
  isSearchByContactType: true,
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
