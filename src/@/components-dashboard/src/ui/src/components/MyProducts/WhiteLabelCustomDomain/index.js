import React, { useState } from 'react'
import {
  useLanguage,
  WhiteLabelCustomDomain as WhiteLabelCustomDomainController
} from '../../../../../index'
import { Button, Input } from '../../../styles'
import { Alert } from '../../Shared'
import {
  Container,
  FormControl,
  ButtonGroup,
  TitleWrapper
} from '../CustomDomain/styles'
import { CUSTOM_DOMAIN_CNAME } from '../CustomDomain/constants'

const WhiteLabelCustomDomainUI = (props) => {
  const {
    handleChangeFormState,
    formState,
    onClose,
    handleChangeCustomDomain
  } = props

  const [, t] = useLanguage()

  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const handleSubmit = () => {
    const errors = []
    if (!formState?.changes?.domain) {
      errors.push(t('VALIDATION_ERROR_REQUIRED', 'Name is required').replace('_attribute_', t('DOMAIN', 'Domain')))
    }
    if (formState?.changes?.domain &&
      !formState?.changes?.domain.match(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i)) {
      errors.push(t('VALIDATION_ERROR_DOMAIN', 'The domain is not valid'))
    }

    if (errors.length === 0) {
      handleChangeCustomDomain()
    } else {
      setAlertState({ open: true, content: errors })
    }
  }

  const closeAlert = () => {
    setAlertState({ open: false, content: [] })
  }

  return (
    <>
      <Container>
        <h1>{t('CUSTOM_DOMAIN', 'Custom domain')}</h1>
        <FormControl>
          <TitleWrapper>
            <label>{t('DOMAIN', 'Domain')}</label>
          </TitleWrapper>
          <span>{t('CUSTOM_DOMAIN_NOTIFY_WHITE_LABEL', `Please make sure that your DNS CNAME is pointing ${CUSTOM_DOMAIN_CNAME}`)}</span>
          <Input
            placeholder='www.yourdomain.com'
            value={formState?.changes?.domain || ''}
            onChange={(e) => handleChangeFormState({ domain: e.target.value })}
          />
        </FormControl>
        <ButtonGroup>
          <Button
            color='primary'
            outline
            onClick={onClose}
          >
            {t('Cancel', 'Cancel')}
          </Button>
          <Button
            color='primary'
            onClick={handleSubmit}
            disabled={formState?.loading}
          >
            {t('SAVE', 'Save')}
          </Button>
        </ButtonGroup>
      </Container>
      <Alert
        title={t('ORDERING', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const WhiteLabelCustomDomain = (props) => {
  const whiteLabelCustomDomainProps = {
    ...props,
    UIComponent: WhiteLabelCustomDomainUI
  }
  return <WhiteLabelCustomDomainController {...whiteLabelCustomDomainProps} />
}
