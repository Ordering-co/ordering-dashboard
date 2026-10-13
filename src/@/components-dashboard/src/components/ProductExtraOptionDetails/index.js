import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const ProductExtraOptionDetails = (props) => {
  const {
    UIComponent,
    business,
    extra,
    option,
    handleUpdateBusinessState,
    handleSucccessDeleteOption,
    parentExtraState,
    setParentExtraState
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [optionState, setOptionState] = useState({ option, loading: false, error: null })
  const [changesState, setChangesState] = useState({ changes: {}, result: {} })
  const [editSubOptionId, setEditSubOptionId] = useState(null)
  const [settingChangeState, setSettingChangeState] = useState({ changes: {}, loading: false, error: null })
  const [conditionalOptions, setConditionalOptions] = useState([])
  const [conditionalSubOptions, setConditionalSubOptions] = useState([])
  const [conditionalOptionId, setConditionalOptionId] = useState(null)
  const [extraState, setExtraState] = useState(extra)
  const [conditionalSubOptionId, setConditionalSubOptionId] = useState(null)
  const [isAddForm, setIsAddForm] = useState(true)
  const [dragoverSubOptionId, setDragoverSubOptionId] = useState(null)
  const [isSubOptionsBottom, setIsSubOptionsBottom] = useState(false)

  /**
   * Method to change the option input
   * @param {EventTarget} e Related HTML event
   * @param {Number} id sub option id
   */
  const handleChangeInput = (e, id) => {
    if (id === editSubOptionId) {
      setChangesState({
        result: {},
        changes: {
          ...changesState.changes,
          [e.target.name]: e.target.value
        }
      })
    } else {
      setEditSubOptionId(id)
      setChangesState({
        result: {},
        changes: {
          [e.target.name]: e.target.value
        }
      })
    }
  }

  /**
   * Method change default suboption
   * @param {Number} id
   */
  const handleChangeDefaultSuboption = (id) => {
    const suboptionPreselected = optionState?.option?.suboptions?.find(suboption => suboption.id === id)?.preselected
    const defaultSubOptionsLength = optionState?.option?.suboptions?.filter(suboption => suboption?.preselected)?.length
    if (suboptionPreselected) {
      handleUpdateSubOption({
        id,
        preselected: false
      })
    } else {
      if (optionState?.option?.max > defaultSubOptionsLength) {
        handleUpdateSubOption({
          id,
          preselected: true
        })
      } else {
        showToast(ToastType.Error, t('MAX_PRESELECTED_OPTIONS_ERROR', 'Maximum number of options exceeded'), 4000)
      }
    }
  }

  /**
   * Method to change the option enabled state
   * @param {Boolean} enabled
   * @param {Number} id sub option id
   */
  const handleChangeSubOptionEnable = (enabled, id) => {
    if (id === editSubOptionId) {
      setChangesState({
        result: {},
        changes: {
          ...changesState.changes,
          enabled
        }
      })
    } else {
      setEditSubOptionId(id)
      setChangesState({
        result: {},
        changes: {
          enabled
        }
      })
    }
  }

  /**
   * Update business photo data
   * @param {File} file Image to change business photo
   */
  const handleChangeSubOptionImage = (file, id) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    if (id === editSubOptionId) {
      reader.onload = () => {
        setChangesState({
          result: {},
          changes: {
            ...changesState.changes,
            image: reader.result
          }
        })
      }
    } else {
      setEditSubOptionId(id)
      reader.onload = () => {
        setChangesState({
          result: {},
          changes: {
            image: reader.result
          }
        })
      }
    }
  }

  /**
   * Method to change the suboption state
   */
  const handleChangeItem = (changes, id) => {
    if (id !== undefined && editSubOptionId === id) setEditSubOptionId(id)
    setChangesState({
      result: {},
      changes: {
        ...changesState.changes,
        ...changes
      }
    })
  }

  /**
   * Method to update the business state
   * @param {Object} updatedExtra updated extra
   */
  const handleSuccessUpdateBusiness = (updatedExtra) => {
    if (handleUpdateBusinessState) {
      const updatedExtras = business.extras.filter(extra => {
        if (extra.id === updatedExtra.id) {
          Object.assign(extra, updatedExtra)
        }
        return true
      })
      const businessState = { ...business, extras: updatedExtras }
      const categories = businessState.categories.map(item => {
        if (item.products) {
          const _products = item.products.map(prod => {
            const _extras = prod?.extras?.filter(extra => {
              if (extra.id === updatedExtra.id) {
                Object.assign(extra, updatedExtra)
              }
              return true
            })
            return { ...prod, extras: _extras }
          })
          const _item = { ...item, products: _products }
          return _item
        }
        return item
      })

      const updatedBusiness = { ...businessState, categories }
      handleUpdateBusinessState(updatedBusiness)
    }
  }

  const handleSetConditionalOptions = (updatedExtra) => {
    const extracedOptions = updatedExtra.options.filter(item => item.id !== option.id)
    const _conditionalOptions = []
    for (const optionItem of extracedOptions) {
      _conditionalOptions.push({ value: optionItem.id, content: optionItem.name })
    }
    setConditionalOptions(_conditionalOptions)
  }

  const handleSetConditionalSubOptions = (updatedExtra, optionId) => {
    const selectedOption = updatedExtra.options.find(item => item.id === optionId)
    const _conditionalSubOptions = []
    for (const subOption of selectedOption.suboptions) {
      _conditionalSubOptions.push({ value: subOption.id, content: subOption.name })
    }
    setConditionalSubOptions(_conditionalSubOptions)
  }

  const handleSetDefaultCondition = (respectTo) => {
    for (const item of extraState?.options) {
      if (item?.suboptions) {
        for (const subItem of item.suboptions) {
          if (subItem.id === respectTo) {
            setConditionalOptionId(item.id)
            setConditionalSubOptionId(subItem.id)
          }
        }
      }
    }
  }

  /**
   * Method to save the new ingredient from API
   */
  const handleUpdateSubOption = async (changesParam) => {
    try {
      if (!changesParam?.id && !editSubOptionId) return
      const _changes = changesParam || { ...changesState.changes }
      let changes = {}
      for (const key in _changes) {
        if (_changes[key] !== '') {
          changes = { ...changes, [key]: _changes[key] }
        }
      }
      if (Object.keys(changes).length === 0) return
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setOptionState({ ...optionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras/${extra.id}/options/${option.id}/suboptions/${changesParam?.id || editSubOptionId}`, requestOptions)
      const content = await response.json()
      setChangesState({
        changes: content.error ? changesState.changes : {},
        result: content?.result
      })
      if (!content.error) {
        const subOptions = optionState.option.suboptions.filter(subOption => {
          if (subOption.id === content.result.id) {
            Object.assign(subOption, content.result)
          }
          return true
        })
        const updatedOption = { ...optionState.option, suboptions: subOptions }
        setOptionState({ ...optionState, option: updatedOption, loading: false })
        const options = extra.options.filter(option => {
          if (option.id === updatedOption.id) {
            Object.assign(option, updatedOption)
          }
          return true
        })
        const updatedExtra = { ...extra, options }
        setExtraState(updatedExtra)
        handleSuccessUpdateBusiness(updatedExtra)
        showToast(ToastType.Success, t('CHOICE_SAVED', 'Choice saved'))
        return true
      }
    } catch (err) {
      setOptionState({ ...optionState, loading: false, error: err.message })
    }
  }

  /**
   * Method to add new option from API
   */
  const handleAddOption = async (values) => {
    try {
      const changes = { ...values }
      for (const key in changes) {
        if (!changes[key]) {
          delete changes[key]
        }
      }
      if (!changes?.price) {
        changes.price = 0
      }
      if (Object.keys(changes).length === 0) return
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      changes.enabled = true
      setOptionState({ ...optionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras/${extra.id}/options/${option.id}/suboptions`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const subOptions = [...optionState.option.suboptions]
        subOptions.push({
          ...content.result,
          preselected: false
        })
        const updatedOption = { ...optionState.option, suboptions: subOptions }
        setOptionState({ ...optionState, option: updatedOption, loading: false })
        setChangesState({
          changes: {},
          result: {}
        })
        const options = extra.options.filter(option => {
          if (option.id === updatedOption.id) {
            Object.assign(option, updatedOption)
          }
          return true
        })
        const updatedExtra = { ...extra, options }
        setExtraState(updatedExtra)
        handleSuccessUpdateBusiness(updatedExtra)
        showToast(ToastType.Success, t('CHOICE_ADDED', 'Choice added'))
        setIsAddForm(false)
      }
    } catch (err) {
      setOptionState({ ...optionState, loading: false, error: err.message })
    }
  }

  /**
   * Method to delete the extra
   * @param {Number} subOptionId
   */
  const handleDeteteSubOption = async (subOptionId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setOptionState({ ...optionState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras/${extra.id}/options/${option.id}/suboptions/${subOptionId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const subOptions = optionState.option.suboptions.filter(subOption => subOption.id !== subOptionId)
        const updatedOption = { ...optionState.option, suboptions: subOptions }
        setOptionState({ ...optionState, option: updatedOption, loading: false })
        const options = extra.options.filter(option => {
          if (option.id === updatedOption.id) {
            Object.assign(option, updatedOption)
          }
          return true
        })
        const updatedExtra = { ...extra, options }
        setExtraState(updatedExtra)
        handleSuccessUpdateBusiness(updatedExtra)
        showToast(ToastType.Success, t('CHOICE_DELETED', 'Choice deleted'))
      }
    } catch (err) {
      setOptionState({ ...optionState, loading: false, error: err.message })
    }
  }

  /**
   * Method to handle the option setting
   * @param {String} name setting name
   * @param {Boolean} checked check state of option setting
   */
  const handleOptionSetting = async (name, checked) => {
    const change = { [name]: checked }
    if (name === 'conditioned' && !checked) {
      setConditionalSubOptionId(null)
      setConditionalOptionId(null)
      change.respect_to = 0
    }
    setSettingChangeState({
      ...settingChangeState,
      changes: change
    })
    handleUpdateOption(change)
  }

  /**
   * Method to save the option from API
   * @param {Object} change
   */
  const handleUpdateOption = async (change) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setSettingChangeState({ ...settingChangeState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(change)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras/${extra.id}/options/${option.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setSettingChangeState({
          changes: content.error ? settingChangeState.changes : {},
          loading: false
        })
        setOptionState({ ...optionState, option: { ...optionState.option, ...content.result } })
        const options = extra.options.filter(option => {
          if (option.id === content.result.id) {
            Object.assign(option, content.result)
          }
          return true
        })
        const updatedExtra = { ...extra, options }
        setExtraState(updatedExtra)
        handleSuccessUpdateBusiness(updatedExtra)
        showToast(ToastType.Success, t('OPTION_SAVED', 'Option saved'))
      }
    } catch (err) {
      setSettingChangeState({ ...settingChangeState, loading: false, error: err.message })
    }
  }

  /**
   * Method to delete the extra
   */
  const handleDeteteOption = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setOptionState({ ...optionState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras/${extra.id}/options/${option.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        handleSucccessDeleteOption && handleSucccessDeleteOption(option.id)
        showToast(ToastType.Success, t('OPTION_DELETED', 'Option deleted'))
        props.onClose && props.onClose()
      }
    } catch (err) {
      setOptionState({ ...optionState, loading: false, error: err.message })
    }
  }

  /**
   * Method to duplicate option from API
   */
  const handleDuplicateOption = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ copy_options: 'metafields,suboptions' })
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras/${extra.id}/options/${option.id}/duplicate`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        let options
        if (parentExtraState.extra.options) options = [...parentExtraState.extra.options, content.result]
        else options = [{ ...content.result }]
        const updatedExtra = { ...parentExtraState.extra, options }
        setParentExtraState({ ...parentExtraState, extra: updatedExtra })
        handleSuccessUpdateBusiness(updatedExtra)
        showToast(ToastType.Success, t('OPTION_DUPLICATED', 'Option duplicated'))
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  /**
   * Method to duplicate sub option from API
   */
  const handleDuplicateSubOption = async (id) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ copy_options: 'metafields' })
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras/${extra.id}/options/${option.id}/suboptions/${id}/duplicate`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        const subOptions = [...optionState.option.suboptions, content.result]
        const updatedOption = { ...optionState.option, suboptions: subOptions }
        setOptionState({ ...optionState, option: updatedOption, loading: false })
        const options = extra.options.filter(option => {
          if (option.id === updatedOption.id) {
            Object.assign(option, updatedOption)
          }
          return true
        })
        const updatedExtra = { ...extra, options }
        setExtraState(updatedExtra)
        handleSuccessUpdateBusiness(updatedExtra)
        showToast(ToastType.Success, t('SUBOPTION_DUPLICATED', 'Suboption duplicated'))
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  /**
   * Method to change the conditional option
   * @param {Number} optionId
   */
  const handleChangeConditionalOption = (optionId) => {
    setConditionalOptionId(optionId)
    handleSetConditionalSubOptions(extraState, optionId)
  }

  /**
   * Method to change the conditional option
   * @param {Number} subOptionId
   */
  const handleChangeConditionalSubOption = (subOptionId) => {
    handleUpdateOption({ respect_to: subOptionId })
  }

  const handleChangeSettingsChangeState = (updatedChange) => {
    setSettingChangeState({
      ...settingChangeState,
      changes: {
        ...setChangesState.changes,
        ...updatedChange
      }
    })
  }

  /**
   * Method to handle sub option drag start
   */
  const handleDragStart = (event, subOption) => {
    event.dataTransfer.setData('transferSubOptionId', subOption.id)
    const ghostElement = document.createElement('div')
    ghostElement.classList.add('ghostDragging')
    ghostElement.innerHTML = subOption.name
    document.body.appendChild(ghostElement)
    event.dataTransfer.setDragImage(ghostElement, 0, 0)
    setIsSubOptionsBottom(false)
  }

  /**
   * Method to handle sub option drag over
   */
  const hanldeDragOver = (event, subOption, isLastSubOption) => {
    event.preventDefault()
    const element = event.target.closest('.draggable-suboption')
    if (element) {
      if (!isLastSubOption) {
        setDragoverSubOptionId(subOption.id)
      } else {
        const middlePositionY = window.scrollY + event.target.getBoundingClientRect().top + event.target.offsetHeight / 2
        const dragPositionY = event.clientY
        if (dragPositionY > middlePositionY) {
          setIsSubOptionsBottom(true)
          setDragoverSubOptionId(null)
        } else {
          setIsSubOptionsBottom(false)
          setDragoverSubOptionId(subOption.id)
        }
      }
    }
  }

  /**
   * Method to handle sub option drop
   */
  const handleDrop = (event, subOption) => {
    event.preventDefault()
    const transferSubOptionId = parseInt(event.dataTransfer.getData('transferSubOptionId'))
    if (subOption.id === transferSubOptionId) return
    let dropSubOptionRank
    if (isSubOptionsBottom) {
      dropSubOptionRank = subOption?.rank + 1
    } else {
      dropSubOptionRank = subOption?.rank
    }
    setIsSubOptionsBottom(false)
    handleUpdateSubOption({ id: transferSubOptionId, rank: dropSubOptionRank })
  }

  /**
   * Method to handle sub option drag end
   */
  const handleDragEnd = () => {
    const elements = document.getElementsByClassName('ghostDragging')
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0])
    }
    setDragoverSubOptionId(null)
  }

  useEffect(() => {
    if (conditionalOptionId) {
      handleSetConditionalOptions(extraState)
      handleSetConditionalSubOptions(extraState, conditionalOptionId)
      const selectedOption = extraState.options.find(item => item.id === option.id)
      handleSetDefaultCondition(selectedOption?.respect_to)
    }
  }, [extraState, conditionalOptionId])

  useEffect(() => {
    setOptionState({ ...optionState, option })
    handleSetConditionalOptions(extra)
    handleSetDefaultCondition(option?.respect_to)
  }, [option, extra])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          optionState={optionState}
          changesState={changesState}
          editSubOptionId={editSubOptionId}
          settingChangeState={settingChangeState}
          handleChangeInput={handleChangeInput}
          handleChangeSubOptionImage={handleChangeSubOptionImage}
          handleChangeSubOptionEnable={handleChangeSubOptionEnable}
          handleDeteteSubOption={handleDeteteSubOption}
          handleOptionSetting={handleOptionSetting}
          conditionalOptions={conditionalOptions}
          conditionalSubOptions={conditionalSubOptions}
          conditionalOptionId={conditionalOptionId}
          conditionalSubOptionId={conditionalSubOptionId}
          handleChangeSettingsChangeState={handleChangeSettingsChangeState}
          handleChangeConditionalOption={handleChangeConditionalOption}
          handleChangeConditionalSubOption={handleChangeConditionalSubOption}
          handleAddOption={handleAddOption}
          handleDeteteOption={handleDeteteOption}
          handleChangeDefaultSuboption={handleChangeDefaultSuboption}
          handleUpdateSubOption={handleUpdateSubOption}
          handleChangeItem={handleChangeItem}
          handleUpdateOption={handleUpdateOption}
          isAddForm={isAddForm}
          setIsAddForm={setIsAddForm}
          handleDuplicateOption={handleDuplicateOption}
          handleDuplicateSubOption={handleDuplicateSubOption}

          dragoverSubOptionId={dragoverSubOptionId}
          isSubOptionsBottom={isSubOptionsBottom}
          handleDragStart={handleDragStart}
          hanldeDragOver={hanldeDragOver}
          handleDrop={handleDrop}
          handleDragEnd={handleDragEnd}
        />
      )}
    </>
  )
}

ProductExtraOptionDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
