import React, { useEffect, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import {
  getBuilderPageFailure,
  getBuilderProductPush,
  removeBuilderProductFirebase,
  saveBuilderProductFirebase
} from '../builderApi'

/**
 * The push accounts of a Builder product. They belong to
 * the product's site, not to its app: a site with its own Firebase service
 * account sends the pushes of its devices with it, otherwise the project's
 * goes. Changes apply right away, without a build.
 */
export const BuilderProductPush = (props) => {
  const { UIComponent, productId, onPageFailure } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [pushState, setPushState] = useState({ loading: true, firebase: null, error: false })
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  const getPush = async () => {
    setPushState(prev => ({ ...prev, loading: true, error: false }))
    const response = await getBuilderProductPush(ordering, token, productId)
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      setPushState({ loading: false, firebase: null, error: true })
      return
    }
    setPushState({ loading: false, firebase: response.result?.firebase ?? null, error: false })
  }

  /** Answers `{ ok, errorCodes, source }`; on success the state is the API's answer. */
  const settle = (response) => {
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      return { ok: false, errorCodes: response.errorCodes, source: null }
    }
    const firebase = response.result?.firebase ?? null
    setPushState({ loading: false, firebase, error: false })
    return { ok: true, errorCodes: [], source: firebase?.source ?? null }
  }

  /** `serviceAccount` is the content of the `.json` Firebase downloads, as text. */
  const saveFirebase = async (serviceAccount) => {
    setSaving(true)
    const response = await saveBuilderProductFirebase(ordering, token, productId, serviceAccount)
    setSaving(false)
    return settle(response)
  }

  const removeFirebase = async () => {
    setRemoving(true)
    const response = await removeBuilderProductFirebase(ordering, token, productId)
    setRemoving(false)
    return settle(response)
  }

  useEffect(() => {
    if (!token || !productId) return
    getPush()
  }, [token, productId, ordering.root])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          pushState={pushState}
          reloadPush={getPush}
          saving={saving}
          removing={removing}
          saveFirebase={saveFirebase}
          removeFirebase={removeFirebase}
        />
      )}
    </>
  )
}
