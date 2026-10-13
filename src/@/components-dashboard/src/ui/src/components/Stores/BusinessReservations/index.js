/* eslint-disable no-unused-vars */
import React, { useState } from 'react'
import { BusinessCustomSlugContainer, BusinessOrderingChannelsContainer, Container, FormControl, Label, SwitchWrapper, Tab, Tabs, Title } from './styles'
import { Button, Input, Switch } from '../../../styles'
import { Alert } from '../../Shared'
import { useLanguage } from '../../../../../index'
import { parseJsonObject } from '../../../../../utils/safeJsonParse'

export const BusinessReservations = (props) => {
  const {
    handleUpdateBusinessConfigs,
    business,
    actionStatus
  } = props
  const [, t] = useLanguage()

  const [alertState, setAlertState] = useState({ open: false, content: [], success: false })
  const [formState, setFormState] = useState({})
  const reservationEnabledConfig = business?.configs?.find(config => config.key === 'reservation_enabled')
  const reservationSettingConfig = business?.configs?.find(config => config.key === 'reservation_setting')
  const reservationValues = parseJsonObject(reservationSettingConfig?.value)

  const closeAlert = () => {
    setAlertState({
      ...alertState,
      open: false,
      content: []
    })
  }

  const handleUpdateBusinessReservations = (params, configId) => {
    const values = {}
    const errors = []
    Object.keys(reservationValues)?.map(key => {
      const newValue = params[key] === '' ? 0 : params[key]
      values[key] = key === 'allow_preorder_reservation'
        ? newValue ?? reservationValues[key] ?? false
        : parseInt(newValue ?? reservationValues[key] ?? 0)
    })
    if (values?.min_guests_reservation === 0) {
      errors.push(t('GUESTS_ZERO_ERROR', 'Minimum guests cannot be zero'))
    }
    if (values?.min_guests_reservation > values?.max_guests_reservation) {
      errors.push(t('MINIMUM_GUESTS_ERROR', 'Minimum guests cannot be higher than maximum guests'))
    }
    if (values?.max_time_reserve_days === 0) {
      errors.push(t('MAX_RESERVE_DAYS_ZERO', 'Max reserve days cannot be zero'))
    }
    if (values?.max_time_reserve_days * 1440 < values?.min_time_reserve_minutes) {
      errors.push(t('MAX_RESERVE_DAYS_ERROR', 'Max reserve days cannot be lower than min time reserve'))
    }
    if (errors?.length > 0) {
      setAlertState({
        open: true,
        content: errors
      })
      return
    }
    handleUpdateBusinessConfigs(JSON.stringify(values), configId)
  }

  return (
    <Container>
      <BusinessOrderingChannelsContainer enabled={reservationEnabledConfig?.value === '1'}>
        <Title>{t('RESERVATIONS', 'Reservations')}</Title>
        <SwitchWrapper>
          <p>{t('DO_YOU_OFFER_TABLE_RESERVATION', 'Do you offer table reservation')}?</p>
          <Switch
            defaultChecked={reservationEnabledConfig?.value === '1'}
            onChange={checked => handleUpdateBusinessConfigs(checked ? '1' : '0', reservationEnabledConfig?.id)}
          />
        </SwitchWrapper>
        {reservationEnabledConfig?.value === '1' && (
          <BusinessCustomSlugContainer>
            <FormControl>
              <Label>{t('MINIMUM_GUESTS', 'Minimum guests')}:</Label>
              <Input
                name='min_guests_reservation'
                type='text'
                value={formState?.min_guests_reservation ?? reservationValues?.min_guests_reservation ?? ''}
                placeholder={t('0_PERSON', '0 PERSON')}
                onChange={(e) => {
                  setFormState({
                    ...formState,
                    [e.target.name]: e.target.value
                  })
                }}
                onKeyPress={(e) => {
                  if (!/^[0-9]$/.test(e.key)) {
                    e.preventDefault()
                  }
                }}
              />
            </FormControl>
            <FormControl>
              <Label>{t('MAXIMUM_GUESTS', 'Maximum guests')}:</Label>
              <Input
                type='text'
                name='max_guests_reservation'
                value={formState?.max_guests_reservation ?? reservationValues?.max_guests_reservation ?? ''}
                placeholder={t('0_PERSON', '0 PERSON')}
                onChange={(e) => {
                  setFormState({
                    ...formState,
                    [e.target.name]: e.target.value
                  })
                }}
                onKeyPress={(e) => {
                  if (!/^[0-9]$/.test(e.key)) {
                    e.preventDefault()
                  }
                }}
              />
            </FormControl>
            <FormControl>
              <Label>{t('MINIMUM_TIME_IN_ADVANCE', 'Minimum time in advance')} ({t('MINUTES', 'Minutes')}):</Label>
              <Input
                name='min_time_reserve_minutes'
                type='text'
                value={formState?.min_time_reserve_minutes ?? reservationValues?.min_time_reserve_minutes ?? ''}
                placeholder={t('0_MIN', '0 min')}
                onChange={(e) => {
                  setFormState({
                    ...formState,
                    [e.target.name]: e.target.value
                  })
                }}
                onKeyPress={(e) => {
                  if (!/^[0-9a-zA-Z]$/.test(e.key)) {
                    e.preventDefault()
                  }
                }}
              />
            </FormControl>
            <FormControl>
              <Label>{t('MAXIMUM_TIME_IN_ADVANCE', 'Maximum time in advance')} ({t('DAYS', 'Days')}):</Label>
              <Input
                name='max_time_reserve_days'
                type='text'
                value={formState?.max_time_reserve_days ?? reservationValues?.max_time_reserve_days ?? ''}
                placeholder={t('0_DAYS', '0 days')}
                onChange={(e) => {
                  setFormState({
                    ...formState,
                    [e.target.name]: e.target.value
                  })
                }}
                onKeyPress={(e) => {
                  if (!/^[0-9]$/.test(e.key)) {
                    e.preventDefault()
                  }
                }}
              />
            </FormControl>
            <FormControl>
              <Label>{t('WHEN_GUEST_LATE_HOLD_TABLE', 'When guest are late, hold table for')} ({t('MINUTES', 'Minutes')}):</Label>
              <Input
                name='late_arrival_hold_minutes'
                type='text'
                value={formState?.late_arrival_hold_minutes ?? reservationValues?.late_arrival_hold_minutes ?? ''}
                placeholder={t('0_MIN', '0 min')}
                onChange={(e) => {
                  setFormState({
                    ...formState,
                    [e.target.name]: e.target.value
                  })
                }}
                onKeyPress={(e) => {
                  if (!/^[0-9]$/.test(e.key)) {
                    e.preventDefault()
                  }
                }}
              />
            </FormControl>
          </BusinessCustomSlugContainer>
        )}
      </BusinessOrderingChannelsContainer>
      {reservationEnabledConfig?.value === '1' && (
        <>
          <SwitchWrapper disableBorder>
            <p>{t('ALLOW_GUEST_PREORDER_BOOKING_TABLE', 'Allow guests to pre-order their food when booking a table')}</p>
            <Switch
              defaultChecked={formState?.allow_preorder_reservation ?? reservationValues?.allow_preorder_reservation}
              onChange={checked => setFormState({
                ...formState,
                allow_preorder_reservation: checked
              })}
            />
          </SwitchWrapper>
          <Button
            borderRadius='8px'
            color='primary'
            disabled={actionStatus.loading || Object.keys(formState).length === 0}
            onClick={() => handleUpdateBusinessReservations(formState, reservationSettingConfig?.id)}
          >
            {t('SAVE', 'Save')}
          </Button>
        </>
      )}
      <Alert
        title={t('RESERVATIONS', 'Reservations')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </Container>
  )
}
