import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import { SettingsList } from '../SettingsList'
import { PayoutRuleForm } from '../../Shared/PayoutRuleForm'
import {
  RuleFootnote,
  StripeConnectPanel,
  StripeConnectStack,
  StripeConnectTab,
  StripeConnectTabs
} from './styles'

export const SettingsStripeConnect = (props) => {
  const { category, focus } = props
  const [, t] = useLanguage()
  const [currentTab, setCurrentTab] = useState('settings')

  const tabs = [
    { key: 'settings', label: t('SETTINGS_STRIPE_CONNECT_TAB_SETTINGS', 'Settings') },
    { key: 'configuration', label: t('SETTINGS_STRIPE_CONNECT_TAB_CONFIGURATION', 'Configuration') }
  ]

  return (
    <StripeConnectStack>
      <StripeConnectTabs role='tablist' aria-label={t('SETTINGS_SECTION_STRIPE_CONNECT', 'Stripe Connect')}>
        {tabs.map(tab => (
          <StripeConnectTab
            key={tab.key}
            type='button'
            role='tab'
            active={currentTab === tab.key}
            aria-selected={currentTab === tab.key}
            onClick={() => setCurrentTab(tab.key)}
          >
            {tab.label}
          </StripeConnectTab>
        ))}
      </StripeConnectTabs>

      {currentTab === 'settings' && (
        <StripeConnectPanel role='tabpanel'>
          <SettingsList category={category} onCloseSettingsList={() => null} isRemoveGeneralTitle focus={focus} />
        </StripeConnectPanel>
      )}

      {currentTab === 'configuration' && (
        <StripeConnectPanel role='tabpanel'>
          <PayoutRuleForm scope='platform' />
          <PayoutRuleForm scope='driver' />
          <RuleFootnote>
            {t('PAYOUT_RULE_APPLIES_TO_NEW_ORDERS', 'Changes apply only to orders placed after you save.')}
          </RuleFootnote>
        </StripeConnectPanel>
      )}
    </StripeConnectStack>
  )
}
