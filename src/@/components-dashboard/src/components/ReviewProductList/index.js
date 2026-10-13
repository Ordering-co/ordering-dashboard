import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'

export const ReviewProductList = (props) => {
  const {
    isSearchByName,
    isSearchByDescription,
    businessId,
    UIComponent
  } = props

  const [ordering] = useApi()
  const [searchValue, setSearchValue] = useState(null)
  const [productState, setProductState] = useState({ loading: false, products: [], error: null })

  const handleChangeSearch = (value) => {
    setSearchValue(value)
  }

  const getProducts = async () => {
    try {
      setProductState({
        ...productState,
        loading: true
      })

      let where = null
      const searchConditions = []
      if (searchValue) {
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
      }

      where = {
        conditions: searchConditions,
        conector: 'OR'
      }

      const productEndpoint = where.conditions.length > 0
        ? ordering.businesses(businessId).products().where(where)
        : ordering.businesses(businessId).products()
      const { content: { error, result } } = await productEndpoint.get()
      if (!error) {
        setProductState({
          ...productState,
          products: [...new Map(result.map(item => [item.id, item])).values()],
          loading: false,
          error: null
        })
      } else {
        setProductState({
          ...productState,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setProductState({
        ...productState,
        loading: false,
        error: err.message
      })
    }
  }

  useEffect(() => {
    if (!businessId && searchValue === null) return
    getProducts(true)
  }, [businessId, searchValue])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          searchValue={searchValue}
          handleChangeSearch={handleChangeSearch}
          productState={productState}
        />
      )}
    </>
  )
}

ReviewProductList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * true, flag to decide search parmeter
   */
  isSearchByName: PropTypes.bool,
  /**
   * true, flag to decide search parmeter
   */
  isSearchByDescription: PropTypes.bool
}
