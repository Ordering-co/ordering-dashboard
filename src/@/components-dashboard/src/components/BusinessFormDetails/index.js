import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { normalizeTimezone } from '../../utils'

/**
 * Component to manage business form details behavior without UI component
 */
export const BusinessFormDetails = (props) => {
  const {
    UIComponent,
    business,
    handleSuccessUpdate,
    handleUpdateBusinessState,
    silentToasts
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [{ configs }] = useConfig()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [businessState, setBusinessState] = useState({ loading: false, business: null, error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [addressChange, setAddressChange] = useState(null)
  let timeout = null

  const googleMapsApiKey = configs?.google_maps_api_key?.value

  /**
   * Clean formState
   */
  const cleanFormState = (values) => setFormState({ ...formState, ...values })

  /**
   * deafult params to add the business newly
   */
  /**
   * Function to update a business
   */
  const updateResult = (response) => {
    setBusinessState({
      ...businessState,
      business: {
        ...businessState.business,
        ...response.content.result
      }
    })
    if (handleSuccessUpdate) {
      handleSuccessUpdate(response.content.result)
    }
    if (handleUpdateBusinessState) {
      handleUpdateBusinessState(response.content.result)
    }
  }

  /**
   * Default fuction for business profile workflow
   * redesign stores 5.1a (decision 4): resolves `{ ok: true }` or `{ ok: false, error }`, so a SaveBar and the leave
   * guard know whether the user may go on. `silentToasts` (opt-in) leaves the «Loading» and «Business updated» feedback to the form.
   */
  const handleUpdateClick = async () => {
    try {
      if (!silentToasts) showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const changes = { ...formState.changes }
      const response = await ordering.businesses(business?.id).save(changes, {
        accessToken: session.token
      })
      const originalChanges = { ...formState.changes }
      setFormState({
        ...formState,
        changes: response.content.error ? formState.changes : {},
        result: response.content,
        loading: false
      })

      if (!response.content.error) {
        if ((typeof originalChanges?.ribbon?.enabled) !== 'undefined' && !originalChanges?.ribbon?.enabled && response.content?.result?.ribbon?.enabled) {
          const updatedChanges = { ribbon: { enabled: false } }
          const response = await ordering.businesses(business?.id).save(updatedChanges, {
            accessToken: session.token
          })
          updateResult(response)
        } else {
          updateResult(response)
        }
        if (!silentToasts) showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
        return { ok: true }
      }
      return { ok: false, error: response.content.result }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
      return { ok: false, error: err.message }
    }
  }

  /**
   * redesign stores 5.1a: drops what the form holds (the store itself was never written) and the last error
   */
  const handleDiscardChanges = () => setFormState(prev => ({ ...prev, changes: {}, result: { error: false } }))

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e, isMany) => {
    let currentChanges = {}
    if (isMany) {
      Object.values(e).map(obj => {
        currentChanges = {
          ...currentChanges,
          [obj.name]: obj.value
        }
      })
    } else {
      currentChanges = {
        [e.target.name]: e.target.value
      }
    }

    setFormState({
      ...formState,
      changes: { ...formState.changes, ...currentChanges }
    })
  }

  const handleChangeSelectedOption = (key, value) => {
    const currentChanges = { ...formState.changes, [key]: value }
    setFormState({
      ...formState,
      changes: currentChanges
    })
  }

  /**
   * Update business photo data
   * @param {File} file Image to change business photo
   */
  const handlechangeImage = (file, name) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          [name]: reader.result
        }
      })
    }
  }

  /**
   * Update ribbon data
   * @param {Object} changes Related HTML event
   */
  const handleChangeRibbon = (changes) => {
    const ribbonChanges = formState?.changes?.ribbon
      ? { ...formState?.changes?.ribbon, ...changes }
      : { ...changes }
    const currentChanges = { ...formState?.changes, ribbon: ribbonChanges }
    setFormState({
      ...formState,
      changes: currentChanges
    })
  }

  const handleChangeSwtich = (name, checked) => {
    const changes = { ...formState.changes, [name]: checked }
    setFormState({
      ...formState,
      changes
    })
  }

  const getTimeZone = async (lat, lng) => {
    const date = new Date()
    const timestamp = Math.floor(date.getTime() / 1000)
    const timezoneApiKey = googleMapsApiKey
    const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${timezoneApiKey}`
    const response = await fetch(url, {
      method: 'GET'
    })
    const result = await response.json()
    return normalizeTimezone(result?.timeZoneId)
  }

  const handleChangeAddress = async (address) => {
    const timezone = await getTimeZone(address?.location?.lat, address?.location?.lng)
    setAddressChange({
      address: address?.address,
      location: { ...address?.location, zipcode: address?.zipcode ? address.zipcode : -1, zoom: 15 },
      timezone
    })
  }

  const handleChangeCenter = (address) => {
    let timezone

    clearTimeout(timeout)
    timeout = setTimeout(async () => {
      timezone = await getTimeZone(address?.lat(), address?.lng())
      setAddressChange({
        location: {
          lat: address?.lat(),
          lng: address?.lng(),
          zoom: 15,
          zipcode: -1
        },
        timezone
      })
    }, 200)
  }

  useEffect(() => {
    if (!addressChange) return
    setFormState({
      ...formState,
      changes: {
        ...formState?.changes,
        ...addressChange
      }
    })
  }, [addressChange])

  useEffect(() => {
    if (!business) return
    setBusinessState({ ...businessState, business })
  }, [business])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          cleanFormState={cleanFormState}
          formState={formState}
          businessState={businessState}
          setFormState={setFormState}
          handleChangeInput={handleChangeInput}
          handleButtonUpdateClick={handleUpdateClick}
          handleDiscardChanges={handleDiscardChanges}
          handlechangeImage={handlechangeImage}
          handleChangeAddress={handleChangeAddress}
          handleChangeCenter={handleChangeCenter}
          handleChangeSwtich={handleChangeSwtich}
          handleChangeRibbon={handleChangeRibbon}
          handleChangeSelectedOption={handleChangeSelectedOption}
        />
      )}
    </>
  )
}

BusinessFormDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
