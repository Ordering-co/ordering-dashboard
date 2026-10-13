import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { getUniqueId, stringToSlug, normalizeTimezone } from '../../utils'

/**
 * Component to manage business form details behavior without UI component
 */
export const BusinessAdd = (props) => {
  const {
    UIComponent,
    handleOpenCategory,
    defaultSandboxRequiredGateways
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [{ configs }] = useConfig()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [zoneState, setZoneState] = useState({})
  const [gallery, setGallery] = useState([])
  const [paymethodsList, setPaymethodsList] = useState({ paymethods: [], loading: true, error: null })
  const [paymethodIds, setPaymethodIds] = useState([])
  const [addressChange, setAddressChange] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [kmlData, setKmlData] = useState(null)
  const [cityId, setCityId] = useState(null)
  const [details, setDetails] = useState(null)
  let timeout = null

  const paymethodsNotAllowed = ['paypal_express', 'authorize', 'stripe_direct', 'stripe_redirect']
  const googleMapsApiKey = configs?.google_maps_api_key?.value
  const sandboxRequiredGateways = defaultSandboxRequiredGateways || ['paypal', 'paypal_express', 'stripe_connect', 'carlos_payment', 'ivr']

  /**
   * Clean formState
   */
  const cleanFormState = (values) => setFormState({ ...formState, ...values })

  /**
   * deafult params to add the business newly
   */
  const defaultAddBusinessParams = {
    minimum: 0,
    delivery_price: 0,
    tax: 0,
    tax_type: 1,
    service_fee: 0,
    enabled: true,
    owner_id: session?.user?.id
  }

  /**
 * Method to get paymethods from API
 */
  const getAllPaymethods = async () => {
    try {
      const response = await fetch(`${ordering.root}/paymethods?where=[{%22attribute%22:%22enabled%22,%22value%22:true}]`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
            'x-app-x': ordering.appId,
            'X-INTERNAL-PRODUCT-X': ordering.appInternalName
          }
        }
      )
      const { result } = await response.json()
      setPaymethodsList({ ...paymethodsList, loading: false, paymethods: parsePaymethods(result) })
    } catch (err) {
      setPaymethodsList({ ...paymethodsList, loading: false, error: err.message })
    }
  }

  const parsePaymethods = (paymethods) => {
    const _paymethods = paymethods && paymethods.filter(paymethod => !paymethodsNotAllowed.includes(paymethod?.gateway))
    return _paymethods
  }

  const handleChangeZoneState = (e, isMany, unit) => {
    let currentChanges = {}
    if (isMany) {
      currentChanges = { ...e }
    } else {
      currentChanges = {
        [e.target.name]: e.target.value
      }
    }

    if (e?.target?.name === 'distance') {
      setZoneState({
        ...zoneState,
        data: {
          [e.target.name]: e.target.value,
          unit
        }
      })
    } else {
      setZoneState({ ...zoneState, ...currentChanges })
    }
  }

  /**
   * Method to add the business
   */
  const handleAddBusiness = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      delete formState?.changes?.schedule
      const changes = { ...formState.changes, ...defaultAddBusinessParams, schedule, ...(cityId && { city_id: cityId }) }
      const response = await ordering.businesses().save(changes, {
        accessToken: session.token
      })

      if (!response.content.error) {
        if (paymethodIds.length > 0) {
          await Promise.all(paymethodIds.map(async (paymethodId) => {
            return await handleAddPaymethods(response.content.result.id, paymethodId)
          }))
        }
        if (gallery.length > 0) {
          await Promise.all(gallery.map(async (galleryItem) => {
            const newGallery = {
              business_id: response?.content?.result?.id,
              file: galleryItem?.file,
              type: 1
            }
            return await handleAddBusinessGallery(response.content.result.id, newGallery)
          }))
        }
        if (zoneState?.name && zoneState?.minimum && zoneState?.price) {
          await handleAddDeliveryZone(response.content.result.id)
        }
        showToast(ToastType.Success, t('BUSINESS_ADDED', 'Business added'))
        handleOpenCategory && handleOpenCategory(response.content.result.slug)
      }
      setFormState({
        ...formState,
        changes: response.content.error ? formState.changes : {},
        result: response.content,
        loading: false
      })
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

  const handleAddDeliveryZone = async (businessId) => {
    let currentChanges = { ...zoneState }
    currentChanges = {
      ...currentChanges,
      data: JSON.stringify(zoneState?.data),
      type: zoneState?.type || 2,
      enabled: true,
      schedule: JSON.stringify([
        { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
        { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
        { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
        { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
        { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
        { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
        { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] }
      ])
    }
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify(currentChanges)
    }
    const response = await fetch(`${ordering.root}/business/${businessId}/deliveryzones`, requestOptions)
    const content = await response.json()
    return content
  }

  const handleAddPaymethods = async (businessId, paymethodId) => {
    const paymethod = paymethodsList.paymethods.find(_paymethod => _paymethod.id === paymethodId)
    const params = {
      enabled: true,
      paymethod_id: paymethodId,
      sandbox: sandboxRequiredGateways.includes(paymethod.gateway)
    }
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
        'x-app-x': ordering.appId,
        'X-INTERNAL-PRODUCT-X': ordering.appInternalName
      },
      body: JSON.stringify(params)
    }
    const response = await fetch(`${ordering.root}/business/${businessId}/paymethods`, requestOptions)
    const content = await response.json()
    return content
  }

  const handleAddBusinessGallery = async (businessId, changes) => {
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify(changes)
    }

    const response = await fetch(`${ordering.root}/business/${businessId}/gallery`, requestOptions)
    const content = await response.json()
    return content
  }

  const getCities = async () => {
    try {
      const { content: { error, result } } = await ordering.countries().select().get()

      let cities = []
      if (!error) {
        for (const country of result) {
          if (country?.enabled) {
            cities = [...cities, ...country?.cities]
          }
        }
        if (cities?.length > 0) setCityId(cities[0]?.id)
      }
    } catch {}
  }

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

  const changeFormState = (changes) => {
    setFormState({ ...formState, changes: { ...formState?.changes, ...changes } })
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

  const handleUploadKmlFiles = (files) => {
    if (files.length === 1) {
      const reader = new window.FileReader()
      reader.readAsText(files[0])
      reader.onload = () => {
        extractGoogleCoords(reader.result)
      }
    }
  }

  const extractGoogleCoords = (plainText) => {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(plainText, 'text/xml')
    const googlePolygons = []
    let placeMarkName = ''

    if (xmlDoc.documentElement.nodeName === 'kml') {
      for (const item of xmlDoc.getElementsByTagName('Placemark')) {
        placeMarkName = item.getElementsByTagName('name')[0].childNodes[0].nodeValue.trim()
        const polygons = item.getElementsByTagName('Polygon')

        for (const polygon of polygons) {
          let coords = polygon.getElementsByTagName('coordinates')[0].childNodes[0].nodeValue.trim()
          coords = coords.replace(/\n/g, ' ').replace(/\s+/g, ' ')
          const points = coords.split(' ')
          const googlePolygonsPaths = []
          for (const point of points) {
            const coord = point.split(',')
            googlePolygonsPaths.push({ lat: +coord[1], lng: +coord[0] })
          }
          googlePolygons.push(googlePolygonsPaths)
        }
      }
    } else {
      setFormState({
        ...formState,
        result: {
          error: t('INVALID_KML_FILE', 'Invalid KML file')
        }
      })
    }

    if (googlePolygons.length === 1) {
      setZoneState({
        ...zoneState,
        type: 2,
        name: placeMarkName,
        data: googlePolygons[0]
      })
      setKmlData(googlePolygons[0])
    } else {
      setFormState({
        ...formState,
        result: {
          error: t('INVALID_KML_FILE', 'Invalid KML file')
        }
      })
    }
  }

  const getSchedule = (periods) => {
    let extraHours = null
    const schedule = []
    for (let i = 0; i < 7; i++) {
      const period = periods.find(item => item?.open?.day === i)
      if (!period) {
        (!extraHours || (extraHours?.close?.hour === 0 && extraHours?.close?.minute === 0))
          ? schedule.push({ enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] })
          : schedule.push({ enabled: true, lapses: [extraHours] })
      }
      if (period?.open?.day === i && period?.close?.day === i) {
        const lapses = [{ open: { hour: period?.open?.hours, minute: period?.open?.minutes }, close: { hour: period?.close?.hours, minute: period?.close?.minutes } }]
        extraHours && lapses.unshift(extraHours)
        extraHours = null
        schedule.push({ enabled: true, lapses })
      }
      if (period?.open?.day === i && period?.close && period?.close?.day !== i) {
        const lapses = [{ open: { hour: period?.open?.hours, minute: period?.open?.minutes }, close: { hour: 23, minute: 59 } }]
        extraHours && lapses.unshift(extraHours)
        if (period?.close?.hours !== 0 && period?.close?.minutes !== 0) {
          extraHours = { open: { hour: 0, minute: 0 }, close: { hour: period?.close?.hours, minute: period?.close?.minutes } }
        }
        schedule.push({ enabled: true, lapses })
      }
      if (period?.open?.day === i && !period?.close) {
        const lapses = [{ open: { hour: period?.open?.hours, minute: period?.open?.minutes }, close: { hour: 23, minute: 59 } }]
        extraHours = null
        schedule.push({ enabled: true, lapses })
      }
    }

    if (extraHours && schedule[0]?.enabled && !(extraHours?.close?.hour === 0 && extraHours?.close?.minute === 0)) schedule[0].lapses.unshift(extraHours)
    if (extraHours && !schedule[0]?.enabled && !(extraHours?.close?.hour === 0 && extraHours?.close?.minute === 0)) schedule[0] = { enabled: true, lapses: [extraHours] }

    return schedule
  }

  useEffect(() => {
    if (details) {
      const updateStoreData = async () => {
        const photos = details?.photos?.map(photo => ({ temp_id: getUniqueId(), file: photo.getUrl() }))
        photos?.length > 0 && setGallery(photos)
        const timezone = await getTimeZone(details?.geometry?.location?.lat(), details?.geometry?.location?.lng())
        const changes = {
          name: details?.name,
          slug: stringToSlug(details?.name),
          cellphone: details?.international_phone_number,
          price_level: details?.price_level?.toString(),
          address: details?.formatted_address,
          ...(details?.opening_hours?.periods && { schedule: getSchedule(details?.opening_hours?.periods) }),
          location: {
            lat: details?.geometry?.location?.lat(),
            lng: details?.geometry?.location?.lng(),
            zipcode: -1,
            zoom: 15
          },
          timezone: timezone ?? 'America/New_York'
        }
        changeFormState(changes)
      }
      updateStoreData()
    }
  }, [details])

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
    getAllPaymethods()
    getCities()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          cleanFormState={cleanFormState}
          formState={formState}
          setFormState={setFormState}
          handleChangeInput={handleChangeInput}
          handlechangeImage={handlechangeImage}
          handleAddBusiness={handleAddBusiness}
          handleChangeAddress={handleChangeAddress}
          handleChangeCenter={handleChangeCenter}
          handleChangeSwtich={handleChangeSwtich}
          handleChangeRibbon={handleChangeRibbon}
          handleChangeGallery={setGallery}
          changeFormState={changeFormState}
          paymethodsList={paymethodsList}
          kmlData={kmlData}
          handleUploadKmlFiles={handleUploadKmlFiles}
          zoneState={zoneState}
          handleChangeZoneState={handleChangeZoneState}
          gallery={gallery}
          paymethodIds={paymethodIds}
          handleChangePaymethodIds={setPaymethodIds}
          handleChangeSchedule={setSchedule}
          details={details}
          setDetails={setDetails}
        />
      )}
    </>
  )
}

BusinessAdd.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
