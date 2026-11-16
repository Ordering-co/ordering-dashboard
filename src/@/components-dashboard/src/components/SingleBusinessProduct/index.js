import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

/**
 * Component to manage Checkout page behavior without UI component
 */
export const SingleBusinessProduct = (props) => {
  const {
    UIComponent,
    business,
    category,
    product,
    handleUpdateBusinessState,
    businessState,
    setDataSelected,
    handleUpdateCategoryState
  } = props

  const [{ loading }] = useSession()
  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [isEditMode, setIsEditMode] = useState(false)

  const [isProductsBottom, setIsProductsBottom] = useState(false)

  // redesign SP-F3 (C): the categoryState the page holds NOW. A save ends after an await, and the closure that started it holds the
  // categoryState of that render: another row may have saved meanwhile, and building the next state from the old one would undo it.
  const categoryRef = useRef(category)
  categoryRef.current = category

  /**
   * Set enabled property of a product
   * @param {Boolean} isChecked
   * @returns {Promise<{ok: boolean, error?: *, result?: *}>} redesign SP-F3 (C): the outcome, so the row can say why it failed
   */
  const handleChangeProductActive = (isChecked) => {
    const params = { enabled: isChecked }
    return editProduct(params)
  }

  /**
   * Set properties of a product
   * @param {EventTarget} evt Related Html element
   */
  const handleChangeInput = (evt) => {
    setFormState({
      ...formState,
      changes: { ...formState.changes, [evt.target.name]: evt.target.value }
    })
    setIsEditMode(true)
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
    setIsEditMode(true)
  }

  /**
   * J2 row 12 (stores-products P-10, D-56 d): the thumbnail of the row is saved when the file is chosen, as the store editor does, and
   * not with the next click outside the row. Only `images` is sent; a refusal puts the stored image back (editProduct).
   * @param {File} file
   * @returns {Promise<{ok: boolean, error?: *, result?: *}>}
   */
  const handleSaveImage = (file) => new Promise(resolve => {
    const reader = new window.FileReader()
    reader.onload = async () => {
      setFormState(prev => ({ ...prev, changes: { ...prev.changes, images: reader.result } }))
      resolve(await editProduct({ images: reader.result }))
    }
    reader.onerror = () => resolve({ ok: false })
    reader.readAsDataURL(file)
  })

  /**
   * Set name property of a product
   * @param {String} value
   */
  const handleUpdateClick = () => {
    const params = {
      images: formState?.changes?.images,
      name: formState?.changes?.name,
      description: formState?.changes?.description,
      price: formState?.changes?.price,
      fee_fixed: formState?.changes?.fee_fixed,
      fee_percentage: formState?.changes?.fee_percentage
    }
    for (const key in params) {
      if (params[key] === null) {
        delete params[key]
      }
    }
    return editProduct(params)
  }

  /**
   * Method to edit a product
   * redesign SP-F3 (C): it returns `{ ok, error, result }` (the callers that ignore the value keep working), and a successful save
   * also updates `categoryState`, which is what the row, the editor header and the card draw. A refused save puts the thumbnail
   * back to the stored one (otherwise every later click outside asked to save it again).
   */
  const editProduct = async (params) => {
    if (loading) return { ok: false }
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true
      })
      const { content: { error, result } } = await ordering.businesses(parseInt(business?.id)).categories(parseInt(product?.category_id)).products(product?.id).save(params)
      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: false,
            result
          }
        })
        if (handleUpdateBusinessState) {
          const _categories = [...business?.categories]
          _categories.forEach(function iterate (category) {
            if (category.id === product?.category_id && category.products) {
              const _products = category.products.map(_product => {
                if (_product.id === product.id) {
                  return {
                    ..._product,
                    ...params
                  }
                }
                return _product
              })
              category.products = [..._products]
            }
            Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
          })
          handleUpdateBusinessState({ ...business, categories: _categories })
        }
        const currentCategory = categoryRef.current
        if (handleUpdateCategoryState && Array.isArray(currentCategory?.products)) {
          // what was sent (without the fields that were not) and then what the API answered, which wins (the stored URL of an image)
          const sent = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined))
          handleUpdateCategoryState({
            ...currentCategory,
            products: currentCategory.products.map(_product => (
              _product.id === product?.id
                ? { ..._product, ...sent, ...(result && typeof result === 'object' && !Array.isArray(result) ? result : {}) }
                : _product
            ))
          })
        }
        showToast(ToastType.Success, t('PRODUCT_UPDATED', 'Product updated'))
        setIsEditMode(false)
        return { ok: true, result }
      } else {
        setFormState({
          ...formState,
          loading: false,
          changes: { ...product },
          result: {
            error: true,
            result
          }
        })
        setIsEditMode(false)
        return { ok: false, error: result }
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        changes: { ...product },
        result: {
          error: true,
          result: err
        }
      })
      setIsEditMode(false)
      return { ok: false, error: err }
    }
  }

  /**
 * Method to edit a product
 */
  const deleteProduct = async () => {
    if (loading) return
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true
      })
      const { content: { error, result } } = await ordering.businesses(parseInt(business?.id)).categories(parseInt(product?.category_id)).products(product?.id).delete()
      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: false,
            result
          }
        })
        if (handleUpdateBusinessState) {
          const _categories = [...business?.categories]
          _categories.forEach(function iterate (category) {
            if (category.id === product?.category_id && category.products) {
              const _products = category.products.filter(_product => _product.id !== product.id)
              category.products = [..._products]
            }
            Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
          })
          handleUpdateBusinessState({ ...business, categories: _categories })
        }
        showToast(ToastType.Success, t('PRODUCT_DELETED', 'Product deleted'))
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
 * Method to handle drag start
 */
  const handleDragStart = (event, product) => {
    event.dataTransfer.setData('transferProduct', JSON.stringify(product))
    const ghostEle = document.createElement('div')
    ghostEle.classList.add('ghostDragging')
    ghostEle.textContent = product?.name
    document.body.appendChild(ghostEle)
    event.dataTransfer.setDragImage(ghostEle, 0, 0)
    setIsProductsBottom(false)
  }

  /**
   * Method to handle drag over
   */
  const handleDragOver = (event, isLastProduct) => {
    event.preventDefault()
    const element = event.target.closest('.draggable-product')
    if (element) {
      if (!isLastProduct) {
        setDataSelected(element.dataset.index)
      } else {
        const middlePositionY = window.scrollY + event.target.getBoundingClientRect().top + event.target.offsetHeight / 2
        const dragPositionY = event.clientY
        if (dragPositionY > middlePositionY) {
          setIsProductsBottom(true)
          setDataSelected('')
        } else {
          setIsProductsBottom(false)
          setDataSelected(element.dataset.index)
        }
      }
    }
  }

  /**
   * Method to handle drag drop
   */
  const handleDrop = (event) => {
    event.preventDefault()
    let transferProduct
    try {
      transferProduct = JSON.parse(event.dataTransfer.getData('transferProduct'))
    } catch (err) {
      return // redesign SP-F3 (C): what was dragged is not a product (a file, some text): nothing to move
    }
    let dropProductRank
    if (isProductsBottom) {
      const rankedProducts = category.products.sort((a, b) => a.rank - b.rank)
      const productsLength = rankedProducts.length
      const index = rankedProducts.findIndex(_product => _product.id === product.id)

      if (index === productsLength - 1) {
        dropProductRank = rankedProducts[index].rank + 1
      } else {
        dropProductRank = rankedProducts[index + 1].rank
      }
    } else {
      dropProductRank = product?.rank
    }
    setIsProductsBottom(false)
    return handleChangeProductRank(transferProduct, { rank: dropProductRank })
  }

  /**
   * Method to change the rank of transfer category
   */
  const handleChangeProductRank = async (transferProduct, params, swap) => {
    if (loading) return { ok: false }
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const { content: { error, result } } = await ordering.businesses(parseInt(business?.id)).categories(parseInt(transferProduct?.category_id)).products(transferProduct?.id).save(params)
      if (!error) {
        if (handleUpdateBusinessState) {
          const _categories = [...business?.categories]
          _categories.forEach(function iterate (category) {
            if (category.id === product?.category_id && category.products) {
              const _products = category.products.map(_product => {
                if (_product.id === transferProduct?.id) {
                  return {
                    ..._product,
                    rank: result?.rank
                  }
                }
                // J2 row 9: a move is a swap; the neighbour takes the old rank of the moved product (the API renumbers it so)
                if (swap && _product.id === swap.id) return { ..._product, rank: swap.rank }
                return _product
              })
              category.products = [..._products]
            }
            Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
          })
          handleUpdateBusinessState({ ...business, categories: _categories })
        }
        if (handleUpdateCategoryState) {
          const updateProducts = category?.products.map(item => {
            if (item.id === result.id) {
              return {
                ...item,
                ...result
              }
            }
            if (swap && item.id === swap.id) return { ...item, rank: swap.rank }
            return item
          })
          handleUpdateCategoryState({ ...category, products: updateProducts })
        }
        showToast(ToastType.Success, t('PRODUCT_UPDATED', 'Product updated'))
        return { ok: true, result }
      } else {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: true,
            result
          }
        })
        return { ok: false, error: result }
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        result: {
          error: true,
          result: [err.message]
        }
      })
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Move this product one place without the mouse (redesign J2, , row 9, D-43 (a)): «Move up» / «Move down» of the ⋯ menu.
   * It is the request, the toasts and the state updates of the drag: `rank` is the rank of the previous (up) or the next (down)
   * sibling, which the row works out with the reorder piece of Shared/Product.
   * @param {number} rank
   * @returns {Promise<{ok: boolean, error?: *, result?: *}>} the outcome, so the row can say why a move failed
   */
  const handleMoveProduct = (rank) => {
    // the neighbour whose place it takes gets its old rank in the same update: with the two ranks equal the list would not move
    const neighbour = (category?.products || []).find(item => item.id !== product?.id && Number(item.rank) === Number(rank))
    return handleChangeProductRank(product, { rank }, neighbour ? { id: neighbour.id, rank: product?.rank } : undefined)
  }

  /**
   * Method to handle drag end
   */
  const handleDragEnd = () => {
    const elements = document.getElementsByClassName('ghostDragging')
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0])
    }
    setDataSelected('')
  }

  useEffect(() => {
    if (product) {
      setFormState({
        ...formState,
        changes: { ...product }
      })
    }
  }, [product, businessState])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          handleChangeProductActive={handleChangeProductActive}
          handleUpdateClick={handleUpdateClick}
          deleteProduct={deleteProduct}
          productFormState={formState}
          handleChangeInput={handleChangeInput}
          handlechangeImage={handlechangeImage}
          isEditMode={isEditMode}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleDragEnd={handleDragEnd}
          handleMoveProduct={handleMoveProduct}
          handleSaveImage={handleSaveImage}
          isProductsBottom={isProductsBottom}
        />
      )}
    </>
  )
}

SingleBusinessProduct.propTypes = {
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
   * Object for a product
   */
  product: PropTypes.object
}
