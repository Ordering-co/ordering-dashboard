import React, { useEffect, useRef, useState } from 'react'
import { useTheme } from 'styled-components'
import { Check2, ThreeDotsVertical } from 'react-bootstrap-icons'
import { useLanguage } from '~components'

import { getIconCard } from '../../../../utils'
import { SimpleSpinner } from '../../../Shared/SimpleSpinner'
import {
  CardItem,
  CardItemContent,
  CardItemActions,
  ActionsContent,
  CardItemActionsWrapper
} from './styles'

export const PaymentCard = (props) => {
  const {
    card,
    cardsLength,
    isLoading,
    cardSelected,
    handleDeleteCard,
    handleCardClick
  } = props

  const theme = useTheme()
  const [, t] = useLanguage()
  const cardActionsRef = useRef(null)
  const actionWrapperRef = useRef(null)
  const deleteRef = useRef(null)

  const [isShowActions, setIsShowActions] = useState(false)

  const handleClickOutside = (e) => {
    if (!isShowActions) return
    const outsideCalendar = !cardActionsRef.current?.contains(e.target)
    if (outsideCalendar) {
      setIsShowActions(false)
    }
  }

  const handleChangeDefaultCard = (e) => {
    if (isLoading) return
    if (actionWrapperRef.current?.contains(e.target) || cardsLength <= 1) return
    handleCardClick(card)
  }

  // redesign (row 82): Esc closes the menu and the focus goes back to the ⋮ that opened it
  const handleMenuKeyDown = (e) => {
    if (e.key !== 'Escape' || !isShowActions) return
    e.stopPropagation()
    setIsShowActions(false)
    cardActionsRef.current?.focus()
  }

  // Leaving the menu with Tab closes it (the focus is then already elsewhere, so it is not sent back)
  const handleMenuBlur = (e) => {
    if (!isShowActions || actionWrapperRef.current?.contains(e.relatedTarget)) return
    setIsShowActions(false)
  }

  const handleDeleteClick = (e) => {
    setIsShowActions(false)
    handleDeleteCard(e)
  }

  // Opened from the keyboard or the pointer, the focus goes to the first (only) item of the menu
  useEffect(() => {
    if (isShowActions) deleteRef.current?.focus()
  }, [isShowActions])

  useEffect(() => {
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [isShowActions])

  return (
    <CardItem
      isCursor={cardsLength > 1}
      onClick={handleChangeDefaultCard}
      isSelected={card?.id === cardSelected?.id}
    >
      <CardItemContent>
        <div>
          {getIconCard(card?.data?.brand)}
        </div>
        <span>
          {card?.data?.brand} {card?.data?.last4}
        </span>
      </CardItemContent>
      <CardItemActions>
        {card?.id === cardSelected?.id && (
          isLoading
            ? (
            <SimpleSpinner
              width={'15px'}
              height={'15px'}
              btc={theme.colors.primary}
              style={{ marginRight: 10 }}
            />
              )
            : (
            <Check2 style={{ marginRight: 10, fontSize: 20, color: theme.colors.primary }} />
              )
        )}
        {!card?.default && !isLoading && (
          <CardItemActionsWrapper
            ref={actionWrapperRef}
            onKeyDown={handleMenuKeyDown}
            onBlur={handleMenuBlur}
          >
            <button
              type='button'
              ref={cardActionsRef}
              aria-label={t('CARD_ACTIONS', 'Card actions: _card_').split('_card_').join(`${card?.data?.brand ?? ''} ${card?.data?.last4 ?? ''}`.trim())}
              aria-haspopup='menu'
              aria-expanded={isShowActions}
              onClick={() => setIsShowActions(prev => !prev)}
            >
              <ThreeDotsVertical aria-hidden='true' />
            </button>
            {
              isShowActions && (
                <ActionsContent role='menu'>
                  <button type='button' role='menuitem' className='delete' ref={deleteRef} onClick={handleDeleteClick}>{t('DELETE', 'Delete')}</button>
                </ActionsContent>
              )
            }
          </CardItemActionsWrapper>
        )}
      </CardItemActions>
    </CardItem>
  )
}
