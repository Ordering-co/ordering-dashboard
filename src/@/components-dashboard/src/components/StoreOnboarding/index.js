import { useProjectState } from '../../ui/src/contexts/ProjectContext'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useStoreOnboardingLanguage } from '../../utils/useStoreOnboardingLanguage'
import { useConfig } from '../../contexts/ConfigContext'
import { createDraft, readDraft, newKey, validateStep, validateForm, getRestaurantUrl, applyMenuChange } from '../../utils/storeOnboarding'
import { effectiveRegionalConfigs } from '../../utils/storeOnboardingRegional'
import { createDraftMedia } from '../../utils/storeOnboardingDraftMedia'
import { createOnboardingApi } from '../../utils/storeOnboardingApi'

export const StoreOnboarding = ({ UIComponent, storageKey, onComplete }) => {
  const [ordering] = useApi()
  const [projectStatus, projectActions] = useProjectState()
  const websiteProduct = projectStatus.websiteProduct
  const [{ user, token }] = useSession()
  const [, t] = useStoreOnboardingLanguage()
  const [, { refreshConfigs }] = useConfig()
  const abort = useMemo(() => new AbortController(), [storageKey, token])
  const api = useMemo(() => createOnboardingApi({ root: ordering.root, token, signal: abort.signal, websiteProduct }), [ordering.root, token, abort, websiteProduct])
  const [draft, setDraft] = useState(() => {
    const saved = readDraft(localStorage, storageKey)
    if (saved) return saved
    const fresh = createDraft(user.email)
    const phone = String(user.cellphone || user.phone || '')
    const prefix = String(user.country_phone_code || '')
    fresh.form.zone.name = t('DELIVERY', 'Delivery')
    fresh.form.phone = phone.startsWith('+') || !prefix ? phone : `+${prefix.replace(/\D/g, '')}${phone.replace(/\D/g, '')}`
    return fresh
  })
  const media = useMemo(() => createDraftMedia(storageKey), [storageKey])
  const [mediaReady, setMediaReady] = useState(() => { try { media.resolve(draft); return true } catch { return false } })
  const pendingEdit = useRef(null)
  const current = useRef(draft)
  const busy = useRef(false)
  const [publishing, setPublishing] = useState(false)
  const [errors, setErrors] = useState([])
  const [notice, setNotice] = useState('')
  const [meta, setMeta] = useState({ loading: true, configs: {}, paymethods: [] })
  const [reload, setReload] = useState(0)
  const [appearanceRetry, setAppearanceRetry] = useState(0)
  const [appearance, setAppearance] = useState({ loading: true, error: false })
  const [siteRetry, setSiteRetry] = useState(0)
  const [site, setSite] = useState({ loading: false, url: null, error: false })
  const wasStored = useRef(Boolean(localStorage.getItem(storageKey)))
  const adopt = next => { const owned = { ...next, journal: structuredClone(next.journal) }; current.current = owned; setDraft(owned) }
  const latestDraft = () => {
    const raw = localStorage.getItem(storageKey)
    const stored = readDraft(localStorage, storageKey)
    const saved = stored && media.resolve(stored)
    if ((raw && !saved) || (saved && saved.nonce !== current.current.nonce) || (!raw && wasStored.current)) throw new Error('draft_changed')
    if (saved) { wasStored.current = true; adopt(saved); return saved }
    return current.current
  }
  const persist = requested => {
    const next = requested.form.menuDrafts && ['manual', 'sample'].includes(requested.form.menuMode)
      ? { ...requested, form: { ...requested.form, menuDrafts: { ...requested.form.menuDrafts, [requested.form.menuMode]: requested.form.categories } } }
      : requested
    if (abort.signal.aborted) throw new Error('cancelled')
    const latest = latestDraft()
    if ((latest.journal.started && !next.journal.started && !(busy.current && !latest.journal.businessId)) ||
      (latest.journal.businessId && !next.journal.businessId) || (latest.journal.published && !next.journal.published)) throw new Error('journal_changed')
    const before = localStorage.getItem(storageKey)
    const previous = readDraft(localStorage, storageKey)
    const encoded = media.encode(next, previous)
    const commit = () => {
      if (abort.signal.aborted) throw new Error('cancelled')
      if (localStorage.getItem(storageKey) !== before) throw new Error('draft_changed')
      const saved = JSON.stringify(encoded.draft)
      localStorage.setItem(storageKey, saved)
      wasStored.current = true
      adopt(next)
      const cleanup = media.collect(previous, encoded.draft, () => !abort.signal.aborted && localStorage.getItem(storageKey) === saved)
      return cleanup?.catch(() => {})
    }
    const failed = async error => {
      try { await encoded.discard(ref => !String(localStorage.getItem(storageKey) || '').includes(ref)) } catch {}
      throw error
    }
    if (encoded.ready) return encoded.ready.then(commit).catch(failed)
    try { return commit() } catch (error) { return failed(error) }
  }
  const enqueueDraftWrite = run => {
    if (navigator.locks) return navigator.locks.request(storageKey, { signal: abort.signal }, run)
    const result = pendingEdit.current ? pendingEdit.current.then(run) : run()
    if (!result?.then) return result
    const barrier = result.then(() => {}, () => {})
    const owned = barrier.finally(() => { if (pendingEdit.current === owned) pendingEdit.current = null })
    pendingEdit.current = owned
    return result
  }
  useEffect(() => {
    const receive = event => {
      if (event.key !== storageKey || abort.signal.aborted) return
      const saved = readDraft({ getItem: () => event.newValue }, storageKey)
      if (!saved || saved.nonce !== current.current.nonce) { setNotice('storage'); return }
      const receiveDraft = next => {
        if (abort.signal.aborted || localStorage.getItem(storageKey) !== event.newValue) return
        wasStored.current = true
        adopt(next)
      }
      try { receiveDraft(media.resolve(saved)) } catch {
        media.load(saved).then(receiveDraft).catch(() => { if (!abort.signal.aborted) setNotice('storage') })
      }
    }
    window.addEventListener('storage', receive)
    return () => window.removeEventListener('storage', receive)
  }, [storageKey, abort, media])
  useEffect(() => () => abort.abort(), [abort])
  useEffect(() => {
    let active = true
    setMeta({ loading: true, configs: {}, paymethods: [] })
    api.bootstrap(abort.signal).then(async result => {
      if (!active || abort.signal.aborted) return
      setMeta({ ...result, configs: effectiveRegionalConfigs(result.configs, result.countries), loading: false })

      try {
        const raw = localStorage.getItem(storageKey)
        const stored = readDraft(localStorage, storageKey) || current.current
        if (stored.nonce !== current.current.nonce) throw new Error('draft_changed')
        let hydrated
        try { hydrated = media.resolve(stored) } catch { hydrated = await media.load(stored) }
        if (!active || abort.signal.aborted) return
        if (localStorage.getItem(storageKey) !== raw) throw new Error('draft_changed')
        adopt(hydrated)
        setMediaReady(true)
        await enqueueDraftWrite(() => {
          if (!active || abort.signal.aborted) return
          const latest = latestDraft()
          if (latest.defaultsPending !== true || latest.journal.started) return
          const next = { ...latest, form: { ...latest.form }, defaultsPending: false }
          const timezone = result.configs.timezone?.value || result.configs.default_timezone?.value
          if (timezone && !next.timezoneEdited) next.form.timezone = timezone
          return persist(next)
        })
      } catch { if (active && !abort.signal.aborted) setNotice('storage') }
    }).catch(() => {
      if (active && !abort.signal.aborted) setMeta({ loading: false, error: true, configs: {}, paymethods: [] })
    })
    return () => { active = false }
  }, [api, abort, reload, storageKey, media])
  useEffect(() => {
    let active = true
    setAppearance({ loading: true, error: false, websiteProduct })
    if (websiteProduct === null) { setAppearance({ loading: Boolean(projectStatus.loading), error: !projectStatus.loading, websiteProduct }); return }
    api.getWebsiteAppearance(abort.signal).then(async result => {
      if (!active || abort.signal.aborted) return
      setAppearance({ ...result, loading: false, error: false, websiteProduct })
      if (!mediaReady) return
      try {
        await enqueueDraftWrite(() => {
          if (!active || abort.signal.aborted) return
          const latest = latestDraft()
          if (!latest.journal.started && latest.form.websiteColor && (latest.form.websiteAppearanceTarget?.siteId !== result.siteId || latest.form.websiteAppearanceTarget?.themeId !== result.themeId)) {
            return persist({ ...latest, form: { ...latest.form, websiteAppearanceTarget: { siteId: result.siteId, themeId: result.themeId } } })
          }
        })
      } catch { if (active && !abort.signal.aborted) setNotice('storage') }
    }).catch(() => {
      if (active && !abort.signal.aborted) setAppearance({ loading: false, error: true, websiteProduct })
    })
    return () => { active = false }
  }, [api, abort, appearanceRetry, websiteProduct, projectStatus.loading, mediaReady])
  const edit = change => {
    if (busy.current || abort.signal.aborted || !mediaReady) return false
    const run = () => {
      const latest = latestDraft()
      if (latest.journal.started) return false
      const next = change(latest)
      if (!next) return false
      const saved = persist(next)
      const done = () => { setNotice(''); return true }
      return saved?.then ? saved.then(done) : done()
    }
    const failed = () => { if (!abort.signal.aborted) setNotice('storage'); return false }
    try { const result = enqueueDraftWrite(run); return result?.then ? result.catch(failed) : result } catch { return failed() }
  }

  const update = patch => edit(latest => {
    setErrors([])
    const form = { ...latest.form, ...patch }
    if (patch.zone) form.zone = { ...latest.form.zone, ...patch.zone }
    return { ...latest, ...(Object.prototype.hasOwnProperty.call(patch, 'timezone') && { timezoneEdited: true }), form }
  })
  const updateMenu = change => edit(latest => ({ ...latest, form: { ...latest.form, categories: applyMenuChange(latest.form, change) } }))
  const move = step => edit(latest => {
    const order = [0, 1, 2, 3, 5]
    if (!order.includes(step) || order.indexOf(step) > order.indexOf(latest.step) + 1) return
    const errors = step > latest.step ? (latest.step === 3 ? [...validateStep(latest.form, 3), ...validateStep(latest.form, 4)] : validateStep(latest.form, latest.step)) : []
    setErrors(errors)
    return errors.length ? null : { ...latest, step }
  })
  const chooseMenu = sample => edit(latest => {
    const form = latest.form
    const menuDrafts = { ...form.menuDrafts, ...(form.menuMode && { [form.menuMode]: form.categories }) }
    if (sample === null) return { ...latest, form: { ...form, menuMode: '', categories: [], menuDrafts } }
    const mode = sample ? 'sample' : 'manual'
    const categories = menuDrafts[mode] || (sample
      ? [{
          key: newKey(),
          name: t('STORE_ONBOARDING_SAMPLE_CATEGORY', 'Pizzas'),
          products: [
            { key: newKey(), name: t('STORE_ONBOARDING_SAMPLE_PRODUCT_ONE', 'Margherita pizza'), price: '12' },
            { key: newKey(), name: t('STORE_ONBOARDING_SAMPLE_PRODUCT_TWO', 'Pepperoni pizza'), price: '15' },
            { key: newKey(), name: t('STORE_ONBOARDING_SAMPLE_VEGETARIAN_PIZZA', 'Vegetarian pizza'), price: '14' },
            { key: newKey(), name: t('STORE_ONBOARDING_SAMPLE_BBQ_PIZZA', 'BBQ chicken pizza'), price: '16' }
          ]
        }, {
          key: newKey(),
          name: t('STORE_ONBOARDING_SAMPLE_SIDES', 'Sides'),
          products: [
            { key: newKey(), name: t('STORE_ONBOARDING_SAMPLE_GARLIC_BREAD', 'Garlic bread'), price: '5' },
            { key: newKey(), name: t('STORE_ONBOARDING_SAMPLE_FRIES', 'French fries'), price: '4' },
            { key: newKey(), name: t('STORE_ONBOARDING_SAMPLE_WINGS', 'Chicken wings'), price: '8' }
          ]
        }, {
          key: newKey(),
          name: t('STORE_ONBOARDING_SAMPLE_DRINKS', 'Drinks'),
          products: [
            { key: newKey(), name: t('STORE_ONBOARDING_SAMPLE_LEMONADE', 'Lemonade'), price: '3' },
            { key: newKey(), name: t('STORE_ONBOARDING_SAMPLE_WATER', 'Sparkling water'), price: '2' },
            { key: newKey(), name: t('STORE_ONBOARDING_SAMPLE_TEA', 'Iced tea'), price: '3' }
          ]
        }]
      : [])
    setErrors([])
    return { ...latest, form: { ...form, menuMode: mode, menuDrafts, categories } }
  })
  const publish = async () => {
    if (busy.current || meta.loading || meta.error || !mediaReady || pendingEdit.current) return
    busy.current = true
    setPublishing(true)
    setNotice('')
    const run = async () => {
      const snapshot = structuredClone(latestDraft())
      const invalid = validateForm(snapshot.form)[0]
      if (invalid) { setErrors(invalid.errors); await persist({ ...snapshot, step: invalid.step === 4 ? 3 : invalid.step }); return }
      await persist(snapshot)
      await api.publish(snapshot, user.id, persist)

      try { await refreshConfigs() } catch {}
    }
    try {
      if (navigator.locks) await navigator.locks.request(storageKey, { signal: abort.signal }, run)
      else await run()
    } catch {
      if (!abort.signal.aborted) setNotice('publish')
    } finally {
      busy.current = false
      if (!abort.signal.aborted) setPublishing(false)
    }
  }
  const refreshSite = () => { setSiteRetry(n => n + 1); if (!websiteProduct) projectActions.getProjectStatus?.() }
  useEffect(() => {
    if (!draft.journal.published) return
    if (websiteProduct === null) { setSite({ loading: Boolean(projectStatus.loading), url: null, error: !projectStatus.loading, websiteProduct }); return }
    const request = new AbortController()
    let active = true
    let retryTimer
    let availableUrl = null
    const deadline = Date.now() + 10000
    setSite({ loading: true, url: null, error: false, websiteProduct })
    const finish = next => { if (active) setSite({ ...next, websiteProduct }) }
    const timeout = setTimeout(() => { request.abort(); clearTimeout(retryTimer); finish({ loading: false, url: availableUrl, error: false }) }, 10000)
    const check = async () => {
      try {
        const sites = await api.getWebsiteSites(request.signal)
        if (!active || request.signal.aborted) return
        availableUrl = getRestaurantUrl(sites, draft.journal.slug, { websiteProduct, root: ordering.root })
        if (availableUrl) { clearTimeout(timeout); finish({ loading: false, url: availableUrl, error: false }); return }
        if (Date.now() + 2000 < deadline) retryTimer = setTimeout(check, 2000)
        else { clearTimeout(timeout); finish({ loading: false, url: null, error: false }) }
      } catch {
        if (!active || request.signal.aborted) return
        if (Date.now() + 2000 < deadline) retryTimer = setTimeout(check, 2000)
        else { clearTimeout(timeout); finish({ loading: false, url: null, error: true }) }
      }
    }
    check()
    return () => { active = false; clearTimeout(timeout); clearTimeout(retryTimer); request.abort() }
  }, [draft.journal.published, draft.journal.slug, api, siteRetry, websiteProduct, projectStatus.loading, ordering.root])
  const cashId = meta.paymethods.find(p => p.gateway === 'cash')?.id
  const testOrderEnabled = Boolean(draft.journal.published && draft.form.orderTypes.includes(1) && draft.form.payments.includes('cash') && cashId)
  return <UIComponent mediaReady={mediaReady} testOrder={{ enabled: testOrderEnabled }} draft={draft} update={update} updateMenu={updateMenu} move={move} chooseMenu={chooseMenu} publish={publish} publishing={publishing} errors={errors} notice={notice} meta={meta} retryMetadata={() => setReload(n => n + 1)} site={site.websiteProduct === websiteProduct ? site : { loading: true, url: null, error: false }} refreshSite={refreshSite} onComplete={onComplete} appearance={appearance.websiteProduct === websiteProduct ? appearance : { loading: true, error: false }} retryAppearance={() => { setAppearanceRetry(n => n + 1); if (!websiteProduct) projectActions.getProjectStatus?.() }} project={ordering.project || ordering.root.split('/').pop()} />
}
