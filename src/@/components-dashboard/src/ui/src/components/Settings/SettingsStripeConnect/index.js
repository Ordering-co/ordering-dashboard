import React, { useMemo, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { SettingsList } from '../SettingsList'
import { PayoutRuleForm } from '../../Shared/PayoutRuleForm'
import { ConfirmDialog, LeaveGuardContext, useLeaveGuardHost } from '../../Shared/Product'
import { OAuthRedirectUri } from './OAuthRedirectUri'
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

  // bugs H R-F1: the tab change is a way out of the forms on screen. The section owns a leave host: the payout rule forms register in
  // it through the context and the Settings list through `leaveGuard`, so a tab click with unsaved work
  // asks «Keep editing · Discard» (owner decision 27) before it unmounts them. The hub's own guard (category, route) is a router block fed by
  // useHubFormReport: it does not read this host and this host does not read it, so each way out asks once.
  const leave = useLeaveGuardHost()
  const settingsLeaveGuard = useMemo(() => ({ register: leave.context.register }), [leave.context])
  const currentLabel = tabs.find(tab => tab.key === currentTab)?.label

  const handleTabClick = (key) => {
    if (key === currentTab) return
    leave.requestLeave(() => setCurrentTab(key))
  }

  return (
    <LeaveGuardContext.Provider value={leave.context}>
      <StripeConnectStack>
        <StripeConnectTabs role='tablist' aria-label={t('SETTINGS_SECTION_STRIPE_CONNECT', 'Stripe Connect')}>
          {tabs.map(tab => (
            <StripeConnectTab
              key={tab.key}
              type='button'
              role='tab'
              active={currentTab === tab.key}
              aria-selected={currentTab === tab.key}
              onClick={() => handleTabClick(tab.key)}
            >
              {tab.label}
            </StripeConnectTab>
          ))}
        </StripeConnectTabs>

        {currentTab === 'settings' && (
          <StripeConnectPanel role='tabpanel'>
            {/* main: the address to register in Stripe's OAuth settings */}
            <OAuthRedirectUri />
            <SettingsList
              category={category}
              onCloseSettingsList={() => null}
              isRemoveGeneralTitle
              focus={focus}
              leaveGuard={settingsLeaveGuard}
            />
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
      {/* Owner decision 27 B (2026-10-21, ): a tab change with unsaved work asks the hub's «Discard your changes?» (decision 17),
          the question a section change already asks, instead of «Save your changes?» with «Save and continue». */}
      <ConfirmDialog
        open={leave.dialog.open}
        title={t('SETTINGS_DISCARD_TITLE', 'Discard your changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        tone='danger'
        onConfirm={leave.dialog.onDiscard}
        onCancel={leave.dialog.onKeep}
      >
        {t('SETTINGS_DISCARD_DESCRIPTION', 'You have unsaved changes in _section_. If you leave, they are lost.')
          .replace('_section_', () => currentLabel)}
      </ConfirmDialog>
    </LeaveGuardContext.Provider>
  )
}
