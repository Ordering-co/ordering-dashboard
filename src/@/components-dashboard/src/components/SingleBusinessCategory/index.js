import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { translateApiMessage } from '../../utils/translateApiMessage'

// bugs E D11: the first text the API (or an exception) gives, to say why a re-order failed.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

/**
 * Component to manage Checkout page behavior without UI component
 */
export const SingleBusinessCategory = (props) => {
  const {
    UIComponent,
    handleUpdateBusinessState,
    business,
    category,
    categorySelected,
    setCategorySelected,
    setDataSelected
  } = props

  const [{ loading }] = useSession()
  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [formState, setFormState] = useState({ changes: {}, loading: false, result: { error: false } })
  const [isEditMode, setIsEditMode] = useState(false)
  const [isCategoriesBottom, setIsCategoriesBottom] = useState(false)

  // redesign SP-F2: returns what editCategory returns ({ ok, error }) so a caller that wants it (the switch of the
  // catalog tree) can go back to the stored value and say why; the other callers ignore it.
  const handelChangeCategoryActive = (isChecked) => {
    const params = { enabled: isChecked }
    return editCategory(params)
  }

  const handleUpdateClick = () => {
    const params = {
      name: formState?.changes?.name,
      image: formState?.changes?.image
    }
    for (const key in params) {
      if (params[key] === null) {
        delete params[key]
      }
    }
    return editCategory(params)
  }

  /**
 * Update category photo data
 * @param {File} file Image to change category photo
 */
  const handlechangeImage = (file) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          image: reader.result
        }
      })
    }
    setIsEditMode(true)
  }

  /**
   * Set properties of a category
   * @param {EventTarget} evt Related Html element
   */
  const handleInputChange = (evt) => {
    setFormState({
      ...formState,
      changes: { ...formState.changes, [evt.target.name]: evt.target.value }
    })
    setIsEditMode(true)
  }

  /**
   * Method to handle drag start
   */
  const handleDragStart = (event) => {
    event.dataTransfer.setData('transferCategoryId', category?.id)
    const ghostEle = document.createElement('div')
    ghostEle.classList.add('ghostDragging')
    ghostEle.textContent = category.name
    document.body.appendChild(ghostEle)
    event.dataTransfer.setDragImage(ghostEle, 0, 0)
    setIsCategoriesBottom(false)
  }

  /**
   * Method to handle drag over
   */
  const handleDragOver = (event, isLastCategory) => {
    event.preventDefault()
    const element = event.target.closest('.draggable-category')
    if (element) {
      if (!isLastCategory) {
        setDataSelected(element.dataset.index)
      } else {
        const middlePositionY = window.scrollY + event.target.getBoundingClientRect().top + event.target.offsetHeight / 2
        const dragPositionY = event.clientY
        if (dragPositionY > middlePositionY) {
          setIsCategoriesBottom(true)
          setDataSelected('')
        } else {
          setIsCategoriesBottom(false)
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
    const transferCategoryId = parseInt(event.dataTransfer.getData('transferCategoryId'))
    let dropCategoryRank
    if (isCategoriesBottom) {
      dropCategoryRank = category?.rank + 1
    } else {
      dropCategoryRank = category?.rank
    }
    setIsCategoriesBottom(false)
    handleChangeCategoryRank(transferCategoryId, { rank: dropCategoryRank })
  }

  /**
   * Method to change the rank of transfer category
   */
  const handleChangeCategoryRank = async (transferCategoryId, params, swap) => {
    if (loading) return
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const { content } = await ordering.businesses(parseInt(business?.id)).categories(transferCategoryId).save(params)
      if (!content.error) {
        const _categories = [...business?.categories]
        _categories.forEach(function iterate (category) {
          if (category.id === transferCategoryId) {
            category.rank = content.result.rank
          } else if (swap && category.id === swap.id) {
            // J2 row 9: a move is a swap; the neighbour takes the old rank of the moved category (the API renumbers it so)
            category.rank = swap.rank
          }
          Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
        })
        handleUpdateBusinessState({ ...business, categories: _categories })
        showToast(ToastType.Success, t('CATEOGORY_UPDATED', 'Category updated'))
      } else {
        // bugs E D11: an API error used to leave the «Loading» toast and nothing else; the ranks are not touched
        // (they only change on success) and the toast says why, like the save of the store details.
        showRankError(content.result)
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
      // bugs E D11: same for an exception; the order stays as it was.
      showRankError() // review (bugs E): an exception's text is not for the user, the generic text
    }
  }

  /**
   * Move this category one place without the mouse (redesign J2, , row 9, D-43 (a)): «Move up» / «Move down» of the ⋯ menu.
   * It is the request, the toasts and the state updates of the drag: `rank` is the rank of the previous (up) or the next (down)
   * sibling, which the row works out with the reorder piece of Shared/Product.
   * @param {number} rank
   * @returns {Promise<void>} resolves when the move has ended (and the tree has its new ranks), so the row can put the focus back
   */
  const handleMoveCategory = (rank) => {
    // the sibling (the list that holds this category) whose place it takes gets its old rank in the same update, so the tree is
    // drawn in the new order
    const siblingsOf = (list) => {
      if (!Array.isArray(list)) return null
      if (list.some(item => item?.id === category?.id)) return list
      for (const item of list) {
        const found = siblingsOf(item?.subcategories)
        if (found) return found
      }
      return null
    }
    const neighbour = (siblingsOf(business?.categories) || []).find(item => item?.id !== category?.id && Number(item?.rank) === Number(rank))
    return handleChangeCategoryRank(category?.id, { rank }, neighbour ? { id: neighbour.id, rank: category?.rank } : undefined)
  }

  const showRankError = (error) => {
    showToast(ToastType.Error, translateApiMessage(t, firstMessage(error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
  }

  /**
   * Method to handle drag end
   */
  const handleDragEnd = () => {
    setDataSelected('')
    const elements = document.getElementsByClassName('ghostDragging')
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0])
    }
  }

  /**
   * Method to edit a category
   */
  // redesign SP-F2: resolves `{ ok: true, result }` or `{ ok: false, error }`; `formState.result` is left as before.
  const editCategory = async (params) => {
    if (loading) return { ok: false }
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true
      })
      const { content: { error, result } } = await ordering.businesses(parseInt(business?.id)).categories(parseInt(category.id)).save(params)
      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: false,
            result
          }
        })
        setIsEditMode(false)
        if (handleUpdateBusinessState) {
          const _categories = [...business.categories]
          _categories.forEach(function iterate (category) {
            if (category.id === result.id) {
              category.name = result?.name
              category.enabled = result?.enabled
              category.image = result?.image
            }
            Array.isArray(category?.subcategories) && category.subcategories.forEach(iterate)
          })
          handleUpdateBusinessState({ ...business, categories: _categories })
        }
        showToast(ToastType.Success, t('CATEOGORY_UPDATED', 'Category updated'))
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
          result: err
        }
      })
      return { ok: false, error: err }
    }
  }

  /**
 * Method to edit a category
 */
  const deleteCategory = async () => {
    if (loading) return
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true
      })
      const { content: { error, result } } = await ordering.businesses(parseInt(business?.id)).categories(parseInt(category.id)).delete()
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
          const _categories = [...business.categories]
          _categories.forEach(function iterate (_category, index, object) {
            if (_category.id === category.id) {
              object.splice(index, 1)
            }
            Array.isArray(_category?.subcategories) && _category.subcategories.forEach(iterate)
          })

          handleUpdateBusinessState({ ...business, categories: _categories })
          if (category.id === categorySelected.id) setCategorySelected(_categories[0])
        }
        showToast(ToastType.Success, t('CATEOGORY_DELETED', 'Category deleted'))
        props.onClose && props.onClose(category.id)
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

  useEffect(() => {
    if (category) {
      setFormState({
        ...formState,
        changes: { ...category }
      })
    } else {
      setFormState({ ...formState, changes: {} })
    }
  }, [category])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          handelChangeCategoryActive={handelChangeCategoryActive}
          categoryFormState={formState}
          isCategoriesBottom={isCategoriesBottom}
          handlechangeImage={handlechangeImage}
          handleUpdateClick={handleUpdateClick}
          deleteCategory={deleteCategory}
          handleInputChange={handleInputChange}
          isEditMode={isEditMode}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleDragEnd={handleDragEnd}
          handleMoveCategory={handleMoveCategory}
        />
      )}
    </>
  )
}

SingleBusinessCategory.propTypes = {
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
  category: PropTypes.object
}
