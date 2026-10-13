import React, { useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import {
  BusinessWhiteLabel as BusinessWhiteLabelController,
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

const BusinessWhiteLabelUI = (props) => {
  const {
    business,
    siteCurrentState,
    confirmCreate,
    handleConfirmCreate,
    handleRetry,
    setIsExtendExtraOpen
  } = props

  const [, t] = useLanguage()

  useEffect(() => {
    if (setIsExtendExtraOpen) {
      setIsExtendExtraOpen(true)
    }
    return () => {
      if (setIsExtendExtraOpen) {
        setIsExtendExtraOpen(false)
      }
    }
  }, [])

  const renderHeader = () => (
    <HeaderContainer>
      <h1>{t('WHITE_LABEL', 'White Label')}</h1>
      <p>{t('WHITE_LABEL_DESC', 'Customize the site and theme of this business.')}</p>
    </HeaderContainer>
  )

  if (confirmCreate) {
    return (
      <Container>
        {renderHeader()}
        <SectionCard>
          <SectionTitle>{t('CREATE_SITE_FOR_BUSINESS', 'Create site for this business')}</SectionTitle>
          <p style={{ marginTop: 0, fontSize: 13, color: '#748194' }}>
            {t('WHITE_LABEL_CONFIRM_CREATE', 'You are about to create a dedicated site for this business. This will be created automatically.')}
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
              {t('WHITE_LABEL_LOAD_ERROR', 'Could not load the site for this business.')}
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
              name={`${business?.name || ''} Web`}
              business={business}
              disableReplaceCode
            />
          </EditorWrapper>
        )}
        {!loading && !error && !site?.id && (
          <EmptyWrapper>
            {t('WHITE_LABEL_EMPTY', 'No site available for this business.')}
          </EmptyWrapper>
        )}
      </SectionCard>
    </Container>
  )
}

export const BusinessWhiteLabel = (props) => {
  return (
    <BusinessWhiteLabelController
      {...props}
      UIComponent={BusinessWhiteLabelUI}
    />
  )
}
