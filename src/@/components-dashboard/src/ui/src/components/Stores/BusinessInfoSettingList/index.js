import React from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { SectionNav } from '../../Shared/Product'

// redesign stores 5.1b (decision 35, G2-03): the subsections of Store details are one selector at every width
// («Information ▾»), never a strip of tabs that scrolls sideways. Same keys (`?tab=`), same order and same rules as the strip:
// Owner is not offered to level 2 (main dropped the EatStreet owner's Agents rule).
export const STORE_DETAILS_TABS = ['information', 'owner', 'categories', 'location', 'agents', 'images', 'videos', 'seo_options']

/** The subsections this person sees, in order (the strip's rules). */
export const visibleStoreDetailsTabs = ({ level } = {}) => STORE_DETAILS_TABS.filter(key => !(level === 2 && key === 'owner'))

export const BusinessInfoSettingList = (props) => {
  const {
    selectedInfoItem,
    handleSelectInfoItem
  } = props
  const [, t] = useLanguage()
  const [{ user }] = useSession()

  const labels = {
    information: t('INFORMATION', 'Information'),
    owner: t('OWNER_ID', 'Owner'),
    categories: t('CATEGORIES', 'Categories'),
    location: t('LOCATION', 'Location'),
    agents: t('AGENTS', 'Agents'),
    images: t('IMAGES', 'Images'),
    videos: t('VIDEOS', 'Videos'),
    seo_options: t('SEO_OPTIONS', 'SEO Options')
  }
  const items = visibleStoreDetailsTabs({ level: user?.level }).map(key => ({ id: key, label: labels[key] }))

  return (
    <SectionNav
      selectorOnly
      className='odc-sd-subnav'
      label={t('STORE_DETAILS_SUBSECTIONS', 'Store details subsections')}
      compactLabel={t('SUBSECTION', 'Subsection')}
      items={items}
      value={selectedInfoItem}
      onValueChange={handleSelectInfoItem}
    />
  )
}
