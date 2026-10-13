import React, { useEffect, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import {
  getBuilderPageFailure,
  listBuilderAppSettings,
  resetBuilderAppSetting,
  updateBuilderAppSetting,
  uploadBuilderAppSettingFile
} from '../builderApi'

/**
 * The colors, images, files and texts of a Builder app.
 * Every change applies on the next build. `onChanged` runs after each one
 * (the detail reloads its checks); `onPageFailure` gets the error kind when
 * the product, the app or the module is gone.
 */
export const BuilderAppSettings = (props) => {
  const { UIComponent, productId, appId, onChanged, onPageFailure } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [settingsState, setSettingsState] = useState({ loading: true, settings: [], error: false })
  const [savingId, setSavingId] = useState(null)

  const getSettings = async () => {
    setSettingsState(prev => ({ ...prev, loading: true, error: false }))
    const response = await listBuilderAppSettings(ordering, token, productId, appId)
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      setSettingsState({ loading: false, settings: [], error: true })
      return
    }
    setSettingsState({ loading: false, settings: response.result, error: false })
  }

  /** Swaps in the item the API answered and tells the detail. */
  const settle = (settingId, response) => {
    setSavingId(null)
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      return { setting: null, errorCodes: response.errorCodes }
    }
    setSettingsState(prev => ({
      ...prev,
      settings: prev.settings.map(item => item.id === settingId ? { ...item, ...response.result } : item)
    }))
    onChanged && onChanged()
    return { setting: response.result, errorCodes: [] }
  }

  const saveValue = async (settingId, value) => {
    setSavingId(settingId)
    return settle(settingId, await updateBuilderAppSetting(ordering, token, productId, appId, settingId, value))
  }

  const uploadFile = async (settingId, file) => {
    setSavingId(settingId)
    return settle(settingId, await uploadBuilderAppSettingFile(ordering, token, productId, appId, settingId, file))
  }

  const resetSetting = async (settingId) => {
    setSavingId(settingId)
    return settle(settingId, await resetBuilderAppSetting(ordering, token, productId, appId, settingId))
  }

  useEffect(() => {
    if (!token || !productId || !appId) return
    getSettings()
  }, [token, productId, appId, ordering.root])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          settingsState={settingsState}
          savingId={savingId}
          reloadSettings={getSettings}
          saveValue={saveValue}
          uploadFile={uploadFile}
          resetSetting={resetSetting}
        />
      )}
    </>
  )
}
