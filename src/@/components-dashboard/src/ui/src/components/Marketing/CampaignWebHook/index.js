import React, { useState, useEffect, useId } from 'react'
import { useLanguage, useEvent } from '../../../../../index'
import { Input, TextArea, Button } from '../../../styles'
import { Alert } from '../../Shared'

import {
  Container,
  InputWrapper,
  ButtonWrapper,
  Description
} from './styles'

export const CampaignWebHook = (props) => {
  const {
    isAddMode,
    contactState,
    handleChangeData,
    handleUpdateContact,
    handleAddCampaign,
    formState,
    // redesign CA-B2 (decision 3|4): opt-in props, all default off
    hideActions = false,
    previewOnly = false,
    onConfigStateChange
  } = props

  const [, t] = useLanguage()
  const fieldId = useId() // redesign CA-R2 (P7): ties each visible label to its field
  const [events] = useEvent()

  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const handleSaveSms = () => {
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
    if (!contactState?.changes?.contact_data?.webhook) {
      setAlertState({
        open: true,
        content: t('VALIDATION_ERROR_REQUIRED', 'URL is required').replace('_attribute_', t('URL', 'URL'))
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

  const handleGoToPage = (e) => {
    e.preventDefault()
    events.emit('go_to_page', { page: 'integrations' })
  }

  // redesign CA-B2 (decision 4): no config gate in this channel, always configured
  useEffect(() => {
    if (typeof onConfigStateChange === 'function') onConfigStateChange(true)
  }, [])

  // redesign CA-B2 (decision 3): the webhook has no facsimile, so previewOnly shows its three values as read-only text
  if (previewOnly) {
    return (
      <dl className='odc-campaign-webhook-preview'>
        <dt>{t('TITLE', 'Title')}</dt>
        <dd>{contactState?.changes?.contact_data?.title || ''}</dd>
        <dt>{t('MESSAGES', 'Messages')}</dt>
        <dd>{contactState?.changes?.contact_data?.body || ''}</dd>
        <dt>{t('HOOKS', 'Hooks')}</dt>
        <dd>{contactState?.changes?.contact_data?.webhook || ''}</dd>
      </dl>
    )
  }

  return (
    <>
      <Container>
        <Description>
          {t('INTEGRATION_SETTINGS_LINK_DESC', 'You need to have an Integration first, you can do it here:')} <a onClick={(e) => handleGoToPage(e)}>{t('INTEGRATIONS', 'Integrations')}</a>
        </Description>
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
        <InputWrapper>
          <label htmlFor={`${fieldId}-webhook`}>{t('HOOKS', 'Hooks')}</label>
          <Input
            name='webhook'
            id={`${fieldId}-webhook`}
            placeholder={t('URL', 'URL')}
            defaultValue={contactState?.changes?.contact_data?.webhook || ''}
            onChange={handleChangeData}
          />
        </InputWrapper>
      </Container>
      {!hideActions && (
        <>
          <ButtonWrapper>
            <Button
              color='primary'
              onClick={() => handleSaveSms()}
              disabled={contactState.loading}
            >
              {isAddMode ? t('ADD', 'Add') : t('SAVE', 'Save')}
            </Button>
          </ButtonWrapper>
          <Alert
            title={t('CAMPAIGN', 'Campaign')}
            content={alertState.content}
            acceptText={t('ACCEPT', 'Accept')}
            open={alertState.open}
            onClose={() => closeAlert()}
            onAccept={() => closeAlert()}
            closeOnBackdrop={false}
          />
        </>
      )}
    </>
  )
}
