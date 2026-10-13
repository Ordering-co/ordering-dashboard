import React, { useState } from 'react'
import { RewardsPrograms as RewardsProgramsController, useLanguage } from '../../../../../index'
import { PointsWalletBusinessDetail } from '../../Loyalty/PointsWalletBusinessDetail'
import { PointsWalletBusinessList } from '../../Loyalty/PointsWalletBusinessList'
import { PointsWalletLevels } from '../../Loyalty/PointsWalletLevels'
import { SettingsList } from '../SettingsList'
import {
  EmbeddedLevels,
  EmbeddedWalletForm,
  LoyaltyBlock,
  LoyaltyBlockHelp,
  LoyaltyCard,
  LoyaltyCardHeader,
  LoyaltyCardHelp,
  LoyaltyCardTitle,
  LoyaltyStack,
  LoyaltyTab,
  LoyaltyTabs
} from './styles'

const SettingsLoyaltyStoresUI = (props) => {
  const {
    type,
    category,
    pointWallet,
    loyaltyPlanList,
    handleUpdatePointsWallet
  } = props
  const [, t] = useLanguage()
  const [selectedBusinessList, setSelectedBusinessList] = useState([])
  const [walletTab, setWalletTab] = useState('general')
  const isPointsWallet = type === 'credit_point'
  const isLoading = !!loyaltyPlanList?.loading

  return (
    <LoyaltyStack>
      <LoyaltyCard>
        <LoyaltyCardHeader>
          <LoyaltyCardTitle>
            {isPointsWallet
              ? t('POINTS_WALLET', 'Points wallet')
              : t('CASH_WALLET', 'Cash wallet')}
          </LoyaltyCardTitle>
          <LoyaltyCardHelp>
            {isPointsWallet
              ? t('POINTS_WALLET_DESCRIPTION', 'Points wallet general and per business setup.')
              : t('CASH_WALLET_DESCRIPTION', 'Cash wallet general and per business setup.')}
          </LoyaltyCardHelp>
        </LoyaltyCardHeader>

        <LoyaltyTabs role='tablist' aria-label={t('POINTS_WALLET', 'Points wallet')}>
          <LoyaltyTab
            type='button'
            role='tab'
            active={walletTab === 'general'}
            aria-selected={walletTab === 'general'}
            onClick={() => setWalletTab('general')}
          >
            {t('SETTINGS_LOYALTY_GENERAL', 'Defaults for all businesses')}
          </LoyaltyTab>
          <LoyaltyTab
            type='button'
            role='tab'
            active={walletTab === 'businesses'}
            aria-selected={walletTab === 'businesses'}
            onClick={() => setWalletTab('businesses')}
          >
            {t('SETTINGS_LOYALTY_PER_STORE', 'Per-store wallet rules')}
          </LoyaltyTab>
        </LoyaltyTabs>

        {walletTab === 'general' && (
          <LoyaltyBlock>
            <LoyaltyBlockHelp>
              {t('SETTINGS_LOYALTY_GENERAL_HELP', 'These values apply to every store unless a store has its own rules.')}
            </LoyaltyBlockHelp>
            {!isLoading && (
              <EmbeddedWalletForm>
                <PointsWalletBusinessDetail
                  loyaltyPlanList={loyaltyPlanList}
                  walletData={pointWallet}
                  handleUpdatePointsWallet={handleUpdatePointsWallet}
                  selectedBusinessList={selectedBusinessList}
                  hideName
                />
              </EmbeddedWalletForm>
            )}
          </LoyaltyBlock>
        )}

        {walletTab === 'businesses' && (
          <LoyaltyBlock>
            <LoyaltyBlockHelp>
              {t('SETTINGS_LOYALTY_PER_STORE_HELP', 'Set wallet rules for each store.')}
            </LoyaltyBlockHelp>
            <PointsWalletBusinessList
              {...props}
              setSelectedBusinessList={setSelectedBusinessList}
              handleParentSidebarMove={() => {}}
              isCloseBusinessDetails={false}
            />
          </LoyaltyBlock>
        )}
      </LoyaltyCard>

      {isPointsWallet && (
        <LoyaltyCard>
          <LoyaltyCardHeader>
            <LoyaltyCardTitle>{t('LEVELS', 'Levels')}</LoyaltyCardTitle>
            <LoyaltyCardHelp>
              {t('LEVELS_DESCRIPTION', 'Setup different loyalty levels for your users.')}
            </LoyaltyCardHelp>
          </LoyaltyCardHeader>
          <EmbeddedLevels>
            <PointsWalletLevels handleParentSidebarMove={() => {}} />
          </EmbeddedLevels>
        </LoyaltyCard>
      )}

      {category && (
        <LoyaltyCard>
          <LoyaltyCardHeader>
            <LoyaltyCardTitle>
              {isPointsWallet
                ? t('SETTINGS_LOYALTY_ADDON', 'Loyalty points & levels addon')
                : t('SETTINGS_LOYALTY_CASH_ADDON', 'Cash wallet addon')}
            </LoyaltyCardTitle>
            <LoyaltyCardHelp>
              {isPointsWallet
                ? t('SETTINGS_LOYALTY_ADDON_HELP', 'Turn the addon on and set program options.')
                : t('SETTINGS_LOYALTY_CASH_ADDON_HELP', 'Turn the addon on and set cash wallet options.')}
            </LoyaltyCardHelp>
          </LoyaltyCardHeader>
          <SettingsList category={category} onCloseSettingsList={() => null} isRemoveGeneralTitle />
        </LoyaltyCard>
      )}
    </LoyaltyStack>
  )
}

export const SettingsLoyaltyStores = (props) => (
  <RewardsProgramsController
    {...props}
    UIComponent={SettingsLoyaltyStoresUI}
  />
)
