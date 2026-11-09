import React, { useEffect, useRef, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import {
  BUILDER_SCOPE_PAGE_SIZE,
  getBuilderPageFailure,
  getBuilderScopeBusiness,
  getBuilderScopeFranchise,
  getBuilderThemeSchema,
  listBuilderScopeBusinesses,
  listBuilderScopeFranchises,
  listBuilderThemes,
  updateBuilderProduct
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

/** What each website type picks, and the list it picks it from. */
export const SCOPE_MODES = {
  marketplace: null,
  single_store: { kind: 'stores', key: 'businessId' },
  franchise: { kind: 'franchises', key: 'franchiseId' }
}

const modeOf = ({ businessId, franchiseId }) => (franchiseId ? 'franchise' : businessId ? 'single_store' : 'marketplace')

/**
 * A website's scope: its type (`mode`) and what it picks, one store, one
 * franchise, or neither (the marketplace); never both. A type with nothing
 * picked yet keeps both null.
 */
const normalizeScope = ({ mode, businessId = null, franchiseId = null } = {}) => {
  const type = SCOPE_MODES[mode] !== undefined ? mode : modeOf({ businessId, franchiseId })
  return {
    mode: type,
    businessId: type === 'single_store' ? businessId ?? null : null,
    franchiseId: type === 'franchise' ? franchiseId ?? null : null
  }
}

const scopeOf = (product) => normalizeScope({ businessId: product?.business_id ?? null, franchiseId: product?.franchise_id ?? null })

/** The scope's type picks something it hasn't yet: it can't be saved. */
export const isScopeIncomplete = (scope) => {
  const mode = SCOPE_MODES[scope?.mode]
  return !!mode && !scope[mode.key]
}

const sameId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)

const EMPTY_LIST = { items: [], search: '', page: 0, totalPages: 0, total: 0, loading: false, loaded: false, error: false }

/**
 * One picker's list, a page at a time: `load({ search })` asks for the first
 * page of a search (nothing when it already has it, unless `force`),
 * `load({ more: true })` for the next one, added to what is shown. An older
 * answer never overwrites a newer one.
 */
const useScopeList = (fetchPage) => {
  const [list, setList] = useState(EMPTY_LIST)
  const listRef = useRef(list)
  listRef.current = list
  const requestRef = useRef(0)

  const load = async ({ search, more = false, force = false } = {}) => {
    const prev = listRef.current
    const text = search === undefined ? prev.search : String(search).trim()
    if (more) {
      if (prev.loading || !prev.loaded || prev.error || prev.page >= prev.totalPages) return
    } else if (!force && text === prev.search && (prev.loading || (prev.loaded && !prev.error))) {
      return
    }
    const page = more ? prev.page + 1 : 1
    const requestId = ++requestRef.current
    listRef.current = { ...prev, search: text, loading: true, error: false }
    setList(current => ({ ...current, search: text, loading: true, error: false }))
    const response = await fetchPage({ page, pageSize: BUILDER_SCOPE_PAGE_SIZE, search: text })
    if (requestId !== requestRef.current) return
    if (response.error) {
      setList(current => ({ ...current, loading: false, error: true }))
      return
    }
    const rows = (Array.isArray(response.result) ? response.result : []).filter(item => item && item.id !== undefined && item.id !== null)
    const pagination = response.pagination || {}
    setList(current => {
      const items = more ? [...current.items, ...rows.filter(row => !current.items.some(item => sameId(item.id, row.id)))] : rows
      return {
        items,
        search: text,
        page: Number(pagination.current_page) || page,
        totalPages: Number(pagination.total_pages) || 0,
        total: Number(pagination.total) || items.length,
        loading: false,
        loaded: true,
        error: false
      }
    })
  }

  return [list, load]
}

/**
 * What a Builder website shows whatever its theme (`site` of its
 * schema): its scope, the marketplace, one store or one franchise, and its
 * settings (name, description, its own HTML and code, tracking only, the
 * app banner). They're the product's, saved with its own Save, not in a
 * theme's draft; a theme reads them in `values.site`.
 *
 * The scope (`scope`: `mode`, `businessId`, `franchiseId`) changes with
 * `setScopeMode`, which drops the id the new type doesn't take, and
 * `setScope`. The stores and the franchises to pick from (`scopeOptions`)
 * load a page at a time from the backoffice, searched on the server:
 * `loadScopeOptions(kind, { search, more, force })`, `kind` being `stores` or
 * `franchises`. The picked one (`scopeSelection`) is read by its id when no
 * loaded page has it.
 *
 * Changes stay here until `save` sends them (`PUT products/{id}` with the
 * product's name): `edits` has the shape of `settings` under `site`, a null
 * taking a key's default back. `settings.invalid` answers `errors` by path
 * (`site.name`); a type with nothing picked isn't sent (`scope.incomplete`).
 * What the product saved that this version of the schema no longer takes
 * (`product.settings_invalid`) is dropped when it saves; `settings` comes
 * without it, or with a number out of its range at the closest limit
 * (`.out_of_range`), which it saves. `settings_upgrade_dropped` names what converting the
 * settings to this version lost.
 * The schema (`schemaState`) names and orders what is shown.
 */
export const BuilderSiteSettings = (props) => {
  const { UIComponent, productId, product, onProductChange, onPageFailure } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [edits, setEdits] = useState({})
  const [scopeEdit, setScopeEdit] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [errorCodes, setErrorCodes] = useState([])
  const [saving, setSaving] = useState(false)
  const [schemaState, setSchemaState] = useState({ loading: true, schema: null, format: null, error: false })
  // The picked store or franchise when no loaded page has it, by `${kind}:${id}`
  const [picked, setPicked] = useState({})
  const [hasActiveTheme, setHasActiveTheme] = useState(null)
  const schemaRequest = useRef(0)
  const themesRequest = useRef(0)

  const [stores, loadStores] = useScopeList((options) => listBuilderScopeBusinesses(ordering, token, options))
  const [franchises, loadFranchises] = useScopeList((options) => listBuilderScopeFranchises(ordering, token, options))
  const scopeOptions = { stores, franchises }

  const current = { site: product?.settings || {} }
  const savedScope = scopeOf(product)
  const scope = scopeEdit ?? savedScope
  const hasEdits = Object.keys(edits).length > 0 || !!scopeEdit

  /** Changes one setting (`['site', …]`); null takes its default back, and going back to what is saved drops the change. */
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

  /**
   * One store, one franchise, or neither (the marketplace): never both.
   * `item`, the picked row, is kept to show it whatever page is loaded.
   */
  const setScope = ({ item, ...next } = {}) => {
    const value = normalizeScope(next)
    const mode = SCOPE_MODES[value.mode]
    if (item && mode && sameId(item.id, value[mode.key])) {
      setPicked(prev => ({ ...prev, [`${mode.kind}:${item.id}`]: { item } }))
    }
    setScopeEdit(sameValue(value, savedScope) ? null : value)
    setErrorCodes([])
  }

  /** Another website type: the id of the one it was goes; back to the saved type, its saved pick comes back. */
  const setScopeMode = (mode) => {
    if (SCOPE_MODES[mode] === undefined || mode === scope.mode) return
    setScope(mode === savedScope.mode ? savedScope : { mode })
  }

  const discard = () => {
    setEdits({})
    setScopeEdit(null)
    setFieldErrors({})
    setErrorCodes([])
  }

  /** Answers `{ ok, errorCodes }`; on success the product is the API's answer. */
  const save = async () => {
    if (!hasEdits) return { ok: true, errorCodes: [] }
    if (scopeEdit && isScopeIncomplete(scopeEdit)) {
      setErrorCodes(['scope.incomplete'])
      return { ok: false, errorCodes: ['scope.incomplete'] }
    }
    setSaving(true)
    const response = await updateBuilderProduct(ordering, token, productId, {
      name: product?.name,
      ...(scopeEdit ? { businessId: scopeEdit.businessId, franchiseId: scopeEdit.franchiseId } : {}),
      ...(edits.site ? { settings: edits.site } : {})
    })
    setSaving(false)
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      setErrorCodes(response.errorCodes || [])
      if (Array.isArray(response.errors)) setFieldErrors(Object.fromEntries(response.errors.map(item => [item.path, item.code])))
      return { ok: false, errorCodes: response.errorCodes || [] }
    }
    const { apps, ...updated } = response.result || {}
    onProductChange && onProductChange(updated)
    discard()
    return { ok: true, errorCodes: [] }
  }

  /** A page of the project's enabled stores (`stores`) or franchises (`franchises`) to pick the scope from. */
  const loadScopeOptions = (kind, options) => {
    if (!token) return
    if (kind === 'stores') return loadStores(options)
    if (kind === 'franchises') return loadFranchises(options)
  }

  // The picked one: from a loaded page, else read by its id
  const pickedMode = SCOPE_MODES[scope.mode]
  const pickedId = pickedMode ? scope[pickedMode.key] : null
  const pickedKey = pickedMode && pickedId ? `${pickedMode.kind}:${pickedId}` : null
  const listedItem = pickedKey ? scopeOptions[pickedMode.kind].items.find(item => sameId(item.id, pickedId)) : null
  const scopeSelection = !pickedKey
    ? null
    : listedItem ? { item: listedItem, loading: false, missing: false, error: false } : { item: null, loading: true, missing: false, error: false, ...picked[pickedKey] }

  const readPicked = async (kind, id, key) => {
    setPicked(prev => ({ ...prev, [key]: { loading: true } }))
    const response = kind === 'stores' ? await getBuilderScopeBusiness(ordering, token, id) : await getBuilderScopeFranchise(ordering, token, id)
    const item = !response.error && response.result && typeof response.result === 'object' && !Array.isArray(response.result) ? response.result : null
    // No answer (status 0) can be tried again; any other refusal means it's gone, or not this user's
    setPicked(prev => ({ ...prev, [key]: item ? { item, loading: false } : { item: null, loading: false, missing: response.status !== 0, error: response.status === 0 } }))
  }

  useEffect(() => {
    if (!token || !pickedKey || listedItem || picked[pickedKey]) return
    readPicked(pickedMode.kind, pickedId, pickedKey)
  }, [token, pickedKey, !!listedItem])

  /** Reads the picked one again after it couldn't be read. */
  const reloadScopeSelection = () => {
    if (token && pickedKey && !listedItem) readPicked(pickedMode.kind, pickedId, pickedKey)
  }

  /** The website's schema: its `site` sections say what is shown. */
  const loadSchema = async () => {
    const requestId = ++schemaRequest.current
    setSchemaState(prev => ({ ...prev, loading: true, error: false }))
    const response = await getBuilderThemeSchema(ordering, token, productId)
    if (requestId !== schemaRequest.current) return
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      setSchemaState({ loading: false, schema: null, format: null, error: true })
      return
    }
    setSchemaState({ loading: false, schema: response.result?.schema ?? null, format: response.result?.format ?? null, error: false })
  }

  const loadActiveTheme = async () => {
    const requestId = ++themesRequest.current
    setHasActiveTheme(null)
    const response = await listBuilderThemes(ordering, token, productId)
    if (requestId !== themesRequest.current) return
    setHasActiveTheme(response.error ? null : Array.isArray(response.result) && response.result.some(theme => theme?.active === true))
  }

  useEffect(() => {
    discard()
    if (!token || !productId) return
    loadSchema()
    loadActiveTheme()
  }, [token, productId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          schemaState={schemaState}
          reloadSchema={loadSchema}
          hasActiveTheme={hasActiveTheme}
          current={current}
          edits={edits}
          fieldErrors={fieldErrors}
          errorCodes={errorCodes}
          scope={scope}
          scopeChanged={!!scopeEdit}
          scopeOptions={scopeOptions}
          scopeSelection={scopeSelection}
          scopeIncomplete={isScopeIncomplete(scope)}
          saving={saving}
          hasEdits={hasEdits}
          setValue={setValue}
          setScope={setScope}
          setScopeMode={setScopeMode}
          loadScopeOptions={loadScopeOptions}
          reloadScopeSelection={reloadScopeSelection}
          save={save}
          discard={discard}
        />
      )}
    </>
  )
}
