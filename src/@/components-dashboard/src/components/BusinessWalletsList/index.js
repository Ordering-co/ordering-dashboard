import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const BusinessWalletsList = (props) => {
  const {
    UIComponent,
    business,
    handleSuccessUpdate
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [walletsListState, setWalletsListState] = useState({ wallets: business?.configs || [], loading: false, error: null })
  const [loyaltyPlanState, setLoyaltyPlanState] = useState({ loading: true, created: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  const getWalletsList = async () => {
    try {
      setWalletsListState({ ...walletsListState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/configs`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setWalletsListState({
          ...walletsListState,
          loading: false,
          wallets: content.result
        })
      } else {
        setWalletsListState({ ...walletsListState, loading: false, error: content.result })
      }
    } catch (err) {
      setWalletsListState({
        ...walletsListState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const getLoyaltyPlans = async () => {
    try {
      setLoyaltyPlanState({ ...loyaltyPlanState, loading: true })
      const reqLoyalty = await fetch(
        `${ordering.root}/loyalty_plans`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      )
      const content = await reqLoyalty.json()
      if (!content.error) {
        const loyaltyPlan = content.result.find(plan => plan.type === 'credit_point')
        if (loyaltyPlan) {
          const found = loyaltyPlan.businesses.find(_buiness => _buiness.business_id === business.id)
          setLoyaltyPlanState({
            ...loyaltyPlanState,
            loading: false,
            created: !!found
          })
        } else {
          setLoyaltyPlanState({
            ...loyaltyPlanState,
            loading: false,
            created: false
          })
        }
      } else {
        setLoyaltyPlanState({
          ...loyaltyPlanState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setLoyaltyPlanState({
        ...loyaltyPlanState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleUpdateWallet = async (walletId, params) => {
    try {
      setActionState({ ...actionState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(params)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/configs/${walletId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ loading: false, error: null })
        const _wallets = walletsListState.wallets.map(wallet => {
          if (wallet.id === content.result?.id) return content.result
          return wallet
        })
        setWalletsListState({ ...walletsListState, wallets: _wallets })
        handleSuccessUpdate && handleSuccessUpdate({ ...business, configs: _wallets })
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      } else {
        setActionState({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
    }
  }

  useEffect(() => {
    if (loyaltyPlanState?.loading) {
      getLoyaltyPlans()
    }
    if (business?.configs) return
    getWalletsList()
  }, [business?.configs])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            loyaltyPlanState={loyaltyPlanState}
            walletsListState={walletsListState}
            actionState={actionState}
            handleUpdateWallet={handleUpdateWallet}
          />
        )
      }
    </>
  )
}

BusinessWalletsList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
