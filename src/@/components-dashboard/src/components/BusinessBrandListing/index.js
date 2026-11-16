import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

/**
 * Component to manage BusinessBrandListing behavior without UI component
 */
export const BusinessBrandListing = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings
  } = props

  const [, t] = useLanguage()
  const [, { showToast, hideToast }] = useToast()
  const [searchValue, setSearchValue] = useState(null)
  const [{ token, loading }] = useSession()
  const [ordering] = useApi()

  const firstRender = useRef(true)
  // redesign SB-B1: `loaded` is true after the first response of the list (the UI tells "still loading" from "no brands").
  const [brandListState, setBrandListState] = useState({ loading: false, loaded: false, brands: [], error: null })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: paginationSettings?.initialPage ?? 1,
    pageSize: paginationSettings?.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: null } })
  const [openDetail, setOpenDetail] = useState(false)
  // requests of this controller in flight: two switches of different brands can save at the same time
  const inFlight = useRef(0)

  const startRequest = () => {
    inFlight.current += 1
    setFormState(prev => ({ ...prev, loading: true }))
  }

  const endRequest = () => {
    inFlight.current = Math.max(0, inFlight.current - 1)
    setFormState(prev => ({ ...prev, loading: inFlight.current > 0 }))
  }

  /**
   * Method to update brand list
   * redesign SB-B1 (auditor 7): also accepts an updater `(prevBrands) => nextBrands`, so nothing is computed on a
   * list captured before another save finished.
   */
  const handleUpdateBrandList = (brands) => {
    setBrandListState(prev => ({
      ...prev,
      brands: typeof brands === 'function' ? brands(prev.brands) : brands
    }))
  }

  /**
   * redesign SB-B1 (G5-47): returns `{ ok: true }`, `{ ok: false, error: result }` (API error) or
   * `{ ok: false, error: [message] }` (exception), so the switch can go back to the stored value.
   */
  const handleChangeState = (id, type, value) => {
    const changes = {
      [type]: value
    }
    return updateBrand(id, changes)
  }

  /**
   * Method to delete a brand from API
   * redesign SB-B1 (G5-44, M-SB8): returns `{ ok, error }`; on success the brand leaves the list, the total goes down
   * by one and the detail closes. A failure writes nothing in `formState.result`: the caller says it.
   */
  const deleteBrand = async (id) => {
    startRequest()
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/franchises/${id}`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        // redesign bugs F row 19: the delete error dialog says it, so the «Loading» toast must not stay
        hideToast?.()
        return { ok: false, error: content.result }
      }
      setFormState(prev => ({ ...prev, changes: {}, result: content }))
      setBrandListState(prev => ({
        ...prev,
        brands: prev.brands.filter(brand => String(brand.id) !== String(id))
      }))
      setPaginationProps(prev => Number.isFinite(prev.totalItems)
        ? { ...prev, totalItems: Math.max(0, prev.totalItems - 1) }
        : prev)
      showToast(ToastType.Success, t('BRAND_DELETED', 'Brand deleted'))
      setOpenDetail(false)
      return { ok: true }
    } catch (err) {
      hideToast?.()
      return { ok: false, error: [err.message] }
    } finally {
      endRequest()
    }
  }

  /**
   * Method to update a brand from API
   * redesign SB-B1 (G5-47): returns `{ ok, error }` like `deleteBrand`; no toast on failure (the switch says it).
   */
  const updateBrand = async (id, changes) => {
    startRequest()
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/franchises/${id}`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        // redesign bugs F row 19: the switch says it, so the «Loading» toast must not stay
        hideToast?.()
        return { ok: false, error: content.result }
      }
      setFormState(prev => ({ ...prev, changes: {}, result: content }))
      setBrandListState(prev => ({
        ...prev,
        brands: prev.brands.map(item => {
          if (item.id === content.result?.id) {
            return {
              ...item,
              name: content.result.name,
              logo: content.result.logo,
              enabled: content.result.enabled
            }
          }
          return item
        })
      }))
      showToast(ToastType.Success, t('BRAND_UPDATED', 'Brand updated'))
      return { ok: true }
    } catch (err) {
      hideToast?.()
      return { ok: false, error: [err.message] }
    } finally {
      endRequest()
    }
  }

  /**
   * Method to read one brand (deep link to a brand that is not on the loaded page). Read only.
   * redesign SB-B1 (M-SB1): `{ ok: true, brand }` or `{ ok: false, error }`.
   */
  const getBrand = async (id) => {
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/franchises/${id}`, requestOptions)
      const content = await response.json()
      if (content?.error) return { ok: false, error: content.result }
      return { ok: true, brand: content.result }
    } catch (err) {
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to get brand list with API pagination + search
   */
  const getBrands = async (page, pageSize) => {
    if (loading) return
    try {
      setBrandListState((prev) => ({ ...prev, loading: true }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      let where = null
      if (searchValue) {
        where = {
          conditions: [{
            attribute: 'name',
            value: { condition: 'ilike', value: encodeURI(`%${String(searchValue).trim()}%`) }
          }],
          conector: 'AND'
        }
      }
      const safePage = page || paginationProps.currentPage
      const safePageSize = pageSize || paginationProps.pageSize
      const fetchEndpoint = where
        ? `${ordering.root}/franchises?page=${safePage}&page_size=${safePageSize}&where=${JSON.stringify(where)}`
        : `${ordering.root}/franchises?page=${safePage}&page_size=${safePageSize}`

      const response = await fetch(fetchEndpoint, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setBrandListState(prev => ({
          ...prev,
          loading: false,
          loaded: true,
          brands: content.result,
          error: null
        }))
        if (content.pagination) {
          setPaginationProps((prev) => ({
            ...prev,
            currentPage: content.pagination.current_page,
            totalPages: content.pagination.total_pages,
            totalItems: content.pagination.total,
            from: content.pagination.from,
            to: content.pagination.to
          }))
        }
      } else {
        // redesign SB-B1 (M-SB6): the error stays in `brandListState.error` for the UI to draw
        setBrandListState((prev) => ({
          ...prev,
          loading: false,
          loaded: true,
          error: content.result
        }))
      }
      firstRender.current = false
    } catch (err) {
      setBrandListState((prev) => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  useEffect(() => {
    if (brandListState.loading) return
    getBrands(firstRender.current ? paginationProps.currentPage : 1, paginationProps.pageSize)
  }, [searchValue])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          searchValue={searchValue}
          onSearch={setSearchValue}
          handleUpdateBrandList={handleUpdateBrandList}
          brandListState={brandListState}
          handleChangeState={handleChangeState}
          brandFormState={formState}
          handleDeleteBrand={deleteBrand}
          openDetail={openDetail}
          setOpenDetail={setOpenDetail}
          paginationProps={paginationProps}
          setPaginationProps={setPaginationProps}
          getBrands={getBrands}
          getBrand={getBrand}
        />
      )}
    </>
  )
}

BusinessBrandListing.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Pagination defaults
   */
  paginationSettings: PropTypes.object
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10 }
}
