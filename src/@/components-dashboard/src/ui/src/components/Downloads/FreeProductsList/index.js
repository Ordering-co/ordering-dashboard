import React, { useId } from 'react'
import { useTheme } from 'styled-components'
import { useApi, useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { CatalogCard, CopyButton, IconButton, PageHeader, ProjectCode } from '../../Shared/Product'
import { ExternalLink, Menu as MenuIcon, Phone, Store, Truck } from '../../Shared/Icon'
import './free-downloads.css'

// redesign FD-A (decisions D1–D5): /free-downloads on Product. A page header, a note on how to sign in (with the project
// code and a Copy button when the project is known) and a grid of three cards, one per product, each with its secondary link(s)
// that open in a new tab. The five destinations, their names and their order are main's. It makes no request of its own.
// redesign J5 row 46 (free-downloads P-1, ): each link has an icon «Copy link» beside it (P/CopyButton), to send the app
// to drivers and stores without opening the store first; no QR.

const FALLBACK_ICONS = { driver_app: Truck, business_app: Store, call_center: Phone }

export const FreeProductsList = () => {
  const theme = useTheme()
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const newTabId = useId()
  const project = ordering?.project
  const appStore = t('FREE_DOWNLOADS_APP_STORE', 'App Store')
  const googlePlay = t('FREE_DOWNLOADS_GOOGLE_PLAY', 'Google Play')
  const mobilePlatforms = t('FREE_DOWNLOADS_MOBILE_PLATFORMS', 'iOS · Android')
  const copyLink = t('FREE_DOWNLOADS_COPY_LINK', 'Copy link')
  const copiedLabel = t('COPIED', 'Copied')
  const copyFailed = t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")
  // (free-downloads P-2): App Store links without a country, so each user lands on their own store (main pinned Mexico)
  const products = [
    {
      key: 'driver_app',
      title: t('TYPE_DRIVER_APP', 'Driver App'),
      description: t('FREE_DOWNLOADS_DRIVER_DESCRIPTION', 'Receive deliveries, follow routes and update order status.'),
      image: theme.images?.apps?.driverApp,
      platforms: mobilePlatforms,
      links: [
        { label: appStore, href: 'https://apps.apple.com/app/driver-app-v26/id6526462318' },
        { label: googlePlay, href: 'https://play.google.com/store/apps/details?id=com.orderingplus.driverapp' }
      ]
    },
    {
      key: 'business_app',
      title: t('TYPE_BUSINESS_APP', 'Business App'),
      description: t('FREE_DOWNLOADS_BUSINESS_DESCRIPTION', 'Receive and manage your business orders from one place.'),
      image: theme.images?.apps?.storeApp,
      platforms: mobilePlatforms,
      links: [
        { label: appStore, href: 'https://apps.apple.com/app/business-app-v26/id6526502488' },
        { label: googlePlay, href: 'https://play.google.com/store/apps/details?id=com.orderingplus.storeapp' }
      ]
    },
    {
      key: 'call_center',
      title: t('FREE_DOWNLOADS_CALL_CENTER', 'Call Center'),
      description: t('FREE_DOWNLOADS_CALL_CENTER_DESCRIPTION', 'Create phone orders and help customers from your browser.'),
      image: theme.images?.apps?.callCenterApp,
      platforms: t('FREE_DOWNLOADS_WEB_APP', 'Web app'),
      links: [
        { label: t('FREE_DOWNLOADS_OPEN_CALL_CENTER', 'Open Call Center'), href: 'https://callcenter.orderingplus.com/signin' }
      ]
    }
  ]

  return (
    <div className='odc-root odc-fd-frame'>
      <PageHeader
        leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
        title={t('FREE_DOWNLOADS', 'Free downloads')}
        description={t('FREE_DOWNLOADS_DESCRIPTION', 'Free tools for your team, with the Ordering brand.')}
      />

      <ProjectCode
        note={t('FREE_DOWNLOADS_SIGN_IN', 'Sign in with your project and Ordering account.')}
        project={project}
        codeLabel={t('PROJECT_CODE', 'Project code')}
        copy={{
          label: t('COPY_PROJECT_CODE', 'Copy project code'),
          copyLabel: t('COPY_BUTTON', 'Copy'),
          copiedLabel: t('COPIED', 'Copied'),
          failedLabel: t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")
        }}
      />

      <span id={newTabId} hidden>{t('OPENS_IN_NEW_TAB', 'opens in a new tab')}</span>

      <ul className='odc-fd-grid' aria-label={t('FREE_DOWNLOADS', 'Free downloads')}>
        {products.map(({ key, title, description, image, platforms, links }) => {
          const Icon = FALLBACK_ICONS[key]
          return (
            <CatalogCard
              key={key}
              data-product={key}
              mediaKind='picture'
              media={image ? <img src={image} alt='' /> : <Icon className='odc-icon' aria-hidden='true' />}
              title={title}
              meta={(
                <>
                  <span>{t('FREE_DOWNLOADS_BY_ORDERING', 'By Ordering')}</span>
                  <span> · </span>
                  <span>{platforms}</span>
                </>
              )}
              description={description}
              footer={links.map(({ label, href }) => {
                const name = key === 'call_center' ? label : `${label} · ${title}`
                return (
                  <span key={href} className='odc-fd-link'>
                    <a
                      className='odc-btn'
                      data-variant='secondary'
                      data-size='md'
                      href={href}
                      target='_blank'
                      rel='noopener noreferrer'
                      aria-label={name}
                      aria-describedby={newTabId}
                    >
                      <span>{label}</span>
                      <ExternalLink className='odc-icon odc-icon-flip' aria-hidden='true' />
                    </a>
                    <CopyButton iconOnly text={href} label={`${copyLink} · ${name}`} copiedLabel={copiedLabel} failedLabel={copyFailed} />
                  </span>
                )
              })}
            />
          )
        })}
      </ul>
    </div>
  )
}
