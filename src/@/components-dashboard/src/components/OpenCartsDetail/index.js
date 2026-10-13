import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const OpenCartsDetail = (props) => {
  const {
    cart,
    UIComponent,
    handleSuccessDeleteCart
  } = props

  const [, t] = useLanguage()
  const [{ token }] = useSession()
  const [ordering] = useApi()
  const [, { showToast }] = useToast()

  const [cartState, setCartState] = useState({ cart: null, loading: false, error: null })
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null })

  const getCartList = async () => {
    try {
      setCartState({ ...cartState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const fetchEndpoint = `${ordering.root}/carts/${cart?.uuid}?user_id=${cart?.user_id}`

      const response = await fetch(fetchEndpoint, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const _cart = {
          ...content.result,
          id: cart?.id,
          business: { ...content.result.business, ...cart?.business },
          user: { ...cart?.user, ...(cart?.address?.address && { address: cart.address.address }) },
          updated_at: cart?.updated_at
        }
        setCartState({
          loading: false,
          cart: _cart,
          error: null
        })
      } else {
        setCartState({
          ...cartState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setCartState({
        ...cartState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to delete order from API
   */
  const handleDeleteCart = async (cart) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: cart.user_id,
          uuid: cart.uuid
        })
      }

      const response = await fetch(`${ordering.root}/carts/clear`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        showToast(ToastType.Success, t('CART_DELETED', 'Cart deleted'))
        handleSuccessDeleteCart && handleSuccessDeleteCart(cartState.cart)
        props.onClose && props.onClose()
      }
      setActionStatus({
        loading: false,
        error: content.error ? content.result : null
      })
    } catch (err) {
      setActionStatus({ loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    if (!cart) return
    getCartList()
  }, [cart])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          actionStatus={actionStatus}
          cartState={cartState}
          handleDeleteCart={handleDeleteCart}
        />
      )}
    </>
  )
}

OpenCartsDetail.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * This must be contains cartId to fetch
   */
  cartId: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string
  ]),
  /**
   * Order, this must be contains an object with all order info
   */
  order: PropTypes.object
}
