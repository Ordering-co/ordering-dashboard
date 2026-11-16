import React from 'react'
import { useLanguage } from '../../../../../index'
import {
  Container,
  Logo,
  Content,
  Spinner
} from './spinner-loader-styles'

export const SpinnerLoader = (props) => {
  const [, t] = useLanguage()
  const {
    primary,
    logotype,
    content,
    style
  } = props
  return (
    <Container style={style} primary={primary}>
      {!content && <span className='od-spinner-loader-announcement'>{t('LOADING', 'Loading')}</span>}
      {logotype && (
        <Logo>
          <img src={logotype} alt='logo' />
        </Logo>
      )}
      {content && (
        <Content>
          {content}
        </Content>
      )}
      <Spinner>
        <div className='spinner-content'>
          <div />
        </div>
      </Spinner>
    </Container>
  )
}
