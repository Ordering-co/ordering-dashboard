import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { changesForStore, effectiveDeviceChanges, ownerAfterSave } from '../../utils/devices'

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
    onClose,
    onCreated
  } = props

  const [, t] = useLanguage()
  const [, { showToast, hideToast }] = useToast()
  const [{ token, user }] = useSession()
  const [ordering] = useApi()

  const BUSINESSES_PAGE_SIZE = 10

  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: null } })
  const [businessList, setBusinessList] = useState({ loading: false, businesses: [], error: null })
  const [logoutDeviceState, setLogoutDeviceState] = useState({ loading: false, error: null })
  const [chosenBusiness, setChosenBusiness] = useState(null)
  const [adminList, setAdminList] = useState({ loading: false, users: null, error: null })
  const [businessSearchValue, setBusinessSearchValue] = useState('')
  const [businessPagination, setBusinessPagination] = useState({
    currentPage: 1,
    pageSize: BUSINESSES_PAGE_SIZE,
    totalPages: null,
    totalItems: null
  })

  // redesign stores-devices: every action answers `{ ok: true }` or `{ ok: false, error }`, so the panel can keep its
  // confirmation open on a failure and close it on success. The requests, bodies and toasts are main's.

  /**
   * Method to delete all sessions for the device user from API
   */
  const logoutDevice = async () => {
    const userId = selectedDevice?.user_id
    if (!userId) return { ok: false, error: null }
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
        return { ok: true }
      }
      setLogoutDeviceState({ loading: false, error: content })
      showToast(ToastType.Error, content?.result?.message || content?.result || t('ERROR', 'Error'))
      return { ok: false, error: content?.result }
    } catch (err) {
      setLogoutDeviceState({
        loading: false,
        error: err.message
      })
      showToast(ToastType.Error, err.message || t('ERROR', 'Error'))
      return { ok: false, error: err.message }
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
      setFormState(prev => ({ ...prev, loading: true }))
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
        setFormState(prev => ({ ...prev, result: content, loading: false }))
        const updatedDevices = (devices || []).filter(device => device?.id !== selectedDevice?.id)
        handleUpdateDeviceList && handleUpdateDeviceList(updatedDevices)
        showToast(ToastType.Success, t('DEVICE_DELETED', 'Device deleted'))
        onClose && onClose()
        return { ok: true }
      }
      // redesign bugs F row 19: the panel's alert says the failure, so the «Loading» toast must not stay
      hideToast?.()
      setFormState(prev => ({ ...prev, result: content, loading: false }))
      return { ok: false, error: content?.result }
    } catch (err) {
      hideToast?.()
      setFormState(prev => ({ ...prev, result: { error: true, result: err.message }, loading: false }))
      return { ok: false, error: err.message }
    }
  }

  // redesign stores-devices (R-1): the chosen store as an object, so paging or searching the store list does not lose it
  // (main's select then said «Select an option» while the store was still set, and the new row had no store until a reload)
  const businessById = (businessId) => businessList?.businesses?.find(business => business?.id === businessId) ??
    (chosenBusiness?.id === businessId ? chosenBusiness : null)
  const ownersOf = (businessId) => businessById(businessId)?.owners
  const hasNoOwners = (businessId) => {
    const owners = ownersOf(businessId)
    return Array.isArray(owners) && owners.length === 0
  }
  const linkableUsersOf = (businessId) => (
    hasNoOwners(businessId) && adminList.users?.length ? adminList.users : ownersOf(businessId)
  )

  const getAdmins = async () => {
    try {
      setAdminList(prev => ({ ...prev, loading: true }))
      const { content: { error, result } } = await ordering
        .setAccessToken(token)
        .users()
        .where([{ attribute: 'level', value: 0 }, { attribute: 'enabled', value: true }])
        .select(['name', 'lastname', 'email', 'photo']).get()
      if (!error) {
        setAdminList({ loading: false, users: result || [], error: null })
      } else {
        setAdminList({ loading: false, users: null, error: result })
      }
    } catch (err) {
      setAdminList({ loading: false, users: null, error: [err.message] })
    }
  }

  /**
   * Method to create a device from API
   * redesign stores-devices (DV-06): with `onCreated` the page keeps the panel on the new device (its code is what the
   * person came for); without it the panel closes as in main.
   */
  const addDevice = async () => {
    try {
      setFormState(prev => ({ ...prev, loading: true }))
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
        setFormState(prev => ({ ...prev, changes: {}, result: content.result, loading: false }))
        const business = businessById(content?.result?.business_id)
        const device = {
          ...content?.result,
          business,
          user: ownerAfterSave({ device: null, changes: formState?.changes, owners: linkableUsersOf(content?.result?.business_id) })
        }
        handleUpdateDeviceList && handleUpdateDeviceList([...(devices || []), device])
        showToast(ToastType.Success, t('DEVICE_CREATED', 'Device created'))
        if (onCreated) onCreated(device)
        else onClose && onClose()
        return { ok: true, device }
      }
      hideToast?.()
      setFormState(prev => ({ ...prev, result: content, loading: false }))
      return { ok: false, error: content?.result }
    } catch (err) {
      hideToast?.()
      setFormState(prev => ({ ...prev, result: { error: true, result: err.message }, loading: false }))
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to update a device from API
   * redesign stores-devices (DV-05): nothing changed, nothing is sent (main sent `{ business_id }` and said «updated»).
   * After a save the changes are cleared, so the panel is clean again, and the list's row carries the owner it now has.
   */
  const updateDevice = async () => {
    // R-2: a value typed back to what the device has is not a change
    const sent = effectiveDeviceChanges(formState?.changes, selectedDevice)
    if (!Object.keys(sent).length) {
      setFormState(prev => ({ ...prev, changes: {} }))
      return { ok: true, unchanged: true }
    }
    try {
      setFormState(prev => ({ ...prev, loading: true }))
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const changes = {
        business_id: selectedDevice?.business_id,
        user_id: selectedDevice?.user_id,
        ...sent
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
        setFormState(prev => ({ ...prev, changes: {}, result: content, loading: false }))
        const owners = linkableUsersOf(selectedDevice?.business_id)
        const updatedDevices = (devices || []).map(device => {
          if (device?.id === selectedDevice?.id) {
            return {
              ...device,
              ...content.result,
              business: device.business,
              user: ownerAfterSave({ device, changes: sent, owners })
            }
          }
          return device
        })
        handleUpdateDeviceList && handleUpdateDeviceList(updatedDevices)
        showToast(ToastType.Success, t('DEVICE_UPDATED', 'Device updated'))
        return { ok: true }
      }
      hideToast?.()
      setFormState(prev => ({ ...prev, result: content, loading: false }))
      return { ok: false, error: content?.result }
    } catch (err) {
      hideToast?.()
      setFormState(prev => ({ ...prev, result: { error: true, result: err.message }, loading: false }))
      return { ok: false, error: err.message }
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
    const target = businessById(businessId)
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
        setChosenBusiness(prev => (prev?.id === businessId ? { ...prev, owners: content.result.owners } : prev))
      }
    } catch {}
  }

  // redesign stores-devices (DV-03): a new store drops the owner chosen for the previous one
  const handleChangeFormState = (changes) => {
    if ('business_id' in changes) {
      setChosenBusiness(businessList?.businesses?.find(business => business?.id === changes.business_id) ?? null)
    }
    setFormState(prev => {
      if (!('business_id' in changes)) return { ...prev, changes: { ...prev?.changes, ...changes } }
      const { business_id: businessId, ...rest } = changes
      return { ...prev, changes: changesForStore({ ...prev?.changes, ...rest }, businessId) }
    })
  }

  // redesign stores-devices: «Discard» in the panel's guard empties the draft
  const clearFormChanges = () => setFormState(prev => ({ ...prev, changes: {}, result: { error: null } }))

  useEffect(() => {
    getBusinessList()
  }, [])

  useEffect(() => {
    if (user?.level !== 0) return
    const businessId = formState?.changes?.business_id || selectedDevice?.business_id
    if (businessId) enrichBusinessOwners(businessId)
  }, [formState?.changes?.business_id, selectedDevice?.business_id, businessList?.businesses?.length])

  const needsAdmins = user?.level === 0 && hasNoOwners(formState?.changes?.business_id || selectedDevice?.business_id)

  useEffect(() => {
    if (!needsAdmins || adminList.users || adminList.loading || adminList.error) return
    getAdmins()
  }, [needsAdmins])

  useEffect(() => {
    setFormState(prev => ({ ...prev, changes: {} }))
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
          clearFormChanges={clearFormChanges}
          handleChangeFormState={handleChangeFormState}
          businessList={businessList}
          chosenBusiness={chosenBusiness}
          adminList={needsAdmins ? adminList : null}
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
