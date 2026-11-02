import React, { useEffect, useRef, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import {
  activateBuilderTheme,
  createBuilderTheme,
  deleteBuilderTheme,
  getBuilderPageFailure,
  listBuilderThemePresets,
  listBuilderThemes
} from '../builderApi'

/**
 * The saved themes of a Builder website (themes v2): up to
 * BUILDER_THEMES_MAX, one of them active. A new theme starts inactive,
 * from scratch, from the current one or from a preset of the catalog.
 */
export const BuilderProductThemes = (props) => {
  const { UIComponent, productId, onPageFailure } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [themesState, setThemesState] = useState({ loading: true, themes: [], error: false })
  const [presetsState, setPresetsState] = useState({ loading: false, loaded: false, presets: [], error: false })
  const [themeAction, setThemeAction] = useState(null)
  const listRequest = useRef(0)

  const failPage = (response) => {
    const pageFailure = getBuilderPageFailure(response)
    if (pageFailure) onPageFailure && onPageFailure(pageFailure)
  }

  const getThemes = async ({ silent = false } = {}) => {
    const requestId = ++listRequest.current
    if (!silent) setThemesState(prev => ({ ...prev, loading: true, error: false }))
    const response = await listBuilderThemes(ordering, token, productId)
    if (requestId !== listRequest.current) return
    if (response.error) {
      failPage(response)
      if (!silent) setThemesState({ loading: false, themes: [], error: true })
      return
    }
    setThemesState({ loading: false, themes: Array.isArray(response.result) ? response.result : [], error: false })
  }

  /** Read once, when the create panel opens. */
  const getPresets = async () => {
    if (presetsState.loading || presetsState.loaded) return
    setPresetsState(prev => ({ ...prev, loading: true, error: false }))
    const response = await listBuilderThemePresets(ordering, token, productId)
    if (response.error) {
      failPage(response)
      setPresetsState({ loading: false, loaded: false, presets: [], error: true })
      return
    }
    setPresetsState({ loading: false, loaded: true, presets: Array.isArray(response.result) ? response.result : [], error: false })
  }

  /** Answers `{ ok, errorCodes, theme }`; the list is read again after a change. */
  const run = async (action, call) => {
    setThemeAction(action)
    const response = await call()
    setThemeAction(null)
    if (response.error) {
      failPage(response)
      return { ok: false, errorCodes: response.errorCodes, theme: null }
    }
    getThemes({ silent: true })
    return { ok: true, errorCodes: [], theme: response.result ?? null }
  }

  /** `{ name, source: blank | current | preset, presetId }` */
  const createTheme = (fields) =>
    run({ type: 'create' }, () => createBuilderTheme(ordering, token, productId, fields))

  const activateTheme = (themeId) =>
    run({ type: 'activate', themeId }, () => activateBuilderTheme(ordering, token, productId, themeId))

  const deleteTheme = (themeId) =>
    run({ type: 'delete', themeId }, () => deleteBuilderTheme(ordering, token, productId, themeId))

  useEffect(() => {
    if (!token || !productId) return
    getThemes()
  }, [token, productId, ordering.root])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          themesState={themesState}
          presetsState={presetsState}
          themeAction={themeAction}
          reloadThemes={getThemes}
          getPresets={getPresets}
          createTheme={createTheme}
          activateTheme={activateTheme}
          deleteTheme={deleteTheme}
        />
      )}
    </>
  )
}
