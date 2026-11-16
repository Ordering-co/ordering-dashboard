import React, { useEffect, useRef, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

// redesign stores 5.14 (A-3): same contract as BusinessMenuMetaFields. `metaFieldsList` is `{ metaFields, loading,
// error }`: `loading` starts true whenever a fetch will happen (no `metafields` prop), and a failed GET (error:true, non-ok,
// throw) leaves `metaFields: []` plus the error, never the error payload as the list. `reloadMetaFields()` repeats the GET.
// Add / delete answer `{ ok, ... }` and always settle `actionState.loading` (a body that is not JSON never throws out of the
// handler). No toasts: the UI shows the errors inline. The `handleSuccess*PromotionMetaFields` callbacks still run on success.
// `handeAddMetaField` stays as an alias of `handleAddMetaField`.

const readJson = async (response) => {
  try {
    return await response.json()
  } catch (err) {
    return null
  }
}

const failureOf = (response, json) => {
  if (!response.ok || json?.error) return json?.result || response.statusText || `HTTP ${response.status}`
  return null
}

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
   * Meta fields list: { metaFields, loading, error }
   */
  const [metaFieldsList, setMetaFieldsList] = useState({ metaFields: metafields || [], loading: !metafields, error: null })
  /**
   * object to save action state
   */
  const [actionState, setActionState] = useState({ loading: false, result: { error: false } })
  const lastRequest = useRef(0)

  const request = (method, path = '', body) => fetch(`${ordering.root}/business/${businessId}/offers/${offerId}/metafields${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })

  /**
   * Method to get meta fields from API
   */
  const getMetaFields = async () => {
    const requestId = ++lastRequest.current
    setMetaFieldsList(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await request('GET')
      const json = await readJson(response)
      if (requestId !== lastRequest.current) return
      const error = failureOf(response, json)
      if (error) {
        setMetaFieldsList({ metaFields: [], loading: false, error })
        return
      }
      setMetaFieldsList({ metaFields: Array.isArray(json?.result) ? json.result : [], loading: false, error: null })
    } catch (err) {
      if (requestId !== lastRequest.current) return
      setMetaFieldsList({ metaFields: [], loading: false, error: err.message })
    }
  }

  /**
   * Method to delete meta fields from API
   * @returns {Promise<{ ok: true } | { ok: false, error }>}
   */
  const handleDeleteMetaField = async (metaFieldId) => {
    setActionState(prev => ({ ...prev, loading: true }))
    try {
      const response = await request('DELETE', `/${metaFieldId}`)
      const json = await readJson(response)
      const error = failureOf(response, json)
      if (error) {
        setActionState({ loading: false, result: { error: true, result: error } })
        return { ok: false, error }
      }
      setMetaFieldsList(prev => ({ ...prev, metaFields: prev.metaFields.filter(_metaField => _metaField.id !== metaFieldId) }))
      setActionState({ loading: false, result: { error: false } })
      handleSuccessDeletePromotionMetaFields && handleSuccessDeletePromotionMetaFields(metaFieldId)
      return { ok: true }
    } catch (err) {
      setActionState({ loading: false, result: { error: true, result: err.message } })
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to add meta fields from API
   * @returns {Promise<{ ok: true, result } | { ok: false, error }>}
   */
  const handleAddMetaField = async (values) => {
    setActionState(prev => ({ ...prev, loading: true }))
    try {
      const response = await request('POST', '', values)
      const json = await readJson(response)
      const error = failureOf(response, json) || (json ? null : 'Invalid response')
      if (error) {
        setActionState({ loading: false, result: { error: true, result: error } })
        return { ok: false, error }
      }
      setMetaFieldsList(prev => ({ ...prev, metaFields: [...prev.metaFields, json.result] }))
      setActionState({ loading: false, result: { error: false } })
      handleSuccessAddPromotionMetaFields && handleSuccessAddPromotionMetaFields(json.result)
      return { ok: true, result: json.result }
    } catch (err) {
      setActionState({ loading: false, result: { error: true, result: err.message } })
      return { ok: false, error: err.message }
    }
  }

  useEffect(() => {
    if (metafields) {
      setMetaFieldsList(prev => ({ ...prev, metaFields: metafields, loading: false, error: null }))
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
          reloadMetaFields={getMetaFields}
          handleDeleteMetaField={handleDeleteMetaField}
          handleAddMetaField={handleAddMetaField}
          handeAddMetaField={handleAddMetaField}
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
