import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const DeliveryServices = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings
  } = props

  const [ordering] = useApi()
  const [{ user, token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [deliveryServicesState, setDeliveryServicesState] = useState({ companies: [], loading: false, error: null })
  const [businessesList, setBusinessesList] = useState({ businesses: [], loading: false, error: null })
  const [paymethodsList, setPaymethodsList] = useState({ paymethods: [], loading: false, error: null })
  const [deliveryGroups, setDeliveryGroups] = useState({ groups: [], loading: false, error: null })
  const [scheduleState, setScheduleState] = useState({ loading: false, error: false, change: null })
  const [searchValue, setSearchValue] = useState('')
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [selectedGroupList, setSelectedGroupList] = useState([])
  const [actionDisabled, setActionDisabled] = useState(false)
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings?.controlType === 'pages' && paginationSettings?.initialPage && paginationSettings?.initialPage >= 1) ? paginationSettings?.initialPage : 1,
    pageSize: paginationSettings?.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })

  /**
   * Method to get the drivers groups from API
   */
  const getDeliveryServices = async () => {
    try {
      setDeliveryServicesState({ ...deliveryServicesState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const filterConditons = []
      filterConditons.push({ attribute: 'owner_type', value: 'system' })
      const response = await fetch(`${ordering.root}/driver_companies?where=${JSON.stringify(filterConditons)}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setDeliveryServicesState({ ...deliveryServicesState, companies: content.result, loading: false })
        if (user?.level === 5) {
          const found = content.result.find(group => group?.administrator_id === user?.id)
          if (found) setActionDisabled(false)
          else setActionDisabled(true)
        } else {
          setActionDisabled(false)
        }
      }
    } catch (err) {
      setDeliveryServicesState({ ...deliveryServicesState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to update selected drivers group from API
   * @param {Number} driverGroupId
   * @param {Object} changes
   */
  const handleUpdateDeliveryService = async (deliveryServiceId, changes) => {
    if (!deliveryServiceId) return
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true, error: null })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/driver_companies/${deliveryServiceId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ error: null, loading: false })
        const groups = deliveryServicesState.companies.filter(company => {
          if (company.id === deliveryServiceId) {
            Object.assign(company, content.result)
          }
          return true
        })
        setDeliveryServicesState({ ...deliveryServicesState, groups })
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  const getDeliveryGroups = async (groupId) => {
    if (!groupId) return null
    try {
      setDeliveryGroups({ ...deliveryGroups, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/drivergroups/${groupId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setDeliveryGroups({ ...deliveryGroups, groups: [content.result], loading: false })
        return content.result
      }
    } catch (err) {
      setDeliveryGroups({ ...deliveryGroups, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get businesses from API
   */
  const getBusinesses = async () => {
    try {
      setBusinessesList({ ...businessesList, loading: true })
      const { content: { error, result } } = await ordering
        .setAccessToken(token)
        .businesses()
        .select(['name', 'logo'])
        .asDashboard()
        .get()
      if (!error) {
        setBusinessesList({ ...businessesList, loading: false, businesses: result })
      }
    } catch (err) {
      setBusinessesList({ ...businessesList, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get the paymethods from API
   */
  const getPaymethods = async () => {
    try {
      setPaymethodsList({ ...paymethodsList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/paymethods?params=name,gateway&where={%22enabled%22:true}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setPaymethodsList({ ...paymethodsList, paymethods: content.result, loading: false })
      }
    } catch (err) {
      setPaymethodsList({ ...paymethodsList, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to update selected drivers group from API
   * @param {Number} driverGroupId
   * @param {Object} changes
   */
  const handleUpdateDeliveryGroup = async (driverGroupId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true, error: null })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/drivergroups/${driverGroupId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ error: null, loading: false })
        const groups = deliveryServicesState.groups.filter(group => {
          if (group.id === driverGroupId) {
            Object.assign(group, content.result)
          }
          return true
        })
        setDeliveryServicesState({ ...deliveryServicesState, groups })
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to delete the drivers group from API
   * @param {Number} deliveryServiceId
   */
  const handleDeleteDeliveryService = async (deliveryServiceId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true, error: null })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/drivergroups/${deliveryServiceId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        const groups = deliveryServicesState.companies.filter(group => group.id !== deliveryServiceId)
        setDeliveryServicesState({ ...deliveryServicesState, groups })
        showToast(ToastType.Success, t('DRIVER_GROUP_DELETED', 'Driver group deleted'))
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  const handleSelectGroup = (groupId) => {
    let ids = []
    if (selectedGroupList.includes(groupId)) {
      ids = selectedGroupList.filter(id => id !== groupId)
    } else {
      ids = [...selectedGroupList, groupId]
    }
    setSelectedGroupList(ids)
  }

  const handleAllSelectGroup = () => {
    const allIds = deliveryServicesState.companies?.reduce((ids, group) => [...ids, group.id], [])
    if (selectedGroupList.length === allIds.length) {
      setSelectedGroupList([])
    } else {
      setSelectedGroupList(allIds)
    }
  }

  const handleScheduleState = (scheduleChanges) => {
    scheduleChanges?.length > 0 && setScheduleState({
      ...scheduleState,
      change: scheduleChanges
    })
  }

  const handleInstallSysPlugin = async (pluginUrl, callback) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          url: pluginUrl
        })
      }
      const response = await fetch(`${ordering.root}/plugins`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        showToast(ToastType.Success, t('SYSTEM_PLUGIN_INSTALLED', 'Plugin installed'))
        callback && callback(content)
      } else {
        setActionState({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    getDeliveryServices()
    getBusinesses()
    getPaymethods()
  }, [searchValue])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            deliveryServicesState={deliveryServicesState}
            setDeliveryServicesState={setDeliveryServicesState}
            setPaginationProps={setPaginationProps}
            businessesList={businessesList}
            paymethodsList={paymethodsList}
            actionState={actionState}
            scheduleState={scheduleState}
            handleUpdateDeliveryService={handleUpdateDeliveryService}
            handleDeleteDeliveryService={handleDeleteDeliveryService}
            handleUpdateDeliveryGroup={handleUpdateDeliveryGroup}
            handleScheduleState={handleScheduleState}
            selectedGroupList={selectedGroupList}
            handleSelectGroup={handleSelectGroup}
            handleAllSelectGroup={handleAllSelectGroup}
            actionDisabled={actionDisabled}
            pagination={paginationProps}
            onSearch={setSearchValue}
            searchValue={searchValue}
            getDeliveryGroups={getDeliveryGroups}
            deliveryGroups={deliveryGroups}
            setDeliveryGroups={setDeliveryGroups}
            handleInstallSysPlugin={handleInstallSysPlugin}
          />
        )
      }
    </>
  )
}

DeliveryServices.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  propsToFetch: []
}
