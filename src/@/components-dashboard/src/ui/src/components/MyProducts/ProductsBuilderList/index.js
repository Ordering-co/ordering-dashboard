import React, { useEffect, useState } from 'react'

import { useApi, useSession } from '../../../../../index'
import { OrderingWebsite } from '../OrderingWebsite'
import { AppUI } from '../AppUI'
import { addQueryToUrl } from '../../../utils'
import { SkeletonCard } from './SkeletonCard'

export const ProductsBuilderList = (props) => {
  props = { ...defaultProps, ...props }
  const { productId, typeApp } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [state, setState] = useState({ loading: !typeApp, typeApp, error: null, app: null })

  const getProduct = async (productId) => {
    try {
      setState({ ...state, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/builder/apps/${productId}`, requestOptions)
      const { error, result } = await response.json()

      const getType = (code) => {
        if (!code) return ''
        return code.includes('app') ? 'app' : code.includes('web') ? 'web' : ''
      }

      setState({
        ...state,
        loading: false,
        error: error ? result[0] : null,
        app: !error ? result : null,
        typeApp: !error ? getType(result?.base?.code) : null
      })
    } catch (err) {
      setState({
        ...state,
        loading: false,
        error: err?.message ?? err
      })
    }
  }

  useEffect(() => {
    if (productId) {
      addQueryToUrl({ id: productId })
      getProduct(productId)
    }
  }, [productId])

  return (
    state.loading
      ? (<SkeletonCard />)
      : (
        <>
          {state.error && (
            <div>{state.error}</div>
          )}
          {state.typeApp === 'web' && !state.error && (
            <OrderingWebsite app={state.app} {...props} />
          )}
          {state.typeApp === 'app' && !state.error && (
            <AppUI app={state.app} {...props} />
          )}
        </>)
  )
}

const defaultProps = {
  typeApp: ''
}
