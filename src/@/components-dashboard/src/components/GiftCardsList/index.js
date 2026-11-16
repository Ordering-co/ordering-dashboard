import React, { useEffect, useState, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

/**
 * Component to manage gift cards without UI component
 */
export const GiftCardsList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    isSearchById,
    isSearchByAuthorName,
    isSearchByAuthorEmail,
    isSearchByAuthorPhone,
    // redesign GC-A (GC-A1): opt-in, so no other caller changes its search
    isSearchByCode,
    isSearchByRecipientEmail,
    defaultStatus
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [giftCards, setGiftCards] = useState({ loading: true, list: [], error: null })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage : 1,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })
  const [activeStatus, setActiveStatus] = useState(defaultStatus ?? 'pending')
  const [searchValue, setSearchValue] = useState(null)
  const firstRender = useRef(true)
  // redesign GC-A (GC-A2): the last request wins; an older answer is dropped
  const lastRequest = useRef(0)

  /**
   * Method to get the gift cards from API
   */
  const getGiftCards = async (page, pageSize) => {
    const requestId = ++lastRequest.current
    try {
      // redesign GC-A (functional state): functional form, not the `giftCards` captured by this closure
      setGiftCards(prev => ({
        ...prev,
        loading: true,
        error: null
      }))
      let where = []
      const conditions = []
      if (activeStatus) {
        conditions.push(
          {
            attribute: 'status',
            value: activeStatus === 'pending' ? ['pending', 'sent'] : activeStatus
          }
        )
      }
      if (searchValue) {
        const searchConditions = []
        if (isSearchById) {
          searchConditions.push(
            {
              attribute: 'id',
              value: {
                condition: 'ilike',
                value: encodeURIComponent(`%${searchValue}%`)
              }
            }
          )
        }
        if (isSearchByAuthorName) {
          ['name', 'lastname'].forEach(attribute => {
            searchConditions.push(
              {
                attribute: 'author',
                conditions: [
                  {
                    attribute,
                    value: {
                      condition: 'ilike',
                      value: encodeURIComponent(`%${searchValue}%`)
                    }
                  }
                ]
              }
            )
          })
        }
        if (isSearchByAuthorEmail) {
          searchConditions.push(
            {
              attribute: 'author',
              conditions: [
                {
                  attribute: 'email',
                  value: {
                    condition: 'ilike',
                    value: encodeURIComponent(`%${searchValue}%`)
                  }
                }
              ]
            }
          )
        }
        if (isSearchByAuthorPhone) {
          searchConditions.push(
            {
              attribute: 'author',
              conditions: [
                {
                  attribute: 'phone',
                  value: {
                    condition: 'ilike',
                    value: encodeURIComponent(`%${searchValue}%`)
                  }
                }
              ]
            }
          )
        }
        // redesign GC-A (GC-A1)
        if (isSearchByCode) {
          searchConditions.push(
            {
              attribute: 'code',
              value: {
                condition: 'ilike',
                value: encodeURIComponent(`%${searchValue}%`)
              }
            }
          )
        }
        if (isSearchByRecipientEmail) {
          searchConditions.push(
            {
              attribute: 'user_email',
              value: {
                condition: 'ilike',
                value: encodeURIComponent(`%${searchValue}%`)
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
        ? `${ordering.root}/gift_cards?page=${page}&page_size=${pageSize}&where=${JSON.stringify(where)}`
        : `${ordering.root}/gift_cards?page=${page}&page_size=${pageSize}`

      const response = await fetch(fetchEndpoint, requestOptions)
      const { error, result, pagination } = await response.json()
      // redesign GC-A (GC-A2): a newer request already started, so this answer is stale
      if (requestId !== lastRequest.current) return
      if (!error) {
        setPaginationProps({
          currentPage: pagination.current_page,
          pageSize: pagination.page_size === 0 ? paginationProps.pageSize : pagination.page_size,
          totalPages: pagination.total_pages,
          totalItems: pagination.total,
          from: pagination.from,
          to: pagination.to
        })
      }
      setGiftCards({
        loading: false,
        list: error ? [] : result,
        error: error ? result : null
      })
    } catch (err) {
      if (requestId !== lastRequest.current) return
      setGiftCards(prev => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  /**
   * redesign GC-A (GC-A4): ask again for the current page and size (the «Retry» of the UI)
   */
  const reload = () => getGiftCards(paginationProps.currentPage, paginationProps.pageSize)

  useEffect(() => {
    // redesign GC-A: only the very first load uses the initial page; a new search or status always goes back to page 1.
    // The flag flips here (it used to flip when an answer landed, so a search typed before it kept the old page).
    const page = firstRender.current ? paginationProps.currentPage : 1
    firstRender.current = false
    getGiftCards(page, paginationProps.pageSize)
  }, [activeStatus, searchValue])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          giftCards={giftCards}
          paginationProps={paginationProps}
          activeStatus={activeStatus}
          setActiveStatus={setActiveStatus}
          getGiftCards={getGiftCards}
          reload={reload}
          searchValue={searchValue}
          onSearch={setSearchValue}
        />
      )}
    </>
  )
}
GiftCardsList.propTypes = {
  /**
 * UI Component, this must be containt all graphic elements and use parent props
 */
  UIComponent: PropTypes.elementType
}
const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10 }
}
