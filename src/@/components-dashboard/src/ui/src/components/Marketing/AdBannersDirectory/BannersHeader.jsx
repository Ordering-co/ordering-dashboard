import React from 'react'

import { useLanguage } from '../../../../../index'
import { IconButton, PageHeader } from '../../Shared/Product'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { Menu as MenuIcon } from '../../Shared/Icon'
import { learnOptionsValues } from '../../../utils/learnOptionsValues'
import './ad-banners.css'

// redesign AB-B2 (decision 1): the page header of the ad banners list: the title, how many banners there are, how many are on
// («3 on») and the Learn menu, exactly as main has it (M/AdBannersListing/index.js:24,123-125). There is no primary action: each
// position has its own «Add banner» (BannersSections).
//
// @param {number}   [props.count]        Banners in the list (all positions); the count is not drawn while it is unknown.
// @param {number}   [props.onCount]      How many of them are on; the «N on» status is not drawn while it is unknown (loading).
// @param {Function} [props.onOpenMenu]   Given while the sidebar is collapsed: the menu button goes before the title (today's `isCollapse`).

// «_count_ on»: the number becomes an .odc-figure node (decision 11) and keeps its direction in RTL
const withFigure = (template, count) => template.split('_count_').flatMap((part, index) => (
  index === 0
    ? [part]
    : [<bdi key={index} dir='ltr' className='odc-figure'>{count}</bdi>, part]
))

const isCount = (value) => value != null && value !== '' && Number.isFinite(Number(value))

export const BannersHeader = ({ count, onCount, onOpenMenu }) => {
  const [, t] = useLanguage()
  const known = isCount(count)
  const countLabel = Number(count) === 1
    ? t('AD_BANNERS_COUNT_ONE', '1 banner')
    : t('AD_BANNERS_COUNT_OTHER', '_count_ banners').replace('_count_', () => String(count))

  return (
    <PageHeader
      className='odc-banners-head'
      leading={onOpenMenu && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={onOpenMenu} />}
      title={t('AD_BANNERS', 'Ad banners')}
      count={known ? Number(count) : undefined}
      countLabel={known ? countLabel : undefined}
      status={isCount(onCount)
        ? <span className='odc-banners-on'>{withFigure(t('AD_BANNERS_ON_COUNT', '_count_ on'), Number(onCount))}</span>
        : undefined}
      learn={<LearnDropDown learnOptions={learnOptionsValues(['ad_banners'], t)} />}
    />
  )
}
