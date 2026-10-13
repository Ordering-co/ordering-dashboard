import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to manage product ingredient behavior without UI component
 */
export const ProductIngredient = (props) => {
  const {
    business,
    product,
    ingredient,
    UIComponent,
    handleSuccessUpdate,
    onChange
  } = props

  /**
   * Set current state
   */
  const state = { id: ingredient?.id, name: ingredient?.name, selected: props?.state?.selected }

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [ingredientState, setIngredientState] = useState({ ingredient, loading: false, error: null })
  const [changesState, setChangesState] = useState({})
  const [isAddMode, setIsAddMode] = useState(false)

  /**
   * Method to change the ingredient name
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    setChangesState({
      ...changesState,
      [e.target.name]: e.target.value
    })
  }

  /**
   * Method to save the new ingredient from API
   */
  const handleAddIngredient = async () => {
    try {
      let changes = {
        business_id: business?.id,
        category_id: product?.category_id,
        product_id: product?.id
      }
      changes = { ...changes, ...changesState }
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setIngredientState({ ...ingredientState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/categories/${product?.category_id}/products/${product.id}/ingredients`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setChangesState({})
        setIngredientState({
          ...ingredientState,
          loading: false,
          ingredient: content.result
        })
        let ingredients
        if (product.ingredients) {
          ingredients = [...product.ingredients, content.result]
        } else {
          ingredients = [content.result]
        }
        const updatedProduct = { ...product, ingredients }
        handleSuccessUpdate && handleSuccessUpdate(updatedProduct)
        showToast(ToastType.Success, t('INGREDIENT_SAVED', 'Ingredient saved'))
        props.onClose && props.onClose()
      }
    } catch (err) {
      setIngredientState({ ...ingredientState, loading: false, error: err.message })
    }
  }

  /**
   * Method to save the new ingredient from API
   */
  const handleUpdateIngredient = async () => {
    try {
      let changes = {
        business_id: business?.id,
        category_id: product?.category_id,
        product_id: product?.id
      }

      changes = { ...changes, ...changesState }
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setIngredientState({ ...ingredientState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/categories/${product?.category_id}/products/${product.id}/ingredients/${ingredient.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setChangesState({})
        setIngredientState({
          ...ingredientState,
          loading: false,
          ingredient: content.result
        })
        const ingredients = product.ingredients.filter(_ingredient => {
          if (_ingredient.id === ingredient.id) {
            Object.assign(_ingredient, content.result)
          }
          return true
        })
        const updatedProduct = { ...product, ingredients }
        handleSuccessUpdate && handleSuccessUpdate(updatedProduct)
        showToast(ToastType.Success, t('INGREDIENT_SAVED', 'Ingredient saved'))
      }
    } catch (err) {
      setIngredientState({ ...ingredientState, loading: false, error: err.message })
    }
  }

  /**
   * Method to delete the product ingredient
   */
  const handleDeleteIngredient = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setIngredientState({ ...ingredientState, loading: false })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/categories/${product?.category_id}/products/${product.id}/ingredients/${ingredient.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setIngredientState({
          ...ingredientState,
          loading: false,
          ingredient: content.result
        })
        const ingredients = product.ingredients.filter(_ingredient => _ingredient.id !== ingredient.id)
        const updatedProduct = { ...product, ingredients }
        handleSuccessUpdate && handleSuccessUpdate(updatedProduct)
        showToast(ToastType.Success, t('INGREDIENT_DELETED', 'Ingredient deleted'))
        props.onClose && props.onClose()
      }
    } catch (err) {
      setIngredientState({ ...ingredientState, loading: false, error: err.message })
    }
  }

  /**
   * Run onChange function with new state
   * @param {object} newState State with changes
   */
  const changeState = (newState) => {
    onChange && onChange(newState, ingredient)
  }

  /**
     * Select/unselect the suboption
     */
  const toggleSelect = () => {
    changeState({ selected: !state.selected })
  }

  useEffect(() => {
    setChangesState({})
    setIngredientState({
      ...ingredientState,
      ingredient
    })
    if (ingredient) {
      setIsAddMode(false)
    } else {
      setIsAddMode(true)
    }
  }, [ingredient])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          ingredientState={ingredientState}
          changesState={changesState}
          isAddMode={isAddMode}
          handleChangeInput={handleChangeInput}
          handleDeleteIngredient={handleDeleteIngredient}
          handleAddIngredient={handleAddIngredient}
          handleUpdateIngredient={handleUpdateIngredient}

          state={state}
          toggleSelect={toggleSelect}
        />
      )}
    </>
  )
}

ProductIngredient.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
