import React, { useState, useEffect, useRef } from 'react'
import {
  ProductOptionSuboption as ProductSubOptionController,
  useUtils,
  useLanguage
} from '../../../../../../index'
import BsCircleFill from '@meronex/icons/bs/BsCircleFill'
import BsCircleHalf from '@meronex/icons/bs/BsCircleHalf'
import BsDashCircle from '@meronex/icons/bs/BsDashCircle'
import BsPlusCircle from '@meronex/icons/bs/BsPlusCircle'

import {
  Container,
  SuboptionPrice,
  QuantityControl,
  PositionControl,
  IconControl,
  Text,
  SubOptionThumbnail,
  LeftOptionContainer,
  RightOptionContainer
} from './styles'
import MdCheckBox from '@meronex/icons/md/MdCheckBox'
import MdCheckBoxOutlineBlank from '@meronex/icons/md/MdCheckBoxOutlineBlank'
import RiRadioButtonFill from '@meronex/icons/ri/RiRadioButtonFill'
import MdRadioButtonUnchecked from '@meronex/icons/md/MdRadioButtonUnchecked'

const ProductOptionSubOptionUI = (props) => {
  const {
    state,
    increment,
    decrement,
    balance,
    option,
    suboption,
    toggleSelect,
    changePosition,
    isSoldOut,
    setIsScrollAvailable,
    onChange
  } = props

  const disableIncrement = option?.limit_suboptions_by_max ? (balance === option?.max || state.quantity === suboption.max) : state.quantity === suboption?.max || (!state.selected && balance === option?.max)
  const price = option?.with_half_option && suboption?.half_price && state.position !== 'whole' ? suboption?.half_price : suboption?.price
  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const [showMessage, setShowMessage] = useState(false)
  const dirtyRef = useRef(null)

  const handleIncrement = (e) => {
    e.stopPropagation()
    increment()
  }

  const handleDecrement = (e) => {
    e.stopPropagation()
    decrement()
  }

  const handlePosition = (e, position) => {
    e.stopPropagation()
    changePosition(position)
  }

  // redesign fix-qa: E3. The whole row marks the sub option (main did); a press on a control of the row keeps its own action,
  // and the name button, which is the keyboard way in, is not counted twice.
  const handleRowClick = (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return
    handleSuboptionClick()
  }

  const handleSuboptionClick = () => {
    dirtyRef.current = true
    toggleSelect()
    if (balance === option?.max && option?.suboptions?.length > balance && !(option?.min === 1 && option?.max === 1) && !state.selected) {
      setShowMessage(true)
    }
  }

  useEffect(() => {
    if (!(balance === option?.max && option?.suboptions?.length > balance && !(option?.min === 1 && option?.max === 1) && !state.selected)) {
      setShowMessage(false)
    }
  }, [balance])

  useEffect(() => {
    if (balance === option?.max && state?.selected && dirtyRef) {
      if (dirtyRef?.current !== null) {
        dirtyRef.current = false
        setIsScrollAvailable(true)
      }
    }
  }, [state?.selected])

  useEffect(() => {
    if (dirtyRef?.current || !suboption?.preselected || !option?.respect_to) return
    const newState = { ...state, selected: suboption?.preselected, quantity: state.selected ? 0 : 1 }
    onChange(newState, suboption, option)
  }, [suboption, dirtyRef, option])
  return (
    <>
      <Container onClick={handleRowClick}>
        <LeftOptionContainer
          as='button'
          type='button'
          aria-pressed={Boolean(state?.selected)}
          onClick={() => handleSuboptionClick()}
        >
          <IconControl aria-hidden='true'>
            {((option?.min === 0 && option?.max === 1) || option?.max > 1)
              ? (
                  state?.selected
                    ? (
                <MdCheckBox />
                      )
                    : (
                <MdCheckBoxOutlineBlank disabled />
                      )
                )
              : (
                  state?.selected
                    ? (
                <RiRadioButtonFill />
                      )
                    : (
                <MdRadioButtonUnchecked disabled />
                      )
                )}
          </IconControl>
          {suboption.image && suboption.image !== '-' && (
            <SubOptionThumbnail src={suboption.image} />
          )}
          <Text>
            <span className='name'>{suboption?.name}</span>
          </Text>
        </LeftOptionContainer>
        <RightOptionContainer>

          <QuantityControl>
            {option?.allow_suboption_quantity && state?.selected && (
              <>
                <button
                  type='button'
                  aria-label={t('DECREMENT_SUBOPTION', 'Decrease quantity')}
                  disabled={state.quantity === 0 || isSoldOut}
                  onClick={handleDecrement}
                >
                  <BsDashCircle
                    disabled={state.quantity === 0 || isSoldOut}
                    aria-hidden='true'
                  />
                </button>
                {state.quantity}
                <button
                  type='button'
                  aria-label={t('INCREMENT_SUBOPTION', 'Increase quantity')}
                  disabled={disableIncrement || isSoldOut}
                  onClick={handleIncrement}
                >
                  <BsPlusCircle
                    disabled={disableIncrement || isSoldOut}
                    aria-hidden='true'
                  />
                </button>
              </>
            )}
          </QuantityControl>
          <PositionControl>
            {
              option?.with_half_option && state?.selected && (
                <>
                  <button
                    type='button'
                    aria-label={t('LEFT_HALF', 'Left half')}
                    aria-pressed={Boolean(state.selected && state.position === 'left')}
                    onClick={(e) => handlePosition(e, 'left')}
                  >
                    <BsCircleHalf
                      className={['reverse', state.selected && state.position === 'left' ? 'selected' : null].filter(classname => classname).join(' ')}
                      aria-hidden='true'
                    />
                  </button>
                  <button
                    type='button'
                    aria-label={t('WHOLE', 'Whole')}
                    aria-pressed={Boolean(state.selected && state.position === 'whole')}
                    onClick={(e) => handlePosition(e, 'whole')}
                  >
                    <BsCircleFill
                      className={[state.selected && state.position === 'whole' ? 'selected' : null].filter(classname => classname).join(' ')}
                      aria-hidden='true'
                    />
                  </button>
                  <button
                    type='button'
                    aria-label={t('RIGHT_HALF', 'Right half')}
                    aria-pressed={Boolean(state.selected && state.position === 'right')}
                    onClick={(e) => handlePosition(e, 'right')}
                  >
                    <BsCircleHalf
                      className={[state.selected && state.position === 'right' ? 'selected' : null].filter(classname => classname).join(' ')}
                      aria-hidden='true'
                    />
                  </button>
                </>
              )
            }
          </PositionControl>
        </RightOptionContainer>
        <SuboptionPrice>
          {price > 0 && (
            <>+ {parsePrice(price)}</>
          )}
        </SuboptionPrice>
      </Container>
      {showMessage && (
        <Text noMargin>
          <span>{`${t('OPTIONS_MAX_LIMIT', 'Maximum options to choose')}: ${option?.max}`}</span>
        </Text>
      )}
    </>
  )
}

export const ProductOptionSubOption = (props) => {
  const productOptionSubOptionProps = {
    ...props,
    UIComponent: ProductOptionSubOptionUI,
    isOrigin: true
  }

  return (
    <ProductSubOptionController {...productOptionSubOptionProps} />
  )
}
