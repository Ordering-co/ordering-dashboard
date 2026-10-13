import React from 'react'
import { useApi, useLanguage } from '../../../../../index'
import { Button, IconButton } from '../../../styles'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useTheme } from 'styled-components'
import { List as MenuIcon } from 'react-bootstrap-icons'
import {
  Container,
  HeaderTitleContainer,
  ContentLayout,
  TextWrapper,
  ImageBlock
} from './styles'

export const CustomProject = () => {
  const [, t] = useLanguage()
  const [, { configurations }] = useApi()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const theme = useTheme()

  return (
    <Container>
      <HeaderTitleContainer>
        {isCollapse && (
          <IconButton
            color='black'
            onClick={() => handleMenuCollapse(false)}
          >
            <MenuIcon />
          </IconButton>
        )}
        <h1>{t('CUSTOM_PROJECT', 'Custom Project')}</h1>
      </HeaderTitleContainer>
      <ContentLayout>
        <TextWrapper>
          <h2>{t('CUSTOM_PROJECT', 'Custom Project')}</h2>
          <h4>{t('CREATE_TAILOR_MODE', 'Create the tailor-made solution your business requires.')}</h4>
          <p>{t('CUSTOM_PROJECT_DESC', 'Change the design of your Ordering Products, improve current functionality, or even create new software for your business, it\'s your call.')}</p>
          <Button
            color='primary'
            borderRadius='8px'
            onClick={() => window.open(`https://www.${configurations?.subdomain}.com/quote-project-request`, '_blank')}
          >
            {t('CONTACT_US', 'Contact us')}
          </Button>
        </TextWrapper>
        <ImageBlock>
          <img src={theme.images.myProducts.customProject} alt='' />
        </ImageBlock>
      </ContentLayout>
    </Container>
  )
}
