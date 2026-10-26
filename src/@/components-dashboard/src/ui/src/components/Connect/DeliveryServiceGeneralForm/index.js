import React, { useState, useEffect } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { useForm } from 'react-hook-form'
import { Button, ButtonLink } from '../../../styles'
import { usePluginPage } from '../../../hooks/usePluginPage'
import { hasPluginLaunch } from '../../../../../utils/pluginPages'
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
  const openPluginPage = usePluginPage()
  const plugin = deliveryServiceState?.deliveryService?.plugin

  // A plugin with links.launch gives a one-time URL instead of taking the
  // session in the URL. The tab opens on the click, before the plugin
  // answers, so the browser does not block it as a popup.
  const handleStartSetup = async () => {
    const setupWindow = window.open('', '_blank')
    const url = await openPluginPage(plugin, 'setup', { driverCompanyId: deliveryServiceId })
    if (!setupWindow) return
    if (!url) {
      setupWindow.close()
      return
    }
    setupWindow.opener = null
    setupWindow.location.href = url
  }

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
            {hasPluginLaunch(plugin)
              ? (
                <Button type='button' color='primary' onClick={handleStartSetup}>
                  {t('START_SETUP', 'Start Setup')}
                </Button>
                )
              : (
                <ButtonLink
                  color='primary'
                  href={`${plugin?.setup_url}?project_code=${projectCode}&access_token=${token}&driver_company_id=${deliveryServiceId}`}
                  target='_blank'
                >
                  {t('START_SETUP', 'Start Setup')}
                </ButtonLink>
                )}
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
