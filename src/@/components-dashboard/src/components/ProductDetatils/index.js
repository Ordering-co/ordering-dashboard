import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useAssistantRecordChanges } from '../../contexts/AssistantContext'

/**
 * Component to manage product details edit form behavior without UI component
 */
export const ProductDetatils = (props) => {
  const {
    business,
    UIComponent,
    productId,
    categoryId,
    handleUpdateBusinessState,
    categoryState,
    handleUpdateCategoryState,
    getPageProducts
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [productState, setProductState] = useState({ loading: false, product: null, error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [productCart, setProductCart] = useState({ ingredients: {}, options: {} })

  // The assistant changed this product: show the values it read back
  useAssistantRecordChanges(({ entity, id, after }) => {
    if (entity !== 'Product' || !after || !id || id !== productState.product?.id) return
    setProductState(prev => ({ ...prev, product: { ...prev.product, ...after } }))
  })

  /**
   * Clean formState
   */
  const cleanFormState = (values) => setFormState({ ...formState, ...values })

  /**
   * Method to get the product from API
   */
  const getProduct = async () => {
    try {
      setProductState({
        ...productState,
        loading: true
      })
      const params = {
        version: 'v2'
      }
      const { content: { error, result } } = await ordering
        .businesses(business.id)
        .categories(categoryId)
        .products(productId)
        .parameters(params)
        .get()
      if (!error) {
        setProductState({
          loading: false,
          product: result,
          error: null
        })
      } else {
        setProductState({
          ...productState,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setProductState({
        ...productState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to update the product details from API
   */
  const handleUpdateClick = async (params, options = { refreshProducts: false }) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const changes = params ? { ...params } : { ...formState.changes }
      const originalChanges = params ? { ...params } : { ...formState.changes }
      const { content: { error, result } } = await ordering.businesses(business?.id).categories(productState?.product?.category_id).products(productState?.product?.id).save(changes, {
        accessToken: session.token,
        noStringify: ['allergens', 'dietary_tags']
      })
      setFormState({
        ...formState,
        changes: error ? formState.changes : {},
        result: {
          error,
          result
        },
        loading: false
      })

      if (!error) {
        if (options.refreshProducts) {
          await getPageProducts?.(true)
          setProductState({
            ...productState,
            product: {
              ...productState?.product,
              ...result
            }
          })
          showToast(ToastType.Success, t('PRODUCT_SAVED', 'Product saved'))
          return
        }
        if ((typeof originalChanges?.ribbon?.enabled) !== 'undefined' && !originalChanges?.ribbon?.enabled && result?.ribbon?.enabled) {
          const updatedChanges = { ribbon: { enabled: false } }
          const { content } = await ordering.businesses(business?.id).categories(productState?.product?.category_id).products(productState?.product?.id).save(updatedChanges, {
            accessToken: session.token
          })
          handleSuccessUpdate(content?.result)
        } else {
          handleSuccessUpdate(result)
        }
        showToast(ToastType.Success, t('PRODUCT_SAVED', 'Product saved'))
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

  /**
 * Method to edit a product
 */
  const handleDeleteProduct = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true
      })
      const { content: { error, result } } = await ordering.businesses(parseInt(business?.id)).categories(parseInt(productState.product?.category_id)).products(productState.product?.id).delete()
      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: false,
            result
          }
        })
        if (handleUpdateCategoryState) {
          const updatedProducts = categoryState?.products?.filter(item => item.id !== productState.product.id)
          handleUpdateCategoryState({ ...categoryState, products: updatedProducts })
        }
        if (handleUpdateBusinessState) {
          const _categories = [...business?.categories]
          _categories.forEach(function iterate (category) {
            if (category.id === productState.product?.category_id) {
              if (!category.products) {
                const updatedProducts = categoryState?.products?.filter(item => item.id !== productState.product.id)
                category.products = updatedProducts
              } else {
                const _products = category.products.filter(_product => _product.id !== productState.product.id)
                category.products = [..._products]
              }
            }
            Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
          })
          const updatedBusiness = { ...business, categories: _categories }
          handleUpdateBusinessState(updatedBusiness)
        }
        showToast(ToastType.Success, t('PRODUCT_DELETED', 'Product deleted'))
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: true,
            result
          }
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        result: {
          error: true,
          result: err
        }
      })
    }
  }

  /**
   * Method to change the product enabled state
   */
  const handleChangeProductActiveState = () => {
    const params = { enabled: !productState?.product?.enabled }
    handleUpdateClick(params)
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [e.target.name]: e.target.value
      }
    })
  }

  /**
   * Update credential data
   * @param {Object} changes Related HTML event
   */
  const handleChangeFormState = (changes) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        ...changes
      }
    })
  }

  /**
   * Update ribbon data
   * @param {Object} changes Related HTML event
   */
  const handleChangeRibbon = (changes) => {
    const ribbonChanges = formState?.changes?.ribbon
      ? { ...formState?.changes?.ribbon, ...changes }
      : { ...changes }
    const currentChanges = { ...formState?.changes, ribbon: ribbonChanges }
    setFormState({
      ...formState,
      changes: currentChanges
    })
  }

  /**
   * Update business photo data
   * @param {File} file Image to change business photo
   */
  const handlechangeImage = (file, isSeo) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          [isSeo ? 'seo_image' : 'images']: reader.result
        }
      })
    }
  }

  /**
   * Init product cart status
   * @param {object} product Product to init product cart status
   */
  const initProductCart = (product) => {
    const ingredients = {}
    for (const key in product.ingredients) {
      const ingredient = product.ingredients[key]
      ingredients[`id:${ingredient.id}`] = {
        selected: true
      }
    }
    const newProductCart = {
      ...props.productCart,
      id: product.id,
      price: product.price,
      name: product.name,
      businessId: props.businessId,
      categoryId: product.category_id,
      inventoried: product.inventoried,
      stock: product.quantity,
      ingredients: props.productCart?.ingredients || ingredients,
      options: props.productCart?.options || {},
      comment: props.productCart?.comment || null,
      quantity: props.productCart?.quantity || 1
    }
    newProductCart.unitTotal = getUnitTotal(newProductCart)
    newProductCart.total = newProductCart.unitTotal * newProductCart.quantity
    setProductCart(newProductCart)
  }

  /**
   * Get unit total for product cart
   * @param {object} productCart Current product status
   */
  const getUnitTotal = (productCart) => {
    let subtotal = 0
    for (let i = 0; i < props.product?.extras?.length; i++) {
      const extra = props.product?.extras[i]
      for (let j = 0; j < extra.options?.length; j++) {
        const option = extra.options[j]
        for (let k = 0; k < option.suboptions?.length; k++) {
          const suboption = option.suboptions[k]
          if (productCart.options[`id:${option.id}`]?.suboptions[`id:${suboption.id}`]?.selected) {
            const suboptionState = productCart.options[`id:${option.id}`].suboptions[`id:${suboption.id}`]
            const quantity = option.allow_suboption_quantity ? suboptionState.quantity : 1
            const price = option.with_half_option && suboption.half_price && suboptionState.position !== 'whole' ? suboption.half_price : suboption.price
            subtotal += price * quantity
          }
        }
      }
    }
    return props.product?.price + subtotal
  }

  /**
   * Check if option must show
   * @param {object} option Option to check
   */
  const showProductOption = (option) => {
    let showOption = true
    if (option.respect_to) {
      showOption = false
      if (productCart.options) {
        const options = productCart.options
        for (const key in options) {
          const _option = options[key]
          if (_option.suboptions[`id:${option.respect_to}`]?.selected) {
            showOption = true
            break
          }
        }
      }
    }
    return showOption
  }

  /**
   * Function to update the product state
   */
  const handleSuccessUpdate = (updatedProduct) => {
    setProductState({
      ...productState,
      product: {
        ...productState?.product,
        ...updatedProduct
      }
    })

    if (handleUpdateBusinessState) {
      const _categories = [...business?.categories]
      _categories.forEach(function iterate (category) {
        if (category.id === productState?.product?.category_id) {
          if (!category.products) {
            const updatedProducts = categoryState?.products?.map(item => {
              if (item?.id === productState?.product?.id) {
                return {
                  ...item,
                  ...updatedProduct
                }
              }
              return item
            })
            category.products = updatedProducts
          } else {
            const _products = category?.products?.map(_product => {
              if (_product.id === productState?.product?.id) {
                return {
                  ..._product,
                  ...updatedProduct
                }
              }
              return _product
            })
            category.products = [..._products]
          }
        }
        Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
      })
      const updatedBusiness = { ...business, categories: _categories }
      handleUpdateBusinessState(updatedBusiness)
    }

    if (handleUpdateCategoryState) {
      const updatedProducts = categoryState?.products?.map(item => {
        if (item?.id === productState?.product?.id) {
          return {
            ...productState.product,
            ...updatedProduct
          }
        }
        return item
      })
      handleUpdateCategoryState({ ...categoryState, products: updatedProducts })
    }
  }

  /**
   * Method to duplicate product from API
   */
  const handleDuplicateProduct = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({ copy_options: 'ingredients,gallery,tags,extras,metafields' })
      }
      const response = await fetch(`${ordering.root}/business/${business?.id}/categories/${categoryId}/products/${productId}/duplicate`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        if (handleUpdateCategoryState) {
          handleUpdateCategoryState({ ...categoryState, products: [...categoryState?.products, content.result] })
        }
        showToast(ToastType.Success, t('PRODUCT_DUPLICATED', 'Product duplicated'))
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  useEffect(() => {
    if (props?.product && props?.product?.extras) {
      setProductState({ ...productState, product: props.product })
      initProductCart(props.product)
    } else {
      if (productId && categoryId) {
        getProduct()
      }
    }
  }, [props.product])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          productState={productState}
          productCart={productCart}
          formState={formState}
          cleanFormState={cleanFormState}
          handleChangeRibbon={handleChangeRibbon}
          handleChangeProductActiveState={handleChangeProductActiveState}
          handleChangeInput={handleChangeInput}
          handlechangeImage={handlechangeImage}
          handleUpdateClick={handleUpdateClick}
          handleDeleteProduct={handleDeleteProduct}
          showProductOption={showProductOption}
          handleChangeFormState={handleChangeFormState}
          handleSuccessUpdate={handleSuccessUpdate}
          handleDuplicateProduct={handleDuplicateProduct}
          getProduct={getProduct}
        />
      )}
    </>
  )
}

ProductDetatils.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
