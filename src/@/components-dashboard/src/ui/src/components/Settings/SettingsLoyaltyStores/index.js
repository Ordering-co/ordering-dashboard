import React, { useEffect, useState } from 'react'
import { RewardsPrograms as RewardsProgramsController, useLanguage } from '../../../../../index'
import { PointsWalletBusinessDetail } from '../../Loyalty/PointsWalletBusinessDetail'
import { PointsWalletBusinessList } from '../../Loyalty/PointsWalletBusinessList'
import { PointsWalletLevels } from '../../Loyalty/PointsWalletLevels'
import { SettingsList } from '../SettingsList'
import { useHubFormReport } from '../SettingsHubForm/useHubFormReport'
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
    focus,
    pointWallet,
    loyaltyPlanList,
    handleUpdatePointsWallet
  } = props
  const [, t] = useLanguage()
  const [selectedBusinessList, setSelectedBusinessList] = useState([])
  const [walletTab, setWalletTab] = useState('general')
  const isPointsWallet = type === 'credit_point'
  const isLoading = !!loyaltyPlanList?.loading

  // (owner decision 17): the wallet form keeps its changes inside PointsWalletBusinessDetail, so the hub guard
  // learns of them here, from the input events that bubble up to the form's wrapper: a field is dirty while its value
  // differs from the saved wallet. The form drops its changes when the wallet changes (save) or when it unmounts (tab, loading),
  // and so do these. The key is not the category's: the addon list below reports under that one.
  const [changedFields, setChangedFields] = useState({})
  useEffect(() => { setChangedFields({}) }, [pointWallet, walletTab, isLoading])
  const handleWalletFieldChange = (event) => {
    const { name, value } = event.target || {}
    if (!name) return
    const changed = String(value ?? '') !== String(pointWallet?.[name] ?? '')
    setChangedFields(prev => (!!prev[name] === changed ? prev : { ...prev, [name]: changed }))
  }
  useHubFormReport(`${category?.key || type}:wallet`, {
    dirty: Object.values(changedFields).some(Boolean),
    saving: false
  })

  // (R9 leftovers of ): the open store rules and the open level keep their changes in their own
  // screens and tell the hub through `onDirtyChange`, each under its own key. Both drop their changes when the screen
  // that holds them closes or unmounts (tab, close, save).
  const [storeRulesDirty, setStoreRulesDirty] = useState(false)
  useEffect(() => { setStoreRulesDirty(false) }, [walletTab])
  useHubFormReport(`${category?.key || type}:store-rules`, { dirty: storeRulesDirty, saving: false })
  const [levelDirty, setLevelDirty] = useState(false)
  useHubFormReport(`${category?.key || type}:levels`, { dirty: levelDirty, saving: false })

  return (
    <LoyaltyStack>
      <LoyaltyCard>
        <LoyaltyCardHeader>
          <LoyaltyCardTitle>
            {isPointsWallet
              ? t('POINTS_WALLET', 'Points wallet')
              : t('CASH_WALLET_NAME', 'Cash wallet')}
          </LoyaltyCardTitle>
          <LoyaltyCardHelp>
            {isPointsWallet
              ? t('POINTS_WALLET_DESCRIPTION', 'Points wallet general and per business setup.')
              : t('CASH_WALLET_DESCRIPTION', 'Cash wallet general and per business setup.')}
          </LoyaltyCardHelp>
        </LoyaltyCardHeader>

        <LoyaltyTabs role='tablist' aria-label={isPointsWallet ? t('POINTS_WALLET', 'Points wallet') : t('CASH_WALLET_NAME', 'Cash wallet')}>
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
              <EmbeddedWalletForm onChange={handleWalletFieldChange}>
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
              onDirtyChange={setStoreRulesDirty}
            />
          </LoyaltyBlock>
        )}
      </LoyaltyCard>

      {isPointsWallet && (
        <LoyaltyCard>
          <LoyaltyCardHeader>
            <LoyaltyCardTitle>{t('LEVELS', 'Levels')}</LoyaltyCardTitle>
            <LoyaltyCardHelp>
              {t('LOYALTY_LEVELS_DESCRIPTION', 'Set up different loyalty levels for your users.')}
            </LoyaltyCardHelp>
          </LoyaltyCardHeader>
          <EmbeddedLevels>
            <PointsWalletLevels handleParentSidebarMove={() => {}} onDirtyChange={setLevelDirty} />
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
          <SettingsList category={category} onCloseSettingsList={() => null} isRemoveGeneralTitle focus={focus} />
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
