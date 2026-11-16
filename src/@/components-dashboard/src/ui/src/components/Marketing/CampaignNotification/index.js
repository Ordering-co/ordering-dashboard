import React, { useEffect, useMemo, useState, useId } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLanguage } from '../../../../../index'
import { Input, TextArea, Button } from '../../../styles'
import { useTheme } from 'styled-components'
import { Alert } from '../../Shared'
import { SettingsList } from '../../Settings/SettingsList'
import {
  Container,
  InputWrapper,
  ButtonWrapper,
  SmsPreviewWrapper,
  SmsContentLayout,
  SmsPreviewContentWrapper,
  SmsPreviewContent,
  Description,
  BottomSpace,
  ContactWrapper
} from './styles'

export const CampaignNotification = (props) => {
  const {
    isAddMode,
    contactState,
    handleChangeData,
    handleUpdateContact,
    handleAddCampaign,
    formState,
    categoryList,
    // redesign CA-B2 (decision 3|4): opt-in props, all default off
    hideActions = false,
    previewOnly = false,
    onConfigStateChange
  } = props

  const [, t] = useLanguage()
  const fieldId = useId() // redesign CA-R2 (P7): ties each visible label to its field
  const theme = useTheme()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [category, setCategory] = useState()

  const oneSignalList = [
    'onesignal_user_auth',
    'onesignal_orderingapp_id',
    'onesignal_businessapp_id',
    'onesignal_deliveryapp_id',
    'notification_toast'
  ]
  const firebaseKey = 'firebase_service_account'
  const generalList = [...oneSignalList, firebaseKey]

  const isEnableConfig = useMemo(() => {
    const configs = category?.configs
    if (!configs) return undefined
    if (configs.some(config => config.key === firebaseKey && !!config?.value)) return true
    return configs.filter(config => oneSignalList.includes(config.key)).every(config => !!config?.value)
  }, [category])

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const handleSaveNotification = () => {
    if (!contactState?.changes?.contact_data?.title) {
      setAlertState({
        open: true,
        content: t('VALIDATION_ERROR_REQUIRED', 'Title is required').replace('_attribute_', t('TITLE', 'Title'))
      })
      return
    }
    if (!contactState?.changes?.contact_data?.body) {
      setAlertState({
        open: true,
        content: t('VALIDATION_ERROR_REQUIRED', 'Body is required').replace('_attribute_', t('BODY', 'Body'))
      })
      return
    }

    if (isAddMode) {
      if (formState?.changes?.conditions?.length > 0) {
        for (const item of formState?.changes?.conditions) {
          if (item?.date_condition === '=' || item?.date_condition === '>') {
            setAlertState({
              open: true,
              content: t('REQUIRED_BEFORE_OR_RANGE_OPTION_WHEN_FIXED', 'when audience type is Fixed, date condition is required Before or Date range option')
            })
            return
          }
          if (item?.condition === '=') {
            setAlertState({
              open: true,
              content: t('REQUIRED_MORE_OR_LESS_OPTION_WHEN_FIXED', 'when audience type is Fixed, order condition is required More or Less option')
            })
            return
          }
        }
      }
      handleAddCampaign()
    } else {
      handleUpdateContact()
    }
  }

  useEffect(() => {
    if (categoryList?.categories?.length > 0) {
      const selectedCategory = categoryList?.categories.find(item => item.key === 'notification')
      const configs = selectedCategory?.configs.filter(config => generalList.includes(config.key))
      setCategory({ ...selectedCategory, configs })
    }
  }, [categoryList])

  // redesign CA-B2 (decision 4): tell the host whether the push gate is satisfied (boolean, false while loading)
  useEffect(() => {
    if (typeof onConfigStateChange === 'function') onConfigStateChange(!!isEnableConfig)
  }, [isEnableConfig])

  const notificationPreview = (
    <SmsPreviewWrapper>
      <SmsContentLayout bgimage={theme.images.general.mobileHalfMask}>
        <SmsPreviewContentWrapper>
          <SmsPreviewContent>
            <h2>{contactState?.changes?.contact_data?.title || ''}</h2>
            <p>{contactState?.changes?.contact_data?.body || ''}</p>
          </SmsPreviewContent>
        </SmsPreviewContentWrapper>
      </SmsContentLayout>
    </SmsPreviewWrapper>
  )

  // redesign CA-B2 (decision 3): facsimile only, read-only, no gate
  if (previewOnly) return notificationPreview

  return (
    <>
      {isEnableConfig
        ? (
        <>
          <Container>
            <InputWrapper>
              <label htmlFor={`${fieldId}-title`}>{t('TITLE', 'Title')}</label>
              <Input
                name='title'
                id={`${fieldId}-title`}
                placeholder={t('TITLE', 'Title')}
                defaultValue={contactState?.changes?.contact_data?.title || ''}
                onChange={handleChangeData}
              />
            </InputWrapper>
            <InputWrapper>
              <label htmlFor={`${fieldId}-body`}>{t('MESSAGES', 'Messages')}</label>
              <TextArea
                name='body'
                id={`${fieldId}-body`}
                placeholder={t('WRITE_MESSAGE', 'Write a message')}
                defaultValue={contactState?.changes?.contact_data?.body || ''}
                onChange={handleChangeData}
              />
            </InputWrapper>
            {notificationPreview}
          </Container>
          {!hideActions && (
            <ButtonWrapper>
              <Button
                color='primary'
                onClick={() => handleSaveNotification()}
                disabled={contactState.loading}
              >
                {isAddMode ? t('ADD', 'Add') : t('SAVE', 'Save')}
              </Button>
            </ButtonWrapper>
          )}
        </>
          )
        : (
        <>
          <ContactWrapper>
            <p>{t('IF_YOU_NEED_HELP_WITH_SETUP_CONTACT_SUPPORT_TEAM', 'If you need help with your setup, contact our support team.')}</p>
            <Button color='primary' outline onClick={() => window.open('https://www.ordering.co/contact/', '_blank', 'noopener,noreferrer')}>{t('TECH_SUPPORT', 'Tech Support')}</Button>
          </ContactWrapper>
          <Description>
            <span onClick={() => window.open('https://docs.ordering.co/docs/products/dashboard/settings/pro/push-notifications/', '_blank', 'noopener,noreferrer')}>
              {t('CAMPAIGNS_PUSH_SETUP_HELP', 'To send push notifications, complete the OneSignal settings or add a Firebase service account')}
            </span>
          </Description>
          {categoryList?.loading && (
            <>
              {[...Array(5).keys()].map(i => (
                <p key={i}>
                  <Skeleton height={20} />
                </p>
              ))}
            </>
          )}
          {!categoryList?.loading && category && (
            <SettingsList
              {...props}
              category={category}
              isRemoveGeneralTitle
            />
          )}
          <BottomSpace />
        </>
          )}
      {!hideActions && (
        <Alert
          title={t('CAMPAIGN', 'Campaign')}
          content={alertState.content}
          acceptText={t('ACCEPT', 'Accept')}
          open={alertState.open}
          onClose={() => closeAlert()}
          onAccept={() => closeAlert()}
          closeOnBackdrop={false}
        />
      )}
    </>
  )
}
