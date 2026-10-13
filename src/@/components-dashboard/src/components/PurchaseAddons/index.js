import React, { useEffect, useState } from 'react'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

export const PurchaseAddons = (props) => {
  const {
    UIComponent
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [publicAddons, setPublicAddons] = useState({ loading: true, result: [], error: null })
  const [purchasedAddons, setPurchasedAddons] = useState({ loading: true, result: [], error: null })

  const requestBase = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }

  const getAddonsPublic = async () => {
    try {
      setPublicAddons({
        ...publicAddons,
        loading: true
      })
      const response = await fetch(`${ordering.root}/billing/addons/public`, requestBase)
      const { error, result } = await response.json()
      setPublicAddons({
        ...publicAddons,
        loading: false,
        result,
        error
      })
    } catch (err) {
      setPublicAddons({
        ...publicAddons,
        loading: false,
        error: [err?.message]
      })
    }
  }

  const getPurchasedAddons = async () => {
    try {
      setPurchasedAddons({
        ...publicAddons,
        loading: true
      })
      const response = await fetch(`${ordering.root}/billing/products`, requestBase)
      const { error, result } = await response.json()
      setPurchasedAddons({
        ...publicAddons,
        loading: false,
        result: result?.map(addon => addon?.id),
        error
      })
    } catch (err) {
      setPurchasedAddons({
        ...publicAddons,
        loading: false,
        error: [err?.message]
      })
    }
  }

  useEffect(() => {
    Promise.any([getAddonsPublic(), getPurchasedAddons()])
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          publicAddons={publicAddons}
          purchasedAddons={purchasedAddons}
        />
      )}
    </>
  )
}
