import React, { useEffect, useState, useRef } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const SitesList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    isSearchByName,
    isSearchByDescription
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const firstRender = useRef(true)
  const [sitesListState, setSitesListState] = useState({ loading: false, sites: [], error: null })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage : 1,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })
  const [searchValue, setSearchValue] = useState(null)

  /**
   * Method to get the sites from API
   */
  const getSites = async (page, pageSize) => {
    try {
      setSitesListState((prev) => ({ ...prev, loading: true }))
      let where = null
      const conditions = []
      if (searchValue) {
        const searchConditions = []
        if (isSearchByName) {
          searchConditions.push(
            {
              attribute: 'name',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
              }
            }
          )
        }
        if (isSearchByDescription) {
          searchConditions.push(
            {
              attribute: 'description',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
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
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const fetchEndpoint = where
        ? `${ordering.root}/sites?page=${page}&page_size=${pageSize}&&where=${JSON.stringify(where)}`
        : `${ordering.root}/sites?page=${page}&page_size=${pageSize}`

      const response = await fetch(fetchEndpoint, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setSitesListState({
          loading: false,
          sites: content.result,
          error: null
        })
        setPaginationProps((prev) => ({
          ...prev,
          currentPage: content.pagination.current_page,
          totalPages: content.pagination.total_pages,
          totalItems: content.pagination.total,
          from: content.pagination.from,
          to: content.pagination.to
        }))
      } else {
        setSitesListState((prev) => ({
          ...prev,
          loading: false,
          error: content.result
        }))
      }
      firstRender.current = false
    } catch (err) {
      setSitesListState((prev) => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  /**
   * Function to update the site list
   */
  const handleSuccessUpdateSites = (updateSites) => {
    setSitesListState((prev) => ({
      ...prev,
      sites: updateSites
    }))
  }

  useEffect(() => {
    if (sitesListState.loading) return
    getSites(firstRender.current ? paginationProps.currentPage : 1, paginationProps.pageSize)
  }, [searchValue])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          paginationProps={paginationProps}
          setPaginationProps={setPaginationProps}
          sitesListState={sitesListState}
          searchValue={searchValue}
          onSearch={setSearchValue}
          getSites={getSites}
          handleSuccessUpdateSites={handleSuccessUpdateSites}
        />
      )}
    </>
  )
}

SitesList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
