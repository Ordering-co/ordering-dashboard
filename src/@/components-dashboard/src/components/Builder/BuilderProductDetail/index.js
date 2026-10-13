import React, { useEffect, useRef, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import {
  getBuilderAdHocInstallUrl,
  getBuilderAppChecks,
  getBuilderErrorKind,
  getBuilderPageFailure,
  getBuilderProduct,
  updateBuilderApp,
  updateBuilderAppPlatform,
  updateBuilderProduct,
  updateBuilderProductStatus
} from '../builderApi'
import { useAppBuilds } from './useAppBuilds'

/** Error kinds that replace the whole page instead of a toast. */
const PAGE_ERROR_KINDS = ['not_found', 'disabled', 'no_access']

/** Statuses whose app shows what the next build would get wrong. */
const CHECKED_STATUSES = ['draft', 'active']

/**
 * One Builder product: the app, its platforms and their builds.
 * Its status changes here, and so do its name, the app and its
 * platforms. Builds are asked for, retried and cancelled here.
 * The checks of the next build load on their own; the `checks` of an
 * activation answer are left out unless it was refused.
 */
export const BuilderProductDetail = (props) => {
  const { UIComponent, productId } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [productState, setProductState] = useState({ loading: true, product: null, errorKind: null })
  const [statusState, setStatusState] = useState({ loading: false, nextStatus: null })
  const [checksState, setChecksState] = useState({ loading: false, checks: null, error: false })
  const checksRequest = useRef(0)

  const product = productState.product
  const app = product?.apps?.[0] ?? null
  const checksEnabled = !!app && CHECKED_STATUSES.includes(product?.product_status)

  const getProduct = async () => {
    setProductState(prev => ({ ...prev, loading: true }))
    const response = await getBuilderProduct(ordering, token, productId)
    if (response.error) {
      setProductState({ loading: false, product: null, errorKind: getBuilderErrorKind(response) })
      return
    }
    setProductState({ loading: false, product: response.result, errorKind: null })
  }

  /** Replaces the page when the product, the app or the module is gone. */
  const failPage = (errorKind) => {
    setProductState({ loading: false, product: null, errorKind })
  }

  const builds = useAppBuilds({ productId, appId: app?.id, enabled: !!app, onPageFailure: failPage })

  const getChecks = async () => {
    if (!checksEnabled) return
    const requestId = ++checksRequest.current
    setChecksState(prev => ({ ...prev, loading: true, error: false }))
    const response = await getBuilderAppChecks(ordering, token, productId, app.id)
    if (requestId !== checksRequest.current) return
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) failPage(pageFailure)
      setChecksState({ loading: false, checks: null, error: true })
      return
    }
    setChecksState({ loading: false, checks: response.result, error: false })
  }

  /**
   * Returns `{ product, errorKind, checks }`. A missing product or a disabled
   * module replaces the page; any other failure is left to the caller. When
   * activating is refused because something is missing
   * (`product.incomplete`), `errorKind` is `incomplete`, `checks` says what
   * each app misses and `missing` what the product itself misses (a
   * website's `name`).
   */
  const changeStatus = async (productStatus) => {
    setStatusState({ loading: true, nextStatus: productStatus })
    const response = await updateBuilderProductStatus(ordering, token, productId, productStatus)
    setStatusState({ loading: false, nextStatus: null })
    if (response.error) {
      if (response.errorCodes.includes('product.incomplete')) {
        getChecks()
        return {
          product: null,
          errorKind: 'incomplete',
          checks: Array.isArray(response.checks) ? response.checks : [],
          missing: Array.isArray(response.missing) ? response.missing : []
        }
      }
      const errorKind = getBuilderErrorKind(response)
      if (PAGE_ERROR_KINDS.includes(errorKind)) {
        setProductState({ loading: false, product: null, errorKind })
      }
      return { product: null, errorKind, checks: null }
    }
    const { checks, ...updated } = response.result || {}
    const next = { ...productState.product, ...updated }
    setProductState({ loading: false, product: next, errorKind: null })
    return { product: next, errorKind: null, checks: null }
  }

  /** Answers `{ ok, errorCodes }`, after replacing the page if it has to. */
  const settle = (response) => {
    if (!response.error) return { ok: true, errorCodes: [] }
    const pageFailure = getBuilderPageFailure(response)
    if (pageFailure) failPage(pageFailure)
    return { ok: false, errorCodes: response.errorCodes }
  }

  /** After a saved change to the app: what the next build needs, and whether it is behind. */
  const handleAppChanged = () => {
    getChecks()
    builds.noteConfigChanged()
  }

  /** The product's name (the site). Applies right away. */
  const renameProduct = async (name) => {
    const response = await updateBuilderProduct(ordering, token, productId, { name })
    const answer = settle(response)
    if (answer.ok) {
      const { apps, ...updated } = response.result || {}
      setProductState(prev => ({ ...prev, product: { ...prev.product, ...updated } }))
    }
    return answer
  }

  /** Keeps the app's base and builds, which the edit answers leave out. */
  const mergeApp = (updatedApp) => {
    setProductState(prev => {
      const apps = prev.product?.apps || []
      return {
        ...prev,
        product: {
          ...prev.product,
          apps: apps.map((item, index) => index === 0 ? { ...item, ...updatedApp } : item)
        }
      }
    })
  }

  /** The app's name in the stores, description, version and package. */
  const updateApp = async (fields) => {
    const response = await updateBuilderApp(ordering, token, productId, app.id, fields)
    const answer = settle(response)
    if (answer.ok) {
      mergeApp(response.result)
      handleAppChanged()
    }
    return answer
  }

  /** The same fields for one platform; null takes the app's value again. */
  const updatePlatform = async (platform, fields) => {
    const response = await updateBuilderAppPlatform(ordering, token, productId, app.id, platform, fields)
    const answer = settle(response)
    if (answer.ok) {
      mergeApp(response.result)
      handleAppChanged()
    }
    return answer
  }

  useEffect(() => {
    if (!token || !productId) return
    getProduct()
  }, [token, productId, ordering.root])

  useEffect(() => {
    if (!checksEnabled) {
      checksRequest.current++
      setChecksState({ loading: false, checks: null, error: false })
      return
    }
    getChecks()
  }, [checksEnabled, app?.id])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          productState={productState}
          reloadProduct={getProduct}
          statusState={statusState}
          changeStatus={changeStatus}
          checksState={checksState}
          checksEnabled={checksEnabled}
          reloadChecks={getChecks}
          onAppChanged={handleAppChanged}
          latestBuildsState={builds.latestState}
          reloadLatestBuilds={builds.reloadLatest}
          buildsHistoryVersion={builds.historyVersion}
          requestBuild={builds.requestBuild}
          retryBuild={builds.retryBuild}
          cancelBuild={builds.cancelBuild}
          getBuildLog={builds.getBuildLog}
          getBuildDownload={builds.getBuildDownload}
          adHocInstallUrl={app ? getBuilderAdHocInstallUrl(ordering, app.id) : null}
          renameProduct={renameProduct}
          updateApp={updateApp}
          updatePlatform={updatePlatform}
          failPage={failPage}
        />
      )}
    </>
  )
}
