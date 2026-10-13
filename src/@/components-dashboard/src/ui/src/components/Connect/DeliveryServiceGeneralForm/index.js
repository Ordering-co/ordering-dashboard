import React, { useState, useEffect } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { useForm } from 'react-hook-form'
import { ButtonLink } from '../../../styles'
import { Alert } from '../../Shared'

import {
  ButtonWrapper,
  Container,
  SkeletonWrapperOutside
} from './styles'
import { SettingsList } from '../../Settings'
import Skeleton from 'react-loading-skeleton'

export const DeliveryServiceGeneralForm = (props) => {
  const {
    deliveryServiceState,
    changesState,
    handleUpdateDeliveryService,
    handleAddDeliveryService,
    actionDisabled,
    isTourOpen,
    handleNextClick,
    pluginState,
    setAvailableModifyData,
    projectCode,
    deliveryServiceId,
    handleUpdateDeliveryGroup
  } = props

  const [, t] = useLanguage()
  const [{ token }] = useSession()
  const { handleSubmit, errors } = useForm()
  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const onSubmit = () => {
    if (deliveryServiceState.deliveryService) {
      handleUpdateDeliveryService(changesState)
    } else {
      if (isTourOpen) {
        handleNextClick()
      } else {
        handleAddDeliveryService()
      }
    }
  }

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setAlertState({
        open: true,
        content: Object.values(errors).map((error) => error.message)
      })
    }
  }, [errors])

  useEffect(() => {
    if (Object.keys(changesState)?.length > 0) {
      handleUpdateDeliveryGroup(changesState)
    }
  }, [changesState])

  return (
    <Container
      data-tour='tour_fill_group'
      onSubmit={handleSubmit(onSubmit)}
      disabled={actionDisabled}
    >
      <p className='message'>
        {
          deliveryServiceState?.deliveryService?.plugin?.setup_url
            ? t('CLICK_FOLLOW_STEPS_TO_FINISH_SETUP', 'Click and Follow steps to finish setup')
            : t('FILL_REQUESTED_FIELDS', 'Please fill in the fields requested below.')
        }
      </p>
      {
        deliveryServiceState?.deliveryService?.plugin?.setup_url && ( // colocar texto de por favor sigue los pasos para terminar el setup, falta backend para evaluar si esta completo o no el setup
          <ButtonWrapper>
            <ButtonLink
              color='primary'
              href={`${deliveryServiceState?.deliveryService?.plugin?.setup_url}?project_code=${projectCode}&access_token=${token}&driver_company_id=${deliveryServiceId}`}
              target='_blank'
            >
              {t('START_SETUP', 'Start Setup')}
            </ButtonLink>
          </ButtonWrapper>
        )
      }
      {
        !pluginState.error && pluginState.loading && (
          <SkeletonWrapperOutside>
            {[...Array(6)].map((i) => (
              <div key={i}>
                <Skeleton height={20} width={200} />
                <Skeleton height={44} />
              </div>
            ))}
            <Skeleton width={70} height={44} />
          </SkeletonWrapperOutside>
        )
      }
      <SettingsList
        {...props}
        staticConfigs={pluginState?.configs}
        onCloseSettingsList={() => (null)}
        isRemoveGeneralTitle
        setAvailableModifyData={setAvailableModifyData}
      />
      <Alert
        title={t('ALERT', 'Alert')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </Container>
  )
}
