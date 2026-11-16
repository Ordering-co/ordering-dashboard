import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

// redesign my-products-dashboard (DB-01): same helpers as the OrderingWebsite controller (OW-12).
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

export const Dashboard = (props) => {
  const {
    UIComponent,
    appId,
    type
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [orderingTheme, setOrderingTheme] = useState({ loading: false, themes: [], error: null, siteId: null })
  const [site, setSite] = useState(null)
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  // redesign D-81 part B (owner, 2026-10-19): what the server has, apart from the name/description being typed. The editor
  // compares against it to know there is unsaved work, and `discardChanges` goes back to it (same contract as the OrderingWebsite one).
  const [savedSite, setSavedSite] = useState(null)
  const changesRef = useRef(formState.changes)
  changesRef.current = formState.changes
  const siteRef = useRef(site)
  siteRef.current = site
  // opening the page only reads. What main wrote on load (create the brand site, or fix the code or type of the one
  // found) waits here, `{ create }` or `{ repair }`, and is written by the first save through `ensureSite`.
  const pendingSiteRef = useRef(null)
  // the write in flight, so a second save at the same time (a double click, Save + the domain dialog) waits for it, not repeats it
  const ensuringRef = useRef(null)
  const savedSiteRef = useRef(savedSite)
  savedSiteRef.current = savedSite

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

  /**
 * Method to get the themes from API
 */
  const getSites = async () => {
    try {
      setOrderingTheme({
        ...orderingTheme,
        loading: true
      })
      const requestOptions = {
        ...requestBase,
        method: 'GET'
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const findByType = result.find(site => site.type === type)
        const found = result.find(site => site.code === appId)
        if (findByType) {
          pendingSiteRef.current = findByType.code !== appId
            ? { repair: { id: findByType.id, type, code: appId } }
            : null
          applyServerSite(findByType)
        } else if (found) {
          pendingSiteRef.current = { repair: { id: found.id, type, code: found.code } }
          applyServerSite(found)
        } else {
          pendingSiteRef.current = { create: { code: 'web_dashboard_x', name: 'Dashboard', type } }
          applyServerSite(null)
        }
      }
      setOrderingTheme({
        ...orderingTheme,
        loading: false
      })
    } catch (err) {
      setOrderingTheme({
        ...orderingTheme,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * writes what the load left pending (create the brand site, or fix its code and type) and gives back the site to
   * write on. Nothing pending: the site as it is. It throws the API answer when the write fails.
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
    setSavedSite(result)
    // the fields being edited stay as typed (same rule as setSiteFromServer)
    const dirtyKeys = Object.keys(changesRef.current || {})
    const next = { ...result, ...pick(siteRef.current, dirtyKeys) }
    siteRef.current = next
    setSite(next)
    return result
  }

  const handleUpdateSite = async (payload) => {
    // redesign my-products-dashboard (DB-01): a payload (e.g. "Remove custom domain" = { domain: null }) is sent as is,
    // and none = the pending changes. the site is created or fixed first when the load left that pending.
    // redesign D-81 part B: the answer tells the leave guard whether the Save worked ({ ok, error? }); nothing to send is fine
    const changes = payload ?? formState.changes
    if (!changes) return { ok: false, error: null }
    if (Object.keys(changes).length === 0) return { ok: true }
    if (!site?.id && !pendingSiteRef.current?.create) return { ok: false, error: null }

    const isExplicitPayload = payload != null
    try {
      // DB-02: the save is in flight until it answers (the brand's Save is disabled meanwhile)
      setFormState((prev) => ({ ...prev, loading: true }))
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      let siteId
      try {
        siteId = (await ensureSite())?.id
      } catch (result) {
        setFormState((prev) => ({ ...prev, loading: false }))
        const message = result instanceof Error ? result.message : result
        showToast(ToastType.Error, message)
        return { ok: false, error: message }
      }
      const seoOptions = {
        ...requestBase,
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/sites/${siteId}`, seoOptions)
      const { error, result } = await response.json()
      if (!error) {
        if (isExplicitPayload) {
          // only what was sent is cleared; unsaved name/description stay
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
        return { ok: true }
      }
      setFormState((prev) => ({ ...prev, loading: false }))
      showToast(ToastType.Error, result)
      return { ok: false, error: result }
    } catch (err) {
      setFormState((prev) => ({ ...prev, loading: false }))
      showToast(ToastType.Error, err.message)
      return { ok: false, error: err.message }
    }
  }

  // redesign D-81 part B: back to what the server has, without writing.
  const discardChanges = () => {
    const saved = savedSiteRef.current
    if (saved) setSite(JSON.parse(JSON.stringify(saved)))
    setFormState({ loading: false, changes: {}, error: null })
  }

  // redesign my-products-dashboard (R1-01): the `setSite` the UI receives (the domain dialog) is only called after
  // writing on the server, so it must not step on fields with unsaved changes (same rule as OW-12). Object or function.
  const setSiteFromServer = (update) => {
    const dirtyKeys = Object.keys(changesRef.current || {})
    const prev = siteRef.current
    const next = typeof update === 'function' ? update(prev) : update
    setSite({ ...next, ...pick(prev, dirtyKeys) })
    setSavedSite((saved) => ({ ...saved, ...omit(next, dirtyKeys) }))
  }

  useEffect(() => {
    if (!appId || !type) return
    getSites()
  }, [appId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          orderingTheme={orderingTheme}
          site={site}
          setSite={setSiteFromServer}
          formState={formState}
          handleChangeInput={handleChangeInput}
          handleUpdateSite={handleUpdateSite}
          ensureSite={ensureSite}
          savedSite={savedSite}
          discardChanges={discardChanges}
        />
      )}
    </>
  )
}

Dashboard.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
