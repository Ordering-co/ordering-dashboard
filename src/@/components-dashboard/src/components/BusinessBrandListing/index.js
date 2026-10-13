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
  const [, { showToast }] = useToast()
  const [searchValue, setSearchValue] = useState(null)
  const [{ token, loading }] = useSession()
  const [ordering] = useApi()

  const firstRender = useRef(true)
  const [brandListState, setBrandListState] = useState({ loading: false, brands: [], error: null })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: paginationSettings?.initialPage ?? 1,
    pageSize: paginationSettings?.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: null } })
  const [openDetail, setOpenDetail] = useState(false)

  /**
   * Method to update brand list
   */
  const handleUpdateBrandList = (brands) => {
    setBrandListState({ ...brandListState, brands })
  }

  const handleChangeState = (id, type, value) => {
    const changes = {
      [type]: value
    }
    updateBrand(id, changes)
  }

  /**
   * Method to delete a brand from API
   */
  const deleteBrand = async (id) => {
    try {
      setFormState({ ...formState, loading: true })
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
      if (!content?.error) {
        setFormState({
          ...formState,
          changes: {},
          result: content,
          loading: false
        })
        if (handleUpdateBrandList) {
          const _brands = brandListState?.brands.filter(brand => brand.id !== id)
          handleUpdateBrandList(_brands)
        }
        showToast(ToastType.Success, t('BRAND_DELETED', 'Brand deleted'))
        setOpenDetail(false)
      } else {
        setFormState({
          ...formState,
          result: content,
          loading: false
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  /**
   * Method to update a brand from API
   */
  const updateBrand = async (id, changes) => {
    try {
      setFormState({ ...formState, loading: true })
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
      if (!content?.error) {
        setFormState({
          ...formState,
          changes: {},
          result: content,
          loading: false
        })
        if (handleUpdateBrandList) {
          const _brands = brandListState?.brands.map(item => {
            if (item.id === content.result.id) {
              return {
                ...item,
                name: content.result.name,
                logo: content.result.logo,
                enabled: content.result.enabled
              }
            }
            return item
          })
          handleUpdateBrandList(_brands)
        }
        showToast(ToastType.Success, t('BRAND_UPDATED', 'Brand updated'))
      } else {
        setFormState({
          ...formState,
          result: content,
          loading: false
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
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
        setBrandListState({
          loading: false,
          brands: content.result,
          error: null
        })
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
        setBrandListState((prev) => ({
          ...prev,
          loading: false,
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
