import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const DriverGroupSetting = (props) => {
  const {
    userId,
    UIComponent,
    isDriverManager
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [driversGroupsState, setDriversGroupsState] = useState({ groups: [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [includedGroupIds, setIncludedGroupIds] = useState([])

  const requestBase = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  }

  /**
   * Method to handle select all or none drivers groups
   * @param {Boolean} isSelectAll - true for select all, false for select none
   */
  const handleSelectAllDriver = async (isSelectAll) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true, error: null })

      const requestOptions = {
        ...requestBase,
        headers: {
          ...requestBase.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          driver_group_ids: isSelectAll ? driversGroupsState?.groups?.map(group => group.id) : []
        })
      }

      const response = await fetch(`${ordering.root}/users/${userId}/drivergroups`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setActionState({ error: null, loading: false })
        const newIncludedIds = isSelectAll ? driversGroupsState.groups.map(group => group.id) : []
        setIncludedGroupIds(newIncludedIds)

        getDriversGroups()
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get the drivers groups from API
   */
  const getDriversGroups = async () => {
    try {
      setDriversGroupsState({ ...driversGroupsState, loading: true })
      const requestOptions = {
        ...requestBase,
        method: 'GET',
        headers: {
          ...requestBase.headers,
          'Content-Type': 'application/json'
        }
      }
      let where = []
      const conditions = []
      conditions.push({
        attribute: 'enabled',
        value: true
      })
      conditions.push({
        attribute: 'type',
        value: {
          condition: '!=',
          value: 1
        }
      })
      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const response = await fetch(`${ordering.root}/drivergroups?params=name,drivers,administrators,type&where=${JSON.stringify(where)}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setDriversGroupsState({ ...driversGroupsState, groups: content.result, loading: false })
      }
    } catch (err) {
      setDriversGroupsState({ ...driversGroupsState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to update selected drivers group from API
   * @param {Number} driverGroupId
   * @param {Object} changes
   */
  const handleUpdateDriversGroup = async (driverGroupId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true, error: null })
      const requestOptions = {
        ...requestBase,
        method: 'PUT',
        headers: {
          ...requestBase.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/drivergroups/${driverGroupId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ error: null, loading: false })
        const groups = driversGroupsState.groups.filter(group => {
          if (group.id === driverGroupId) {
            Object.assign(group, content.result)
          }
          return true
        })
        setDriversGroupsState({ ...driversGroupsState, groups })
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  const handleCheckboxClick = (groupId) => {
    const selectedGroup = driversGroupsState.groups.find(group => group.id === groupId)
    const userIds = isDriverManager
      ? selectedGroup.administrators?.reduce((ids, admin) => [...ids, admin.id], [])
      : selectedGroup.drivers?.reduce((ids, driver) => [...ids, driver.id], [])

    const numericUserIds = userIds.map(id => Number(id))
    const numericUserId = Number(userId)

    let changedUserIds = []
    if (numericUserIds.includes(numericUserId)) {
      changedUserIds = numericUserIds.filter(id => id !== numericUserId)
    } else {
      changedUserIds = [...numericUserIds, numericUserId]
    }

    const changes = isDriverManager
      ? { administrators: changedUserIds.length > 0 ? JSON.stringify(changedUserIds) : null }
      : { drivers: changedUserIds.length > 0 ? JSON.stringify(changedUserIds) : null }

    if (changedUserIds.includes(numericUserId)) {
      setIncludedGroupIds(prev => {
        if (prev.includes(groupId)) {
          return prev
        }
        const newIds = [...prev, groupId]
        return newIds
      })
    } else {
      setIncludedGroupIds(prev => {
        const newIds = prev.filter(id => id !== groupId)
        return newIds
      })
    }

    handleUpdateDriversGroup(groupId, changes)
  }

  useEffect(() => {
    if (driversGroupsState.loading || !driversGroupsState.groups.length) {
      return
    }

    const groupIds = driversGroupsState.groups?.reduce((ids, group) => {
      const found = isDriverManager
        ? group.administrators.find(admin => Number(admin.id) === Number(userId))
        : group.drivers.find(driver => Number(driver.id) === Number(userId))
      if (found) return [...ids, group.id]
      else return [...ids]
    }, [])

    if (JSON.stringify(groupIds) !== JSON.stringify(includedGroupIds)) {
      setIncludedGroupIds(groupIds)
    }
  }, [userId, driversGroupsState.groups])

  useEffect(() => {
    getDriversGroups()
  }, [])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            driversGroupsState={driversGroupsState}
            includedGroupIds={includedGroupIds}
            actionState={actionState}
            handleCheckboxClick={handleCheckboxClick}
            handleSelectAllDriver={handleSelectAllDriver}
          />
        )
      }
    </>
  )
}

DriverGroupSetting.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
