import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const BusinessPlaceGroupList = (props) => {
  const {
    UIComponent,
    business
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()

  const [placeGroupList, setPlaceGroupList] = useState({ loading: false, placeGroups: [], error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Method to add the campaign in the campaign list
   * @param {Object} result campaign to add
   */
  const handleSuccessAddPlaceGroup = (result) => {
    const placeGroups = [...placeGroupList.placeGroups, result]
    setPlaceGroupList({ ...placeGroupList, placeGroups })
  }

  /**
   * Method to update the place list
   */
  const handleSuccessUpdatePlaceGroup = async (result) => {
    const updatedPlaceList = placeGroupList?.placeGroups?.map(placeGroup => {
      if (result?.id === placeGroup?.id) {
        return {
          ...placeGroup,
          ...result
        }
      }
      return placeGroup
    })
    setPlaceGroupList({
      ...placeGroupList,
      placeGroups: updatedPlaceList
    })
  }

  /**
   * Method to delete place
   */
  const handleSuccessDeletePlaceGroup = (placeId) => {
    const updatedPlaceList = placeGroupList?.placeGroups?.filter(place => place.id !== placeId)
    setPlaceGroupList({
      ...placeGroupList,
      placeGroups: updatedPlaceList
    })
  }

  const getPlaceGroupList = async () => {
    try {
      setPlaceGroupList({ ...placeGroupList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business?.id}/place_groups`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setPlaceGroupList({
          ...placeGroupList,
          loading: false,
          placeGroups: content.result
        })
      } else {
        setPlaceGroupList({
          ...placeGroupList,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setPlaceGroupList({
        ...placeGroupList,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Function to update place data
   */
  const handleChangeEnabled = async (placeId, changes, isMulti) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/business/${business?.id}/place_groups/${placeId}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setActionState({
          ...actionState,
          loading: false,
          error: null
        })
        !isMulti && handleSuccessUpdatePlaceGroup(content.result)
        showToast(ToastType.Success, t('PLACE_UPDATED', 'Place updated'))
      } else {
        setActionState({
          ...actionState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setActionState({
        ...actionState,
        loading: false,
        error: err.message
      })
    }
  }

  const getMultiCheckStatus = () => {
    let isChecked = true
    placeGroupList.placeGroups.forEach(placeGroup => {
      if (!placeGroup.enabled) isChecked = false
    })
    return isChecked
  }

  const handleMultiChangeEnabled = async () => {
    const allPromise = []
    const isChecked = getMultiCheckStatus()
    placeGroupList.placeGroups.forEach(placeGroup => {
      allPromise.push(new Promise((resolve, reject) => {
        resolve(handleChangeEnabled(placeGroup.id, { enabled: !isChecked }, true))
      }))
    })
    await Promise.all(allPromise)
    const updatedPlaceList = placeGroupList?.placeGroups?.map(placeGroup => {
      return {
        ...placeGroup,
        enabled: !isChecked
      }
    })
    setPlaceGroupList({
      ...placeGroupList,
      placeGroups: updatedPlaceList
    })
  }

  useEffect(() => {
    if (!business) return
    getPlaceGroupList()
  }, [business])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            placeGroupList={placeGroupList}
            handleSuccessAddPlaceGroup={handleSuccessAddPlaceGroup}
            handleSuccessUpdatePlaceGroup={handleSuccessUpdatePlaceGroup}
            handleSuccessDeletePlaceGroup={handleSuccessDeletePlaceGroup}
            handleChangeEnabled={handleChangeEnabled}
            handleMultiChangeEnabled={handleMultiChangeEnabled}
            getMultiCheckStatus={getMultiCheckStatus}
          />
        )
      }
    </>
  )
}

BusinessPlaceGroupList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
