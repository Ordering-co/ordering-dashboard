// (settings P-8, decision 29): the muted texts that Settings draws from legacy styles (#909BA9 lightGray and
// #748194 secundaryContrast, 2.81:1 and 3.95:1 on white) use the third text level `--od-x-text-subtle` (5.11:1). axe
// `color-contrast` over every hub section at 1440 went from 57 muted nodes to 0.
import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ServerStyleSheet, ThemeProvider } from 'styled-components'
import theme from '~/theme.json'

import * as ApiUsageLimits from '../ApiUsageLimits/styles'
import * as IntegrationListing from '../IntegrationListing/styles'
import * as MultiCountrySettings from '../MultiCountrySettings/styles'
import * as PlaceListing from '../PlaceListing/styles'
import * as EmailSetting from '../EmailSetting/styles'
import * as GuestCheckoutFieldsSetting from '../GuestCheckoutFieldsSetting/styles'
import * as CheckoutFieldsSetting from '../CheckoutFieldsSetting/styles'
import * as CardFieldsSetting from '../CardFieldsSetting/styles'
import * as AddressFieldsSetting from '../AddressFieldsSetting/styles'
import * as SettingsLoyaltyStores from '../SettingsLoyaltyStores/styles'
import * as SettingsStripeConnect from '../SettingsStripeConnect/styles'
import * as PointsWalletBusinessDetail from '../../Loyalty/PointsWalletBusinessDetail/styles'

const cssOf = (Component) => {
  const sheet = new ServerStyleSheet()
  try {
    renderToString(sheet.collectStyles(<ThemeProvider theme={theme}><Component /></ThemeProvider>))
    return sheet.getStyleTags()
  } finally {
    sheet.seal()
  }
}

const cases = [
  ['ApiUsageLimits.CardMeta', ApiUsageLimits.CardMeta],
  ['ApiUsageLimits.Percent', ApiUsageLimits.Percent],
  ['ApiUsageLimits.FooterMeta', ApiUsageLimits.FooterMeta],
  ['IntegrationListing.SettingItemContent', IntegrationListing.SettingItemContent],
  ['MultiCountrySettings.SiteItem', MultiCountrySettings.SiteItem],
  ['PlaceListing.Tab', PlaceListing.Tab],
  ['EmailSetting.Option', EmailSetting.Option],
  ['GuestCheckoutFieldsSetting.Option', GuestCheckoutFieldsSetting.Option],
  ['CheckoutFieldsSetting.SiteItem', CheckoutFieldsSetting.SiteItem],
  ['CardFieldsSetting.SiteItem', CardFieldsSetting.SiteItem],
  ['AddressFieldsSetting.SiteItem', AddressFieldsSetting.SiteItem],
  ['SettingsLoyaltyStores.LoyaltyCardHelp', SettingsLoyaltyStores.LoyaltyCardHelp],
  ['SettingsLoyaltyStores.LoyaltyTab', SettingsLoyaltyStores.LoyaltyTab],
  ['SettingsLoyaltyStores.LoyaltyBlockHelp', SettingsLoyaltyStores.LoyaltyBlockHelp],
  ['SettingsStripeConnect.StripeConnectTab', SettingsStripeConnect.StripeConnectTab],
  ['SettingsStripeConnect.RuleFootnote', SettingsStripeConnect.RuleFootnote],
  ['PointsWalletBusinessDetail.PointsAccumulationContainer', PointsWalletBusinessDetail.PointsAccumulationContainer]
]

describe('Settings muted texts', () => {
  it.each(cases)('%s uses --od-x-text-subtle, not the low-contrast greys', (_name, Component) => {
    expect(Component).toBeTruthy()
    const css = cssOf(Component)
    expect(css).toContain('color:var(--od-x-text-subtle)')
    expect(css.toLowerCase()).not.toMatch(/color:(#909ba9|#748194)/)
  })
})
