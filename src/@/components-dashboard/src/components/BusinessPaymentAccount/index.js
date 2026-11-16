import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const BusinessPaymentAccount = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    businessId
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const token = session?.token

  const isAdmin = session?.user?.level === 0
  const isBusinessOwner = session?.user?.level === 2

  const [accountState, setAccountState] = useState({
    loading: true,
    error: null,
    account: null
  })

  const [methodsState, setMethodsState] = useState({
    loading: true,
    error: null,
    methods: []
  })

  // All existing accounts (for association)
  const [allAccountsState, setAllAccountsState] = useState({
    loading: false,
    error: null,
    accounts: []
  })

  // redesign stores 5.11: the four writes (create, update, associate, dissociate) show no «Loading» Info toast and no Error
  // toast any more: the UI shows the error in line, next to the action. The success toasts and the `{ error, result }` they return stay.
  const [actionState, setActionState] = useState({ loading: false, error: null })

  const getMethods = async () => {
    if (!token) return
    try {
      setMethodsState((prev) => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business_payment_accounts/methods`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        setMethodsState({ loading: false, error: content?.result, methods: [] })
        return
      }
      const methods = Array.isArray(content?.result) ? content.result : []
      setMethodsState({ loading: false, error: null, methods })
    } catch (err) {
      setMethodsState({ loading: false, error: [err?.message || 'Unknown error'], methods: [] })
    }
  }

  const getAccount = async () => {
    if (!token || !businessId) return
    try {
      setAccountState((prev) => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      // an owner asks only for its store's account; only an admin associates one, so only an admin gets the list
      const query = isAdmin ? '' : `?business_id=${businessId}`
      const response = await fetch(`${ordering.root}/business_payment_accounts${query}`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        setAccountState({ loading: false, error: content?.result, account: null })
        return
      }
      const results = Array.isArray(content?.result) ? content.result : []
      const match = results.find(a => a?.businesses?.some(b => b?.id === businessId)) || null
      setAccountState({ loading: false, error: null, account: match })
      // Store all accounts for association feature
      setAllAccountsState({ loading: false, error: null, accounts: isAdmin ? results : [] })
    } catch (err) {
      setAccountState({ loading: false, error: [err?.message || 'Unknown error'], account: null })
    }
  }

  const createAccount = async (changes) => {
    if (!token || !businessId) return

    if (!changes?.paymethod) {
      return { error: true, result: [t('PAYMETHOD_REQUIRED', 'Payment method is required')] }
    }

    try {
      setActionState({ loading: true, error: null })

      const payload = {
        paymethod: changes.paymethod,
        business_id: businessId
      }
      if (changes.name) {
        payload.name = changes.name
      }
      if (changes.data && Object.keys(changes.data).length > 0) {
        payload.data = JSON.stringify(changes.data)
      }

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
      const response = await fetch(`${ordering.root}/business_payment_accounts`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        setActionState({ loading: false, error: content?.result })
        return { error: true, result: content?.result }
      }
      setActionState({ loading: false, error: null })
      setAccountState((prev) => ({ ...prev, account: content?.result }))
      showToast?.(ToastType.Success, t('PAYMENT_ACCOUNT_CREATED', 'Payment account created'))
      return content
    } catch (err) {
      setActionState({ loading: false, error: [err?.message || 'Unknown error'] })
      return { error: true, result: [err?.message || 'Unknown error'] }
    }
  }

  const updateAccount = async (id, changes) => {
    if (!token || !id) return
    // redesign stores 5.11 (B-7): main left here with `undefined`, so the UI left edit mode as if it had saved. The error shape lets it
    // say so and stay in edit.
    if (!isAdmin) return { error: true, result: [t('PAYMENT_ACCOUNT_ADMIN_ONLY', 'Only an administrator can edit the payment account.')] }

    try {
      setActionState({ loading: true, error: null })

      const payload = {}
      if (changes.name !== undefined) {
        payload.name = changes.name
      }
      if (changes.data && Object.keys(changes.data).length > 0) {
        payload.data = JSON.stringify(changes.data)
      }
      if (changes.enabled !== undefined) {
        payload.enabled = changes.enabled
      }

      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
      const response = await fetch(`${ordering.root}/business_payment_accounts/${id}`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        setActionState({ loading: false, error: content?.result })
        return { error: true, result: content?.result }
      }
      setActionState({ loading: false, error: null })
      // Refetch to update both accountState and allAccountsState
      await getAccount()
      showToast?.(ToastType.Success, t('PAYMENT_ACCOUNT_UPDATED', 'Payment account updated'))
      return content
    } catch (err) {
      setActionState({ loading: false, error: [err?.message || 'Unknown error'] })
      return { error: true, result: [err?.message || 'Unknown error'] }
    }
  }

  const associateAccount = async (accountId) => {
    if (!token || !businessId || !accountId) return

    try {
      setActionState({ loading: true, error: null })

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ business_payment_account_id: accountId })
      }
      const response = await fetch(`${ordering.root}/business/${businessId}`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        setActionState({ loading: false, error: content?.result })
        return { error: true, result: content?.result }
      }
      setActionState({ loading: false, error: null })
      // Refetch account to get the full account data
      await getAccount()
      showToast?.(ToastType.Success, t('PAYMENT_ACCOUNT_ASSOCIATED', 'Payment account associated'))
      return content
    } catch (err) {
      setActionState({ loading: false, error: [err?.message || 'Unknown error'] })
      return { error: true, result: [err?.message || 'Unknown error'] }
    }
  }

  const dissociateAccount = async () => {
    if (!token || !businessId) return

    try {
      setActionState({ loading: true, error: null })

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ business_payment_account_id: null })
      }
      const response = await fetch(`${ordering.root}/business/${businessId}`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        setActionState({ loading: false, error: content?.result })
        return { error: true, result: content?.result }
      }
      setActionState({ loading: false, error: null })
      // Refetch to update both accountState (will be null) and allAccountsState (fresh data)
      await getAccount()
      showToast?.(ToastType.Success, t('PAYMENT_ACCOUNT_DISSOCIATED', 'Payment account dissociated'))
      return content
    } catch (err) {
      setActionState({ loading: false, error: [err?.message || 'Unknown error'] })
      return { error: true, result: [err?.message || 'Unknown error'] }
    }
  }

  useEffect(() => {
    if (!token || !businessId) return
    getAccount()
  }, [token, businessId])

  useEffect(() => {
    if (!token) return
    getMethods()
  }, [token])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessId={businessId}
          isAdmin={isAdmin}
          isBusinessOwner={isBusinessOwner}
          accountState={accountState}
          methodsState={methodsState}
          allAccountsState={allAccountsState}
          actionState={actionState}
          createAccount={createAccount}
          updateAccount={updateAccount}
          associateAccount={associateAccount}
          dissociateAccount={dissociateAccount}
          getAccount={getAccount}
          getMethods={getMethods}
        />
      )}
    </>
  )
}

BusinessPaymentAccount.propTypes = {
  UIComponent: PropTypes.elementType,
  businessId: PropTypes.number
}

const defaultProps = {
  businessId: null
}
