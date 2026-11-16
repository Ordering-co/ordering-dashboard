import React from 'react'
import { useTheme } from 'styled-components'

import { useLanguage } from '../../../../../index'
import { ContactButton, Container, WrapperButton } from './outbound-link-styles'

const PERSONALIZATION_URL = 'https://orderingco.typeform.com/to/qHPQtU'

export const Personalization = (props) => {
  const {
    isShowTitle
  } = props
  const theme = useTheme()
  const [, t] = useLanguage()
  return (
    <Container>
      {isShowTitle && (
        <h1>{t('PERSONALIZATION', 'Personalization')}</h1>
      )}
      <p>
        {t('PERSONALIZATION_TITLE', 'If you are looking for something  special for your Ordering.co Solution')},
        <a
          className='od-outbound-link'
          data-outbound-link-slot='personalization-link'
          href={PERSONALIZATION_URL}
          target='_blank'
          rel='noopener noreferrer'
        >
          {t('SEND_US_SPECIAL_WISH', 'send us your special wish.')}
        </a>
      </p>
      <img
        data-outbound-link-slot='personalization-image'
        src={theme?.images.general?.personalization}
        alt={t('PERSONALIZATION', 'Personalization')}
        loading='lazy'
      />
      <WrapperButton>
        <ContactButton
          borderRadius='8px'
          onClick={() => window.open(PERSONALIZATION_URL, '_blank', 'noopener,noreferrer')}
        >
          {t('CONTACT_US', 'Contact us')}
        </ContactButton>
      </WrapperButton>
    </Container>
  )
}
