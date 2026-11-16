import React from 'react'

import { useLanguage } from '../../../../index'
import { Earth, ExternalLink as ExternalLinkIcon, Globe, LayoutGrid, MapPin, Monitor, PanelLeft, Phone, Store, Truck } from '../Shared/Icon'
import { PlatformMark } from './PlatformMark'
import './builder-shared.css'

// redesign B2: the marks are Builder's own PlatformMark (brand marks never enter Shared/Icon)
export const PlatformIcon = ({ platform }) => <PlatformMark platform={platform} />

// redesign B2: product glyphs of Shared/Icon (Lucide) in place of react-bootstrap-icons, each the closest to main's
const TYPE_ICONS = {
  marketplace_app: LayoutGrid,
  franchise_app: MapPin,
  store_app: Store,
  driver_app: Truck,
  kiosk_app: Monitor,
  marketplace_website: Globe,
  franchise_website: Earth,
  dashboard: PanelLeft
}

export const TypeGlyph = ({ type }) => {
  const Icon = TYPE_ICONS[type] || Phone
  return <Icon className='odc-icon' />
}

/** A tutorial outside the Dashboard (App Store Connect, Play Console, MDM). Hidden without a URL. */
export const GuideLink = ({ href, children }) => {
  const [, t] = useLanguage()
  if (!href) return null
  return (
    <a className='odc-builder-guide' href={href} target='_blank' rel='noopener noreferrer'>
      {children}
      <ExternalLinkIcon className='odc-icon' />
      <span className='odc-sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
    </a>
  )
}
