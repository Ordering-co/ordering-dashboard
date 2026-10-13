import React, { useState, useEffect } from 'react'
import { useLanguage } from '../../../../../index'
import { Circle, RecordCircleFill } from 'react-bootstrap-icons'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { DriversGroupAutoassignService } from '../DriversGroupAutoassignService'

import {
  LogisticsContainer,
  OrderStatusWrapper,
  RadioButton
} from './styles'

export const DriversGroupsLogisticsService = (props) => {
  const {
    driversGroupState,
    changesState,
    handleChangesState,
    handleParentSidebarMove,
    actionDisabled
  } = props

  const [, t] = useLanguage()
  const { width } = useWindowSize()

  const [openConfig, setOpenConfig] = useState(false)

  useEffect(() => {
    if (width < 1200) {
      handleParentSidebarMove(0)
    } else {
      if (openConfig) handleParentSidebarMove(700)
    }
  }, [width, openConfig])

  useEffect(() => {
    setOpenConfig(false)
  }, [driversGroupState.driversGroup?.id])

  return (
    <LogisticsContainer
      disabled={actionDisabled}
    >
      <label>{t('WHEN_WOULD_LIKE_AUTOMATIC_ASSIGNMENT', 'When would you like this automatic assignment proccess to begin')}</label>
      <OrderStatusWrapper
        onClick={() => handleChangesState({ orders_group_start_in_status: 7 })}
      >
        <RadioButton
          active={
            (changesState?.orders_group_start_in_status && changesState?.orders_group_start_in_status === 7) ||
            (typeof changesState?.orders_group_start_in_status === 'undefined' && driversGroupState.driversGroup?.orders_group_start_in_status === 7)
          }
        >
          {
            ((changesState?.orders_group_start_in_status && changesState?.orders_group_start_in_status === 7) ||
              (typeof changesState?.orders_group_start_in_status === 'undefined' && driversGroupState.driversGroup?.orders_group_start_in_status === 7)
            )
              ? (
                <RecordCircleFill />
                )
              : (
                <Circle />
                )
          }
        </RadioButton>
        <span>{t('ACCEPT_BY_BUSINESS', 'Accepted by Business.')}</span>
      </OrderStatusWrapper>
      <OrderStatusWrapper
        onClick={() => handleChangesState({ orders_group_start_in_status: 4 })}
      >
        <RadioButton
          active={
            (changesState?.orders_group_start_in_status && changesState?.orders_group_start_in_status === 4) ||
            (typeof changesState?.orders_group_start_in_status === 'undefined' && driversGroupState.driversGroup?.orders_group_start_in_status === 4)
          }
        >
          {
            ((changesState?.orders_group_start_in_status && changesState?.orders_group_start_in_status === 4) ||
              (typeof changesState?.orders_group_start_in_status === 'undefined' && driversGroupState.driversGroup?.orders_group_start_in_status === 4)
            )
              ? (
                <RecordCircleFill />
                )
              : (
                <Circle />
                )
          }
        </RadioButton>
        <span>{t('READY_FOR_PICKUP', 'Ready for pickup')}</span>
      </OrderStatusWrapper>
      <DriversGroupAutoassignService {...props} />
    </LogisticsContainer>
  )
}
