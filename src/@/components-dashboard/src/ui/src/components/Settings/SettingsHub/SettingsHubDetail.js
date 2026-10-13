import React, { useState } from 'react'
import { InfoCircle } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { NotFoundSource } from '../../Shared'
import { EmailSetting } from '../EmailSetting'
import { NotificationSetting } from '../NotificationSetting'
import { SettingsList } from '../SettingsList'
import { SettingsLoyaltyStores } from '../SettingsLoyaltyStores'
import { LanguageSetting } from '../LanguageSetting'
import { PlaceListing } from '../PlaceListing'
import { IntegrationListing } from '../IntegrationListing'
import { CustomOrder } from '../CustomOrder'
import { Cms } from '../Cms'
import { GuestCheckoutFieldsSetting } from '../GuestCheckoutFieldsSetting'
import { CheckoutFieldsSetting } from '../CheckoutFieldsSetting'
import { AddressFieldsSetting } from '../AddressFieldsSetting'
import { CardFieldsSetting } from '../CardFieldsSetting'
import { LanguageManager } from '../LanguageManager'
import { SitesAuthSettings } from '../SitesAuthSettings'
import { MultiCountrySettings } from '../MultiCountrySettings'
import { InfoHelpBox } from '../InfoHelpBox'
import { ApiUsageLimits } from '../ApiUsageLimits'

import {
  BackButton,
  BackRow,
  DetailBody,
  DetailDescription,
  DetailHeader,
  DetailTitle,
  DetailTitleRow,
  IconButton,
  StatusPanel
} from './styles'

const SPECIAL_SCREENS = {
  languages: () => <LanguageSetting />,
  places: () => <PlaceListing avoidExpand />,
  developers: () => <IntegrationListing avoidExpand />,
  api_usage: () => <ApiUsageLimits />,
  custom_order: () => <CustomOrder hideHeader />,
  pages: () => <Cms avoidExpand />,
  checkout_fields: () => <GuestCheckoutFieldsSetting disableGuestColumns />,
  user_information: () => (
    <>
      <CheckoutFieldsSetting avoidExpand />
      <AddressFieldsSetting avoidExpand />
      <CardFieldsSetting />
    </>
  ),
  language_manager: () => <LanguageManager avoidExpand isShowProductType />,
  sites: () => <SitesAuthSettings avoidExpand />,
  multi_country: () => <MultiCountrySettings />
}

export const SettingsHubDetail = ({ section, onBack, focus }) => {
  const [, t] = useLanguage()
  const [openMoreInfo, setOpenMoreInfo] = useState({ open: false, category: null })

  if (!section) {
    return (
      <StatusPanel>
        {t('SETTINGS_HUB_CHOOSE_SECTION', 'Choose a setting from the list.')}
      </StatusPanel>
    )
  }

  const title = t(section.copy?.labelKey, section.copy?.label)
  const description = section.copy?.descriptionKey
    ? t(section.copy.descriptionKey, section.copy.description)
    : (section.category?.description || '')
  const category = section.category
  const hasVideo = !!category?.video
  const SpecialScreen = section.type === 'screen' ? SPECIAL_SCREENS[section.key] : null

  const renderCategory = () => {
    if (!category) {
      return (
        <NotFoundSource
          content={t('NOT_FOUND_CONFIG', 'Sorry, we couldn\'t find the config.')}
        />
      )
    }
    if (category.key === 'email_configs') {
      return <EmailSetting category={category} onCloseSettingsList={() => null} isRemoveGeneralTitle />
    }
    if (category.key === 'notification') {
      return <NotificationSetting category={category} onCloseSettingsList={() => null} isRemoveGeneralTitle />
    }
    if ((category.configs || []).length > 0) {
      const loyaltyType = category.key === 'addon_points_and_levels'
        ? 'credit_point'
        : category.key === 'addon_cash_wallet_and_refunds'
          ? 'cashback'
          : null
      if (loyaltyType) {
        return <SettingsLoyaltyStores type={loyaltyType} category={category} />
      }
      return (
        <SettingsList category={category} onCloseSettingsList={() => null} isRemoveGeneralTitle focus={focus} />
      )
    }
    return (
      <NotFoundSource
        content={t('NOT_FOUND_CONFIG', 'Sorry, we couldn\'t find the config.')}
      />
    )
  }

  return (
    <>
      <DetailHeader>
        {onBack && (
          <BackRow>
            <BackButton type='button' onClick={onBack}>
              {t('SETTINGS_HUB_BACK', 'Back to settings')}
            </BackButton>
          </BackRow>
        )}
        <DetailTitleRow>
          <DetailTitle>{title}</DetailTitle>
          {hasVideo && (
            <IconButton
              type='button'
              aria-label={t('MORE_INFO', 'More info')}
              onClick={() => setOpenMoreInfo({ open: true, category })}
            >
              <InfoCircle />
            </IconButton>
          )}
        </DetailTitleRow>
        {!!description && <DetailDescription>{description}</DetailDescription>}
      </DetailHeader>
      <DetailBody>
        {SpecialScreen ? <SpecialScreen /> : renderCategory()}
      </DetailBody>
      {openMoreInfo.open && (
        <InfoHelpBox
          open={openMoreInfo.open}
          category={openMoreInfo.category}
          handleOnClose={setOpenMoreInfo}
        />
      )}
    </>
  )
}
