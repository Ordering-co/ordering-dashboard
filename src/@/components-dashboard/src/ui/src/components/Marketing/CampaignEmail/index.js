import React, { useState, useEffect, useMemo, useId } from 'react'
import { useLanguage } from '../../../../../index'
import { Input, Button } from '../../../styles'
import { Alert } from '../../Shared'
import { RichHtmlEditor } from '../../Shared/RichHtmlEditor'
import { getUtils } from './utils'
import { EmailPreviewFrame } from '../../CartRecovery/RecoveryRules/EmailPreviewFrame'

import {
  Container,
  InputWrapper,
  EmailPreviewWrapper,
  EmailPreviewHeader,
  PointGroup,
  EmailPreviewContent,
  ButtonWrapper,
  WrapperEditor,
  Preview,
  Description,
  ContactWrapper
} from './styles'

const CampaignEmailUI = (props) => {
  const {
    isAddMode,
    contactState,
    handleChangeData,
    handleUpdateContact,
    handleAddCampaign,
    formState,
    handleChangeContact,
    categoryList,
    // redesign CA-B2 (decision 3|4): opt-in props, all default off
    hideActions = false,
    previewOnly = false,
    onConfigStateChange
  } = props

  const [, t] = useLanguage()
  const fieldId = useId() // redesign CA-R2 (P7): ties each visible label to its field
  const { defaultBodyContent, defaultSubjectContent } = getUtils()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [category, setCategory] = useState()

  const generalList = [
    'email_smtp_use_default',
    'email_smtp_host',
    'email_smtp_username',
    'email_smtp_password',
    'email_smtp_encryption',
    'email_smtp_port'
  ]

  const isEnableConfig = useMemo(() => {
    return category?.configs?.filter(config => generalList.includes(config.key)).every(config => !!config?.value)
  }, [category])

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const handleSetDefaultContent = () => {
    handleChangeData({ target: { value: defaultSubjectContent, name: 'title' } })
    handleChangeContact('body', defaultBodyContent)
  }

  const handleSaveEmail = () => {
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
      const selectedCategory = categoryList?.categories.find(item => item.key === 'pro_white_labeling')
      const configs = selectedCategory?.configs.filter(config => generalList.includes(config.key))
      setCategory({ ...selectedCategory, configs })
    }
  }, [categoryList])

  // redesign CA-B2 (decision 4): tell the host whether the SMTP gate is satisfied (boolean, false while loading)
  useEffect(() => {
    if (typeof onConfigStateChange === 'function') onConfigStateChange(!!isEnableConfig)
  }, [isEnableConfig])

  const emailPreview = (
    <EmailPreviewWrapper>
      <EmailPreviewHeader>
        <PointGroup>
          <div />
          <div />
          <div />
        </PointGroup>
      </EmailPreviewHeader>
      <EmailPreviewContent>
        <h2>{contactState?.changes?.contact_data?.title || ''}</h2>
        {/* the body is painted in a sandboxed iframe (no scripts), never injected into the app */}
        <Preview>
          <EmailPreviewFrame body={contactState?.changes?.contact_data?.body || ''} />
        </Preview>
      </EmailPreviewContent>
    </EmailPreviewWrapper>
  )

  // redesign CA-B2 (decision 3): facsimile only, read-only, no gate and no editor
  if (previewOnly) return emailPreview

  return (
    <>
      <>
        <Container>
          {!isEnableConfig && (
            <>
              <ContactWrapper>
                <p>{t('IF_YOU_NEED_HELP_WITH_SETUP_CONTACT_SUPPORT_TEAM', 'If you need help with your setup, contact our support team.')}</p>
                <Button color='primary' outline onClick={() => window.open('https://www.ordering.co/contact/', '_blank', 'noopener,noreferrer')}>{t('TECH_SUPPORT', 'Tech Support')}</Button>
              </ContactWrapper>
              <Description>
                <span onClick={() => window.open('https://docs.ordering.co/docs/products/dashboard/settings/pro/white-label/', '_blank', 'noopener,noreferrer')}>
                  {t('SMTP_SETTINGS_LINK_DESC', 'You need to complete SMTP configuration first')}
                </span>
              </Description>
            </>
          )}
          {isEnableConfig && (
            <>
              <InputWrapper>
                <div className='container-title'>
                  <label htmlFor={`${fieldId}-title`}>{t('TITLE', 'Title')}</label>
                  <Button color='primary' onClick={() => handleSetDefaultContent()}>{t('USE_DEFAULT_TEMPLATE', 'Use default template')}</Button>
                </div>
                <Input
                  name='title'
                  id={`${fieldId}-title`}
                  placeholder={t('TITLE', 'Title')}
                  value={contactState?.changes?.contact_data?.title ?? ''}
                  onChange={handleChangeData}
                />
              </InputWrapper>
              <InputWrapper>
                <label id={`${fieldId}-body-label`}>{t('MESSAGES', 'Messages')}</label>
                <WrapperEditor role='group' aria-labelledby={`${fieldId}-body-label`}>
                  <RichHtmlEditor
                    linkAsButton
                    video={false}
                    label={t('MESSAGES', 'Messages')}
                    placeholder={t('EMAIL_CONTENT', 'Email content')}
                    value={contactState?.changes?.contact_data?.body ?? ''}
                    onChange={html => handleChangeContact('body', html)}
                  />
                </WrapperEditor>
              </InputWrapper>
              {emailPreview}
            </>
          )}
        </Container>
        {isEnableConfig && !hideActions && (
          <ButtonWrapper>
            <Button
              color='primary'
              onClick={handleSaveEmail}
              disabled={contactState.loading}
            >
              {isAddMode ? t('ADD', 'Add') : t('SAVE', 'Save')}
            </Button>
          </ButtonWrapper>
        )}
      </>
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

export const CampaignEmail = CampaignEmailUI
