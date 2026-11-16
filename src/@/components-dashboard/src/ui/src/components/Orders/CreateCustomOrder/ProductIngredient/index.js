import React from 'react'
import { ProductIngredient as ProductIngredientController } from '../../../../../../index'

import { Container } from './styles'
import MdCheckBox from '@meronex/icons/md/MdCheckBox'
import MdCheckBoxOutlineBlank from '@meronex/icons/md/MdCheckBoxOutlineBlank'

const ProductIngredientUI = (props) => {
  const {
    state,
    ingredient,
    toggleSelect,
    isSoldOut
  } = props

  return (
    <>
      <Container
        as='button'
        type='button'
        isSoldOut={isSoldOut}
        aria-pressed={Boolean(state?.selected && !isSoldOut)}
        onClick={() => toggleSelect()}
      >
        <span aria-hidden='true'>
          {state?.selected && !isSoldOut
            ? (
            <MdCheckBox />
              )
            : (
            <MdCheckBoxOutlineBlank disabled />
              )}
        </span>
        <span>
          {ingredient.name}
        </span>
      </Container>
    </>
  )
}

export const ProductIngredient = (props) => {
  const productIngredientProps = {
    ...props,
    UIComponent: ProductIngredientUI
  }

  return (
    <ProductIngredientController {...productIngredientProps} />
  )
}
