import React, { useEffect, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import { getBuilderAppCredentials, getBuilderPageFailure, saveBuilderAppCredentials } from '../builderApi'

/**
 * The signing credentials of a Builder app, only for the
 * platforms its base builds. Passwords and files are written and never read
 * back: the API answers `has_*` and `complete`.
 */
export const BuilderAppCredentials = (props) => {
  const { UIComponent, productId, appId, onChanged, onPageFailure } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [credentialsState, setCredentialsState] = useState({ loading: true, credentials: null, error: false })
  const [savingPlatform, setSavingPlatform] = useState(null)

  const getCredentials = async () => {
    setCredentialsState(prev => ({ ...prev, loading: true, error: false }))
    const response = await getBuilderAppCredentials(ordering, token, productId, appId)
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      setCredentialsState({ loading: false, credentials: null, error: true })
      return
    }
    setCredentialsState({ loading: false, credentials: response.result, error: false })
  }

  /** Sends only what changed; what isn't sent stays as it was. */
  const saveCredentials = async (platform, fields) => {
    setSavingPlatform(platform)
    const response = await saveBuilderAppCredentials(ordering, token, productId, appId, platform, fields)
    setSavingPlatform(null)
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      return { credentials: null, errorCodes: response.errorCodes }
    }
    setCredentialsState({ loading: false, credentials: response.result, error: false })
    onChanged && onChanged()
    return { credentials: response.result, errorCodes: [] }
  }

  useEffect(() => {
    if (!token || !productId || !appId) return
    getCredentials()
  }, [token, productId, appId, ordering.root])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          credentialsState={credentialsState}
          savingPlatform={savingPlatform}
          reloadCredentials={getCredentials}
          saveCredentials={saveCredentials}
        />
      )}
    </>
  )
}
