import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useProduct, PRODUCT_ACTIONS } from '../../contexts/ProductContext'

/**
 * Component to manage login behavior without UI component
 */
export const ProductComponent = (props) => {
  props = { ...defaultProps, ...props }
  const {
    product,
    UIComponent
  } = props

  const [{ ingredients }, dispatchIngredients] = useProduct()
  const [{ options }, dispatchOptions] = useProduct()

  const [productCount, setProductCount] = useState(1)
  const [productPrice, setProductPrice] = useState(product.price)
  const [note, setNote] = useState('')

  const initIngredients = () => {
    const ingredientList = product.ingredients
    for (let idx = 0; idx < ingredientList.length; idx++) {
      ingredientList[idx].isChecked = true
    }

    dispatchIngredients({
      type: PRODUCT_ACTIONS.CHANGE_INGREDIENTS,
      ingredients: ingredientList
    })
  }

  const isCheckedRespectOption = (options, respectId) => {
    for (let oIdx = 0; oIdx < options.length; oIdx++) {
      const subOptionList = options[oIdx].suboptions
      for (let sIdx = 0; sIdx < subOptionList.length; sIdx++) {
        if (subOptionList[sIdx].id === respectId) {
          return subOptionList[sIdx].isChecked
        }
      }
    }

    return false
  }

  const initOptions = () => {
    const optionList = []
    const extras = product.extras
    for (let eIdx = 0; eIdx < extras.length; eIdx++) {
      optionList.push(...extras[eIdx].options)
    }

    for (let oIdx = 0; oIdx < optionList.length; oIdx++) {
      const option = optionList[oIdx]
      option.isDisplay = true
      if (option.conditioned) {
        const respectId = option.respect_to
        if (typeof respectId === 'undefined' || respectId === '' || respectId === 'null') {
          option.isDisplay = false
        }

        if (!isCheckedRespectOption(optionList, respectId)) {
          option.isDisplay = false
        }
      }

      const subOptionList = option.suboptions
      for (let sIdx = 0; sIdx < subOptionList.length; sIdx++) {
        subOptionList[sIdx].isChecked = false
      }
    }
    dispatchOptions({
      type: PRODUCT_ACTIONS.CHANGE_OPTIONS,
      options: optionList
    })
  }

  useEffect(() => {
    initIngredients()
    initOptions()
  }, [])

  const onShare = () => {
    if (props.onShare) {
      props.onShare(product)
    }
  }

  const onClose = () => {
    if (props.onClose) {
      props.onClose()
    }
  }

  const onChangedIngredient = (index) => {
    ingredients[index].isChecked = !ingredients[index].isChecked
    dispatchIngredients({
      type: PRODUCT_ACTIONS.CHANGE_INGREDIENTS,
      ingredients
    })
  }

  const onChangedOption = (optionIndex, subOptionIndex, optionType) => {
    if (optionType) { // radio button
      for (let sIdx = 0; sIdx < options[optionIndex].suboptions.length; sIdx++) {
        options[optionIndex].suboptions[sIdx].isChecked = false
      }
      options[optionIndex].suboptions[subOptionIndex].isChecked = true
    } else { // checkbox
      options[optionIndex].suboptions[subOptionIndex].isChecked = !options[optionIndex].suboptions[subOptionIndex].isChecked
    }

    for (let oIdx = 0; oIdx < options.length; oIdx++) {
      const option = options[oIdx]
      option.isDisplay = true
      if (option.conditioned) {
        const respectId = option.respect_to
        if (typeof respectId === 'undefined' || respectId === '' || respectId === 'null') {
          option.isDisplay = false
        }

        if (!isCheckedRespectOption(options, respectId)) {
          option.isDisplay = false
        }
      }
    }

    calculatePrice(productCount, options)
    dispatchOptions({
      type: PRODUCT_ACTIONS.CHANGE_OPTIONS,
      options
    })
  }

  const calculatePrice = (pCount, optionList) => {
    let optionPrice = 0
    for (let oIdx = 0; oIdx < optionList.length; oIdx++) {
      if (optionList[oIdx].isDisplay === false) continue

      const subOptionList = optionList[oIdx].suboptions
      for (let sIdx = 0; sIdx < subOptionList.length; sIdx++) {
        if (subOptionList[sIdx].isChecked) {
          optionPrice = optionPrice + parseFloat(subOptionList[sIdx].price)
        }
      }
    }
    const price = (parseFloat(product.price) + optionPrice) * pCount
    setProductPrice(price)
  }

  const onChangedNote = (e) => {
    setNote(e.target.value)
  }

  const onClickedButtonPlus = () => {
    setProductCount(productCount + 1)
    calculatePrice(productCount + 1, options)
  }

  const onClickedButtonMinus = () => {
    if (productCount > 1) {
      setProductCount(productCount - 1)
      calculatePrice(productCount - 1, options)
    }
  }

  const onClickedButtonAdd = () => {
    if (props.onClickedButtonAdd) {
      product.ingredients = ingredients
      product.options = options
      product.note = note
      product.quantity = productCount
      props.onAdd(product)
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          onShare={onShare}
          onClose={onClose}
          productName={product.name}
          productLogo={product.images}
          productCount={productCount}
          productPrice={productPrice}
          ingredients={ingredients}
          options={options}
          note={note}
          onChangedIngredient={onChangedIngredient}
          onChangedOption={onChangedOption}
          onChangedNote={onChangedNote}
          onClickedButtonPlus={onClickedButtonPlus}
          onClickedButtonMinus={onClickedButtonMinus}
          onClickedButtonAdd={onClickedButtonAdd}
        />
      )}
    </>
  )
}

ProductComponent.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Custom function to check the sub-option is checked
   * @param
   * extraIndex, respectId
   * respectId is 'respect_to' field
   */
  onShare: PropTypes.func,
  onClose: PropTypes.func,
  productName: PropTypes.string,
  productLogo: PropTypes.string,
  productCount: PropTypes.number,
  productPrice: PropTypes.number,
  ingredients: PropTypes.array,
  options: PropTypes.array,
  note: PropTypes.array,
  onChangedIngredient: PropTypes.func,
  onChangedOption: PropTypes.func,
  onChangedNote: PropTypes.func,
  /**
   * Custom function to control the product number
   */
  onClickedButtonPlus: PropTypes.func,
  /**
   * Custom function to control the product number
   */
  onClickedButtonMinues: PropTypes.func,
  /**
   * Custom function to add the product to the cart
   */
  onClickedButtonAdd: PropTypes.func
}

const defaultProps = {
  productName: ''
}
