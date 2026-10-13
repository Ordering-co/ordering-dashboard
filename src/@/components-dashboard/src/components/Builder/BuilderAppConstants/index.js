import React, { useEffect, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import {
  getBuilderPageFailure,
  listBuilderAppConstants,
  resetBuilderAppConstant,
  updateBuilderAppConstant
} from '../builderApi'

/**
 * The constants of a Builder app: keys and switches like
 * Google Maps or Show tutorials. Each change applies on the next build.
 */
export const BuilderAppConstants = (props) => {
  const { UIComponent, productId, appId, onChanged, onPageFailure } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [constantsState, setConstantsState] = useState({ loading: true, constants: [], error: false })
  const [savingId, setSavingId] = useState(null)

  const getConstants = async () => {
    setConstantsState(prev => ({ ...prev, loading: true, error: false }))
    const response = await listBuilderAppConstants(ordering, token, productId, appId)
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      setConstantsState({ loading: false, constants: [], error: true })
      return
    }
    setConstantsState({ loading: false, constants: response.result, error: false })
  }

  const settle = (constantId, response) => {
    setSavingId(null)
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      return { constant: null, errorCodes: response.errorCodes }
    }
    setConstantsState(prev => ({
      ...prev,
      constants: prev.constants.map(item => item.id === constantId ? { ...item, ...response.result } : item)
    }))
    onChanged && onChanged()
    return { constant: response.result, errorCodes: [] }
  }

  const saveConstant = async (constantId, value) => {
    setSavingId(constantId)
    return settle(constantId, await updateBuilderAppConstant(ordering, token, productId, appId, constantId, value))
  }

  const resetConstant = async (constantId) => {
    setSavingId(constantId)
    return settle(constantId, await resetBuilderAppConstant(ordering, token, productId, appId, constantId))
  }

  useEffect(() => {
    if (!token || !productId || !appId) return
    getConstants()
  }, [token, productId, appId, ordering.root])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          constantsState={constantsState}
          savingId={savingId}
          reloadConstants={getConstants}
          saveConstant={saveConstant}
          resetConstant={resetConstant}
        />
      )}
    </>
  )
}
