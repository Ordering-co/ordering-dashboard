import React from 'react'
import { useLanguage, DriversGroupOrders as DriversGroupOrdersController } from '../../../../../index'
import { useTheme } from 'styled-components'
import { Input, Checkbox } from '../../../styles'

import {
  GroupOrdersContainer,
  FieldWrapper,
  UseMapsApiCheckboxContainer,
  MapsApiDescriptionContainer,
  MaxTimeInputsContainer,
  IconImage,
  MaxTimeBusinessInputContainer,
  FieldRowContainer
} from './styles'

const DriversGroupOrdersUI = (props) => {
  const {
    curDriversGroup,
    changesState,
    handleChangesState,
    maxTimeBetweenOrder,
    maxTimeBetweenBusiness,
    maxTimeBetweenDelivery,
    handleChangeMaxTimeBetweenOrder,
    handleChangeMaxTimeBetweenBusiness,
    handleChangeMaxTimeBetweenDelivery,
    onChangeNumberInput
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()

  return (
    <GroupOrdersContainer>
      <h1>{t('GROUP_ORDERS', 'Group orders')}</h1>
      <FieldWrapper>
        <label htmlFor='drivers-group-orders-max-orders'>{t('MAX_NUMBER_ORDERS', 'Maximum number of orders')}</label>
        <Input
          id='drivers-group-orders-max-orders'
          value={changesState?.orders_group_max_orders ?? curDriversGroup?.orders_group_max_orders ?? 0}
          onChange={e => onChangeNumberInput('orders_group_max_orders', e.target.value)}
        />
      </FieldWrapper>
      <FieldWrapper as='fieldset'>
        <legend>{t('MAX_TIME_BETWEEN_ORDER', 'Maximum time between orders')}</legend>
        <MaxTimeInputsContainer>
          <Input
            aria-label={t('HOURS', 'Hours')}
            value={maxTimeBetweenOrder?.hour ?? ''}
            onChange={e => handleChangeMaxTimeBetweenOrder(e.target.value, 'hour')}
          />
          <strong aria-hidden='true'>&#8282;</strong>
          <Input
            aria-label={t('MINUTES', 'Minutes')}
            value={maxTimeBetweenOrder?.minute ?? ''}
            onChange={e => handleChangeMaxTimeBetweenOrder(e.target.value, 'minute')}
            maxlength='2'
          />
          <strong aria-hidden='true'>&#8282;</strong>
          <Input
            aria-label={t('SECONDS', 'Seconds')}
            value={maxTimeBetweenOrder?.second ?? ''}
            onChange={e => handleChangeMaxTimeBetweenOrder(e.target.value, 'second')}
            maxlength='2'
          />
        </MaxTimeInputsContainer>
      </FieldWrapper>
      <FieldWrapper>
        <label htmlFor='drivers-group-orders-max-distance-pickup'>{t('MAX_DISTANCE_BETWEEN_BUSINESS', 'Maximum distance between businesses in meters')}</label>
        <MaxTimeBusinessInputContainer>
          <IconImage
            aria-hidden='true'
            url={theme.images?.icons?.shopToShop}
          />
          <Input
            id='drivers-group-orders-max-distance-pickup'
            value={changesState?.orders_group_max_distance_between_pickup ?? curDriversGroup?.orders_group_max_distance_between_pickup ?? ''}
            onChange={e => onChangeNumberInput('orders_group_max_distance_between_pickup', e.target.value)}
          />
        </MaxTimeBusinessInputContainer>
      </FieldWrapper>
      <FieldWrapper>
        <label htmlFor='drivers-group-orders-max-distance-delivery'>{t('MAX_DISTANCE_BETWEEN_DELIVERY', 'Maximum distance between deliveries in meters')}</label>
        <MaxTimeBusinessInputContainer>
          <IconImage
            aria-hidden='true'
            url={theme.images?.icons?.homeToHome}
          />
          <Input
            id='drivers-group-orders-max-distance-delivery'
            value={changesState?.orders_group_max_distance_between_delivery ?? curDriversGroup?.orders_group_max_distance_between_delivery ?? ''}
            onChange={e => onChangeNumberInput('orders_group_max_distance_between_delivery', e.target.value)}
          />
        </MaxTimeBusinessInputContainer>
      </FieldWrapper>
      <FieldWrapper>
        <UseMapsApiCheckboxContainer>
          <Checkbox
            id='drivers-group-orders-use-maps-api'
            aria-describedby='drivers-group-orders-use-maps-api-hint'
            checked={changesState?.orders_group_use_maps_api ?? curDriversGroup?.orders_group_use_maps_api ?? false}
            onChange={e => handleChangesState({ orders_group_use_maps_api: e.target.checked })}
          />
          <MapsApiDescriptionContainer>
            <label htmlFor='drivers-group-orders-use-maps-api'>
              {t('USE_MAPS_API', 'Use maps api')}
            </label>
            <p id='drivers-group-orders-use-maps-api-hint'>
              <span>{t('GOOGLE_MAPS_EXTRA_COST', 'Using this generates extra charges on your Google Maps usage.')}</span>
              <a href='https://console.cloud.google.com/home/dashboard' target='_blank' rel='noopener noreferrer'>
                {t('GO_TO_GOOGLE_CONSOLE', 'Go to Google Console')}
              </a>
            </p>
          </MapsApiDescriptionContainer>
        </UseMapsApiCheckboxContainer>
      </FieldWrapper>
      {/* (changesState?.type === 0 || (typeof changesState?.type === 'undefined' && driversGroup?.type === 0)) */}
      {(changesState?.orders_group_use_maps_api || (typeof changesState?.orders_group_use_maps_api === 'undefined' && curDriversGroup?.orders_group_use_maps_api)) && (
        <>
          <FieldWrapper as='fieldset'>
            <legend>{t('MAX_TIME_BETWEEN_PICKUP', 'Maximum time between pickup points in seconds')}</legend>
            <FieldRowContainer>
              <IconImage
                aria-hidden='true'
                url={theme.images?.icons?.shopToShop}
              />
              <MaxTimeInputsContainer>
                <Input
                  aria-label={t('HOURS', 'Hours')}
                  value={maxTimeBetweenBusiness?.hour ?? ''}
                  onChange={e => handleChangeMaxTimeBetweenBusiness(e.target.value, 'hour')}
                />
                <strong aria-hidden='true'>&#8282;</strong>
                <Input
                  aria-label={t('MINUTES', 'Minutes')}
                  value={maxTimeBetweenBusiness?.minute ?? ''}
                  onChange={e => handleChangeMaxTimeBetweenBusiness(e.target.value, 'minute')}
                  maxlength='2'
                />
                <strong aria-hidden='true'>&#8282;</strong>
                <Input
                  aria-label={t('SECONDS', 'Seconds')}
                  value={maxTimeBetweenBusiness?.second ?? ''}
                  onChange={e => handleChangeMaxTimeBetweenBusiness(e.target.value, 'second')}
                  maxlength='2'
                />
              </MaxTimeInputsContainer>
            </FieldRowContainer>
          </FieldWrapper>
          <FieldWrapper as='fieldset'>
            <legend>{t('MAX_TIME_BETWEEN_DELIVERY', 'Maximum time between delivery points in seconds')}</legend>
            <FieldRowContainer>
              <IconImage
                aria-hidden='true'
                url={theme.images?.icons?.homeToHome}
              />
              <MaxTimeInputsContainer>
                <Input
                  aria-label={t('HOURS', 'Hours')}
                  value={maxTimeBetweenDelivery?.hour ?? ''}
                  onChange={e => handleChangeMaxTimeBetweenDelivery(e.target.value, 'hour')}
                />
                <strong aria-hidden='true'>&#8282;</strong>
                <Input
                  aria-label={t('MINUTES', 'Minutes')}
                  value={maxTimeBetweenDelivery?.minute ?? ''}
                  onChange={e => handleChangeMaxTimeBetweenDelivery(e.target.value, 'minute')}
                  maxlength='2'
                />
                <strong aria-hidden='true'>&#8282;</strong>
                <Input
                  aria-label={t('SECONDS', 'Seconds')}
                  value={maxTimeBetweenDelivery?.second ?? ''}
                  onChange={e => handleChangeMaxTimeBetweenDelivery(e.target.value, 'second')}
                  maxlength='2'
                />
              </MaxTimeInputsContainer>
            </FieldRowContainer>
          </FieldWrapper>
        </>
      )}
    </GroupOrdersContainer>
  )
}

export const DriversGroupOrders = (props) => {
  const drivesGroupOrdersProps = {
    ...props,
    UIComponent: DriversGroupOrdersUI
  }
  return <DriversGroupOrdersController {...drivesGroupOrdersProps} />
}
