import React from 'react'
import { useLanguage, useSession } from '../../../../index'
import { useTheme } from 'styled-components'
import { ExclamationTriangle } from 'react-bootstrap-icons'

import {
  Container,
  Banner,
  Icon,
  Content,
  ButtonWrap
} from './styles'
import { Button } from '../../styles'

export { BannerStack } from './styles'

export const Banners = (props) => {
  props = { ...defaultProps, ...props }
  const {
    setShowBillingPayment
  } = props

  const theme = useTheme()
  const [, t] = useLanguage()
  const [{ user }] = useSession()

  const handleClick = () => {
    setShowBillingPayment((prevState) => ({ ...prevState, open: true, from: 'past_due' }))
  }

  return (
    <Container>
      <Banner>
        <Icon>
          <ExclamationTriangle
            size={26}
            color={theme.colors.warning}
          />
        </Icon>
        <Content>
          <h1>{t('PAST_DUE_TITLE_BANNER', 'Hey :user:, we have a problem, your account is past due.').replace(':user:', user?.name)}</h1>
          <p>{t('PAST_DUE_SUBTITLE_BANNER', 'There appears to be an issue with your payment. Kindly update the card on file and complete your payment.')}</p>
        </Content>
        <ButtonWrap>
          <Button
            color='warning'
            style={{
              borderRadius: 8,
              padding: '5px 30px',
              maxHeight: '40px'
            }}
            onClick={() => handleClick()}
          >
            {t('PAY_NOW', 'Pay now')}
          </Button>
        </ButtonWrap>
      </Banner>
    </Container>
  )
}

const defaultProps = {
  type: 'past_due'
}
