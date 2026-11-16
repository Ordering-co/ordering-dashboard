import React, { useEffect, useMemo, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { NotFoundSource } from '../../Shared'
import { IconButton } from '../../Shared/Product'
import { Info } from '../../Shared/Icon'
import { EmailSetting } from '../EmailSetting'
import { NotificationSetting } from '../NotificationSetting'
import { SettingsList } from '../SettingsList'
import { SettingsLoyaltyStores } from '../SettingsLoyaltyStores'
import { SettingsStripeConnect } from '../SettingsStripeConnect'
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
import { SettingsHubFormContext } from '../SettingsHubForm/SettingsHubFormContext'

import './settings-hub.css'

const SPECIAL_SCREENS = {
  languages: () => <LanguageSetting />,
  places: () => <PlaceListing avoidExpand />,
  developers: () => <IntegrationListing avoidExpand />,
  api_usage: () => <ApiUsageLimits />,
  custom_order: () => <CustomOrder hideHeader />,
  pages: () => <Cms avoidExpand />,
  checkout_fields: () => <GuestCheckoutFieldsSetting disableGuestColumns />,
  // (AC): the three lists are one stack that spaces them with a token; each list carries no padding of its own
  user_information: () => (
    <div className='odc-hub-fields-stack'>
      <CheckoutFieldsSetting avoidExpand />
      <AddressFieldsSetting avoidExpand />
      <CardFieldsSetting />
    </div>
  ),
  language_manager: () => <LanguageManager avoidExpand isShowProductType />,
  sites: () => <SitesAuthSettings avoidExpand />,
  multi_country: () => <MultiCountrySettings />
}

// redesign settings A: the section on screen. The hub renders it with `key={section.key}`, so a form's state
// (its changes, its open dialogs, the video box) never passes to another section.
const SectionContent = ({ section, groupLabel, focus, focusHeading }) => {
  const [, t] = useLanguage()
  const [openMoreInfo, setOpenMoreInfo] = useState({ open: false, category: null })
  const headingRef = useRef(null)

  // On the phone the section is its own screen: the focus goes to its title when it opens.
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus({ preventScroll: true })
  }, [focusHeading])

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
      // `?focus=` reaches the legacy editors too (email levels, wallet cards)
      return <EmailSetting category={category} onCloseSettingsList={() => null} isRemoveGeneralTitle focus={focus} />
    }
    if (category.key === 'notification') {
      // redesign (n.º 9, review L2 #1): `?focus=` opens the accordion that holds the key
      return <NotificationSetting category={category} onCloseSettingsList={() => null} isRemoveGeneralTitle focus={focus} />
    }
    if ((category.configs || []).length > 0) {
      const loyaltyType = category.key === 'addon_points_and_levels'
        ? 'credit_point'
        : category.key === 'addon_cash_wallet_and_refunds'
          ? 'cashback'
          : null
      if (loyaltyType) {
        return <SettingsLoyaltyStores type={loyaltyType} category={category} focus={focus} />
      }
      if (category.key === 'addon_stripe_connect') {
        return <SettingsStripeConnect category={category} focus={focus} />
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
      <div className='odc-root odc-hub-detail-head'>
        {groupLabel && <p className='odc-hub-crumb'>{groupLabel}</p>}
        <div className='odc-hub-detail-title-row'>
          <h2 ref={headingRef} tabIndex={-1} className='odc-hub-detail-title'>{title}</h2>
          {hasVideo && (
            <IconButton
              icon={Info}
              label={t('MORE_INFO', 'More info')}
              onClick={() => setOpenMoreInfo({ open: true, category })}
            />
          )}
        </div>
        {!!description && <p className='odc-hub-detail-desc'>{description}</p>}
      </div>
      <div className='odc-hub-detail-body'>
        {SpecialScreen ? <SpecialScreen /> : renderCategory()}
      </div>
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

/**
 * The open section of the hub. Gives its forms the hub's context (`{ product: true, report }`): inside it SettingsList,
 * EmailSetting, NotificationSetting and SettingsCustomBlocks draw the Product fields and the save bar, and tell the hub
 * their state through `report(sectionKey, { dirty, saving } | null)`.
 *
 * @param {object}   props.section       the hub section (`buildSettingsHub`)
 * @param {string}   [props.groupLabel]  the group's name, shown as the route above the title (not on the phone)
 * @param {string}   [props.focus]       `?focus=` config key
 * @param {boolean}  [props.focusHeading] move the focus to the title on mount (the phone's section screen)
 * @param {Function} [props.report]      the hub guard's `report`
 */
export const SettingsHubDetail = ({ section, groupLabel, focus, focusHeading, report }) => {
  const [, t] = useLanguage()
  const formContext = useMemo(() => ({ product: true, report: report || (() => {}) }), [report])

  if (!section) {
    return (
      <div className='odc-root odc-hub-status'>
        {t('SETTINGS_HUB_CHOOSE_SECTION', 'Choose a setting from the list.')}
      </div>
    )
  }

  return (
    <SettingsHubFormContext.Provider value={formContext}>
      <SectionContent
        key={section.key}
        section={section}
        groupLabel={groupLabel}
        focus={focus}
        focusHeading={focusHeading}
      />
    </SettingsHubFormContext.Provider>
  )
}
