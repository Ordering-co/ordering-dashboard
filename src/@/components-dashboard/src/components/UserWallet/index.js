import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const UserWallet = (props) => {
  const {
    UIComponent,
    userId,
    walletType
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [walletState, setWalletState] = useState({ loading: false, wallet: {}, error: null })
  const [walletEventsState, setWalletEventsState] = useState({ loading: false, events: [], error: null })
  const [usersState, setUsersState] = useState({ loading: false, users: [], error: null })

  const [addWalletState, setAddWalletState] = useState({})
  const [reduceWalletState, setReduceWalletState] = useState({})
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Method to get user wallet info from API
   */
  const getUserWallet = async () => {
    try {
      setWalletState({
        ...walletState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'x-app-x': ordering.appId,
          'X-INTERNAL-PRODUCT-X': ordering.appInternalName,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/users/${userId}/wallets`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setWalletState({
          loading: false,
          wallet: content.result.find(wallet => wallet.type === walletType) || {},
          error: null
        })
      } else {
        setWalletState({
          ...walletState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setWalletState({
        ...walletState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to get user wallet events from API
   */
  const getUserWalletHistory = async (walletId) => {
    try {
      setWalletEventsState({
        ...walletEventsState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'x-app-x': ordering.appId,
          'X-Internal-Product-X': ordering.appInternalName,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/users/${userId}/wallets/${walletId}/events?orderBy=-id`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setWalletEventsState({
          loading: false,
          events: content.result,
          error: null
        })
      } else {
        setWalletEventsState({
          ...walletEventsState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setWalletEventsState({
        ...walletEventsState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const getUsers = async (authorIds) => {
    if (!authorIds?.length) return
    try {
      setUsersState((prev) => ({ ...prev, loading: true }))
      const { content: { result, error } } = await ordering
        .setAccessToken(token)
        .users()
        .select(['id', 'name', 'lastname'])
        .where([{ attribute: 'id', value: authorIds }])
        .get()
      if (!error) {
        setUsersState((prev) => {
          const merged = [...prev.users]
          for (const user of result) {
            const idx = merged.findIndex(u => u.id === user.id)
            if (idx >= 0) merged[idx] = user
            else merged.push(user)
          }
          return { loading: false, users: merged, error: null }
        })
      } else {
        setUsersState((prev) => ({ ...prev, loading: false, error: result }))
      }
    } catch (err) {
      setUsersState((prev) => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  /**
   * Method to add wallet money from API
   */
  const handleAddWalletMoney = async () => {
    try {
      setActionState({ loading: true, error: null })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'x-app-x': ordering.appId,
          'X-Internal-Product-X': ordering.appInternalName,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(addWalletState)
      }
      const response = await fetch(`${ordering.root}/users/${userId}/wallets/${walletState.wallet?.id}/events`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setWalletState({
          ...walletState,
          wallet: {
            ...walletState.wallet,
            balance: walletState.wallet?.balance + content.result.amount
          }
        })
        setAddWalletState({})
        setActionState({ loading: false, error: null })
        showToast(ToastType.Success, t('WALLET_MONEY_ADDED', 'Wallet money added'))
      } else {
        setActionState({
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to add wallet money from API
   */
  const handleReduceWalletMoney = async () => {
    try {
      setActionState({ loading: true, error: null })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const params = { ...reduceWalletState }
      params.amount = '-' + reduceWalletState.amount
      const requestOptions = {
        method: 'POST',
        headers: {
          'x-app-x': ordering.appId,
          'X-Internal-Product-X': ordering.appInternalName,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(params)
      }
      const response = await fetch(`${ordering.root}/users/${userId}/wallets/${walletState.wallet?.id}/events`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setWalletState({
          ...walletState,
          wallet: {
            ...walletState.wallet,
            balance: walletState.wallet?.balance + content.result.amount
          }
        })
        setActionState({ loading: false, error: null })
        setReduceWalletState({})
        showToast(ToastType.Success, t('WALLET_MONEY_REDUCED', 'Wallet money reduced'))
      } else {
        setActionState({
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   * @param {Boolean} isAddMoney variable to check if the add mode is or not
   */
  const handleChangeInput = (e, isAddMoney) => {
    if (isAddMoney) {
      setAddWalletState({
        ...addWalletState,
        [e.target.name]: e.target.value
      })
    } else {
      setReduceWalletState({
        ...reduceWalletState,
        [e.target.name]: e.target.value
      })
    }
  }

  /**
   * Method to parse the transaction event
   */
  const parseEvent = (event) => {
    let eventLog = ''
    let author = ''
    const findUser = usersState.users.find(user => user.id === event.author_id)
    if (findUser) {
      author = `${findUser?.name} ${findUser?.lastname}`
    } else {
      author = `${event.author_id}`
    }
    if (event.event_type === 'manual') {
      switch (event.event) {
        case 'movement':
          if (Math.sign(event.amount) === -1) {
            eventLog = t('TRANSACTION_REDUCE_MONEY', '<strong>_user_</strong> reduce money').replace('_user_', `${author}`)
          } else {
            eventLog = t('TRANSACTION_ADD_MONEY', '<strong>_user_</strong> add money').replace('_user_', `${author}`)
          }
          break
        case 'locked':
          eventLog = t('TRANSACTION_LOCKED', '<strong>_user_</strong> locked').replace('_user_', `${author}`)
          break
        case 'unlocked':
          eventLog = t('TRANSACTION_UNLOCKED', '<strong>_user_</strong> unlocked').replace('_user_', `${author}`)
          break
        default:
          eventLog = event.event
          break
      }
    }
    if (event.event_type === 'redeem_gift_card') {
      eventLog = t('REDEEMED_GIFT_CARD', 'Redeemed from the <strong>Gift card</strong>')
    }
    if (event.event_type === 'refund') {
      eventLog = t('REFUND_MONEY', 'Refund money')
    }

    if (event.event_type === 'payment') {
      eventLog = t('PAID_MONEY', 'Paid money')
    }

    return eventLog
  }

  useEffect(() => {
    if (!walletState.wallet?.id) return
    getUserWalletHistory(walletState.wallet.id)
  }, [walletState.wallet?.id, walletState.wallet?.balance])

  useEffect(() => {
    getUserWallet()
  }, [userId])

  useEffect(() => {
    const events = walletEventsState?.events || []
    if (!events.length) return
    const knownIds = new Set(usersState.users.map(u => u.id))
    const missingAuthorIds = [...new Set(
      events
        .map(event => event.author_id)
        .filter(id => id !== null && id !== undefined && !knownIds.has(id))
    )]
    if (missingAuthorIds.length === 0) return
    getUsers(missingAuthorIds)
  }, [walletEventsState?.events])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            walletState={walletState}
            walletEventsState={walletEventsState}
            addWalletState={addWalletState}
            reduceWalletState={reduceWalletState}
            actionState={actionState}
            handleChangeInput={handleChangeInput}
            handleAddWalletMoney={handleAddWalletMoney}
            handleReduceWalletMoney={handleReduceWalletMoney}
            parseEvent={parseEvent}
          />
        )
      }
    </>
  )
}

UserWallet.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
  * This must be contains userId to fetch
  */
  userId: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string
  ])
}
