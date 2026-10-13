import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { getSettingsSitesWhere } from '../../utils/settingsAccess'

export const CheckoutFieldsSetting = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const hideSettingList = ['city_dropdown_option', 'address', 'zipcode', 'address_notes']

  const [checkoutFieldsState, setCheckoutFieldsState] = useState({ fields: [], loading: false, error: null })
  const [originaState, setOriginalState] = useState({ fields: [], loading: false, error: null })
  const [sitesState, setSitesState] = useState({ loading: true, sites: [], error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [selectedSiteId, setSelectedSiteId] = useState(null)

  /**
   * Method to get the sites from API
   */
  const handleGetSitesList = async () => {
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const where = getSettingsSitesWhere() || {}
      const response = await fetch(`${ordering.root}/sites?${Object.keys(where).length ? 'where=' + JSON.stringify(where) : ''}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setSitesState({
          loading: false,
          sites: result,
          error: null
        })
      } else {
        setSitesState({
          ...sitesState,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setSitesState({
        ...sitesState,
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * Method to get the checkout fields from API
   */
  const getCheckoutFieldsBySites = async () => {
    try {
      setCheckoutFieldsState({ ...checkoutFieldsState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/validation_field_sites`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const checkoutFields = content.result.filter(field => field?.validation_field?.validate === 'checkout' && !hideSettingList.includes(field?.validation_field?.code))
        setCheckoutFieldsState({ fields: checkoutFields, loading: false })
      }
    } catch (err) {
      setCheckoutFieldsState({ ...checkoutFieldsState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get the checkout fields from API
   */
  const getCheckoutFields = async () => {
    try {
      setOriginalState({ ...originaState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/checkoutfields`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const checkoutFields = content.result.filter(field => !hideSettingList.includes(field.code))
        const orderValidationFields = ['name', 'middle_name', 'lastname', 'second_lastname', 'email', 'mobile_phone', 'city_dropdown_option', 'address', 'zipcode', 'address_notes', 'coupon', 'driver_tip', 'comments', 'birthdate']
        const validationF = []
        orderValidationFields.forEach(field => {
          const sort = checkoutFields.findIndex(validationfields => {
            return validationfields.code === field
          })
          if (sort !== -1) {
            const item = checkoutFields[sort]
            checkoutFields.splice(sort, 1)
            validationF.push(item)
          }
        })
        setOriginalState({ fields: validationF, loading: false })
      }
    } catch (err) {
      setOriginalState({ ...originaState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to update the checkout fields setting from API
   * @param {Number} fieldId selected field id
   * @param {Number} siteId site id
   * @param {Object} changes changes
   */
  const handleChangeCheckoutFieldSetting = async (fieldId, siteId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const content = await updateCheckoutField(fieldId, siteId, changes)
      if (!content.error) {
        setActionState({ loading: false, error: null })
        showToast(ToastType.Success, t('FIELD_SAVED', 'Field saved'))
        const fields = checkoutFieldsState.fields.map(field => {
          if (field.site_id === siteId && field.validation_field_id === fieldId) {
            return {
              ...field,
              ...changes
            }
          }
          return field
        })
        setCheckoutFieldsState({ ...checkoutFieldsState, fields })
      } else {
        setActionState({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  const updateCheckoutField = async (fieldId, siteId, changes, isResult) => {
    const requestOptions = {
      method: isResult ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(changes)
    }
    const response = await fetch(`${ordering.root}/validationfields/${fieldId}/sites/${siteId}`, requestOptions)
    const content = await response.json()
    if (content?.error) throw new Error(content.result)
    if (isResult) return content.result
    return content
  }

  const updateCheckoutFields = async (fieldsToCreate) => {
    try {
      setActionState(prev => ({ ...prev, loading: true, isPost: true }))
      const fields = fieldsToCreate ?? originaState?.fields
      const content = await Promise.all(fields.map(field => updateCheckoutField(field?.id, selectedSiteId, { enabled: true, ...(field?.code === 'email' && { required: true }) }, true)))
      setCheckoutFieldsState(prev => ({ ...prev, fields: [...prev.fields, ...content] }))
      setActionState(prev => ({ ...prev, loading: false, isPost: false }))
    } catch (err) {
      setActionState({ loading: false, error: [err.message], isPost: false })
    }
  }

  useEffect(() => {
    if (!selectedSiteId) return
    if (originaState.loading || checkoutFieldsState.loading) return
    if (originaState.error || checkoutFieldsState.error) return
    if (actionState.isPost) return
    if (!originaState.fields?.length) return

    const fieldsBySite = checkoutFieldsState?.fields.filter(field => field.site_id === selectedSiteId)
    const existingCodes = new Set(fieldsBySite.map(f => f?.validation_field?.code))
    const missingFields = originaState.fields.filter(f => !existingCodes.has(f.code))

    if (missingFields.length > 0) {
      updateCheckoutFields(missingFields)
    }
  }, [selectedSiteId, originaState.fields, checkoutFieldsState.fields])

  useEffect(() => {
    getCheckoutFields()
    handleGetSitesList()
    getCheckoutFieldsBySites()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          sitesState={sitesState}
          checkoutFieldsState={checkoutFieldsState}
          handleChangeCheckoutFieldSetting={handleChangeCheckoutFieldSetting}
          selectedSiteId={selectedSiteId}
          setSelectedSiteId={setSelectedSiteId}
          actionState={actionState}
        />
      )}
    </>
  )
}

CheckoutFieldsSetting.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
