import React, { useEffect, useState } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { useLocation } from 'react-router-dom'
import { BusinessInfoSettingList, visibleStoreDetailsTabs } from '../BusinessInfoSettingList'
import { BusinessOwners } from '../BusinessOwners'
import { BusinessTypes } from '../BusinessTypes'
import { BusinessLocation } from '../BusinessLocation'
import { BusinessImages } from '../BusinessImages'
import { BusinessVideos } from '../BusinessVideos'
import { SeoOptions } from '../SeoOptions'
import { BusinessInformation } from '../BusinessInformation'
import { addQueryToUrl } from '../../../utils'
import { useRequestLeave } from '../../Shared/Product/LeaveGuard'
import './store-details.css'

import {
  InfoConatiner,
  Container
} from './styles'

export const BusinessDetail = (props) => {
  const {
    business,
    handleDeleteBusinessOwner,
    handleAddBusinessOwner,
    formState,
    setFormState,
    handleUpdateBusinessClick,
    businessTypes,
    setBusinessTypes,
    handleSuccessAddBusinessItem,
    handleSuccessDeleteBusinessItem,
    handleSucessUpdateBusiness,
    setIsExtendExtraOpen,
    isExtendExtraOpen,
    handleUpdateBusinessState,
    isGoogleRedirectPluginActive,
    googleRedirectPluginRoot,
    googleRedirectPluginLoading,
    feedInclusionLoading,
    feedInclusionSaving,
    isSecondaryIncluded,
    onGoogleFeedToggle,
    feedPrimarySaving,
    isPrimaryIncluded,
    onGoogleFeedPrimaryToggle
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [selectedInfoItem, setSelctedInfoItem] = useState('information')

  const selectInfoItem = (tab) => {
    setSelctedInfoItem(tab)
    addQueryToUrl({ tab })
  }
  // redesign stores 5.1a (G2-03): another tab with unsaved work in this one asks first (the editor's leave guard)
  const requestLeave = useRequestLeave()
  const handleSelectInfoItem = (tab) => {
    if (tab === selectedInfoItem) return
    requestLeave(() => selectInfoItem(tab))
  }

  useEffect(() => {
    setIsExtendExtraOpen(false)
  }, [selectedInfoItem])

  useEffect(() => {
    const tab = query.get('tab')
    // redesign stores 5.1b: only a subsection this person is offered; any other (unknown, Owner for level 2) opens
    // Information, as an unknown one always did
    const tabs = visibleStoreDetailsTabs({ level: user?.level })
    if (tab && tabs.includes(tab)) {
      setSelctedInfoItem(tab)
    } else {
      selectInfoItem('information')
    }
  }, [])

  return (
    <>
      {/* J2 RV-4: `odc-sd-frame` tells the store editor this section scrolls in its own box (store-editor.css) */}
      <Container className='odc-sd-frame'>
        <InfoConatiner>
          {/* redesign stores 5.1b (decision 35): the title and the subsection selector share one row */}
          <div className='odc-sd-head'>
            <h1>{t('STORE_DETAILS', 'Store details')}</h1>
            <BusinessInfoSettingList
              selectedInfoItem={selectedInfoItem}
              handleSelectInfoItem={handleSelectInfoItem}
            />
          </div>
          {selectedInfoItem === 'information' && (
            <BusinessInformation
              business={business}
              handleSuccessUpdate={handleSucessUpdateBusiness}
              handleUpdateBusinessState={handleUpdateBusinessState}
              isGoogleRedirectPluginActive={isGoogleRedirectPluginActive}
              googleRedirectPluginRoot={googleRedirectPluginRoot}
              googleRedirectPluginLoading={googleRedirectPluginLoading}
              feedInclusionLoading={feedInclusionLoading}
              feedInclusionSaving={feedInclusionSaving}
              isSecondaryIncluded={isSecondaryIncluded}
              onGoogleFeedToggle={onGoogleFeedToggle}
              feedPrimarySaving={feedPrimarySaving}
              isPrimaryIncluded={isPrimaryIncluded}
              onGoogleFeedPrimaryToggle={onGoogleFeedPrimaryToggle}
            />
          )}
          {selectedInfoItem === 'owner' && (
            <BusinessOwners
              business={business}
              handleDeleteBusinessOwner={handleDeleteBusinessOwner}
              handleAddBusinessOwner={handleAddBusinessOwner}
            />
          )}
          {selectedInfoItem === 'categories' && (
            <BusinessTypes
              business={business}
              businessTypes={businessTypes}
              formState={formState}
              setFormState={setFormState}
              handleUpdateBusinessClick={handleUpdateBusinessClick}
              setBusinessTypes={setBusinessTypes}
              setIsExtendExtraOpen={setIsExtendExtraOpen}
              isExtendExtraOpen={isExtendExtraOpen}
            />
          )}
          {selectedInfoItem === 'location' && (
            <BusinessLocation
              business={business}
              formState={formState}
              setFormState={setFormState}
              handleUpdateBusinessClick={handleUpdateBusinessClick}
            />
          )}
          {selectedInfoItem === 'agents' && (
            <BusinessOwners
              business={business}
              handleDeleteBusinessOwner={handleDeleteBusinessOwner}
              handleAddBusinessOwner={handleAddBusinessOwner}
              type='agents'
            />
          )}
          {selectedInfoItem === 'images' && (
            <BusinessImages
              business={business}
              handleSucessAddBusinessGallery={(result) => handleSuccessAddBusinessItem('gallery', result)}
              handleSucessDeleteBusinessGallery={(id) => handleSuccessDeleteBusinessItem('gallery', id)}
            />
          )}
          {selectedInfoItem === 'videos' && (
            <BusinessVideos
              business={business}
              handleSucessAddBusinessGallery={(result) => handleSuccessAddBusinessItem('gallery', result)}
              handleSucessDeleteBusinessGallery={(id) => handleSuccessDeleteBusinessItem('gallery', id)}
            />
          )}
          {selectedInfoItem === 'seo_options' && (
            <SeoOptions
              data={business}
              formState={formState}
              setFormState={setFormState}
              handleUpdateClick={handleUpdateBusinessClick}
              isBusinessSeo
            />
          )}
        </InfoConatiner>
      </Container>
    </>
  )
}
