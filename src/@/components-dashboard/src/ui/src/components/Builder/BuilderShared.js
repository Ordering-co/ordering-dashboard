import React, { useId } from 'react'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { Android2, Apple, BoxArrowUpRight, Display, GeoAlt, Globe, Globe2, Grid, LayoutSidebar, Phone, Shop, Truck } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../index'
import { getBuildKind, getBuildStatusLabel, getPlatformLabel } from './utils'
import { ExternalLink, MessagePanel, PlatformBubble } from './styles'

export const PlatformIcon = ({ platform }) => {
  if (platform === 'ios') return <Apple aria-hidden='true' />
  if (platform === 'android') return <Android2 aria-hidden='true' />
  return <Phone aria-hidden='true' />
}

const TYPE_ICONS = {
  marketplace_app: Grid,
  franchise_app: GeoAlt,
  store_app: Shop,
  driver_app: Truck,
  kiosk_app: Display,
  marketplace_website: Globe,
  franchise_website: Globe2,
  dashboard: LayoutSidebar
}

export const TypeGlyph = ({ type }) => {
  const Icon = TYPE_ICONS[type] || Phone
  return <Icon aria-hidden='true' />
}

/**
 * A platform icon colored by its last build. A tooltip (hover or focus)
 * and the accessible name say the status.
 */
export const PlatformBuildIcon = ({ platform, status }) => {
  const [, t] = useLanguage()
  const tooltipId = useId()
  const label = `${getPlatformLabel(platform)}: ${getBuildStatusLabel(status, t)}`
  return (
    <OverlayTrigger
      placement='top'
      overlay={<Tooltip id={tooltipId}>{label}</Tooltip>}
    >
      <PlatformBubble kind={getBuildKind(status)} role='img' aria-label={label} tabIndex={0}>
        <PlatformIcon platform={platform} />
      </PlatformBubble>
    </OverlayTrigger>
  )
}

export const BuilderMessage = ({ icon, title, text, tone, children, role }) => (
  <MessagePanel tone={tone} role={role}>
    {icon}
    <h2>{title}</h2>
    {text && <p>{text}</p>}
    {children}
  </MessagePanel>
)

/** A tutorial outside the Dashboard (App Store Connect, Play Console, MDM). Hidden without a URL. */
export const GuideLink = ({ href, children }) => {
  const [, t] = useLanguage()
  if (!href) return null
  return (
    <ExternalLink href={href} target='_blank' rel='noopener noreferrer'>
      {children}
      <BoxArrowUpRight aria-hidden='true' />
      <span className='sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
    </ExternalLink>
  )
}
