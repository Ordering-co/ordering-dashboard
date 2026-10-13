import React, { useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import {
  BrandWhiteLabel as BrandWhiteLabelController,
  useLanguage
} from '../../../../../index'
import { OrderingWebsite } from '../../MyProducts/OrderingWebsite'

import { Button } from '../../../styles'

import {
  Container,
  HeaderContainer,
  SectionCard,
  SectionTitle,
  Row,
  EmptyWrapper,
  EditorWrapper
} from './styles'

const BrandWhiteLabelUI = (props) => {
  const {
    brand,
    siteCurrentState,
    confirmCreate,
    handleConfirmCreate,
    handleRetry,
    expandSideBar,
    isExpand
  } = props

  const [, t] = useLanguage()

  useEffect(() => {
    if (expandSideBar && !isExpand) {
      expandSideBar()
    }
  }, [])

  const renderHeader = () => (
    <HeaderContainer>
      <h1>{t('WHITE_LABEL', 'White Label')}</h1>
      <p>{t('WHITE_LABEL_DESC_BRAND', 'Customize the site and theme of this brand.')}</p>
    </HeaderContainer>
  )

  if (confirmCreate) {
    return (
      <Container>
        {renderHeader()}
        <SectionCard>
          <SectionTitle>{t('CREATE_SITE_FOR_BRAND', 'Create site for this brand')}</SectionTitle>
          <p style={{ marginTop: 0, fontSize: 13, color: '#748194' }}>
            {t('WHITE_LABEL_CONFIRM_CREATE_BRAND', 'You are about to create a dedicated site for this brand. This will be created automatically.')}
          </p>
          <Row>
            <Button
              color='primary'
              onClick={handleConfirmCreate}
            >
              {t('CREATE_SITE', 'Create site')}
            </Button>
          </Row>
        </SectionCard>
      </Container>
    )
  }

  const { loading, site, theme, error } = siteCurrentState || {}

  return (
    <Container>
      {renderHeader()}
      <SectionCard fillHeight={!!site?.id}>
        <SectionTitle>{t('SITE_AND_THEME', 'Site & theme')}</SectionTitle>
        {loading && <Skeleton height={40} count={3} />}
        {!loading && error && (
          <>
            <EmptyWrapper>
              {t('WHITE_LABEL_LOAD_ERROR_BRAND', 'Could not load the site for this brand.')}
            </EmptyWrapper>
            <Row>
              <Button color='secundary' onClick={handleRetry}>
                {t('RETRY', 'Retry')}
              </Button>
            </Row>
          </>
        )}
        {!loading && !error && site?.id && (
          <EditorWrapper>
            <OrderingWebsite
              forcedSiteId={site.id}
              forcedThemeId={theme?.theme_id || theme?.id}
              appId={site.code}
              name={`${brand?.name || ''} Web`}
              disableReplaceCode
            />
          </EditorWrapper>
        )}
        {!loading && !error && !site?.id && (
          <EmptyWrapper>
            {t('WHITE_LABEL_EMPTY_BRAND', 'No site available for this brand.')}
          </EmptyWrapper>
        )}
      </SectionCard>
    </Container>
  )
}

export const BrandWhiteLabel = (props) => {
  return (
    <BrandWhiteLabelController
      {...props}
      UIComponent={BrandWhiteLabelUI}
    />
  )
}
