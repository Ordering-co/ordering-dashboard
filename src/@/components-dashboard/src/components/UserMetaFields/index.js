import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const UserMetaFields = (props) => {
  const {
    userId,
    UIComponent
  } = props

  const [ordering] = useApi()
  const [session] = useSession()

  /**
   * Array to save meta fields
   */
  const [metaFieldsList, setMetaFieldsList] = useState({ metaFields: [], loading: true, error: null })
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
      const response = await fetch(`${ordering.root}/users/${userId}/metafields`, requestOptions)
      const { error, result } = await response.json()
      // redesign UF-B5 (M-UF11): an error answer leaves `metaFields` an array (the UI maps it) and records the error
      if (!response.ok || error) {
        setMetaFieldsList({ ...metaFieldsList, loading: false, metaFields: [], error: result ?? true })
        return
      }
      setMetaFieldsList({ ...metaFieldsList, loading: false, metaFields: Array.isArray(result) ? result : [] })
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
      const response = await fetch(`${ordering.root}/users/${userId}/metafields/${metaFieldId}`, requestOptions)
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
      } else {
        // redesign UF-B5 (M-UF11): a refused delete ends the loading and records why, instead of spinning forever
        const body = await response.json().catch(() => null)
        setActionState({
          loading: false,
          result: {
            error: true,
            result: body?.result ?? body?.message ?? response.statusText
          }
        })
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
      const response = await fetch(`${ordering.root}/users/${userId}/metafields`, requestOptions)
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
    getMetaFields()
  }, [userId])

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

UserMetaFields.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}
