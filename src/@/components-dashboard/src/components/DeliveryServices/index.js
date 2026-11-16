import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { waitForInstalledIntegration } from '../../utils/pluginInstall'

export const DeliveryServices = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ user, token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [deliveryServicesState, setDeliveryServicesState] = useState({ companies: [], loading: false, error: null })
  const [businessesList, setBusinessesList] = useState({ businesses: [], loading: false, error: null })
  const [paymethodsList, setPaymethodsList] = useState({ paymethods: [], loading: false, error: null })
  const [deliveryGroups, setDeliveryGroups] = useState({ groups: [], loading: false, error: null })
  // redesign DS-B1 (M-DS11 b): `companyId` says whose schedule `change` is
  const [scheduleState, setScheduleState] = useState({ loading: false, error: false, change: null, companyId: null })
  // redesign DS-B1 (decision 6): the stores of every group, from ONE request
  const [groupsInfo, setGroupsInfo] = useState({ loading: false, error: null, groups: {} })
  const groupsRequestRef = useRef(0)
  const companiesRef = useRef([])
  companiesRef.current = deliveryServicesState.companies
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [actionDisabled, setActionDisabled] = useState(false)
  const [installingPluginRoot, setInstallingPluginRoot] = useState(null)
  const installingPluginRef = useRef(false)
  const requestDeliveryServices = async () => {
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
    return await response.json()
  }

  /**
   * Method to get the drivers groups from API
   */
  const getDeliveryServices = async () => {
    try {
      // redesign DS-B1 (M-DS9): a reload clears the previous error
      setDeliveryServicesState(prev => ({ ...prev, loading: true, error: null }))
      const content = await requestDeliveryServices()
      if (!content.error) {
        setDeliveryServicesState(prev => ({ ...prev, companies: content.result, loading: false, error: null }))
        if (user?.level === 5) {
          const found = content.result.find(group => group?.administrator_id === user?.id)
          if (found) setActionDisabled(false)
          else setActionDisabled(true)
        } else {
          setActionDisabled(false)
        }
        // redesign DS-B1 (decision 6): once the providers are here, the stores of their groups, in one request
        await getGroupsInfo(content.result)
      } else {
        // redesign DS-B1 (M-DS9): the API refused; do not leave `loading` on
        setDeliveryServicesState(prev => ({ ...prev, loading: false, error: content.result }))
      }
    } catch (err) {
      setDeliveryServicesState(prev => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  /**
   * redesign DS-B1 (decision 6): ONE request for the stores (`business`) and `enabled` of the first group of every
   * provider that has one. No ids, no request. Only the latest request writes the state.
   * @param {Array} list providers (defaults to the ones already loaded)
   */
  const getGroupsInfo = async (list = companiesRef.current) => {
    const ids = [...new Set((list || [])
      .map(company => company?.driver_groups?.[0]?.id)
      .filter(id => id !== undefined && id !== null))]
    const requestId = ++groupsRequestRef.current
    if (!ids.length) {
      setGroupsInfo({ loading: false, error: null, groups: {} })
      return
    }
    try {
      setGroupsInfo(prev => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const where = [{ attribute: 'id', value: ids }]
      const response = await fetch(`${ordering.root}/drivergroups?params=id,business,enabled&where=${JSON.stringify(where)}`, requestOptions)
      const content = await response.json()
      if (requestId !== groupsRequestRef.current) return
      if (!content.error) {
        const groups = (content.result || []).reduce((map, group) => ({
          ...map,
          [group.id]: { id: group.id, business: group.business, enabled: group.enabled }
        }), {})
        setGroupsInfo({ loading: false, error: null, groups })
      } else {
        setGroupsInfo(prev => ({ ...prev, loading: false, error: content.result }))
      }
    } catch (err) {
      if (requestId !== groupsRequestRef.current) return
      setGroupsInfo(prev => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  /**
   * Method to update selected drivers group from API
   * @param {Number} driverGroupId
   * @param {Object} changes
   */
  const handleUpdateDeliveryService = async (deliveryServiceId, changes) => {
    // main: without a provider id nothing is sent (it went to `/driver_companies/undefined`); `ok: false` sends a switch back
    if (!deliveryServiceId) return { ok: false }
    // redesign DS-B1 (M-DS11): a save that carries the schedule drives scheduleState.loading
    const savesSchedule = !!changes && Object.prototype.hasOwnProperty.call(changes, 'schedule')
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true, error: null })
      if (savesSchedule) setScheduleState(prev => ({ ...prev, loading: true }))
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
        // redesign DS-B1 (M-DS2): swap the provider in `companies` without mutating the old object
        setDeliveryServicesState(prev => ({
          ...prev,
          companies: prev.companies.map(company => company.id === deliveryServiceId ? { ...company, ...content.result, id: company.id } : company)
        }))
        if (savesSchedule) setScheduleState(prev => ({ ...prev, loading: false, change: null, companyId: null }))
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
        return { ok: true, result: content.result }
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
        if (savesSchedule) setScheduleState(prev => ({ ...prev, loading: false }))
        return { ok: false, error: content.result }
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      if (savesSchedule) setScheduleState(prev => ({ ...prev, loading: false }))
      return { ok: false, error: [err.message] }
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
        setBusinessesList(prev => ({ ...prev, loading: false, error: null, businesses: result }))
      } else {
        // redesign DS-B1 (M-DS9)
        setBusinessesList(prev => ({ ...prev, loading: false, error: result }))
      }
    } catch (err) {
      setBusinessesList(prev => ({ ...prev, loading: false, error: [err.message] }))
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
        setPaymethodsList(prev => ({ ...prev, paymethods: content.result, loading: false, error: null }))
      } else {
        // redesign DS-B1 (M-DS9)
        setPaymethodsList(prev => ({ ...prev, loading: false, error: content.result }))
      }
    } catch (err) {
      setPaymethodsList(prev => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  // redesign DS-B1 (M-DS11 b): the change remembers which provider it belongs to
  const handleScheduleState = (scheduleChanges, companyId = null) => {
    scheduleChanges?.length > 0 && setScheduleState(prev => ({
      ...prev,
      change: scheduleChanges,
      companyId
    }))
  }

  // redesign DS-B1 (M-DS11 b): forget the pending change (e.g. when the draft is discarded)
  const resetScheduleState = () => {
    setScheduleState(prev => ({ ...prev, change: null, companyId: null }))
  }

  const handleInstallSysPlugin = async (pluginUrl, callback) => {
    // redesign DS-B1: without plugin_root there is nothing to install; do not call the API
    if (!pluginUrl) {
      return { ok: false, error: [t('DELIVERY_SERVICES_PLUGIN_ROOT_MISSING', 'This provider has no plugin to install.')] }
    }
    // main: one install at a time; another one meanwhile does nothing
    if (installingPluginRef.current) return { ok: false, busy: true }
    installingPluginRef.current = true
    setInstallingPluginRoot(pluginUrl)
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
        callback && await callback(content)
        return { ok: true, result: content.result }
      }
      setActionState({ loading: false, error: content.result })
      return { ok: false, error: content.result }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { ok: false, error: [err.message] }
    } finally {
      installingPluginRef.current = false
      setInstallingPluginRoot(null)
    }
  }

  const handleInstallDeliveryService = async (company) => {
    let installedCompany = null
    const result = await handleInstallSysPlugin(company?.plugin_root, async () => {
      let companies = null
      installedCompany = await waitForInstalledIntegration(async () => {
        try {
          const content = await requestDeliveryServices()
          if (!content.error) companies = content.result
        } catch (err) {}
        return companies
      }, { pluginRoot: company?.plugin_root })
      if (companies) {
        setDeliveryServicesState(prevState => ({ ...prevState, companies }))
        // redesign DS-B1 (decision 6): the stores of the new list, as getDeliveryServices does
        await getGroupsInfo(companies)
      }
    })
    const installed = !!result?.ok
    if (installed && !installedCompany) {
      showToast(ToastType.Info, t('INTEGRATION_INSTALL_PENDING', 'The plugin is installed and still finishing its setup. Try again in a few seconds.'))
    }
    return { installed, company: installedCompany }
  }

  useEffect(() => {
    getDeliveryServices()
    getBusinesses()
    getPaymethods()
  }, [])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            deliveryServicesState={deliveryServicesState}
            setDeliveryServicesState={setDeliveryServicesState}
            businessesList={businessesList}
            paymethodsList={paymethodsList}
            actionState={actionState}
            scheduleState={scheduleState}
            handleUpdateDeliveryService={handleUpdateDeliveryService}
            handleScheduleState={handleScheduleState}
            actionDisabled={actionDisabled}
            getDeliveryGroups={getDeliveryGroups}
            deliveryGroups={deliveryGroups}
            setDeliveryGroups={setDeliveryGroups}
            handleInstallSysPlugin={handleInstallSysPlugin}
            // main: install and wait until the provider is linked, without reloading the page
            handleInstallDeliveryService={handleInstallDeliveryService}
            installingPluginRoot={installingPluginRoot}
            // redesign DS-B1 (M-DS9, M-DS11 b, decision 6)
            reloadDeliveryServices={getDeliveryServices}
            groupsInfo={groupsInfo}
            reloadGroupsInfo={() => getGroupsInfo()}
            resetScheduleState={resetScheduleState}
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
