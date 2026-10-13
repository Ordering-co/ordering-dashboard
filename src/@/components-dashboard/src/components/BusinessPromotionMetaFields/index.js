import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const BusinessPromotionMetaFields = (props) => {
  const {
    businessId,
    offerId,
    metafields,
    UIComponent,
    handleSuccessAddPromotionMetaFields,
    handleSuccessDeletePromotionMetaFields
  } = props

  const [ordering] = useApi()
  const [session] = useSession()

  /**
   * Array to save meta fields
   */
  const [metaFieldsList, setMetaFieldsList] = useState({ metaFields: [], loading: false, error: null })
  /**
   * object to save action state
   */
  const [actionState, setActionState] = useState({ loading: false, result: { error: false } })

  /**
   * Method to get meta fields from API
   */
  const getMetaFields = async () => {
    try {
      setMetaFieldsList({ ...metaFieldsList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/offers/${offerId}/metafields`, requestOptions)
      const { result } = await response.json()
      setMetaFieldsList({ ...metaFieldsList, loading: false, metaFields: result })
    } catch (err) {
      setMetaFieldsList({ ...metaFieldsList, loading: false, error: err.message })
    }
  }

  /**
   * Method to delete meta fields from API
   */
  const handleDeleteMetaField = async (metaFieldId) => {
    try {
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/offers/${offerId}/metafields/${metaFieldId}`, requestOptions)
      if (response.ok) {
        const metaFields = metaFieldsList.metaFields.filter(_metaField => {
          return _metaField.id !== metaFieldId
        })
        setMetaFieldsList({ ...metaFieldsList, metaFields })
        setActionState({
          loading: false,
          result: {
            error: false
          }
        })
        handleSuccessDeletePromotionMetaFields && handleSuccessDeletePromotionMetaFields(metaFieldId)
      }
    } catch (error) {
      setActionState({
        result: {
          error: true,
          result: error.message
        },
        loading: false
      })
    }
  }

  /**
   * Method to add meta fields from API
   */
  const handeAddMetaField = async (values) => {
    try {
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify(values)
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/offers/${offerId}/metafields`, requestOptions)
      const { error, result } = await response.json()
      if (error) {
        setActionState({
          loading: false,
          result: {
            error: true,
            result
          }
        })
      } else {
        let metafields = []
        metafields = [...metaFieldsList.metaFields, result]
        setMetaFieldsList({
          ...metaFieldsList,
          metaFields: metafields
        })
        setActionState({
          loading: false,
          result: {
            error: false
          }
        })
        if (handleSuccessAddPromotionMetaFields) {
          handleSuccessAddPromotionMetaFields(result)
        }
      }
    } catch (error) {
      setActionState({
        result: {
          error: true,
          result: error.message
        },
        loading: false
      })
    }
  }

  useEffect(() => {
    if (metafields) {
      setMetaFieldsList({ ...metaFieldsList, metaFields: metafields })
    } else {
      getMetaFields()
    }
  }, [metafields])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          metaFieldsList={metaFieldsList}
          actionState={actionState}
          handleDeleteMetaField={handleDeleteMetaField}
          handeAddMetaField={handeAddMetaField}
        />
      )}
    </>
  )
}

BusinessPromotionMetaFields.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}
