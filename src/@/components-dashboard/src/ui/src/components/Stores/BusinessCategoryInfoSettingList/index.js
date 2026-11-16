import React from 'react'
import { useLanguage } from '../../../../../index'
import { Tabs } from '../../Shared/Product'
import './category-info-tabs.css'

// redesign stores 5.2 (decision D8): the two tabs of a product category on P/Tabs (4 or fewer tabs → P/Tabs)
export const BusinessCategoryInfoSettingList = (props) => {
  const {
    selectedInfoItem,
    handleSelectInfoItem
  } = props
  const [, t] = useLanguage()

  const items = [
    { value: 'information', label: t('INFORMATION', 'Information') },
    { value: 'seo_options', label: t('SEO_OPTIONS', 'SEO Options') }
  ]

  return (
    <Tabs
      className='odc-category-tabs'
      value={selectedInfoItem}
      onValueChange={handleSelectInfoItem}
      label={t('CATEGORY_SECTIONS', 'Category sections')}
      items={items}
    />
  )
}
