import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const DriversCompaniesList = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [driversCompaniesState, setDriversCompaniesState] = useState({ companies: [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [openDetails, setOpenDetails] = useState(false)
  const [selectedCompanyList, setSelectedCompanyList] = useState([])
  const [startSeveralDeleteStart, setStartSeveralDeleteStart] = useState(false)

  /**
   * Method to get the drivers companies from API
   */
  const getDriversCompanies = async () => {
    try {
      // redesign DC-B1 (M-DC3): a load clears the previous error
      setDriversCompaniesState(prev => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/driver_companies`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setDriversCompaniesState(prev => ({ ...prev, companies: content.result, loading: false }))
      } else {
        // redesign DC-B1 (M-DC3): main had no branch here, and the list stayed loading for good
        setDriversCompaniesState(prev => ({ ...prev, loading: false, error: content.result }))
      }
    } catch (err) {
      setDriversCompaniesState(prev => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  /**
   * Method to update the selected drivers company from API
   * @param {Number} driverCompanyId
   */
  const handleUpdateDriversCompany = async (driverCompanyId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/driver_companies/${driverCompanyId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        // redesign DC-B1 (M-DC22): a new object for the saved company (the row's switch is controlled), not a mutation
        setDriversCompaniesState(prev => ({
          ...prev,
          companies: prev.companies.map(company => (company.id === driverCompanyId ? { ...company, ...content.result } : company))
        }))
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
        return { ok: true } // redesign DC-B1 (M-DC2)
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
        return { ok: false, error: content.result } // redesign DC-B1 (M-DC2)
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { ok: false, error: [err.message] } // redesign DC-B1 (M-DC2)
    }
  }

  /**
   * Method to delete the selected drivers company from API
   * @param {Number} driverCompanyId
   */
  const handleDeleteDriversCompany = async (driverCompanyId) => {
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
      const response = await fetch(`${ordering.root}/driver_companies/${driverCompanyId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        setDriversCompaniesState(prev => ({ ...prev, companies: prev.companies.filter(company => company.id !== driverCompanyId) }))
        showToast(ToastType.Success, t('DRIVER_COMPANY_DELETED', 'Driver company deleted'))
        if (startSeveralDeleteStart) {
          const companyList = [...selectedCompanyList]
          companyList.shift()
          if (companyList.length === 0) {
            setStartSeveralDeleteStart(false)
          }
          setSelectedCompanyList(companyList)
        }
        return { ok: true } // redesign DC-B1
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
        setStartSeveralDeleteStart(false)
        return { ok: false, error: content.result } // redesign DC-B1
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      // redesign DC-B1 (M-DC18): main left the bulk delete armed here, and the next checkbox fired a DELETE nobody confirmed
      setStartSeveralDeleteStart(false)
      return { ok: false, error: [err.message] }
    }
  }

  const handleSelectCompany = (driversCompanyId) => {
    let ids = []
    if (selectedCompanyList.includes(driversCompanyId)) {
      ids = selectedCompanyList.filter(id => id !== driversCompanyId)
    } else {
      ids = [...selectedCompanyList, driversCompanyId]
    }
    setSelectedCompanyList(ids)
  }

  const handleAllSelectCompany = () => {
    const allIds = driversCompaniesState.companies?.reduce((ids, company) => [...ids, company.id], [])
    if (selectedCompanyList.length === allIds.length) {
      setSelectedCompanyList([])
    } else {
      setSelectedCompanyList(allIds)
    }
  }

  useEffect(() => {
    if (!startSeveralDeleteStart || selectedCompanyList.length === 0) return
    handleDeleteDriversCompany(selectedCompanyList[0])
  }, [selectedCompanyList, startSeveralDeleteStart])

  useEffect(() => {
    getDriversCompanies()
  }, [])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            driversCompaniesState={driversCompaniesState}
            setDriversCompaniesState={setDriversCompaniesState}
            actionState={actionState}
            openDetails={openDetails}
            setOpenDetails={setOpenDetails}
            handleUpdateDriversCompany={handleUpdateDriversCompany}
            handleDeleteDriversCompany={handleDeleteDriversCompany}
            handleSelectCompany={handleSelectCompany}
            selectedCompanyList={selectedCompanyList}
            handleAllSelectCompany={handleAllSelectCompany}
            handleDeleteSelectedCompanies={() => setStartSeveralDeleteStart(true)}
            reloadDriversCompanies={getDriversCompanies}
            setSelectedCompanyList={setSelectedCompanyList}
          />
        )
      }
    </>
  )
}

DriversCompaniesList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
