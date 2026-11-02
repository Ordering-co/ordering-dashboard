import React, { useEffect, useRef, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import {
  discardBuilderThemeDraft,
  getBuilderPageFailure,
  getBuilderTheme,
  getBuilderThemeSchema,
  publishBuilderTheme,
  renameBuilderTheme,
  BUILDER_RESET_MAX,
  resetBuilderTheme,
  resolveBuilderTheme,
  saveBuilderThemeDraft,
  uploadBuilderThemeImage
} from '../builderApi'

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const getIn = (tree, path) => path.reduce((node, key) => (isObject(node) ? node[key] : undefined), tree)

const hasIn = (tree, path) => {
  const parent = getIn(tree, path.slice(0, -1))
  return isObject(parent) && Object.prototype.hasOwnProperty.call(parent, path[path.length - 1])
}

const setIn = (tree, [key, ...rest], value) => {
  const node = isObject(tree) ? tree : {}
  if (!rest.length) return { ...node, [key]: value }
  return { ...node, [key]: setIn(node[key], rest, value) }
}

/** Takes the key out, and the maps it leaves empty. */
const unsetIn = (tree, [key, ...rest]) => {
  if (!isObject(tree) || !(key in tree)) return tree
  const { [key]: child, ...others } = tree
  if (!rest.length) return others
  const next = unsetIn(child, rest)
  return isObject(next) && !Object.keys(next).length ? others : { ...others, [key]: next }
}

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** A border, a shadow, a shadow style or a typography style is one value, set whole. */
const isWholeValue = (value) => isObject(value) && ['width', 'blur', 'line', 'style', 'direction'].some(key => key in value)

/** How many values the edits change. */
export const countThemeEdits = (edits) => Object.values(edits || {})
  .reduce((count, value) => count + (isObject(value) && !isWholeValue(value) ? countThemeEdits(value) : 1), 0)

/** What the editor works on: the draft, or the published values. */
export const getThemeCurrent = (theme) => theme?.draft_values ?? theme?.values ?? {}

/** How long after the last change the editor asks the API to resolve the theme. */
export const RESOLVE_DELAY = 300

/**
 * The editor of a version 2 theme of a Builder website. Changes
 * stay here (`edits`, the same shape as the theme, a null taking the
 * schema's default back) until "Save draft" sends them to the draft; the
 * API checks them against the schema and answers `errors` by path.
 * Publishing saves what is pending first. `resolution` is the theme as the
 * API resolves it with those changes (`resolved`, and by path the `sources`
 * of its values and the `aliases` they come from), asked for a moment after
 * the last change.
 *
 * A theme saved with another version of the schema (an earlier one, or a
 * later one the website went back from) comes converted:
 * `upgraded_from` names that version until it saves (`upgrade_dropped`, what
 * converting it lost), and `invalid` (`[{ path, code }]`) what it saved that
 * this version no longer takes, which saving drops; a number out of its range
 * (`.out_of_range`) comes at the closest limit instead, and saves there.
 */
export const BuilderThemeEditor = (props) => {
  const { UIComponent, productId, themeId, onPageFailure } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [schemaState, setSchemaState] = useState({ loading: true, schema: null, format: null, error: false })
  const [themeState, setThemeState] = useState({ loading: true, theme: null, error: false, notFound: false })
  const [edits, setEdits] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [editorAction, setEditorAction] = useState(null)
  const [resolution, setResolution] = useState({ resolved: null, sources: {}, aliases: {}, loading: false, error: false })
  const loadRequest = useRef(0)
  const resolveRequest = useRef(0)

  const failPage = (response) => {
    const pageFailure = getBuilderPageFailure(response)
    if (pageFailure) onPageFailure && onPageFailure(pageFailure)
  }

  const load = async () => {
    const requestId = ++loadRequest.current
    setSchemaState(prev => ({ ...prev, loading: true, error: false }))
    setThemeState(prev => ({ ...prev, loading: true, error: false, notFound: false }))
    const [schemaResponse, themeResponse] = await Promise.all([
      getBuilderThemeSchema(ordering, token, productId),
      getBuilderTheme(ordering, token, productId, themeId)
    ])
    if (requestId !== loadRequest.current) return
    if (schemaResponse.error) {
      failPage(schemaResponse)
      setSchemaState({ loading: false, schema: null, format: null, error: true })
    } else {
      setSchemaState({ loading: false, schema: schemaResponse.result?.schema ?? null, format: schemaResponse.result?.format ?? null, error: false })
    }
    if (themeResponse.error) {
      failPage(themeResponse)
      setThemeState({ loading: false, theme: null, error: true, notFound: (themeResponse.errorCodes || []).includes('theme.not_found') })
      return
    }
    setThemeState({ loading: false, theme: themeResponse.result ?? null, error: false, notFound: false })
  }

  const current = getThemeCurrent(themeState.theme)

  /**
   * Changes one value (`path`, a list of keys); null takes the default
   * back. Going back to what the theme has drops the change.
   */
  const setValue = (path, value) => {
    const saved = hasIn(current, path) ? getIn(current, path) : null
    setEdits(prev => (sameValue(value, saved) ? unsetIn(prev, path) : setIn(prev, path, value)))
    const key = path.join('.')
    setFieldErrors(prev => {
      if (!(key in prev)) return prev
      const { [key]: _removed, ...rest } = prev
      return rest
    })
  }

  /** Answers `{ ok, errorCodes, errors }` (`errors`: what `theme.invalid` refused, by path); on success the theme is the API's answer. */
  const settle = (response, { keepEdits = false } = {}) => {
    if (response.error) {
      failPage(response)
      const errors = (response.errorCodes || []).includes('theme.invalid') && Array.isArray(response.errors) ? response.errors : []
      if (errors.length) setFieldErrors(Object.fromEntries(errors.map(item => [item.path, item.code])))
      return { ok: false, errorCodes: response.errorCodes || [], errors }
    }
    setThemeState({ loading: false, theme: response.result ?? null, error: false, notFound: false })
    if (!keepEdits) {
      setEdits({})
      setFieldErrors({})
    }
    return { ok: true, errorCodes: [], errors: [] }
  }

  const run = async (action, call, options) => {
    setEditorAction(action)
    const response = await call()
    setEditorAction(null)
    return settle(response, options)
  }

  const hasEdits = Object.keys(edits).length > 0

  // What the theme resolves to: the theme's own until there are changes, then the API's with them
  const theme = themeState.theme
  useEffect(() => {
    const requestId = ++resolveRequest.current
    if (!theme) return
    if (!hasEdits) {
      setResolution({ resolved: theme.resolved ?? null, sources: theme.sources || {}, aliases: theme.aliases || {}, loading: false, error: false })
      return
    }
    setResolution(prev => ({ ...prev, loading: true }))
    const timer = setTimeout(async () => {
      const response = await resolveBuilderTheme(ordering, token, productId, themeId, edits)
      if (requestId !== resolveRequest.current) return
      if (response.error) {
        setResolution(prev => ({ ...prev, loading: false, error: true }))
        return
      }
      setResolution({ resolved: response.result?.resolved ?? null, sources: response.result?.sources || {}, aliases: response.result?.aliases || {}, loading: false, error: false })
    }, RESOLVE_DELAY)
    return () => clearTimeout(timer)
  }, [theme, edits])

  /** Saves the changes; a theme shown converted (`upgraded_from`) saves converted, with or without them. */
  const saveDraft = () => {
    if (!hasEdits && !theme?.upgraded_from) return Promise.resolve({ ok: true, errorCodes: [], errors: [] })
    return run('save', () => saveBuilderThemeDraft(ordering, token, productId, themeId, edits))
  }

  const publish = async () => {
    if (hasEdits) {
      const saved = await saveDraft()
      if (!saved.ok) return saved
    }
    return run('publish', () => publishBuilderTheme(ordering, token, productId, themeId))
  }

  /** Drops the draft, and what was not saved. */
  const discardDraft = () => run('discard', () => discardBuilderThemeDraft(ordering, token, productId, themeId))

  /** The preset's values in the draft: all (no sections) or each of `sections`. */
  const resetToPreset = async (sections = []) => {
    if (!sections.length) return run('reset', () => resetBuilderTheme(ordering, token, productId, themeId))
    setEditorAction('reset')
    let response = null
    // One call takes them all, written together; more than it takes go in turns
    for (let start = 0; start < sections.length; start += BUILDER_RESET_MAX) {
      response = await resetBuilderTheme(ordering, token, productId, themeId, sections.slice(start, start + BUILDER_RESET_MAX))
      if (response.error) break
    }
    setEditorAction(null)
    return settle(response)
  }

  const rename = (name) =>
    run('rename', () => renameBuilderTheme(ordering, token, productId, themeId, name), { keepEdits: true })

  /**
   * Uploads it and sets its url in `images.<key>`. Answers `{ ok, errorCodes,
   * limits }`; `limits` has what the refusal names (`formats`, `maxBytes`,
   * `maxSide`, `maxPixels`).
   */
  const uploadImage = async (key, file) => {
    setEditorAction(`upload:${key}`)
    const response = await uploadBuilderThemeImage(ordering, token, productId, themeId, key, file)
    setEditorAction(null)
    if (response.error || !response.result?.url) {
      failPage(response)
      const { formats, maxBytes, maxSide, maxPixels } = response
      return { ok: false, errorCodes: response.errorCodes || [], limits: { formats, maxBytes, maxSide, maxPixels } }
    }
    setValue(['images', key], response.result.url)
    return { ok: true, errorCodes: [], limits: {} }
  }

  useEffect(() => {
    if (!token || !productId || !themeId) return
    setEdits({})
    setFieldErrors({})
    load()
  }, [token, productId, themeId, ordering.root])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          schemaState={schemaState}
          themeState={themeState}
          current={current}
          edits={edits}
          editCount={countThemeEdits(edits)}
          fieldErrors={fieldErrors}
          resolution={resolution}
          editorAction={editorAction}
          reload={load}
          setValue={setValue}
          saveDraft={saveDraft}
          publish={publish}
          discardDraft={discardDraft}
          resetToPreset={resetToPreset}
          rename={rename}
          uploadImage={uploadImage}
        />
      )}
    </>
  )
}
