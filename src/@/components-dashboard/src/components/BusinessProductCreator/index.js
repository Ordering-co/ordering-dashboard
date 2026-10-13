import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { stringToSlug } from '../../utils'

/**
 * Component to manage CreateBusinessProduct behavior without UI component
 */
export const BusinessProductCreator = (props) => {
  const {
    UIComponent,
    business,
    handleUpdateBusinessState,
    setIsAddProduct,
    categorySelected,
    handleParentProductAdd,
    handleUpdateCategoryState,
    categoryState
  } = props

  const [{ loading }] = useSession()
  const [ordering] = useApi()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [formState, setFormState] = useState({ loading: false, changes: { enabled: true }, result: { error: false } })

  /**
  * Update credential data
  * @param {EventTarget} e Related HTML event
  */
  const handleChangeInput = (e) => {
    const currentChanges = { [e.target.name]: e.target.value }

    setFormState({
      ...formState,
      changes: { ...formState.changes, ...currentChanges }
    })
  }

  /**
  * Update credential data
  */
  const handleChangeItem = (changes) => {
    const currentChanges = { ...formState.changes, ...changes }

    setFormState({
      ...formState,
      changes: currentChanges
    })
  }

  /**
* Update credential data
* @param {Boolean} isChecked checkbox status
*/
  const handleChangeCheckBox = (isChecked) => {
    const currentChanges = { enabled: isChecked }

    setFormState({
      ...formState,
      changes: { ...formState.changes, ...currentChanges }
    })
  }

  /**
 * Update business photo data
 * @param {File} file Image to change business photo
 */
  const handlechangeImage = (file) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          images: reader.result
        }
      })
    }
  }

  /**
  * Function to create Business product
  */
  const handleUpdateClick = async () => {
    if (loading) return
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      let categoryId
      if (categorySelected?.id === null && categorySelected?.id === 'featured') {
        categoryId = parseInt(business?.categories[0])
      } else {
        categoryId = parseInt(categorySelected?.id)
      }
      setFormState({
        ...formState,
        loading: true
      })
      const payload = {
        ...formState.changes,
        slug: stringToSlug(formState.changes?.name || '')
      }
      const { content } = await ordering.businesses(parseInt(business?.id)).categories(categoryId).products().save(payload, {
        noStringify: ['allergens', 'dietary_tags']
      })
      if (!content.error) {
        setFormState({
          ...formState,
          changes: {},
          result: {
            error: false,
            result: content.result
          },
          loading: false
        })
        if (handleUpdateBusinessState) {
          const _categories = [...business?.categories]
          _categories.forEach(function iterate (category) {
            if ((category?.id === categoryId) && category?.products) {
              category.products.push(content.result)
            }
            Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
          })
          handleUpdateBusinessState({ ...business, categories: _categories })
        }
        if (handleUpdateCategoryState) {
          handleUpdateCategoryState({ ...categoryState, products: [...categoryState?.products, content.result] })
        }
        setIsAddProduct(false)
        handleParentProductAdd && handleParentProductAdd(false)
        showToast(ToastType.Success, t('PRODUCT_ADD', 'Product added'))
      } else {
        setFormState({
          ...formState,
          changes: formState.changes,
          result: content,
          loading: false
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          setFormState={setFormState}
          handlechangeImage={handlechangeImage}
          handleChangeInput={handleChangeInput}
          handleUpdateClick={handleUpdateClick}
          handleChangeCheckBox={handleChangeCheckBox}
          handleChangeItem={handleChangeItem}
        />
      )}
    </>
  )
}

BusinessProductCreator.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Object for a business
   */
  business: PropTypes.object,
  /**
   * Function to set a business state
   */
  handleUpdateBusinessState: PropTypes.func,
  /**
   * Function to set product creation mode
   */
  setIsAddProduct: PropTypes.func
}
