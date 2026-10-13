import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const BusinessPlaceGroup = (props) => {
  const {
    UIComponent,
    placeGroup,
    businessId,
    handleSuccessAddPlaceGroup,
    handleSuccessUpdatePlaceGroup,
    handleSuccessDeletePlaceGroup,
    handleUpdateSelectedPlaceGroup
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()

  const [placeList, setPlaceList] = useState({ loading: false, places: [], error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  const handleChangeInput = (e) => {
    const currentChanges = { ...formState?.changes, [e.target.name]: e.target.value }
    setFormState({
      ...formState,
      changes: currentChanges
    })
  }

  /**
 * Method to add the campaign in the campaign list
 * @param {Object} result campaign to add
 */
  const handleSuccessAddPlace = (result) => {
    const places = [...placeList.places, result]
    setPlaceList({ ...placeList, places })
  }

  /**
   * Method to update the place list
   */
  const handleSuccessUpdatePlace = async (result) => {
    const updatedPlaceList = placeList?.places?.map(place => {
      if (result?.id === place?.id) {
        return {
          ...place,
          ...result
        }
      }
      return place
    })
    setPlaceList({
      ...placeList,
      places: updatedPlaceList
    })
  }

  /**
   * Method to delete place
   */
  const handleSuccessDeletePlace = (placeId) => {
    const updatedPlaceList = placeList?.places?.filter(place => place.id !== placeId)
    setPlaceList({
      ...placeList,
      places: updatedPlaceList
    })
  }

  const getMultiPlaceCheckStatus = () => {
    let isChecked = true
    placeList.places.forEach(placeGroup => {
      if (!placeGroup.enabled) isChecked = false
    })
    return isChecked
  }

  /**
   * Method to add new place group from API
   */
  const handleAddPlaceGroup = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState?.changes)
      }

      const response = await fetch(`${ordering.root}/business/${businessId}/place_groups`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({ ...formState, loading: false, error: null })
        handleSuccessAddPlaceGroup && handleSuccessAddPlaceGroup({ ...content.result, enabled: true })
        showToast(ToastType.Success, t('PLACE_ADDED', 'Place added'))
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Function to update place group data
   */
  const handleUpdatePlaceGroup = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState?.changes)
      }

      const response = await fetch(`${ordering.root}/business/${businessId}/place_groups/${placeGroup?.id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setFormState({ ...formState, loading: false, error: null, changes: {} })
        handleUpdateSelectedPlaceGroup && handleUpdateSelectedPlaceGroup(content.result)
        handleSuccessUpdatePlaceGroup && handleSuccessUpdatePlaceGroup(content.result)
        showToast(ToastType.Success, t('PLACE_SAVED', 'Place saved'))
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to delete a place group
   */
  const handleDeletePlaceGroup = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/place_groups/${placeGroup?.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        handleSuccessDeletePlaceGroup && handleSuccessDeletePlaceGroup(placeGroup?.id)
        showToast(ToastType.Success, t('PLACE_DELETED', 'Place deleted'))
        setFormState({ ...formState, loading: false, error: null })
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Function to get placeList from API
   */
  const getPlaceList = async () => {
    try {
      setPlaceList({ ...placeList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/places`, requestOptions)
      const content = await response.json()

      const _placesList = content?.result.filter(item => item.place_group_id === placeGroup?.id)
      if (!content.error) {
        setPlaceList({
          ...placeList,
          loading: false,
          places: _placesList
        })
      } else {
        setPlaceList({
          ...placeList,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setPlaceList({
        ...placeList,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Function to update place data
   */
  const handleChangePlaceEnabled = async (placeId, changes, isMulti) => {
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

      const response = await fetch(`${ordering.root}/business/${businessId}/places/${placeId}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setActionState({
          ...actionState,
          loading: false,
          error: null
        })
        !isMulti && handleSuccessUpdatePlace(content.result)
        showToast(ToastType.Success, t('OPTION_UPDATED', 'Option updated'))
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

  const handleMultiPlaceChangeEnabled = async () => {
    const allPromise = []
    const isChecked = getMultiPlaceCheckStatus()
    placeList.places.forEach(place => {
      allPromise.push(new Promise((resolve, reject) => {
        resolve(handleChangePlaceEnabled(place.id, { enabled: !isChecked }, true))
      }))
    })
    await Promise.all(allPromise)
    const updatedPlaceList = placeList?.places?.map(place => {
      return {
        ...place,
        enabled: !isChecked
      }
    })
    setPlaceList({
      ...placeList,
      places: updatedPlaceList
    })
  }

  useEffect(() => {
    setFormState({
      ...formState,
      changes: {}
    })
    if (placeGroup) getPlaceList()
  }, [placeGroup?.id])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            formState={formState}
            placeList={placeList}
            handleChangeInput={handleChangeInput}
            handleAddPlaceGroup={handleAddPlaceGroup}
            handleUpdatePlaceGroup={handleUpdatePlaceGroup}
            handleDeletePlaceGroup={handleDeletePlaceGroup}
            handleSuccessAddPlace={handleSuccessAddPlace}
            handleSuccessUpdatePlace={handleSuccessUpdatePlace}
            handleSuccessDeletePlace={handleSuccessDeletePlace}
            handleChangePlaceEnabled={handleChangePlaceEnabled}
            getMultiPlaceCheckStatus={getMultiPlaceCheckStatus}
            handleMultiPlaceChangeEnabled={handleMultiPlaceChangeEnabled}
          />
        )
      }
    </>
  )
}

BusinessPlaceGroup.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
