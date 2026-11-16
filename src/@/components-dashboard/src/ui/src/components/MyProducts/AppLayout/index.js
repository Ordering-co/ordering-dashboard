import React from 'react'
import { useLocation } from 'react-router-dom'
import { List as MenuIcon, InfoCircle } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { LearnDropDown } from '../../Shared'
import { learnOptionsValues } from '../../../utils'
import { learnKeys } from '../../../config/constants'
import { IconButton, Button } from '../../../styles'
import {
  Container,
  HeaderTitleContainer,
  ContentWrapper,
  BoxWrapper,
  AppInfoContainer,
  ImageWrapper,
  DownloadLink,
  ButtonWRapper,
  DownLoadWrapper,
  DownloadBadge,
  HeaderInfoWrapper,
  InfoContent
} from './styles'

const getDownloadName = (item, t) => {
  if (item?.name) return item.name
  if (item?.title) return item.title
  let host = ''
  try {
    host = new URL(item?.link).hostname
  } catch (err) {
    return ''
  }
  if (host.endsWith('apple.com')) return t('FREE_DOWNLOADS_APP_STORE', 'App Store')
  if (host === 'play.google.com') return t('FREE_DOWNLOADS_GOOGLE_PLAY', 'Google Play')
  return host
}

export const AppLayout = (props) => {
  const { appInfo, isDriver, hideBuyBlocks, children, appId } = props
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const location = useLocation()

  const learnOptions = learnOptionsValues(
    appId === 'app_marketplace_x'
      ? learnKeys?.appLearnKeys
      : appId === 'app_business_x'
        ? learnKeys?.businessLearnKeys
        : appId === 'app_driver_x'
          ? learnKeys?.driverLearnKeys
          : [],
    t
  )

  const LeftContent = () => (
    <AppInfoContainer>
      <ImageWrapper isDriver={isDriver}>
        <img src={appInfo.images.live} alt='' />
      </ImageWrapper>
      <h2>{appInfo.live_title}</h2>
      {appInfo?.downloads && (
        <DownLoadWrapper>
          {appInfo.downloads.map(item => (
            <DownloadBadge
              key={item.id}
              onClick={() => window.open(item.link, '_blank', 'noopener,noreferrer')}
            >
              <img src={item.icon} alt={getDownloadName(item, t)} />
            </DownloadBadge>
          ))}
        </DownLoadWrapper>
      )}
      {appInfo?.web_url && (
        <DownloadLink href={appInfo.web_url} target='_blank' isSingle className='download-link'>
          {appInfo.web_link_title}
        </DownloadLink>
      )}
      <p>{appInfo.live_description}</p>
      {appInfo?.purchase_message && (
        <ButtonWRapper>
          {appInfo?.purchase_link && (
            <Button
              color='primary'
              borderRadius='8px'
              onClick={() => window.open(appInfo?.purchase_link, '_blank', 'noopener,noreferrer')}
            >
              {t('PURCHASE_NOW', 'Purchase Now')}
            </Button>
          )}
          {appInfo?.demo_link && (
            <Button
              color='primary'
              outline
              borderRadius='8px'
              onClick={() => window.open(appInfo?.demo_link, '_blank', 'noopener,noreferrer')}
            >
              {t('BOOK_A_DEMO', 'Book a demo')}
            </Button>
          )}
        </ButtonWRapper>
      )}
    </AppInfoContainer>
  )

  const RightContent = () => (
    <AppInfoContainer>
      <ImageWrapper isDriver={isDriver}>
        <img src={appInfo.images.brand} alt='' />
      </ImageWrapper>
      <h2>{appInfo.brand_title}</h2>
      <p>{appInfo.brand_description}</p>
      <ButtonWRapper>
        {appInfo?.purchase_link && (
          <Button
            color='primary'
            borderRadius='8px'
            onClick={() => window.open(appInfo?.purchase_link, '_blank', 'noopener,noreferrer')}
          >
            {t('PURCHASE_NOW', 'Purchase Now')}
          </Button>
        )}
        {!appInfo?.purchase_link && appInfo?.demo_link && (
          <Button
            color='primary'
            outline
            borderRadius='8px'
            onClick={() => window.open(appInfo?.demo_link, '_blank', 'noopener,noreferrer')}
          >
            {t('BOOK_A_DEMO', 'Book a demo')}
          </Button>
        )}
      </ButtonWRapper>
    </AppInfoContainer>
  )

  return (
    appInfo
      ? <Container>
        <HeaderTitleContainer>
          {isCollapse && (
            <IconButton
              color='black'
              aria-label={t('OPEN_MENU', 'Open menu')}
              onClick={() => handleMenuCollapse(false)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <h1>{t('MY_PRODUCTS', 'My products')}</h1>
          {(location.pathname === '/my-products/ordering-website' || location.pathname === '/my-products/customer-app') && (
            <HeaderInfoWrapper>
              <IconButton
                color='primary'
                aria-label={t('INFORMATION', 'Information')}
              >
                <InfoCircle />
              </IconButton>
              <InfoContent>
                {t('MY_PRODUCTS_INFO', 'Use the advanced configurations below to customize your products changing the images, colors, available options and others with a few clicks. If you have doubts, please contact our team here:')}
                {/* redesign tanda AB (C-2): the link reads «Contact support» instead of the raw URL */}
                {' '}
                <a href='https://www.ordering.co/support/' rel='noopener noreferrer' target='_blank'>{t('CONTACT_SUPPORT', 'Contact support')}</a>
              </InfoContent>
            </HeaderInfoWrapper>
          )}
        </HeaderTitleContainer>
        <ContentWrapper>
          <div className='title-container'>
            <h1>{appInfo.title}</h1>
            <LearnDropDown
              learnOptions={learnOptions}
            />
          </div>
          <p>{appInfo.description}</p>
          {!hideBuyBlocks && (
            <BoxWrapper>
              {appInfo?.live_title && <LeftContent />}
              <RightContent />
            </BoxWrapper>
          )}
          {children && children}
        </ContentWrapper>
      </Container>
      : null
  )
}
