import React, { useRef } from 'react'
import { useLanguage } from '../../../../../../index'
import { Circle, RecordCircleFill } from 'react-bootstrap-icons'
import { DriversGroupOrders } from '../../DriversGroupOrders'
import { DriversGroupAutoassign } from '../../DriversGroupAutoassign'
import { DriversMarkAsBusy } from '../../DriversMarkAsBusy'
import { Checkbox } from '../../../../styles'

import {
  LogisticsContainer,
  OrderStatusWrapper,
  OrderStatusGroup,
  RadioButton,
  SubSectionContainer,
  CheckboxContainer,
  HeaderWrapper
} from './styles'

export const AdvancedLogisticsForm = (props) => {
  const {
    driversGroupState,
    changesState,
    handleChangesState,
    useAdvanced,
    handleLogistic
  } = props

  const [, t] = useLanguage()
  const startInStatusRefs = useRef([])

  const handleStartInStatusKeyDown = (event, index) => {
    let nextIndex = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % startInStatusOptions.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + startInStatusOptions.length) % startInStatusOptions.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = startInStatusOptions.length - 1
    else return
    event.preventDefault()
    handleChangesState({ orders_group_start_in_status: startInStatusOptions[nextIndex].status })
    startInStatusRefs.current[nextIndex]?.focus()
  }

  const isStartInStatus = (status) => (
    (changesState?.orders_group_start_in_status && changesState?.orders_group_start_in_status === status) ||
    (typeof changesState?.orders_group_start_in_status === 'undefined' && driversGroupState.driversGroup?.orders_group_start_in_status === status)
  )

  const startInStatusOptions = [
    { status: 7, label: t('ACCEPT_BY_BUSINESS', 'Accepted by the business') },
    { status: 4, label: t('PREPARATION_COMPLETED', 'Preparation completed') }
  ]

  return (
    <LogisticsContainer>
      <HeaderWrapper>
        <h2>{t('ADVANCED_LOGISTICS', 'Advanced logistics')}</h2>
        <CheckboxContainer>
          <Checkbox
            id='drivers-group-use-advanced-logistic'
            checked={useAdvanced}
            onChange={e => handleLogistic(e.target.checked)}
          />
          <label htmlFor='drivers-group-use-advanced-logistic'>{t('USE_ADVANCED_LOGISTICS', 'Use advanced logistics')}</label>
        </CheckboxContainer>
      </HeaderWrapper>
      {useAdvanced && (
        <>
          <OrderStatusGroup role='radiogroup' aria-label={t('ORDERS_GROUP_START_IN_STATUS', 'Start group in status')}>
            {startInStatusOptions.map((option, index) => (
              <OrderStatusWrapper
                key={option.status}
                as='button'
                type='button'
                role='radio'
                aria-checked={Boolean(isStartInStatus(option.status))}
                tabIndex={isStartInStatus(option.status) || (index === 0 && !startInStatusOptions.some(item => isStartInStatus(item.status))) ? 0 : -1}
                onClick={() => handleChangesState({ orders_group_start_in_status: option.status })}
                onKeyDown={event => handleStartInStatusKeyDown(event, index)}
                ref={element => { startInStatusRefs.current[index] = element }}
              >
                <RadioButton active={isStartInStatus(option.status)}>
                  {isStartInStatus(option.status)
                    ? (
                      <RecordCircleFill />
                      )
                    : (
                      <Circle />
                      )}
                </RadioButton>
                <span>{option.label}</span>
              </OrderStatusWrapper>
            ))}
          </OrderStatusGroup>
          {(changesState?.type === 0) && (
            <SubSectionContainer>
              <DriversGroupOrders {...props} />
            </SubSectionContainer>
          )}
          <SubSectionContainer>
            <DriversGroupAutoassign {...props} />
          </SubSectionContainer>
          {changesState?.type === 0 && (
            <SubSectionContainer>
              <DriversMarkAsBusy {...props} />
            </SubSectionContainer>
          )}
        </>
      )}
    </LogisticsContainer>
  )
}
