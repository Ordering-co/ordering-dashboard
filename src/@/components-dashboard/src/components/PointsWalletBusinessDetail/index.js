import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useConfig } from '../../contexts/ConfigContext'

export const PointsWalletBusinessDetail = (props) => {
  const {
    UIComponent,
    walletData,
    handleUpdateWalletBusiness,
    handleUpdateBusinessList,
    handleUpdatePointsWallet,
    isBusiness,
    selectedBusinessList
  } = props

  const [ordering] = useApi()
  const [{ token, loading }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [{ configs }, { refreshConfigs }] = useConfig()
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  const [formStateConfigs, setFormStateConfigs] = useState({ loading: false, changes: [], error: null })
  const pointsWalletconfigs = [
    configs?.refund_credit_point_allow_when_order_cancelled,
    configs?.refund_cash_wallet_allow_when_order_cancelled,
    configs?.refund_stripe_allow_when_order_cancelled,
    configs?.refund_other_allow_when_order_cancelled
  ]

  /**
   * Update loyalty business data
   * @param {EventTarget} evt Related HTML event
   */
  const handleChangeInput = (evt) => {
    const value = evt.target.value
    setFormState({ ...formState, changes: { ...formState.changes, [evt.target.name]: value } })
  }

  /**
   * Update loyalty business data
   */
  const handleChangeItem = (changes) => {
    setFormState({ ...formState, changes: { ...formState.changes, ...changes } })
  }

  const handleClickSubmit = async () => {
    if (Object.keys(formStateConfigs?.changes).length > 0) {
      formStateConfigs?.changes?.map(async change => {
        const params = { key: change.key, value: change.value }
        await saveConfig(change?.id, params)
      })
      await refreshConfigs && refreshConfigs()
    }
    if (Object.keys(formState?.changes).length === 0) return

    if (walletData) updateLoyalty(walletData?.id, formState?.changes)
    else {
      const filteredBusiness = selectedBusinessList.filter(business => business.wallet_enabled).map(business => {
        return {
          id: business.id,
          redeems: business?.redeems || false,
          accumulates: business?.accumulates || false
        }
      })
      const loyaltyPlan = {
        name: 'Loyalty Point Plan',
        type: 'credit_point',
        redemption_rate: null,
        accumulation_rate: null,
        businesses: JSON.stringify(filteredBusiness),
        ...formState?.changes
      }
      addLoyaltyPlan(loyaltyPlan)
    }
  }

  /**
   * @param { Number } businessId id of loyalty business
   * @param {Object} changes data of business
   */
  const updateLoyalty = async (businessId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      if (changes?.maximum_accumulation === '') {
        changes.maximum_accumulation = null
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const fetchEndpoint = isBusiness
        ? `${ordering.root}/loyalty_plans/${walletData?.loyalty_plan_id}/businesses/${businessId}`
        : `${ordering.root}/loyalty_plans/${walletData?.id}`
      const response = await fetch(fetchEndpoint, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('POINTS_WALLET_UPDATED', 'Points wallet updated'))
        setFormState({ ...formState, loading: false, error: null, changes: {} })
        handleUpdateWalletBusiness && handleUpdateWalletBusiness(result)
        handleUpdateBusinessList && handleUpdateBusinessList(changes)
        if (!isBusiness && handleUpdatePointsWallet) handleUpdatePointsWallet(result)
      } else {
        setFormState({ ...formState, loading: false, error: result })
      }
    } catch (error) {
      setFormState({ ...formState, loading: false, error: error.message })
    }
  }

  /**
   * @param { Number } businessId id of loyalty business
   * @param {Object} changes data of business
   */
  const addLoyaltyPlan = async (changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const fetchEndpoint = `${ordering.root}/loyalty_plans`
      const response = await fetch(fetchEndpoint, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('POINTS_WALLET_CREATED', 'Points wallet created'))
        setFormState({ ...formState, loading: false, error: null, changes: {} })
        if (!isBusiness && handleUpdatePointsWallet) handleUpdatePointsWallet(result)
      } else {
        setFormState({ ...formState, loading: false, error: result })
      }
    } catch (error) {
      setFormState({ ...formState, loading: false, error: error.message })
    }
  }

  const saveChanges = (changeValue, id) => {
    let _configs = []
    const found = formStateConfigs?.changes?.find?.(item => item.id === id)
    if (found) {
      _configs = formStateConfigs?.changes?.map?.(config => (config.id === id) ? { ...config, value: changeValue } : config)
    } else {
      _configs = formStateConfigs?.changes || []
      const config = pointsWalletconfigs.find(_config => _config?.id === id)
      _configs.push({ ...config, value: changeValue })
    }

    setFormStateConfigs({
      ...formStateConfigs,
      changes: [
        ..._configs
      ]
    })
  }

  const saveConfig = async (id, params) => {
    if (loading) return
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const { content: { error, result } } = await ordering.setAccessToken(token).configs(id).save(params)
      if (!error) {
        const changes = formStateConfigs?.changes ? formStateConfigs?.changes?.filter(item => item.id !== result.id) : []
        showToast(ToastType.Success, t('SETTINGS_UPDATE', 'Settings updated'))
        if (changes.length === 0) {
          refreshConfigs && refreshConfigs()
        }
      } else {
        showToast(ToastType.Error, t('SETTINGS_UPDATE_FAILED', 'Settings update has failed'))
      }
    } catch (err) {
      showToast(ToastType.Error, t('SETTINGS_UPDATE_FAILED', 'Settings update has failed'))
    }
  }

  useEffect(() => {
    setFormState({ ...formState, changes: {} })
    setFormStateConfigs({ ...formStateConfigs, changes: [] })
  }, [walletData])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          formStateConfigs={formStateConfigs}
          setFormState={setFormState}
          handleClickSubmit={handleClickSubmit}
          handleChangeInput={handleChangeInput}
          handleChangeItem={handleChangeItem}
          saveChanges={saveChanges}
        />
      )}
    </>
  )
}

PointsWalletBusinessDetail.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * walletData, this must be contains an object
   */
  walletData: PropTypes.object,
  /**
   * Function to update wallet business
   */
  handleUpdateWalletBusiness: PropTypes.func,
  /**
   * Function to update business list
   */
  handleUpdateBusinessList: PropTypes.func,
  /**
   * Function to update points wallet
   */
  handleUpdatePointsWallet: PropTypes.func,
  /**
   * isBusiness, flag to check business
   */
  isBusiness: PropTypes.bool,
  /**
   * Array of business props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}
