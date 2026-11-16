import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useWebsocket, useSocketInstance } from '../../contexts/WebsocketContext'
import { applySiteLogoHeaderSync } from '../../utils'
import { findLegacySiteOfType } from '../../utils/websiteMigration'

// redesign ordering-website B2 (OW-01/OW-02/OW-12): small helpers for the saves that do not lose data.
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const pick = (source, keys) => {
  const out = {}
  keys.forEach((key) => {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key]
  })
  return out
}
const omit = (source, keys) => {
  const out = { ...source }
  keys.forEach((key) => { delete out[key] })
  return out
}
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

export const OrderingWebsite = (props) => {
  const {
    UIComponent,
    app,
    appId,
    type,
    name,
    disableReplaceCode,
    forcedSiteId,
    fallbackAppId,
    setAppIdState,
    // main: websites are made in Builder; with it the page never creates a site and says there is none
    disableSiteCreation
  } = props

  const [ordering, { configurations }] = useApi()
  const [session] = useSession()
  const { token } = session
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const socket = useWebsocket()
  const ioSocket = useSocketInstance(socket)

  const [themeValues, setThemeValues] = useState({})
  const [advancedValues, setAdvancedValues] = useState({})
  const [orderingTheme, setOrderingTheme] = useState({ loading: true, themes: [], error: null, siteId: null })
  const [themesList, setThemesList] = useState({ loading: true, themes: [], error: null })
  const [site, setSite] = useState(null)
  // A page that creates no site says so when there is none
  const [siteMissing, setSiteMissing] = useState(false)
  const [businessesList, setBusinessesList] = useState({ businesses: [], loading: false, error: null })
  const [franchisesList, setFranchisesList] = useState({ loading: false, franchises: [], error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  // redesign ordering-website B2 (OW-01): what is saved on the server, apart from the drafts being edited.
  const [savedValues, setSavedValues] = useState(null)
  const [savedSite, setSavedSite] = useState(null)
  const [saving, setSaving] = useState(false)
  // (K-4): with a `type` and no `disableReplaceCode` (/my-products/ordering-website-2) opening the page only reads. What main
  // wrote on load (create the site, or fix the code or type of the one found) waits in `pendingSiteRef`, `{ create }` or `{ repair }`,
  // and the first save writes it through `ensureSite`, like /my-products/dashboard. The other routes keep writing on load.
  const deferWrites = !!type && !disableReplaceCode
  const pendingSiteRef = useRef(null)
  // `create` pending: there is no site or theme yet, so the editor starts from the theme defaults (see the effect below)
  const [pendingCreate, setPendingCreate] = useState(false)
  // the write in flight, so a second save at the same time (a double click, Save + the domain dialog) waits for it, not repeats it
  const ensuringRef = useRef(null)
  // the default theme assigned on the first save of a created site, until the load can show it (a retry must not assign it twice)
  const assignedThemeRef = useRef(null)
  // the draft was just saved and shown as the theme: the load effect must not overwrite what is being edited
  const skipThemeSyncRef = useRef(false)
  const changesRef = useRef(formState.changes)
  const siteRef = useRef(site)
  const savedValuesRef = useRef(savedValues)
  changesRef.current = formState.changes
  siteRef.current = site
  savedValuesRef.current = savedValues

  const commitSavedValues = (values) => {
    savedValuesRef.current = values
    setSavedValues(values)
  }

  // A site that comes from the server (load, add, update): it is what is shown and what is saved.
  const applyServerSite = (serverSite) => {
    setSite(serverSite)
    setSavedSite(serverSite)
  }

  const requestBase = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }

  /**
 * Update form data
 * @param {EventTarget} e Related HTML event
 */
  const handleChangeInput = (e) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [e.target.name]: e.target.value
      }
    })
    setSite({
      ...site,
      [e.target.name]: e.target.value
    })
  }

  // a site found with another code or type is shown as it is and its theme is loaded; the rename waits in
  // `pendingSiteRef` for the first save. The id does not change with the rename, so the theme is the same one.
  const deferRepair = async (current, repair) => {
    pendingSiteRef.current = { repair }
    applyServerSite(current)
    await getSiteTheme(current.id)
  }

  /**
 * Method to get the themes from API
 */
  const getSites = async () => {
    try {
      // a stale error from a failed load is cleared when it is asked again (Retry)
      // review: so is main's «no site»: the same page instance moves between ordering-website and -2
      setSiteMissing(false)
      setOrderingTheme({
        ...orderingTheme,
        loading: true,
        error: null
      })
      const requestOptions = {
        ...requestBase,
        method: 'GET'
      }

      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()

      // a refused list is a failed load, not an empty site: the UI shows it (with Retry) instead of the form
      if (error || !Array.isArray(result)) {
        setOrderingTheme((prevState) => ({
          ...prevState,
          loading: false,
          themes: [],
          error: Array.isArray(result) && result.length ? result : ['Could not load the site']
        }))
        return
      }

      // main: a migrated site or a Builder product shares the type but is edited in Builder: never re-coded
      const findByType = findLegacySiteOfType(result, type)
      const found = result.find(site => site.code === appId)

      pendingSiteRef.current = null
      assignedThemeRef.current = null
      setPendingCreate(false)

      // with `fallbackAppId` (the franchises page, whose appId can come from ?appId=) only an existing site of this type
      // opens; any other code switches to the default one. main opened the marketplace website (?appId=website) or created a site
      // for a typo. The default code itself keeps main's load (it is created when missing).
      if (fallbackAppId && appId !== fallbackAppId && !result.some(site => site.code === appId && site.type === type)) {
        setAppIdState && setAppIdState(fallbackAppId)
        return
      }

      if (type) {
        if (findByType && !disableReplaceCode) {
          if (findByType.code !== appId) {
            await deferRepair(findByType, { id: findByType.id, type, code: appId })
          } else {
            applyServerSite(found)
            await getSiteTheme(found.id)
          }
        } else if (found) {
          if (!disableReplaceCode) {
            await deferRepair(found, { id: found.id, type, code: found.code })
          } else {
            const siteFound = { ...found, type }
            applyServerSite(siteFound)
            await getSiteTheme(siteFound.id)
          }
        } else if (disableSiteCreation) {
          // main goes first: these pages create no site at all, not even on the first save
          setSiteMissing(true)
        } else if (deferWrites) {
          // no site yet. Nothing is created until the first save; meanwhile the editor shows the theme defaults.
          pendingSiteRef.current = { create: { code: appId, name: name || configurations?.subdomain, type } }
          applyServerSite(null)
          setPendingCreate(true)
        } else {
          await handleAddSite(type)
        }
      } else {
        if (found) {
          await getSiteTheme(found.id)
          applyServerSite(found)
        } else if (disableSiteCreation) {
          setSiteMissing(true)
        } else {
          await handleAddSite()
        }
      }
    } catch (err) {
      setOrderingTheme((prevState) => ({
        ...prevState,
        loading: false,
        error: [err.message]
      }))
    } finally {
      setOrderingTheme((prevState) => ({
        ...prevState,
        loading: false
      }))
    }
  }

  /**
   * Method to get businesses from API
   */
  const getBusinesses = async () => {
    try {
      setBusinessesList({ ...businessesList, loading: false })
      let where = null
      const conditions = []
      conditions.push({
        attribute: 'enabled',
        value: true
      })
      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const { content: { error, result } } = await ordering
        .setAccessToken(token)
        .businesses()
        .select(['name', 'logo', 'slug'])
        .where(where)
        .asDashboard()
        .get()
      if (!error) {
        setBusinessesList({ ...businessesList, loading: false, businesses: result })
      }
    } catch (err) {
      setBusinessesList({ ...businessesList, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get brand list
   */
  const getFranchises = async () => {
    try {
      setFranchisesList({ ...franchisesList, loading: true })
      let where = null
      const conditions = []
      conditions.push({
        attribute: 'enabled',
        value: true
      })
      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const requestOptions = {
        ...requestBase,
        method: 'GET'
      }
      const functionFetch = `${ordering.root}/franchises?where=${JSON.stringify(where)}`
      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setFranchisesList({
          ...franchisesList,
          loading: false,
          franchises: result
        })
      } else {
        setFranchisesList({
          ...franchisesList,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setFranchisesList({
        ...franchisesList,
        loading: false,
        error: err
      })
    }
  }

  /**
 * Function to add new site from API
 */
  const handleAddSite = async () => {
    try {
      const initialData = {
        code: appId,
        name: name || app?.name
      }
      if (type) {
        initialData.type = type
      }
      const requestOptions = {
        ...requestBase,
        body: JSON.stringify(initialData)
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        if (type) {
          applyServerSite(result)
          getSites()
        } else {
          await getSiteTheme(result.id)
          applyServerSite(result)
        }
      } else {
        setOrderingTheme((prevState) => ({
          ...prevState,
          loading: false,
          themes: [],
          error: result
        }))
      }
    } catch (err) {
      setOrderingTheme({
        ...orderingTheme,
        loading: false,
        result: [err.message]
      })
    }
  }

  /**
   * writes what the load left pending (create the site, or fix its code and type) and gives back the site to write on.
   * Nothing pending: the site as it is. A second call while the write is in flight waits for it. It throws the API answer when the
   * write fails.
   */
  const ensureSite = () => {
    if (ensuringRef.current) return ensuringRef.current
    if (!pendingSiteRef.current) return Promise.resolve(siteRef.current)
    ensuringRef.current = writePendingSite().finally(() => { ensuringRef.current = null })
    return ensuringRef.current
  }

  const writePendingSite = async () => {
    const pending = pendingSiteRef.current
    const url = pending.create ? `${ordering.root}/sites` : `${ordering.root}/sites/${pending.repair.id}`
    const body = pending.create ?? { type: pending.repair.type, code: pending.repair.code }
    const response = await fetch(url, { ...requestBase, body: JSON.stringify(body) })
    const { error, result } = await response.json()
    if (error) throw result
    pendingSiteRef.current = null
    setPendingCreate(false)
    // the fields being edited stay as typed (same rule as setSiteFromServer)
    const dirtyKeys = Object.keys(changesRef.current || {})
    setSavedSite((prev) => ({ ...prev, ...result }))
    const next = { ...siteRef.current, ...omit(result, dirtyKeys) }
    siteRef.current = next
    setSite(next)
    return next
  }

  const handleUpdateSite = async (payload) => {
    const changes = applySiteLogoHeaderSync(payload ?? formState.changes, site)

    if (!changes || Object.keys(changes).length === 0) return
    if (!site?.id && !pendingSiteRef.current?.create) return

    // redesign ordering-website B2 (OW-12): an explicit payload
    // (e.g. "Remove custom domain" = { domain: null }) only clears what it sent; unsaved fields stay.
    const isExplicitPayload = payload != null
    try {
      setFormState((prev) => ({ ...prev, loading: true }))
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      // the site is created or fixed first when the load left that pending
      let siteId
      try {
        siteId = (await ensureSite())?.id
      } catch (result) {
        setFormState((prev) => ({ ...prev, loading: false }))
        showToast(ToastType.Error, result instanceof Error ? result.message : result)
        return false
      }
      const seoOptions = {
        ...requestBase,
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/sites/${siteId}`, seoOptions)
      const { error, result } = await response.json()
      if (!error) {
        if (isExplicitPayload) {
          const sent = Object.keys(payload)
          const remaining = Object.keys(changesRef.current || {}).filter((key) => !sent.includes(key))
          setSite((prev) => ({ ...result, ...pick(prev, remaining) }))
          setFormState((prev) => ({ loading: false, error: null, changes: omit(prev.changes, sent) }))
        } else {
          setSite(result)
          setFormState({ loading: false, changes: {}, error: null })
        }
        setSavedSite(result)
        showToast(
          ToastType.Success,
          changes?.domain === null
            ? t('CUSTOM_DOMAIN_REMOVED_SUCCESSFULLY', 'Custom domain removed successfully')
            : t('UPDATED_SUCCESSFULLY', 'Updated successfully')
        )
        return true
      } else {
        setFormState((prev) => ({ ...prev, loading: false }))
        showToast(ToastType.Error, result)
        return false
      }
    } catch (err) {
      setFormState((prev) => ({ ...prev, loading: false }))
      showToast(ToastType.Error, err.message)
      return false
    } finally {
      setOrderingTheme((prevState) => ({
        ...prevState,
        loading: false
      }))
    }
  }

  /**
   * Method to get the site theme from API
   */
  const getSiteTheme = async (siteId) => {
    try {
      const requestOptions = {
        ...requestBase,
        method: 'GET'
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes`, requestOptions)
      const { error, result } = await response.json()
      setOrderingTheme({
        loading: false,
        themes: error ? [] : result,
        error: error ? result : null,
        siteId
      })
    } catch (err) {
      setOrderingTheme({
        ...orderingTheme,
        loading: false,
        error: [err.message]
      })
    }
  }

  // The values a site gets with its first theme: the default theme's own, with this project's default domain.
  const buildDefaultThemeValues = () => {
    const valuesDefault = clone(themesList.themes[0]?.values_default)
    if (valuesDefault?.my_products?.components?.website_settings?.components?.values) {
      valuesDefault.my_products.components.website_settings.components.values.default_domain = `https://${ordering.project}.${configurations.subdomain}.com`
    }
    return valuesDefault
  }

  // assigns the default theme to a site created by the first save. Unlike handleAssignTheme it does not replace the
  // theme state (that would reset the drafts being saved). `{ row }` when it worked, `{ error }` when the API refused it.
  const assignDefaultTheme = async (siteId, defaultTheme) => {
    try {
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes`, {
        ...requestBase,
        body: JSON.stringify({
          theme_id: defaultTheme.id,
          values: JSON.stringify(buildDefaultThemeValues())
        })
      })
      const { error, result } = await response.json()
      if (error) {
        showToast(ToastType.Error, result)
        return { error: result }
      }
      showToast(ToastType.Success, t('THEME_ADDED', 'Theme added'))
      return { row: result }
    } catch (err) {
      showToast(ToastType.Error, err.message)
      return { error: err.message }
    }
  }

  /**
 * Method to assign the theme to site
 */
  const handleAssignTheme = async (value, themeId, siteId) => {
    try {
      const requestOptions = {
        ...requestBase,
        body: JSON.stringify({
          theme_id: themeId,
          values: JSON.stringify(value)
        })
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('THEME_ADDED', 'Theme added'))
        setOrderingTheme({
          ...orderingTheme,
          themes: [result]
        })
      } else {
        showToast(ToastType.Error, result)
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  /**
 * Method to get the themes from API
 */
  const getThemes = async () => {
    try {
      setThemesList({
        ...themesList,
        loading: true
      })
      const requestOptions = {
        ...requestBase,
        method: 'GET'
      }
      const response = await fetch(`${ordering.root}/themes`, requestOptions)
      const { error, result } = await response.json()
      setThemesList({
        loading: false,
        themes: error ? [] : result,
        error: error ? result : null
      })
    } catch (err) {
      setThemesList({
        ...themesList,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
 * Method to update the site theme from API
 */
  // redesign ordering-website B2 (OW-01): the last saved values; before the first load, the theme as it came.
  const getBaseValues = () => clone(savedValuesRef.current ?? orderingTheme.themes[0]?.values ?? {})

  // redesign ordering-website B2 (OW-01): in the store white label the store is the forced one,
  // never one from the draft (same values Basic keeps forcing in its own draft).
  const forceStoreWebsiteTheme = (values) => {
    const slug = props.business?.slug
    if (!forcedSiteId || !slug) return
    if (!isPlainObject(values.my_products)) values.my_products = {}
    if (!isPlainObject(values.my_products.components)) values.my_products.components = {}
    const components = values.my_products.components
    if (!isPlainObject(components.website_theme)) components.website_theme = {}
    if (!isPlainObject(components.website_theme.components)) components.website_theme.components = {}
    components.website_theme.components.type = 'single_store'
    components.website_theme.components.business_slug = slug
  }

  // What Basic sends: its own my_products.components over the saved values.
  const buildBasicValues = () => {
    const base = getBaseValues()
    const values = clone(base)
    values.my_products = { ...base.my_products, components: clone(themeValues) }
    return values
  }

  // What Advanced sends: its draft, with the saved my_products plus the one path Advanced edits there.
  const buildAdvancedValues = (advancedTheme) => {
    const base = getBaseValues()
    const values = clone(advancedTheme)
    const fullscreen = advancedTheme?.my_products?.components?.images?.components?.homepage_image_fullscreen
    values.my_products = clone(base.my_products)
    if (fullscreen !== undefined) {
      if (!isPlainObject(values.my_products)) values.my_products = {}
      if (!isPlainObject(values.my_products.components)) values.my_products.components = {}
      if (!isPlainObject(values.my_products.components.images)) values.my_products.components.images = {}
      if (!isPlainObject(values.my_products.components.images.components)) values.my_products.components.images.components = {}
      values.my_products.components.images.components.homepage_image_fullscreen = clone(fullscreen)
    }
    return values
  }

  // What "save all" sends: both drafts mixed; themeValues is the only source of homepage_image_fullscreen.
  const buildAllValues = () => {
    const base = getBaseValues()
    const values = { ...base, ...clone(advancedValues) }
    values.my_products = {
      ...clone(advancedValues?.my_products ?? base.my_products),
      components: clone(themeValues)
    }
    return values
  }

  /**
   * Saves the site changes (if any) and then the theme. Same requests as before; the site POST is now read:
   * if it fails nothing else is posted and no success is shown.
   * @param {string} mode 'basic' | 'advanced' | 'all'
   * @param {object} advancedTheme Advanced draft (mode 'advanced')
   * @returns {Promise<{ok: boolean, error?: any}>}
   */
  const saveSiteAndTheme = async (mode, advancedTheme) => {
    setSaving(true)
    try {
      const themeRow = orderingTheme.themes[0]
      let themeId = themeRow?.theme_id ?? assignedThemeRef.current?.themeId
      let siteId = themeRow?.site_id ?? assignedThemeRef.current?.siteId
      // a site created by this save (or whose theme request failed) gets the default theme first, like the load does for
      // a site with none; it only applies where the load writes are deferred.
      const defaultTheme = themesList.themes?.[0]
      const needsDefaultTheme = themeId == null && deferWrites && defaultTheme?.id != null
      // redesign ordering-website-2 (OW2-04): with no theme loaded and none to assign nothing is posted (not even the
      // pending site write), like main, where this Save threw before any request; it used to go to /sites/undefined.
      if (!needsDefaultTheme && (themeId == null || siteId == null)) return { ok: false, error: null }
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      let currentSite
      try {
        currentSite = (await ensureSite()) ?? site
      } catch (result) {
        const message = result instanceof Error ? result.message : result
        showToast(ToastType.Error, message)
        return { ok: false, error: message }
      }
      if (needsDefaultTheme) {
        if (currentSite?.id == null) return { ok: false, error: null }
        const assigned = await assignDefaultTheme(currentSite.id, defaultTheme)
        if ('error' in assigned) return { ok: false, error: assigned.error }
        themeId = assigned.row?.theme_id ?? defaultTheme.id
        siteId = assigned.row?.site_id ?? currentSite.id
        assignedThemeRef.current = { themeId, siteId, id: assigned.row?.id }
        // the server now has the defaults: they are the base of this save
        commitSavedValues(isPlainObject(assigned.row?.values) ? clone(assigned.row.values) : buildDefaultThemeValues())
      }
      const siteChanges = applySiteLogoHeaderSync(formState.changes, site)
      if (Object.keys(siteChanges).length > 0) {
        const seoOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(siteChanges)
        }
        const siteResponse = await fetch(`${ordering.root}/sites/${currentSite.id}`, seoOptions)
        const { error: siteError, result: siteResult } = await siteResponse.json()
        if (siteError) {
          showToast(ToastType.Error, siteResult)
          return { ok: false, error: siteResult }
        }
        // a partial answer never blanks fields of the site on screen (review r1: the synthetic API echoes only what was sent)
        setSite((prev) => ({ ...prev, ...siteResult }))
        setSavedSite((prev) => ({ ...prev, ...siteResult }))
        setFormState({ loading: false, changes: {}, error: null })
      }

      const values = mode === 'advanced'
        ? buildAdvancedValues(advancedTheme)
        : mode === 'all' ? buildAllValues() : buildBasicValues()
      forceStoreWebsiteTheme(values)
      if (forcedSiteId && values?.general?.components?.buttons) {
        values.general.components.buttons.color = ''
        values.general.components.buttons.borderRadius = ''
        values.general.components.buttons.buttonTextColor = ''
      }
      const requestOptions = {
        ...requestBase,
        body: JSON.stringify({
          values: JSON.stringify(values)
        })
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes/${themeId}`, requestOptions)
      const { error, result } = await response.json()
      if (error) {
        showToast(ToastType.Error, result)
        return { ok: false, error: result }
      }
      showToast(ToastType.Success, t('THEME_UPDATED', 'Theme updated'))
      const previousFullscreen = getBaseValues()?.my_products?.components?.images?.components?.homepage_image_fullscreen
      // redesign ordering-website integration: what is now stored, as an object. An answer whose `values` is the JSON
      // text that was sent (not an object) used to be spread into advancedValues character by character.
      const storedValues = isPlainObject(result?.values) ? clone(result.values) : clone(values)
      commitSavedValues(storedValues)
      if (!themeRow) {
        // the theme was assigned by this save: the editor now has one (the drafts are what was just saved, so the load effect skips it)
        skipThemeSyncRef.current = true
        setOrderingTheme({
          loading: false,
          themes: [{
            id: assignedThemeRef.current?.id,
            theme_id: themeId,
            site_id: siteId,
            values: clone(storedValues),
            theme: { values_default: clone(defaultTheme?.values_default) }
          }],
          error: null,
          siteId
        })
      }
      if (mode === 'basic') {
        // the Advanced draft is not stepped on: only its my_products follows what Basic saved
        setAdvancedValues((prev) => ({ ...prev, my_products: clone(values.my_products) }))
      } else {
        setAdvancedValues({ ...advancedValues, ...storedValues })
      }
      if (mode === 'advanced') {
        // Basic keeps its own copy of homepage_image_fullscreen: when Basic did not touch it, it follows what Advanced
        // saved, so a later Basic save does not put the old value back.
        const savedFullscreen = values?.my_products?.components?.images?.components?.homepage_image_fullscreen
        setThemeValues((prev) => {
          if (prev?.images?.components?.homepage_image_fullscreen !== previousFullscreen) return prev
          const next = clone(prev)
          if (!isPlainObject(next.images)) next.images = {}
          if (!isPlainObject(next.images.components)) next.images.components = {}
          next.images.components.homepage_image_fullscreen = savedFullscreen
          return next
        })
      }
      return { ok: true }
    } catch (err) {
      showToast(ToastType.Error, err.message)
      return { ok: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSiteTheme = (advancedTheme) => saveSiteAndTheme(advancedTheme ? 'advanced' : 'basic', advancedTheme)

  // redesign ordering-website B2 (OW-01): one draft (sectioned editor) saved in a single request.
  const handleSaveAll = () => saveSiteAndTheme('all')

  // redesign ordering-website B2: back to what is saved.
  const discardChanges = () => {
    // with the site still to be created, what is "saved" is the theme defaults the editor started from
    const base = savedValues ?? (pendingSiteRef.current?.create ? buildDefaultThemeValues() : null)
    setThemeValues(clone(base?.my_products?.components ?? {}))
    setAdvancedValues(clone(base ?? {}))
    setSite(clone(savedSite ?? null))
    setFormState({ loading: false, changes: {}, error: null })
  }

  const loadForcedSite = async () => {
    try {
      setOrderingTheme((prev) => ({ ...prev, loading: true }))
      const response = await fetch(`${ordering.root}/sites/${forcedSiteId}`, {
        ...requestBase,
        method: 'GET'
      })
      const { error, result } = await response.json()
      if (!error && result && !Array.isArray(result)) {
        applyServerSite(result)
        await getSiteTheme(result.id)
      } else {
        setOrderingTheme((prev) => ({ ...prev, loading: false, error: result || ['Site not found'] }))
      }
    } catch (err) {
      setOrderingTheme((prev) => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  // «Retry» of the editor when the site did not load: the same requests the page makes when it opens
  const reloadSite = () => {
    if (forcedSiteId) {
      loadForcedSite()
      return
    }
    if (!appId) return
    if (themesList.error) getThemes()
    getSites()
  }

  useEffect(() => {
    if (forcedSiteId) {
      loadForcedSite()
      getBusinesses()
      getFranchises()
      return
    }
    if (!appId) return
    getThemes()
    getSites()
    getBusinesses()
    getFranchises()
  }, [appId, forcedSiteId])

  useEffect(() => {
    if (forcedSiteId) return
    if (orderingTheme?.siteId && themesList.themes?.length && !orderingTheme?.themes?.length) {
      handleAssignTheme(buildDefaultThemeValues(), themesList.themes[0]?.id, orderingTheme?.siteId)
    }
  }, [JSON.stringify(themesList.themes), orderingTheme?.siteId])

  // a site still to be created shows the theme defaults. They are also its saved base (`savedValues`), so any change to
  // the theme counts as one (the SaveBar and the leave warning depend on it) and Discard goes back to them.
  useEffect(() => {
    if (!pendingCreate || !themesList.themes?.length) return
    const valuesDefault = buildDefaultThemeValues()
    if (!valuesDefault) return
    commitSavedValues(clone(valuesDefault))
    setAdvancedValues(valuesDefault)
    setThemeValues(clone(valuesDefault.my_products?.components ?? {}))
  }, [pendingCreate, themesList.themes])

  useEffect(() => {
    if (!orderingTheme.themes[0]?.values) return
    if (skipThemeSyncRef.current) {
      skipThemeSyncRef.current = false
      return
    }
    if (
      orderingTheme.themes[0]?.values?.business_view?.components?.products?.components?.product?.components?.favorite?.hidden === undefined &&
      orderingTheme.themes[0]?.values?.business_view?.components?.products?.components?.product?.components
    ) {
      orderingTheme.themes[0].values.business_view.components.products.components.product.components.favorite = {
        hidden: orderingTheme.themes[0]?.values?.business_view?.components?.product?.components?.favorite
      }
    }
    if (
      orderingTheme.themes[0].values?.order_types &&
      orderingTheme.themes[0]?.values?.order_types?.components?.catering_delivery === undefined
    ) {
      orderingTheme.themes[0].values.order_types.components.catering_delivery = orderingTheme.themes[0]?.theme?.values_default.order_types.components.catering_delivery
    }
    if (
      orderingTheme.themes[0].values?.order_types &&
      orderingTheme.themes[0]?.values?.order_types?.components?.catering_pickup === undefined
    ) {
      orderingTheme.themes[0].values.order_types.components.catering_pickup = orderingTheme.themes[0]?.theme?.values_default.order_types.components.catering_pickup
    }
    if (
      orderingTheme.themes[0]?.values?.smart_banner_settings === undefined
    ) {
      orderingTheme.themes[0].values.smart_banner_settings = orderingTheme.themes[0]?.theme?.values_default.smart_banner_settings
    }
    if (
      orderingTheme.themes[0]?.values?.theme_settings?.components?.values?.homepage_content === undefined
    ) {
      orderingTheme.themes[0].values.theme_settings = {
        ...orderingTheme.themes[0].values.theme_settings,
        components: {
          ...orderingTheme.themes[0].values.theme_settings?.components,
          values: {
            ...orderingTheme.themes[0].values.theme_settings?.components?.values,
            homepage_content: ''
          }
        }
      }
    }
    if (
      orderingTheme.themes[0]?.values?.theme_settings?.components?.values?.footer_content === undefined
    ) {
      orderingTheme.themes[0].values.theme_settings = {
        ...orderingTheme.themes[0].values.theme_settings,
        components: {
          ...orderingTheme.themes[0].values.theme_settings?.components,
          values: {
            ...orderingTheme.themes[0].values.theme_settings?.components?.values,
            footer_content: ''
          }
        }
      }
    }
    const normalizedValues = JSON.parse(JSON.stringify(orderingTheme.themes[0]?.values))
    setAdvancedValues(normalizedValues)
    // redesign ordering-website B2 (OW-01): same clone, so the load normalizations do not count as a change
    commitSavedValues(clone(normalizedValues))
    const _themeValues = orderingTheme.themes[0]?.values?.my_products?.components
    if (!_themeValues) return
    setThemeValues(JSON.parse(JSON.stringify(_themeValues)))
  }, [orderingTheme?.themes])

  /**
   * WebSocket: join sites room and listen for site updates
   */
  const handleSitesUpdate = (siteUpdate) => {
    if (!site || siteUpdate?.id !== site?.id) return
    // redesign ordering-website B2 (OW-12): only the clean fields follow the server
    const dirtyKeys = Object.keys(changesRef.current || {})
    setSavedSite(prev => ({ ...prev, ...siteUpdate }))
    setSite(prev => ({ ...prev, ...omit(siteUpdate, dirtyKeys) }))
  }

  // redesign ordering-website B2 (OW-12): the `setSite` the UI receives (domain dialog, white label)
  // is only called after writing on the server, so it must not step on fields with unsaved changes.
  // Accepts an object or a function, like setState.
  const setSiteFromServer = (update) => {
    const dirtyKeys = Object.keys(changesRef.current || {})
    const prev = siteRef.current
    const next = typeof update === 'function' ? update(prev) : update
    setSite({ ...next, ...pick(prev, dirtyKeys) })
    setSavedSite((saved) => ({ ...saved, ...omit(next, dirtyKeys) }))
  }

  useEffect(() => {
    if (!session?.user || !ioSocket) return
    const room = {
      project: ordering.project,
      room: 'sites',
      user_id: session?.user?.id,
      role: 'manager'
    }
    const handleJoinRoom = () => socket.join(room)
    if (ioSocket.connected) handleJoinRoom()
    ioSocket.on('connect', handleJoinRoom)
    return () => {
      socket.leave(room)
      ioSocket.off('connect', handleJoinRoom)
    }
  }, [ioSocket, session])

  useEffect(() => {
    socket.on('sites_update', handleSitesUpdate)
    return () => {
      socket.off('sites_update', handleSitesUpdate)
    }
  }, [socket, session, site])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          themeValues={themeValues}
          advancedValues={advancedValues}
          setAdvancedValues={setAdvancedValues}
          orderingTheme={orderingTheme}
          setThemeValues={setThemeValues}
          handleUpdateSiteTheme={handleUpdateSiteTheme}
          themesList={themesList}
          site={site}
          siteMissing={siteMissing}
          setSite={setSiteFromServer}
          businessesList={businessesList}
          franchisesList={franchisesList}
          handleChangeInput={handleChangeInput}
          formState={formState}
          handleUpdateSite={handleUpdateSite}
          ensureSite={ensureSite}
          saving={saving}
          savedValues={savedValues}
          savedSite={savedSite}
          handleSaveAll={handleSaveAll}
          discardChanges={discardChanges}
          reloadSite={reloadSite}
        />
      )}
    </>
  )
}

OrderingWebsite.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
