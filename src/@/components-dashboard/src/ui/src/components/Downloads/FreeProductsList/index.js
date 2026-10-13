import React from 'react'
import { useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useTheme } from 'styled-components'
import { List as MenuIcon, InfoCircle, Apple, GooglePlay, BoxArrowUpRight, Truck, Shop, Headset } from 'react-bootstrap-icons'
import {
  FreeProductsListContainer,
  HeaderTitleContainer,
  MenuButton,
  Intro,
  SignInNote,
  ProductsList,
  ProductCard,
  ProductImage,
  ProductDescription,
  ProductTitle,
  FreeBadge,
  ProductActions,
  DownloadLink,
  BrandNote
} from './styles'

export const FreeProductsList = () => {
  const theme = useTheme()
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const appStore = t('FREE_DOWNLOADS_APP_STORE', 'App Store')
  const googlePlay = t('FREE_DOWNLOADS_GOOGLE_PLAY', 'Google Play')
  const mobilePlatforms = t('FREE_DOWNLOADS_MOBILE_PLATFORMS', 'iOS · Android')
  const products = [
    {
      key: 'driver_app',
      title: t('TYPE_DRIVER_APP', 'Driver App'),
      description: t('FREE_DOWNLOADS_DRIVER_DESCRIPTION', 'Receive deliveries, follow routes and update order status.'),
      image: theme.images?.apps?.driverApp,
      icon: Truck,
      platforms: mobilePlatforms,
      links: [
        { label: appStore, icon: Apple, href: 'https://apps.apple.com/mx/app/driver-app-v26/id6526462318' },
        { label: googlePlay, icon: GooglePlay, href: 'https://play.google.com/store/apps/details?id=com.orderingplus.driverapp' }
      ]
    },
    {
      key: 'business_app',
      title: t('TYPE_BUSINESS_APP', 'Business App'),
      description: t('FREE_DOWNLOADS_BUSINESS_DESCRIPTION', 'Receive and manage your business orders from one place.'),
      image: theme.images?.apps?.storeApp,
      icon: Shop,
      platforms: mobilePlatforms,
      links: [
        { label: appStore, icon: Apple, href: 'https://apps.apple.com/mx/app/business-app-v26/id6526502488' },
        { label: googlePlay, icon: GooglePlay, href: 'https://play.google.com/store/apps/details?id=com.orderingplus.storeapp' }
      ]
    },
    {
      key: 'call_center',
      title: t('FREE_DOWNLOADS_CALL_CENTER', 'Call Center'),
      description: t('FREE_DOWNLOADS_CALL_CENTER_DESCRIPTION', 'Create phone orders and help customers from your browser.'),
      image: theme.images?.apps?.callCenterApp,
      icon: Headset,
      platforms: t('FREE_DOWNLOADS_WEB_APP', 'Web app'),
      links: [
        { label: t('FREE_DOWNLOADS_OPEN_CALL_CENTER', 'Open Call Center'), icon: BoxArrowUpRight, href: 'https://callcenter.orderingplus.com/signin' }
      ]
    }
  ]

  return (
    <FreeProductsListContainer>
      <HeaderTitleContainer>
        {isCollapse && (
          <MenuButton color='black' aria-label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)}>
            <MenuIcon aria-hidden='true' />
          </MenuButton>
        )}
        <h1>{t('FREE_DOWNLOADS', 'Free downloads')}</h1>
      </HeaderTitleContainer>
      <Intro>{t('FREE_DOWNLOADS_DESCRIPTION', 'Free tools for your team, with the Ordering brand.')}</Intro>
      <SignInNote>
        <InfoCircle aria-hidden='true' />
        <span>{t('FREE_DOWNLOADS_SIGN_IN', 'Sign in with your project and Ordering account.')}</span>
      </SignInNote>
      <ProductsList>
        {products.map(product => (
          <ProductCard key={product.key}>
            <ProductImage>
              {product.image ? <img src={product.image} alt='' /> : <product.icon aria-hidden='true' />}
            </ProductImage>
            <ProductDescription>
              <ProductTitle>
                <h2>{product.title}</h2>
                <FreeBadge>{t('FREE_DOWNLOADS_FREE', 'Free')}</FreeBadge>
              </ProductTitle>
              <span className='brand'>{t('FREE_DOWNLOADS_BY_ORDERING', 'By Ordering')}</span>
              <p>{product.description}</p>
              <span className='platforms'>{product.platforms}</span>
            </ProductDescription>
            <ProductActions>
              {product.links.map(link => (
                <DownloadLink
                  key={link.href}
                  href={link.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  color='primary'
                  outline={product.key !== 'call_center'}
                  $web={product.key === 'call_center'}
                  aria-label={product.key === 'call_center' ? link.label : `${link.label} · ${product.title}`}
                >
                  <link.icon aria-hidden='true' />
                  <span>{link.label}</span>
                </DownloadLink>
              ))}
            </ProductActions>
          </ProductCard>
        ))}
      </ProductsList>
      <BrandNote>{t('FREE_DOWNLOADS_BRAND_NOTE', 'These products use the Ordering brand.')}</BrandNote>
    </FreeProductsListContainer>
  )
}
