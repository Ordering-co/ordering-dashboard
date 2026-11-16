import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const DriversCompanyDetails = (props) => {
  const {
    UIComponent,
    driversCompaniesState,
    setDriversCompaniesState,
    driversCompany,
    driversCompanyId
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [companyState, setCompanyState] = useState({ company: null, loading: !driversCompany, error: null })
  const [changesState, setChangesState] = useState({})
  const [actionState, setActionState] = useState({ loading: false, error: null })

  // redesign DC-B1 (M-DC16): the company that is open, also when it came by `?id=` with no row (main used the row, and saved to
  // /driver_companies/undefined and threw on delete)
  const currentId = () => companyState.company?.id ?? driversCompany?.id ?? driversCompanyId

  /**
   * Method to update the selected drivers company from API
   * @param {Number} driverCompanyId
   */
  const handleUpdateDriversCompany = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const _changes = { ...changesState }
      if (_changes?.schedule) {
        _changes.schedule = JSON.stringify(_changes?.schedule)
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(_changes)
      }
      const companyId = currentId()
      const response = await fetch(`${ordering.root}/driver_companies/${companyId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        // redesign DC-B1 (M-DC22): new objects, not a mutation of the list's row; the panel's own copy gets the result too
        const companies = (driversCompaniesState?.companies ?? []).map(company => (company.id === companyId ? { ...company, ...content.result } : company))
        setDriversCompaniesState && setDriversCompaniesState({ ...driversCompaniesState, companies })
        setCompanyState(prev => ({ ...prev, company: prev.company ? { ...prev.company, ...content.result } : prev.company }))
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
        setChangesState({})
        return { ok: true }
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
        return { ok: false, error: content.result }
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to add new drivers company from API
   */
  const handleAddDriversCompany = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })

      const schedule = []
      for (let i = 0; i < 7; i++) {
        schedule.push({
          enabled: true,
          lapses: [
            {
              open: {
                hour: 0,
                minute: 0
              },
              close: {
                hour: 23,
                minute: 45
              }
            }
          ]
        })
      }
      const extraAttributes = {
        enabled: true,
        priority: '0',
        fixed_cost_per_km: 0,
        fixed_cost_delivery: 0,
        percentage_cost_per_order_subtotal: 0
      }
      // redesign DC-B1 (M-DC15): what the form chose wins over the defaults (main put `priority: '0'` last, so the chosen one was lost)
      const changes = {
        ...extraAttributes,
        ...changesState,
        schedule: changesState?.schedule ? JSON.stringify(changesState?.schedule) : JSON.stringify(schedule)
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/driver_companies`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        const companies = [...driversCompaniesState.companies, content.result]
        setDriversCompaniesState({ ...driversCompaniesState, companies })
        showToast(ToastType.Success, t('DRIVER_COMPANY_ADDED', 'Driver company added'))
        setChangesState({})
        props.onClose && props.onClose()
        return { ok: true }
      } else {
        setActionState({ loading: false, error: content.result })
        return { ok: false, error: content.result }
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to delete the selected drivers company from API
   */
  const handleDeleteDriversCompany = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const companyId = currentId()
      const response = await fetch(`${ordering.root}/driver_companies/${companyId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        const companies = (driversCompaniesState?.companies ?? []).filter(company => company.id !== companyId)
        setDriversCompaniesState && setDriversCompaniesState({ ...driversCompaniesState, companies })
        showToast(ToastType.Success, t('DRIVER_COMPANY_DELETED', 'Driver company deleted'))
        props.onClose && props.onClose()
        return { ok: true }
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
        return { ok: false, error: content.result }
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { ok: false, error: [err.message] }
    }
  }

  const handleChangesState = (key, val) => {
    setChangesState({
      ...changesState,
      [key]: val
    })
  }

  const handleChangeScheduleState = (scheduleChanges) => {
    setChangesState({
      ...changesState,
      schedule: scheduleChanges
    })
  }

  const getDriversCompany = async () => {
    try {
      setCompanyState({
        ...companyState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'x-app-x': ordering.appId,
          'X-INTERNAL-PRODUCT-X': ordering.appInternalName,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/driver_companies/${driversCompanyId}`, requestOptions)
      const { result, error } = await response.json()
      if (!error) {
        setCompanyState({
          loading: false,
          company: result,
          error: null
        })
      } else {
        setCompanyState({
          ...companyState,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setCompanyState({
        ...companyState,
        loading: false,
        error: [error.message]
      })
    }
  }

  useEffect(() => {
    if (driversCompany) {
      setCompanyState({
        ...companyState,
        loading: false,
        company: driversCompany
      })
    } else {
      if (driversCompanyId) {
        getDriversCompany()
      }
    }
  }, [driversCompany, driversCompanyId])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            companyState={companyState}
            cleanChagesState={() => setChangesState({})}
            changesState={changesState}
            actionState={actionState}
            cleanActionState={() => setActionState({ ...actionState, error: null })}
            handleChangesState={handleChangesState}
            handleUpdateDriversCompany={handleUpdateDriversCompany}
            handleAddDriversCompany={handleAddDriversCompany}
            handleChangeScheduleState={handleChangeScheduleState}
            handleDeleteDriversCompany={handleDeleteDriversCompany}
          />
        )
      }
    </>
  )
}

DriversCompanyDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
