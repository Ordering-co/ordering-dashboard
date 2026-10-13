import React, { useState, useEffect } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to manage product extras behavior without UI component
 */
export const ProductExtras = (props) => {
  props = { ...defaultProps, ...props }
  const {
    business,
    UIComponent,
    product,
    handleSuccessUpdate,
    handleUpdateBusinessState,
    propsToFetch
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [productState, setProductState] = useState({ product, loading: false, error: null })
  const [extrasState, setExtrasState] = useState({ extras: business?.extras, loading: false, error: null })
  const [changesState, setChangesState] = useState({})
  const [isAddMode, setIsAddMode] = useState(false)
  const [dragoverExtaId, setdragOverExtaId] = useState(null)
  const [isExtrasBottom, setIsExtrasBottom] = useState(false)

  /**
   * Method to get business extras from API
   */
  const getBusinessExtras = async () => {
    try {
      setExtrasState({
        ...extrasState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras?mode=dashboard&params=${propsToFetch.toString()}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        if (handleUpdateBusinessState) {
          const updatedBusiness = { ...business, extras: result }
          handleUpdateBusinessState(updatedBusiness)
        }
      } else {
        setExtrasState({
          ...extrasState,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setExtrasState({
        ...extrasState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to save the new ingredient from API
   * @param {Array} extraIds
   */
  const handleProductExtraState = async (extraIds) => {
    try {
      const changes = {
        business_id: business?.id,
        category_id: product?.category_id,
        product_id: product?.id,
        extras: JSON.stringify(extraIds)
      }
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setProductState({ ...productState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/categories/${product?.category_id}/products/${product.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const extrasFromProductState = productState?.product?.extras?.filter(extra => extraIds.includes(extra.id))
        const extras = extrasState?.extras?.filter(extra => extraIds.includes(extra.id))
        const combinedExtras = extras?.map(extra => {
          const extraFromProduct = extrasFromProductState?.find(ep => ep.id === extra.id)
          if (extraFromProduct) {
            return {
              ...extraFromProduct,
              ...extra
            }
          }
          return extra
        })
        const updatedProduct = { ...productState.product, extras: combinedExtras }
        setProductState({
          ...productState,
          loading: false,
          product: updatedProduct
        })
        handleSuccessUpdate && handleSuccessUpdate(updatedProduct)
        // updateBusinessState(updatedProduct, business)
        showToast(ToastType.Success, t('EXTRA_SAVED', 'Extra saved'))
      }
    } catch (err) {
      setProductState({ ...productState, loading: false, error: err.message })
    }
  }

  /**
   * Method to save the new ingredient from API
   * @param {Number} extraId
   * @param {Object} params updated parameters
   */
  const handleUpdateExtraState = async (extraId, params) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setExtrasState({ ...extrasState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(params)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras/${extraId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const extras = extrasState.extras.filter(extra => {
          if (extra.id === content.result.id) {
            Object.assign(extra, content.result)
          }
          return true
        })
        setExtrasState({ ...extrasState, loading: false, extras })

        const productExtras = productState.product.extras.filter(extra => {
          if (extra.id === content.result.id) {
            Object.assign(extra, content.result)
          }
          return true
        })
        const updatedProduct = { ...product, extras: productExtras }
        setProductState({ ...productState, product: updatedProduct })

        handleSuccessUpdate && handleSuccessUpdate(updatedProduct)
        showToast(ToastType.Success, t('EXTRA_SAVED', 'Extra saved'))
      }
    } catch (err) {
      setProductState({ ...productState, loading: false, error: err.message })
    }
  }

  /**
   * Method to change the extra name
   * @param {EventTarget} e Related HTML event
   * @param {Number} extraId extra id to change
   */
  const handleChangeExtraInput = (e, extraId) => {
    const params = {
      name: e.target.value
    }
    handleUpdateExtraState(extraId, params)
  }

  /**
   * Method to delete the extra
   * @param {Number} extraId
   */
  const handleDeteteExtra = async (extraId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setExtrasState({ ...extrasState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras/${extraId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const extras = extrasState.extras.filter(extra => extra.id !== extraId)
        setExtrasState({ ...extrasState, loading: false, extras })
        const productExtras = productState.product.extras.filter(extra => extra.id !== extraId)
        const updatedProduct = { ...product, extras: productExtras }
        setProductState({ ...productState, product: updatedProduct })
        handleSuccessUpdate && handleSuccessUpdate(updatedProduct)
        showToast(ToastType.Success, t('EXTRA_DELETED', 'Extra deleted'))
      }
    } catch (err) {
      setProductState({ ...productState, loading: false, error: err.message })
    }
  }

  /**
   * Method to change the add extra input
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeAddExtraInput = (e) => {
    setChangesState({ name: e.target.value })
  }

  /**
   * Method to save the new ingredient from API
   */
  const handleAddExtra = async (payload) => {
    if (!payload && Object.keys(changesState).length === 0) {
      setIsAddMode(false)
      return
    }
    try {
      const changes = payload
        ? {
            business_id: business?.id,
            ...payload
          }
        : {
            business_id: business?.id,
            ...changesState
          }
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setExtrasState({ ...extrasState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setChangesState({})
        setIsAddMode(false)
        const extras = [...extrasState.extras, content.result]
        setExtrasState({ ...extrasState, loading: false, extras })
        if (handleUpdateBusinessState) {
          const updatedBusiness = { ...business, extras }
          handleUpdateBusinessState(updatedBusiness)
        }
        showToast(ToastType.Success, t('EXTRA_ADDED', 'Extra added'))
      }
    } catch (err) {
      setExtrasState({ ...extrasState, loading: false, error: err.message })
    }
  }

  /**
   * Method to handle extra drag start
   */
  const handleDragStart = (event, extra) => {
    event.dataTransfer.setData('transferExtraId', extra.id)
    const ghostElement = document.createElement('div')
    ghostElement.classList.add('ghostDragging')
    ghostElement.innerHTML = extra.name
    document.body.appendChild(ghostElement)
    event.dataTransfer.setDragImage(ghostElement, 0, 0)
    setIsExtrasBottom(false)
  }

  /**
   * Method to handle extra drag over
   */
  const hanldeDragOver = (event, extra, isLastExtra) => {
    event.preventDefault()
    const element = event.target.closest('.draggable-extra')
    if (element) {
      if (!isLastExtra) {
        setdragOverExtaId(extra.id)
      } else {
        const middlePositionY = window.scrollY + event.target.getBoundingClientRect().top + event.target.offsetHeight / 2
        const dragPositionY = event.clientY
        if (dragPositionY > middlePositionY) {
          setIsExtrasBottom(true)
          setdragOverExtaId(null)
        } else {
          setIsExtrasBottom(false)
          setdragOverExtaId(extra.id)
        }
      }
    }
  }

  /**
   * Method to handle extra drop
   */
  const handleDrop = (event, extra) => {
    event.preventDefault()
    const transferExtraId = parseInt(event.dataTransfer.getData('transferExtraId'))
    if (extra.id === transferExtraId) return
    let dropExtraRank
    if (isExtrasBottom) {
      dropExtraRank = extra?.rank + 1
    } else {
      dropExtraRank = extra?.rank
    }
    setIsExtrasBottom(false)
    handleChangeExtraRank(transferExtraId, { rank: dropExtraRank })
  }

  /**
   * Method to handle exrta drag end
   */
  const handleDragEnd = () => {
    const elements = document.getElementsByClassName('ghostDragging')
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0])
    }
    setdragOverExtaId(null)
  }

  /**
   * Method to change the rank of extra
   */
  const handleChangeExtraRank = async (transferExtraId, params) => {
    try {
      setExtrasState({ ...extrasState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(params)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/extras/${transferExtraId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const extras = extrasState.extras.filter(extra => {
          if (extra.id === content.result.id) {
            Object.assign(extra, content.result)
          }
          return true
        })
        setExtrasState({ ...extrasState, loading: false, extras })

        const productExtras = productState.product.extras.filter(extra => {
          if (extra.id === content.result.id) {
            Object.assign(extra, content.result)
          }
          return true
        })
        const updatedProduct = { ...product, extras: productExtras }
        setProductState({ ...productState, product: updatedProduct })

        handleSuccessUpdate && handleSuccessUpdate(updatedProduct)
        showToast(ToastType.Success, t('EXTRA_SAVED', 'Extra saved'))
      }
    } catch (err) {
      setProductState({ ...productState, loading: false, error: err.message })
    }
  }

  useEffect(() => {
    setProductState({ ...productState, product })
  }, [product])

  useEffect(() => {
    if (business?.extras) {
      setExtrasState({
        ...extrasState,
        loading: false,
        extras: business?.extras
      })
    } else {
      getBusinessExtras()
    }
  }, [business?.extras])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          changesState={changesState}
          isAddMode={isAddMode}
          productState={productState}
          extrasState={extrasState}
          handleChangeExtraInput={handleChangeExtraInput}
          handleDeteteExtra={handleDeteteExtra}
          handleOpenAddForm={() => setIsAddMode(true)}
          handleAddExtra={handleAddExtra}
          handleChangeAddExtraInput={handleChangeAddExtraInput}
          handleProductExtraState={handleProductExtraState}
          dragoverExtaId={dragoverExtaId}
          isExtrasBottom={isExtrasBottom}
          handleDragStart={handleDragStart}
          hanldeDragOver={hanldeDragOver}
          handleDrop={handleDrop}
          handleDragEnd={handleDragEnd}
          handleUpdateExtraState={handleUpdateExtraState}
          setExtrasState={setExtrasState}
        />
      )}
    </>
  )
}

ProductExtras.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of extra props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: ['id', 'extras', 'business_id', 'name', 'description', 'enabled', 'external_id', 'rank', 'metafields']
}
