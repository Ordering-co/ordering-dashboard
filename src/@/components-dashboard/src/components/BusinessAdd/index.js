import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import {
  addProblems,
  allDaySchedule,
  businessBody,
  citiesOf,
  followUpJobs,
  galleryBody,
  offeredPaymethods,
  paymethodBody,
  SANDBOX_REQUIRED_GATEWAYS,
  zoneBody
} from '../../utils/storeAdd'

/**
 * Store add (redesign ): holds the form and creates the store, without UI.
 *
 * The requests and their bodies are main's (utils/storeAdd.js): `POST /business` through the SDK, then one
 * `POST /business/:id/paymethods` per method, one `POST /business/:id/gallery` per photo and `POST /business/:id/deliveryzones`,
 * in that order. What changes (G5-23, SA-01, SA-04): every answer is read. When the store was created but a later write failed,
 * the state says which one and `retry()` repeats only the failed ones against the same store: the add never creates a second
 * store. Before repeating, it asks what already exists (a write can reach the API and still fail on the way back): a payment
 * method already linked or a zone with the same name counts as done, and after a network failure of `POST /business` itself
 * the next try first looks the store up by its slug (the onboarding's idea, utils/storeOnboardingApi.js). A photo is repeated
 * as it is (its file cannot be matched). `submit()` refuses while the form has problems (G5-20) and returns them.
 *
 * Status: `editing` → `creating` (POST /business) → `finishing` (the follow-up writes) → `created` | `partial`.
 */
export const BusinessAdd = (props) => {
  const {
    UIComponent,
    handleOpenCategory,
    onCreated,
    defaultSandboxRequiredGateways
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const sandboxGateways = defaultSandboxRequiredGateways || SANDBOX_REQUIRED_GATEWAYS

  // G5-21: the email for orders starts as the user's and is held, so the field shows what will be sent
  const [form, setForm] = useState(() => ({ email: session?.user?.email || '' }))
  const [touched, setTouched] = useState(false)
  const [schedule, setSchedule] = useState(allDaySchedule)
  const [gallery, setGallery] = useState([])
  const [paymethodIds, setPaymethodIds] = useState([])
  const paymethodsChosen = useRef(false)
  const [zone, setZone] = useState(null)
  const [cityId, setCityId] = useState(null)
  const cityChosen = useRef(false)
  const [paymethodsList, setPaymethodsList] = useState({ paymethods: [], loading: true, error: null })
  const [countriesState, setCountriesState] = useState({ countries: [], loading: true, error: null })
  const [submitState, setSubmitState] = useState({ status: 'editing', business: null, jobs: [], error: null })
  const busy = useRef(false)
  // review 1-2: a POST /business that failed on the way (network) may still have created the store. What was sent is kept here
  // (not in the error the next edit clears) until a lookup says whether that store exists.
  const networkAttempt = useRef(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const headers = (extra = {}) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`,
    ...extra
  })
  const appHeaders = { 'x-app-x': ordering.appId, 'X-INTERNAL-PRODUCT-X': ordering.appInternalName }

  const getPaymethods = async () => {
    try {
      const response = await fetch(`${ordering.root}/paymethods?where=[{%22attribute%22:%22enabled%22,%22value%22:true}]`, {
        method: 'GET',
        headers: headers(appHeaders)
      })
      const content = await response.json()
      if (content?.error) throw new Error(Array.isArray(content.result) ? content.result[0] : content.result)
      const paymethods = offeredPaymethods(content?.result || [])
      if (!mounted.current) return
      setPaymethodsList({ paymethods, loading: false, error: null })
      // G5-29: main pre-selected the first method of the list; it still does, and it is always one the list shows
      if (!paymethodsChosen.current && paymethods.length) setPaymethodIds([paymethods[0].id])
    } catch (err) {
      if (mounted.current) setPaymethodsList({ paymethods: [], loading: false, error: err?.message || 'error' })
    }
  }

  const getCountries = async () => {
    try {
      const { content: { error, result } } = await ordering.countries().select().get()
      if (!mounted.current) return
      if (error) throw new Error(Array.isArray(result) ? result[0] : result)
      setCountriesState({ countries: result || [], loading: false, error: null })
      // G5-24: main sent the first city of the first enabled country; it is now a visible choice that starts there
      const first = citiesOf(result)[0]
      if (!cityChosen.current && first) setCityId(first.id)
    } catch (err) {
      if (mounted.current) setCountriesState({ countries: [], loading: false, error: err?.message || 'error' })
    }
  }

  useEffect(() => {
    getPaymethods()
    getCountries()
  }, [])

  const editable = submitState.status === 'editing'
  const markTouched = () => { if (!touched) setTouched(true) }

  /**
   * Holds fields of the store (`{ name: value, … }`). `{ silent: true }` is for a value the page fills in by itself (the
   * project's time zone): it does not count as an edit, so leaving still goes without asking.
   */
  const changeFields = (patch, { silent = false } = {}) => {
    if (!editable) return
    if (!silent) markTouched()
    setSubmitState(prev => (prev.error ? { ...prev, error: null } : prev))
    setForm(prev => ({ ...prev, ...patch }))
  }
  const changeSchedule = (next) => { if (!editable) return; markTouched(); setSchedule(next) }
  const changeGallery = (next) => { if (!editable) return; markTouched(); setGallery(prev => (typeof next === 'function' ? next(prev) : next)) }
  const changePaymethodIds = (next) => { if (!editable) return; markTouched(); paymethodsChosen.current = true; setPaymethodIds(next) }
  const changeZone = (next) => { if (!editable) return; markTouched(); setZone(prev => (typeof next === 'function' ? next(prev) : next)) }
  const changeCity = (next) => { if (!editable) return; markTouched(); cityChosen.current = true; setCityId(next) }

  const problems = addProblems({ form, paymethodIds, zone })

  const readContent = async (response) => {
    let content
    try { content = await response.json() } catch { return { ok: false, error: null } }
    if (!response.ok || content?.error) {
      const message = Array.isArray(content?.result) ? content.result[0] : (typeof content?.result === 'string' ? content.result : null)
      return { ok: false, error: message || null }
    }
    return { ok: true, result: content?.result }
  }

  const runJob = async (business, job) => {
    try {
      let response
      if (job.kind === 'details') {
        // bugs E 40a: what was edited after a network failure goes to the store that attempt created, through the
        // SDK path the dashboard uses to edit a store (`businesses(id).save`)
        const answer = await ordering.businesses(business.id).save(job.changes, { accessToken: session.token })
        const content = answer?.content
        if (!content || content.error) {
          const message = Array.isArray(content?.result) ? content.result[0] : (typeof content?.result === 'string' ? content.result : null)
          return { ...job, status: 'failed', error: message || null }
        }
        return { ...job, status: 'done', error: null }
      }
      if (job.kind === 'paymethod') {
        const paymethod = paymethodsList.paymethods.find(item => item.id === job.id) || { id: job.id }
        response = await fetch(`${ordering.root}/business/${business.id}/paymethods`, {
          method: 'POST', headers: headers(appHeaders), body: JSON.stringify(paymethodBody(paymethod, sandboxGateways))
        })
      } else if (job.kind === 'photo') {
        response = await fetch(`${ordering.root}/business/${business.id}/gallery`, {
          method: 'POST', headers: headers(), body: JSON.stringify(galleryBody(business.id, job.photo))
        })
      } else {
        response = await fetch(`${ordering.root}/business/${business.id}/deliveryzones`, {
          method: 'POST', headers: headers(), body: JSON.stringify(zoneBody(zone))
        })
      }
      const outcome = await readContent(response)
      return { ...job, status: outcome.ok ? 'done' : 'failed', error: outcome.error }
    } catch (err) {
      return { ...job, status: 'failed', error: null }
    }
  }

  const list = async (path) => {
    try {
      const response = await fetch(`${ordering.root}${path}`, { method: 'GET', headers: headers(appHeaders) })
      const outcome = await readContent(response)
      return outcome.ok && Array.isArray(outcome.result) ? outcome.result : null
    } catch {
      return null
    }
  }

  // A retry asks first what already exists, so a write that reached the API is not made twice
  const reconcile = async (business, jobs) => {
    let current = jobs
    if (current.some(job => job.kind === 'paymethod' && job.status === 'pending')) {
      const linked = await list(`/business/${business.id}/paymethods`)
      if (linked) {
        const ids = linked.map(item => Number(item?.paymethod_id ?? item?.paymethod?.id))
        current = current.map(job => (job.kind === 'paymethod' && job.status === 'pending' && ids.includes(Number(job.id)) ? { ...job, status: 'done' } : job))
      }
    }
    if (zone && current.some(job => job.kind === 'zone' && job.status === 'pending')) {
      const zones = await list(`/business/${business.id}/deliveryzones`)
      if (zones?.some(item => String(item?.name ?? '').trim() === String(zone.name ?? '').trim())) {
        current = current.map(job => (job.kind === 'zone' ? { ...job, status: 'done' } : job))
      }
    }
    return current
  }

  // After a network failure of POST /business, the store may exist: look it up by the slug that was sent. It is ours only when it
  // has that slug, that name (trimmed, any case: the API may trim it) and, when the answer says, this user as owner; a store of
  // someone else with the same slug is never taken (review 1).
  const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()
  // bugs E 40a: what the form holds now and the failed attempt did not send (a key it sent and the form no longer has
  // cannot be unset through the API, so it is left alone)
  const changesSince = (sentBody, body) => Object.keys(body).reduce((result, key) => (
    JSON.stringify(body[key]) === JSON.stringify(sentBody?.[key]) ? result : { ...result, [key]: body[key] }
  ), {})
  // a renamed or re-slugged store that was updated after being adopted is that name and slug from then on
  const withDetails = (business, jobs) => {
    const details = jobs.find(job => job.kind === 'details' && job.status === 'done')
    if (!details) return business
    const { name, slug } = details.changes
    return { ...business, ...(name !== undefined && { name }), ...(slug !== undefined && { slug }) }
  }
  const findOwnAttempt = async ({ slug, name }) => {
    const where = encodeURIComponent(JSON.stringify([{ attribute: 'slug', value: slug }]))
    const found = await list(`/business?where=${where}&params=id,slug,name,owner_id`)
    if (!found) return { checked: false, store: null }
    return {
      checked: true,
      store: found.find(item => same(item?.slug, slug) && same(item?.name, name) &&
        (item?.owner_id == null || String(item.owner_id) === String(session?.user?.id ?? ''))) || null
    }
  }

  // Whatever throws once the store exists keeps the store: what was still pending counts as failed and «Try again» repeats it
  const keepStore = (created, jobs) => {
    const business = withDetails(created, jobs)
    const marked = jobs.map(job => (job.status === 'done' ? job : { ...job, status: 'failed', error: null }))
    if (mounted.current) setSubmitState({ status: 'partial', business, jobs: marked, error: null })
    return { ok: false, partial: true, business, jobs: marked }
  }

  // main's order: every payment method, then every photo, then the zone; each group at once, as before
  const runJobs = async (business, jobs) => {
    let current = jobs
    for (const kind of ['details', 'paymethod', 'photo', 'zone']) {
      const pending = current.filter(job => job.kind === kind && job.status !== 'done')
      if (!pending.length) continue
      const results = await Promise.all(pending.map(job => runJob(business, job)))
      current = current.map(job => results.find(result => result.key === job.key) || job)
      if (mounted.current) setSubmitState(prev => ({ ...prev, jobs: current }))
    }
    return current
  }

  const finish = (created, jobs) => {
    const business = withDetails(created, jobs)
    const failed = jobs.filter(job => job.status === 'failed')
    if (!mounted.current) return { ok: !failed.length, business, jobs }
    if (failed.length) {
      setSubmitState({ status: 'partial', business, jobs, error: null })
      return { ok: false, partial: true, business, jobs }
    }
    setSubmitState({ status: 'created', business, jobs, error: null })
    showToast(ToastType.Success, t('BUSINESS_ADDED', 'Business added'))
    // the store is complete: a navigation that throws must not send the page back to a form that would create it again
    try {
      if (onCreated) onCreated(business)
      else if (handleOpenCategory) handleOpenCategory(business.slug)
    } catch {}
    return { ok: true, business, jobs }
  }

  /** Creates the store and its follow-up writes. With problems it does nothing and returns them. */
  const submit = async () => {
    if (busy.current) return { ok: false }
    if (submitState.business) return retry()
    if (Object.keys(problems).length) return { ok: false, problems }
    busy.current = true
    setSubmitState({ status: 'creating', business: null, jobs: [], error: null })
    let business = null
    let changes = null
    try {
      if (networkAttempt.current) {
        // the lookup could not say (it failed too): nothing is sent, the attempt is kept for the next try
        const check = await findOwnAttempt(networkAttempt.current)
        if (!check.checked) throw new Error('lookup_failed')
        business = check.store
        // bugs E 40a: the store the failed attempt created has what that attempt sent; whatever the user changed
        // since is applied to it below, so nothing edited after the failure is lost
        if (business) {
          const diff = changesSince(networkAttempt.current.body, businessBody({ form, schedule, ownerId: session?.user?.id, cityId }))
          if (Object.keys(diff).length) changes = diff
        }
        networkAttempt.current = null
      }
      if (!business) {
        const body = businessBody({ form, schedule, ownerId: session?.user?.id, cityId })
        const sent = { slug: form.slug, name: form.name, body }
        let response
        try {
          response = await ordering.businesses().save(body, { accessToken: session.token })
        } catch (err) {
          networkAttempt.current = sent
          throw err
        }
        const content = response?.content
        if (content && content.error) {
          const messages = Array.isArray(content?.result) ? content.result : [content?.result].filter(Boolean)
          if (mounted.current) setSubmitState({ status: 'editing', business: null, jobs: [], error: { messages } })
          busy.current = false
          return { ok: false, error: messages }
        }
        // an answer that is not an error but carries no store cannot say whether it was created: the network case
        if (!content?.result?.id) {
          networkAttempt.current = sent
          throw new Error('unclear_answer')
        }
        business = content.result
      }
    } catch {
      if (mounted.current) setSubmitState({ status: 'editing', business: null, jobs: [], error: { messages: [], network: true } })
      busy.current = false
      return { ok: false }
    }
    // from here the store exists: nothing below may forget it
    const jobs = [
      ...(changes ? [{ key: 'details', kind: 'details', changes }] : []),
      ...followUpJobs({ paymethodIds, gallery, zone })
    ].map(job => ({ ...job, status: 'pending', error: null }))
    try {
      if (mounted.current) setSubmitState({ status: 'finishing', business, jobs, error: null })
      const done = await runJobs(business, jobs)
      return finish(business, done)
    } catch {
      return keepStore(business, jobs)
    } finally {
      busy.current = false
    }
  }

  /** Repeats only the writes that failed, against the store already created. */
  const retry = async () => {
    const { business, jobs } = submitState
    if (busy.current || !business) return { ok: false }
    busy.current = true
    const again = jobs.map(job => (job.status === 'failed' ? { ...job, status: 'pending', error: null } : job))
    setSubmitState({ status: 'finishing', business, jobs: again, error: null })
    try {
      const checked = await reconcile(business, again)
      const done = await runJobs(business, checked)
      return finish(business, done)
    } catch {
      return keepStore(business, again)
    } finally {
      busy.current = false
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          form={form}
          changeFields={changeFields}
          schedule={schedule}
          changeSchedule={changeSchedule}
          gallery={gallery}
          changeGallery={changeGallery}
          paymethodsList={paymethodsList}
          paymethodIds={paymethodIds}
          changePaymethodIds={changePaymethodIds}
          zone={zone}
          changeZone={changeZone}
          cities={citiesOf(countriesState.countries)}
          citiesLoading={countriesState.loading}
          cityId={cityId}
          changeCity={changeCity}
          problems={problems}
          dirty={touched && editable}
          submitState={submitState}
          submit={submit}
          retry={retry}
          retryPaymethods={getPaymethods}
        />
      )}
    </>
  )
}

BusinessAdd.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /** `(slug)`: where main went after creating (Products of the new store) */
  handleOpenCategory: PropTypes.func,
  /** `(business)`: replaces `handleOpenCategory` after a complete add (the tutorial goes back to the list) */
  onCreated: PropTypes.func
}
