import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { saveAssignment } from '../../utils/saveAssignment'

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
  // add or remove only this user in each group instead of rewriting the group's list from this page's copy

  const [driversGroupsState, setDriversGroupsState] = useState({ groups: [], loading: false, loaded: false, error: null })
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
   * Method to read the groups the section can edit, without touching the state
   * @returns {Object} groups: the groups read, or error: the API or network errors
   */
  const readDriversGroups = async () => {
    try {
      const where = {
        conditions: [
          { attribute: 'enabled', value: true },
          { attribute: 'type', value: { condition: '!=', value: 1 } }
        ],
        conector: 'AND'
      }
      const response = await fetch(`${ordering.root}/drivergroups?params=name,drivers,administrators,type&where=${JSON.stringify(where)}`, {
        ...requestBase,
        method: 'GET',
        headers: {
          ...requestBase.headers,
          'Content-Type': 'application/json'
        }
      })
      const content = await response.json()
      return content.error ? { error: content.result } : { groups: content.result }
    } catch (err) {
      return { error: [err.message] }
    }
  }

  /**
   * Method to get the drivers groups from API
   */
  const getDriversGroups = async () => {
    setDriversGroupsState(prev => ({ ...prev, loading: true, error: null }))
    const { groups, error } = await readDriversGroups()
    setDriversGroupsState(prev => (error
      ? { ...prev, loading: false, error }
      : { ...prev, groups, loading: false, loaded: true, error: null }))
  }

  /**
   * Method to update selected drivers group from API
   * @param {Number} driverGroupId
   * @param {Object} changes
   * @param {Object} options - silent: the caller reports toast and action state (batch updates); assign: add (true)
   *   or remove (false) only this user as driver or manager instead of sending `changes`
   * @returns {Object} error: the API or network errors, null when saved
   */
  const handleUpdateDriversGroup = async (driverGroupId, changes, { silent = false, assign } = {}) => {
    try {
      if (!silent) {
        showToast(ToastType.Info, t('LOADING', 'Loading'))
        setActionState({ ...actionState, loading: true, error: null })
      }
      const requestOptions = {
        ...requestBase,
        method: 'PUT',
        headers: {
          ...requestBase.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(changes)
      }
      const content = typeof assign === 'boolean'
        ? await saveAssignment(ordering, token, `drivergroups/${driverGroupId}/${isDriverManager ? 'administrators' : 'drivers'}/${userId}`, assign)
        : await (await fetch(`${ordering.root}/drivergroups/${driverGroupId}`, requestOptions)).json()
      if (!content.error) {
        if (!silent) setActionState({ error: null, loading: false })
        const groups = driversGroupsState.groups.filter(group => {
          if (group.id === driverGroupId) {
            Object.assign(group, content.result)
          }
          return true
        })
        setDriversGroupsState({ ...driversGroupsState, groups })
        if (!silent) showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
        return { error: null }
      } else {
        if (!silent) setActionState({ ...actionState, loading: false, error: content.result })
        return { error: content.result }
      }
    } catch (err) {
      if (!silent) setActionState({ loading: false, error: [err.message] })
      return { error: [err.message] }
    }
  }

  const handleCheckboxClick = (groupId) => {
    const selectedGroup = driversGroupsState.groups.find(group => group.id === groupId)
    const userIds = selectedGroup.drivers?.reduce((ids, driver) => [...ids, driver.id], [])

    const numericUserIds = userIds.map(id => Number(id))
    const numericUserId = Number(userId)

    let changedUserIds = []
    if (numericUserIds.includes(numericUserId)) {
      changedUserIds = numericUserIds.filter(id => id !== numericUserId)
    } else {
      changedUserIds = [...numericUserIds, numericUserId]
    }

    const changes = { drivers: changedUserIds.length > 0 ? JSON.stringify(changedUserIds) : null }

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

    handleUpdateDriversGroup(groupId, changes, { assign: changedUserIds.includes(numericUserId) })
  }

  /**
   * stores a drivers manager's edited selection in one go. Only the groups that change are written, one by
   * one, adding or removing only this user, so what someone else assigned since this page loaded is kept.
   * @param {Array} selectedIds the groups the user should administer
   * @returns {Object} failed: [{ id, name, errors }], the groups that were not saved (empty when all were)
   */
  const handleSaveAdministrators = async (selectedIds) => {
    const numericUserId = Number(userId)
    const isAdmin = (group) => (group.administrators || []).some(admin => Number(admin.id) === numericUserId)
    const pending = driversGroupsState.groups.filter(group => selectedIds.includes(group.id) !== isAdmin(group))
    if (!pending.length) return { failed: [] }

    setActionState({ loading: true, error: null })
    const failed = []
    const saved = {}
    for (const group of pending) {
      const assign = selectedIds.includes(group.id)
      const others = (group.administrators || []).filter(admin => Number(admin.id) !== numericUserId)
      const { error } = await handleUpdateDriversGroup(group.id, undefined, { silent: true, assign })
      if (error) failed.push({ id: group.id, name: group.name, errors: error })
      else saved[group.id] = assign ? [...others, { id: numericUserId }] : others
    }
    setDriversGroupsState(prev => ({
      ...prev,
      groups: prev.groups.map(group => (saved[group.id] ? { ...group, administrators: saved[group.id] } : group))
    }))
    setActionState({ loading: false, error: null })
    if (!failed.length) showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
    return { failed }
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
            handleSaveAdministrators={handleSaveAdministrators}
            reloadGroups={getDriversGroups}
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
