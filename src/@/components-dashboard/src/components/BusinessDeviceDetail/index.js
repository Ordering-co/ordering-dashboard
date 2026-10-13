import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

/**
 * Component to manage BusinessDeviceDetail behavior without UI component
 */
export const BusinessDeviceDetail = (props) => {
  const {
    UIComponent,
    propsToFetch,
    selectedDevice,
    devices,
    handleUpdateDeviceList,
    onClose
  } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ token, user }] = useSession()
  const [ordering] = useApi()

  const BUSINESSES_PAGE_SIZE = 10

  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: null } })
  const [businessList, setBusinessList] = useState({ loading: false, businesses: [], error: null })
  const [logoutDeviceState, setLogoutDeviceState] = useState({ loading: false, error: null })
  const [businessSearchValue, setBusinessSearchValue] = useState('')
  const [businessPagination, setBusinessPagination] = useState({
    currentPage: 1,
    pageSize: BUSINESSES_PAGE_SIZE,
    totalPages: null,
    totalItems: null
  })

  /**
   * Method to delete all sessions for the device user from API
   */
  const logoutDevice = async () => {
    const userId = selectedDevice?.user_id
    if (!userId) return
    try {
      setLogoutDeviceState({ loading: true, error: null })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/users/${userId}/sessions/all`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setLogoutDeviceState({ loading: false, error: null })
        showToast(ToastType.Success, t('LOGOUT_ALL_DEVICES_SUCCESS', 'All devices logged out successfully'))
      } else {
        setLogoutDeviceState({ loading: false, error: content })
        showToast(ToastType.Error, content?.result?.message || content?.result || t('ERROR', 'Error'))
      }
    } catch (err) {
      setLogoutDeviceState({
        loading: false,
        error: err.message
      })
      showToast(ToastType.Error, err.message || t('ERROR', 'Error'))
    }
  }

  const clearLogoutError = () => {
    setLogoutDeviceState(prev => ({ ...prev, error: null }))
  }

  /**
   * Method to delete a device from API
   */
  const deleteDevice = async () => {
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
      const response = await fetch(`${ordering.root}/devices/${selectedDevice?.id}`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setFormState({
          ...formState,
          result: content,
          loading: false
        })
        const updatedDevices = devices.filter(device => device?.id !== selectedDevice?.id)
        handleUpdateDeviceList && handleUpdateDeviceList(updatedDevices)
        showToast(ToastType.Success, t('DEVICE_DELETED', 'Device deleted'))
        onClose && onClose()
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
   * Method to create a device from API
   */
  const addDevice = async () => {
    try {
      setFormState({ ...formState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState?.changes)
      }
      const response = await fetch(`${ordering.root}/devices`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setFormState({
          ...formState,
          result: content.result,
          loading: false
        })
        const business = businessList?.businesses?.find(item => item?.id === content?.result?.business_id)
        const updatedDevices = [...devices, { ...content?.result, business }]
        handleUpdateDeviceList && handleUpdateDeviceList(updatedDevices)
        showToast(ToastType.Success, t('DEVICE_CREATED', 'Device created'))
        onClose && onClose()
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
   * Method to update a device from API
   */
  const updateDevice = async () => {
    try {
      setFormState({ ...formState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const changes = {
        business_id: selectedDevice?.business_id,
        ...formState?.changes
      }
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/devices/${selectedDevice?.id}`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setFormState({
          ...formState,
          result: content,
          loading: false
        })
        const updatedDevices = devices.map(device => {
          if (device?.id === selectedDevice?.id) {
            return {
              ...device,
              ...content.result
            }
          }
          return device
        })
        handleUpdateDeviceList && handleUpdateDeviceList(updatedDevices)
        showToast(ToastType.Success, t('DEVICE_UPDATED', 'Device updated'))
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
   * Method to get business list from API
   * @param {number} page page to fetch
   * @param {number} pageSize page size
   * @param {string} search business name search
   */
  const getBusinessList = async (page = 1, pageSize = BUSINESSES_PAGE_SIZE, search = '') => {
    try {
      setBusinessList(prev => ({ ...prev, loading: true }))
      let content = null
      if (selectedDevice?.business_id) {
        // Editing a device: the business selector is locked, so only the
        // assigned business is needed. Fetch it by id (the SDK resolves owners).
        const response = await ordering.businesses(selectedDevice.business_id).asDashboard().select(propsToFetch).get()
        const single = response.content
        content = single?.error
          ? single
          : { error: false, result: single?.result ? [single.result] : [] }
      } else {
        // Adding a device: paginated server-side list (10 per page) with name search.
        const safePage = Number(page) >= 1 ? Number(page) : 1
        const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : BUSINESSES_PAGE_SIZE
        const conditions = []
        if (search && String(search).trim()) {
          conditions.push({
            attribute: 'name',
            value: { condition: 'ilike', value: encodeURI(`%${String(search).trim()}%`) }
          })
        }
        if (user?.level === 0) {
          const requestOptions = {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          }
          const whereObj = conditions.length ? JSON.stringify({ conditions, conector: 'AND' }) : ''
          const whereParam = whereObj ? `&where=${whereObj}` : ''
          const params = (propsToFetch || []).join(',')
          const response = await fetch(
            `${ordering.root}/backoffice/businesses?params=${params}&page=${safePage}&page_size=${safePageSize}${whereParam}`,
            requestOptions
          )
          content = await response.json()
        } else {
          let fetchEndpoint = ordering.businesses().asDashboard().select(propsToFetch)
          if (conditions.length) {
            fetchEndpoint = fetchEndpoint.where({ conditions, conector: 'AND' })
          }
          const response = await fetchEndpoint.get({ query: { page: safePage, page_size: safePageSize } })
          content = response.content
        }
      }
      const { error, result, pagination } = content || {}
      if (!error) {
        setBusinessList(prev => ({ ...prev, loading: false, businesses: result || [], error: null }))
        if (pagination) {
          setBusinessPagination(prev => ({
            currentPage: pagination.current_page ?? prev.currentPage,
            pageSize: pagination.page_size === 0 ? prev.pageSize : (pagination.page_size ?? prev.pageSize),
            totalPages: pagination.total_pages ?? null,
            totalItems: pagination.total ?? null
          }))
        }
      } else {
        setBusinessList(prev => ({ ...prev, loading: false, error: result }))
      }
    } catch (error) {
      setBusinessList(prev => ({ ...prev, loading: false, error: [error || error?.toString() || error?.message] }))
    }
  }

  const searchBusinesses = (searchVal) => {
    const normalized = searchVal == null ? '' : String(searchVal).trim()
    setBusinessSearchValue(normalized)
    setBusinessPagination(prev => ({ ...prev, currentPage: 1 }))
    getBusinessList(1, BUSINESSES_PAGE_SIZE, normalized)
  }

  const handleChangeBusinessPage = (page) => {
    const safePage = Number(page) >= 1 ? Number(page) : 1
    getBusinessList(safePage, businessPagination.pageSize, businessSearchValue)
  }

  /**
   * Method to enrich a single business with its owners relation.
   * The flat backoffice endpoint does not return owners, so for admin users
   * the selected business is enriched on demand via a scoped SDK call.
   */
  const enrichBusinessOwners = async (businessId) => {
    if (!businessId) return
    const target = businessList?.businesses?.find(business => business.id === businessId)
    if (!target || Array.isArray(target.owners)) return
    try {
      const { content } = await ordering.setAccessToken(token).businesses(businessId).select(['id', 'owners']).asDashboard().get()
      if (!content?.error && content?.result) {
        setBusinessList(prev => ({
          ...prev,
          businesses: (prev.businesses || []).map(business => (
            business.id === businessId ? { ...business, owners: content.result.owners } : business
          ))
        }))
      }
    } catch {}
  }

  const handleChangeFormState = (changes) => {
    setFormState({
      ...formState,
      changes: {
        ...formState?.changes,
        ...changes
      }
    })
  }

  useEffect(() => {
    getBusinessList()
  }, [])

  useEffect(() => {
    if (user?.level !== 0) return
    const businessId = formState?.changes?.business_id || selectedDevice?.business_id
    if (businessId) enrichBusinessOwners(businessId)
  }, [formState?.changes?.business_id, selectedDevice?.business_id, businessList?.businesses?.length])

  useEffect(() => {
    setFormState({ ...formState, changes: {} })
  }, [selectedDevice?.id])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          updateDevice={updateDevice}
          addDevice={addDevice}
          deleteDevice={deleteDevice}
          logoutDevice={logoutDevice}
          logoutDeviceState={logoutDeviceState}
          clearLogoutError={clearLogoutError}
          formState={formState}
          handleChangeFormState={handleChangeFormState}
          businessList={businessList}
          businessPagination={businessPagination}
          handleChangeBusinessPage={handleChangeBusinessPage}
          searchBusinesses={searchBusinesses}
        />
      )}
    </>
  )
}

BusinessDeviceDetail.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
