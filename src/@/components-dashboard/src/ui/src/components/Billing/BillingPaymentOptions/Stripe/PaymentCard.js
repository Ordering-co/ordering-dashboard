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
          <CardItemActionsWrapper ref={actionWrapperRef}>
            <span ref={cardActionsRef}>
              <ThreeDotsVertical onClick={() => setIsShowActions(true)} />
            </span>
            {
              isShowActions && (
                <ActionsContent>
                  <div className='delete' onClick={handleDeleteCard}>{t('DELETE', 'Delete')}</div>
                </ActionsContent>
              )
            }
          </CardItemActionsWrapper>
        )}
      </CardItemActions>
    </CardItem>
  )
}
