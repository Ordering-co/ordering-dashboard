import React, { useEffect, useState } from 'react'

import { useApi, useLanguage, useSession } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { OrderingWebsite } from '../OrderingWebsite'
import { AppUI } from '../AppUI'
import { addQueryToUrl } from '../../../utils'
import { EmptyState, Skeleton } from '../../Shared/Product'
import '../AppEditor/app-editor.css'

// redesign my-products B2 (D7, M-MP-07): the loader of /my-products/<product>?id=. The request, the `?id=` in the URL and the
// props of both editors are main's. What changes is what it painted when something went wrong:
// - loading is a busy status with a hidden «Loading» (P/Skeleton), not the legacy card skeleton (`SkeletonCard` stays in the folder, P-MP5);
// - an error is an alert with the WHOLE message (main read `result[0]`, and when `result` was a text that was its first letter);
// - a product that is neither an app nor a website says so (main painted a blank page).

const getType = (code) => {
  if (!code) return ''
  return code.includes('app') ? 'app' : code.includes('web') ? 'web' : ''
}

// The message of a failed answer, whatever shape the API gave it (a text, a list of texts or of `{ message }`); '' without text.
const messageOf = (error) => {
  const first = Array.isArray(error) ? error[0] : error
  const raw = first instanceof Error ? first.message : first?.message ?? first
  return typeof raw === 'string' ? raw : ''
}

export const ProductsBuilderList = (props) => {
  props = { ...defaultProps, ...props }
  const { productId, typeApp } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()

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

      setState({
        ...state,
        loading: false,
        error: error ? { message: messageOf(result) } : null,
        app: !error ? result : null,
        typeApp: !error ? getType(result?.base?.code) : null
      })
    } catch (err) {
      setState({
        ...state,
        loading: false,
        error: { message: messageOf(err) }
      })
    }
  }

  useEffect(() => {
    if (productId) {
      addQueryToUrl({ id: productId })
      getProduct(productId)
    }
  }, [productId])

  if (state.loading) {
    return (
      <div className='odc-root odc-ape-frame' role='status' aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <div className='odc-ape-skeleton'>
          <Skeleton size='40%' block='var(--od-x-control-height-lg)' />
          <Skeleton size='70%' />
          <Skeleton block='var(--od-x-control-height)' />
          <Skeleton block='var(--od-x-control-height-lg)' />
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className='odc-root odc-ape-frame'>
        <EmptyState
          tone='error'
          title={t('BUILDER_APP_LOAD_FAILED', "We couldn't open this app")}
          description={translateApiMessage(t, state.error.message, '')}
        />
      </div>
    )
  }

  return (
    <>
      {/* Owner decision 20 B (2026-10-21): it edits the site whose code is the app's code (`base.code`, as AppUI does). main gave
          no `appId`, so the editor stayed in its skeleton (J5-01). */}
      {state.typeApp === 'web' && (
        <OrderingWebsite app={state.app} {...props} appId={state.app?.base?.code} />
      )}
      {state.typeApp === 'app' && (
        <AppUI app={state.app} {...props} />
      )}
      {/* a product that is neither (its code has no `app` and no `web`): main painted nothing */}
      {state.app && state.typeApp !== 'web' && state.typeApp !== 'app' && (
        <div className='odc-root odc-ape-frame'>
          <EmptyState title={t('BUILDER_APP_TYPE_UNSUPPORTED', "This product can't be edited here")} />
        </div>
      )}
    </>
  )
}

const defaultProps = {
  typeApp: ''
}
