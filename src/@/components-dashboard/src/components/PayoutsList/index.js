import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

const toErrorList = (result, fallback) => {
  if (Array.isArray(result)) return result.length ? result.map(String) : [fallback]
  if (typeof result === 'string' && result) return [result]
  return [fallback]
}

/**
 * What was paid out of the orders split through Stripe Connect, and what is
 * still to pay, most recent first. The API decides what whoever
 * asks may see: an administrator the whole split of every order, a store
 * owner the part of their stores. `businessId` and `driverId` only narrow
 * that list.
 */
export const PayoutsList = (props) => {
  const {
    UIComponent,
    businessId,
    driverId,
    paginationSettings
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [payoutsState, setPayoutsState] = useState({ loading: true, error: null, payouts: [] })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: paginationSettings?.initialPage || 1,
    pageSize: paginationSettings?.pageSize || 10,
    totalItems: null,
    totalPages: null
  })
  const controllerRef = useRef(null)
  // Only the latest page may update the list: a slow previous page must not land after it
  const requestRef = useRef(0)

  /**
   * Get one page of the payouts
   * @param {Number} page page to load
   * @param {Number} pageSize rows of a page
   */
  const getPayouts = async (page, pageSize) => {
    const request = ++requestRef.current
    try {
      setPayoutsState(prev => ({ ...prev, loading: true, error: null }))
      const where = []
      if (businessId) where.push({ attribute: 'business_id', value: Number(businessId) })
      if (driverId) where.push({ attribute: 'driver_id', value: Number(driverId) })
      const query = new URLSearchParams({ page, page_size: pageSize, orderBy: '-id' })
      if (where.length) query.set('where', JSON.stringify(where))
      const response = await fetch(`${ordering.root}/payouts?${query}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        cache: 'no-store',
        signal: controllerRef.current?.signal
      })
      const content = await response.json()
      if (request !== requestRef.current) return
      if (!response.ok || content?.error) {
        setPayoutsState(prev => ({ ...prev, loading: false, error: toErrorList(content?.result, 'ERROR') }))
        return
      }
      setPayoutsState({ loading: false, error: null, payouts: content.result || [] })
      setPaginationProps({
        currentPage: content.pagination?.current_page || page,
        pageSize: content.pagination?.page_size || pageSize,
        totalItems: content.pagination?.total ?? null,
        totalPages: content.pagination?.total_pages ?? null
      })
    } catch (err) {
      if (err?.name === 'AbortError' || request !== requestRef.current) return
      setPayoutsState(prev => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  const handleChangePage = (page) => getPayouts(page, paginationProps.pageSize)

  const handleChangePageSize = (pageSize) => getPayouts(1, pageSize)

  useEffect(() => {
    controllerRef.current = new AbortController()
    getPayouts(paginationSettings?.initialPage || 1, paginationProps.pageSize)
    return () => controllerRef.current?.abort()
  }, [businessId, driverId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          payoutsState={payoutsState}
          paginationProps={paginationProps}
          handleChangePage={handleChangePage}
          handleChangePageSize={handleChangePageSize}
        />
      )}
    </>
  )
}

PayoutsList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Only the payouts of this business
   */
  businessId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /**
   * Only the payouts of the orders this driver delivered
   */
  driverId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /**
   * `{ initialPage, pageSize }`
   */
  paginationSettings: PropTypes.object
}
