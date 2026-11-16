import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useEvent } from '../../contexts/EventContext'
import { useAssistantRecordChanges } from '../../contexts/AssistantContext'
import { translateApiMessage } from '../../utils/translateApiMessage'
import { saveAssignment } from '../../utils/saveAssignment'

const STREAM_ORDERS_STATUS_URL = 'https://stream-orders.plugins.orderingplus.com'
const VISIBLE_STREAM_STATUSES = ['connected', 'paused', 'disconnected']

const isStreamOrdersPlugin = (plugin) => {
  const identifiers = [plugin?.key, plugin?.url, plugin?.name]
    .map((value) => String(value ?? '').toLowerCase().replace(/[\s_-]+/g, ''))
  return identifiers.some((id) => id.includes('streamorder'))
}

const mapStreamStatus = (result) => {
  const status = result?.status
  if (status === 'not_connected') return null
  if (VISIBLE_STREAM_STATUSES.includes(status)) return status
  return null
}

// The first message of an API error: a string, a list of strings or of { message }.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

export const BusinessDetails = (props) => {
  props = { ...defaultProps, ...props }
  const {
    asDashboard,
    business,
    businessId,
    propsToFetch,
    UIComponent,
    handleSucessUpdateBusiness,
    handleSucessRemoveBusiness,
    handleSucessAddBusiness,
    notGetSites,
    notGetTaxes,
    notGetStreamConnection,
    googleFeedSecondaryIncludedIds,
    googleFeedInclusionListLoading,
    googleFeedSavingBusinessId,
    googleFeedSavingChannel,
    handleGoogleFeedToggle,
    googleFeedExcludedBusinessIds
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast, hideToast }] = useToast()
  const [, t] = useLanguage()
  const [events] = useEvent()
  const [businessState, setBusinessState] = useState({ business: null, loading: true, error: null })

  // The assistant changed this store: show the values it read back
  useAssistantRecordChanges(({ entity, id, after }) => {
    if (entity !== 'Business' || !after || !id || id !== businessState.business?.id) return
    setBusinessState(prev => ({ ...prev, business: { ...prev.business, ...after } }))
  })
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [spoonityKeyState, setSpoonityKeyState] = useState({ loading: false, key: '', result: { error: false } })
  const [siteState, setSiteState] = useState({ site: null, loading: false, error: null })
  const [formTaxChanges, setFormTaxChanges] = useState({})
  const [taxes, setTaxes] = useState({})
  const [taxCatalogState, setTaxCatalogState] = useState({ loading: !notGetTaxes, loaded: false, error: null })
  const taxRequest = useRef(null)
  const [fees, setFees] = useState({})
  const [taxToEdit, setTaxToEdit] = useState({ action: null, payload: null })
  const [formTaxState, setFormTaxState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [streamConnectionState, setStreamConnectionState] = useState({
    enabled: false,
    loading: false,
    status: null,
    error: null
  })

  /**
   * Clean formState
   */
  const cleanFormState = (values) => setFormState({ ...formState, ...values })

  /**
   * Method to get business from API
   */
  const getBusinesses = async () => {
    try {
      setBusinessState({
        ...businessState,
        loading: true
      })
      const fetchEndpoint = asDashboard
        ? ordering.setAccessToken(session.token).businesses(businessId).asDashboard().select(propsToFetch)
        : ordering.setAccessToken(session.token).businesses(businessId).select(propsToFetch)
      const { content: { result } } = await fetchEndpoint.get()
      const business = Array.isArray(result) ? null : result
      setBusinessState({
        ...businessState,
        loading: false,
        business
      })
    } catch (err) {
      setBusinessState({
        ...businessState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to change business enable/disable or featured/not featured
   * @param {Boolean} enabled business enable state
   * @param {Boolean} isFeatured state to check enable or featured
   * @returns {Promise<{ok: boolean, error?: *}>} redesign SL-F1 (A3): `{ ok: true }` once saved; `{ ok: false, error }` on an API error
   * or an exception. Other consumers ignore it.
   */

  const handleChangeActiveBusiness = async (enabled, isFeatured = false) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const changes = isFeatured ? { featured: enabled } : { enabled }
      const { content: { error, result } } = await ordering.setAccessToken(session.token).businesses(businessId).save(changes)
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: error ? result : null
      })

      if (!error) {
        setBusinessState({
          ...businessState,
          business: {
            ...businessState.business,
            ...result
          }
        })
        showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
        return { ok: true }
      }
      // redesign SL-F1 (A3): the list switches (StoreRowSwitch) read this to go back to the stored value and say why
      // redesign bugs F row 19: no error toast replaces «Loading» here (the caller says why, inline), so hide it
      hideToast?.()
      return { ok: false, error: result }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
      hideToast?.() // redesign bugs F row 19: same as the API error above
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to delete business from API
   */
  const handleDeleteBusiness = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}`, requestOptions)
      const content = await response.json()

      setActionStatus({
        ...actionStatus,
        loading: false,
        error: content.error ? content.result : null
      })
      if (!content.error) {
        showToast(ToastType.Success, t('BUSINESS_DELETED', 'Business deleted'))
        handleSucessRemoveBusiness && handleSucessRemoveBusiness(businessId)
        props.onClose && props.onClose()
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to duplicate business from API
   * @returns {Promise<{ok: boolean, result?: object, error?: *, busy?: boolean}>} redesign stores 4.B (decision 6, G1-27):
   * `{ ok: true, result }` (the copy) once created; `{ ok: false, error }` on an API error or an exception (also in `actionStatus`);
   * `{ ok: false, busy: true }` without a request while the previous one is on its way, so two clicks make one copy.
   */
  const duplicatingRef = useRef(false)
  const handleDuplicateBusiness = async () => {
    if (duplicatingRef.current) return { ok: false, busy: true }
    duplicatingRef.current = true
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/duplicate`, requestOptions)
      const content = await response.json()

      setActionStatus({
        ...actionStatus,
        loading: false,
        error: content.error ? content.result : null
      })

      if (!content.error) {
        handleSucessAddBusiness && handleSucessAddBusiness(content?.result)
        // the copy by its name, when the API gives it
        const copyName = content?.result?.name
        showToast(ToastType.Success, copyName
          ? t('STORE_DUPLICATED_AS', 'Created «_name_»').replace('_name_', copyName)
          : t('BUSINESS_DUPLICATED', 'Business duplicated'))
        return { ok: true, result: content?.result }
      }
      return { ok: false, error: content.result }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
      return { ok: false, error: [err.message] }
    } finally {
      duplicatingRef.current = false
    }
  }

  // redesign stores 5.2 (G2-06): one fixed, translated toast per kind of person and action (they were dynamic keys
  // with an uppercase English default, «OWNERS deleted», and the agent ones were in no catalog)
  const ownerToast = (type, action) => {
    if (type === 'agents') {
      return action === 'added' ? t('BUSINESS_AGENT_ADDED', 'Agent added') : t('BUSINESS_AGENT_REMOVED', 'Agent removed')
    }
    return action === 'added' ? t('BUSINESS_OWNER_ADDED', 'Business owner added') : t('BUSINESS_OWNER_REMOVED', 'Business owner removed')
  }

  /**
   * Saves the owners or agents (`type`) of the store as the list of ids `owners`.
   * redesign stores 5.2 (G2-07): the store changes only once the API accepts it, from the latest state (functional
   * update), and the caller learns how it went: `{ ok: true }` or `{ ok: false, error }`. A failure is the caller's to show (the
   * section says why), so it no longer goes to `actionStatus` (the editor's Alert) as well.
   * it sends only who changed (`ids`, added or removed per `assign`), so two people saving the same store keep
   * each other's changes.
   */
  const saveBusinessPeople = async (type, nextPeople, { ids, assign }) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus(prev => ({ ...prev, loading: true }))
      let error, result
      for (const id of ids) {
        ({ error, result } = await saveAssignment(ordering, session.token, `business/${businessId}/${type}/${id}`, assign))
        if (error) break
      }
      setActionStatus(prev => ({ ...prev, loading: false }))
      if (error) return { ok: false, error: result }
      setBusinessState(prev => ({
        ...prev,
        business: { ...prev?.business, [type]: nextPeople(prev?.business?.[type] ?? []) }
      }))
      return { ok: true }
    } catch (err) {
      setActionStatus(prev => ({ ...prev, loading: false }))
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to delete the business owner
   */
  const handleDeleteBusinessOwner = async (owners, { type = 'owners' } = {}) => {
    // decision 12c: a store keeps at least one owner (agents may go down to none, as before)
    if (type === 'owners' && owners.length === 0) {
      return { ok: false, error: [t('STORE_NEEDS_ONE_OWNER', 'A store needs at least one owner.')] }
    }
    const removedIds = (businessState?.business?.[type] ?? []).map(person => person?.id).filter(id => !owners.includes(id))
    const outcome = await saveBusinessPeople(type, people => people.filter(owner => owners.includes(owner.id)), { ids: removedIds, assign: false })
    if (outcome.ok) showToast(ToastType.Success, ownerToast(type, 'removed'))
    return outcome
  }

  /**
   * Method to add the business owner
   */
  const handleAddBusinessOwner = async (owners, newOwner, { type = 'owners' } = {}) => {
    // a store without `agents` (or `owners`) in its record starts from an empty list instead of throwing after the save
    const outcome = await saveBusinessPeople(type, people => (
      people.some(person => person?.id === newOwner?.id) ? people : [...people, newOwner]
    ), { ids: [newOwner?.id], assign: true })
    if (outcome.ok) showToast(ToastType.Success, ownerToast(type, 'added'))
    return outcome
  }

  // redesign stores 2.F: `changes` without the saved keys; the same object when none of them was pending, because
  // `useSaveOnChange` compares `formState.changes` by reference.
  const withoutKeys = (changes = {}, keys) => {
    if (!keys.some(key => key in changes)) return changes
    const rest = { ...changes }
    keys.forEach(key => { delete rest[key] })
    return rest
  }

  // redesign stores 1.A (G2-01, G4-10): a failed save says why, in the place of the "Loading" toast. The API sends
  // its reason as text (translated by its slug) or nothing; then the generic text.
  const showSaveError = (error) => {
    showToast(ToastType.Error, translateApiMessage(t, firstMessage(error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
  }

  /**
   * Method to update the business from the API
   * @returns {Promise<{ok: boolean, error?: *}>} redesign stores 1.A: `{ ok: true }` once saved; `{ ok: false, error }`
   * on an API error or an exception, after the error toast. What failed stays in `formState.changes`.
   * redesign stores 2.F: `options.keepPendingChanges` (the Snooze dialog) sends ONLY the given `changes`; the other
   * pending edits are neither sent nor lost, and `formState.result` is left alone (the dialog shows the error itself).
   * redesign stores 5.18 (from 5.15b): with `keepPendingChanges` there is no «Loading» toast: the caller shows its own
   * busy state, and on a failure (said by the caller, inline) no error toast replaced it, so it stayed. «Business updated» stays
   * (review F3): after «Save and continue» of the leave dialog the section is gone, and a category tick has nothing else to say it.
   * redesign bugs F row 12: `options.inlineError` (Location, which saves the whole form) skips the «Loading» toast and
   * the error toast: the caller says the failure in its own save bar. Everything pending is still sent; «Business updated» stays.
   */
  const handleUpdateBusinessClick = async (changes = {}, options = {}) => {
    const keepPending = !!options?.keepPendingChanges && Object.keys(changes).length > 0 && !changes.target
    // redesign bugs F row 12: the caller shows a failure inline; no «Loading» toast and no error toast on top of it
    const inlineError = !!options?.inlineError
    try {
      if (keepPending) setFormState(prev => ({ ...prev, loading: true }))
      else setFormState({ ...formState, loading: true })
      if (!keepPending && !inlineError) showToast(ToastType.Info, t('LOADING', 'Loading'))
      const changesToSend = Object.keys(changes).length > 0 && !changes.target ? changes : formState.changes

      let responseContent
      if (Array.isArray(changesToSend.taxes)) {
        const { tax_id: _taxId, ...payload } = changesToSend
        const response = await fetch(`${ordering.root}/business/${businessId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`
          },
          body: JSON.stringify(payload)
        })
        responseContent = await response.json()
      } else {
        const response = await ordering.businesses(businessId).save(changesToSend, {
          accessToken: session.token
        })
        responseContent = response.content
      }

      if (keepPending) {
        setFormState(prev => ({
          ...prev,
          changes: responseContent.error ? prev.changes : withoutKeys(prev.changes, Object.keys(changesToSend)),
          loading: false
        }))
      } else {
        setFormState({
          ...formState,
          changes: responseContent.error ? changesToSend : {},
          result: responseContent,
          loading: false
        })
      }

      if (!responseContent.error) {
        setBusinessState({
          ...businessState,
          business: {
            ...businessState.business,
            ...responseContent.result
          }
        })
        showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
        return { ok: true }
      }
      // redesign stores 2.F: with keepPendingChanges the Snooze dialog says why inline; no toast on top of it
      if (!keepPending && !inlineError) showSaveError(responseContent.result)
      return { ok: false, error: responseContent.result }
    } catch (err) {
      if (keepPending) {
        setFormState(prev => ({ ...prev, loading: false }))
      } else {
        setFormState({
          ...formState,
          result: {
            error: true,
            result: err.message
          },
          loading: false
        })
      }
      if (!keepPending && !inlineError) showSaveError(err.message)
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to set Spoonity key
   * redesign stores 5.16 (G2-36): answers `{ ok, result | error }` so the section can tell whether the key was stored.
   * Main showed the success toast for any body, even `error: true`. The key itself never goes into a toast.
   */
  const handleUpdateSpoonityKey = async (key, config) => {
    try {
      setSpoonityKeyState(prev => ({ ...prev, loading: true }))
      showToast(ToastType.Info, t('LOADING', 'Loading'))

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          value: key
        })
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/configs/${config}`, requestOptions)
      const content = await response.json()

      if (!content || content.error) {
        showToast(ToastType.Error, t('SPOONITY_KEY_ERROR', 'Spoonity key error'))
        setSpoonityKeyState(prev => ({
          ...prev,
          result: { error: true, result: content?.result },
          loading: false
        }))
        return { ok: false, error: content?.result }
      }

      showToast(ToastType.Success, t('SPOONITY_KEY_UPDATED', 'Spoonity key updated'))
      setSpoonityKeyState(prev => ({
        ...prev,
        key: content.result?.value,
        result: content.result,
        loading: false
      }))
      return { ok: true, result: content.result }
    } catch (err) {
      showToast(ToastType.Error, t('SPOONITY_KEY_ERROR', 'Spoonity key error'))
      setSpoonityKeyState(prev => ({
        ...prev,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      }))
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to add the business fields when new busines item is added
   */
  const handleSuccessAddBusinessItem = (name, result) => {
    const params = [...businessState?.business[name], result]
    setBusinessState({
      ...businessState,
      business: {
        ...businessState?.business,
        [name]: params
      }
    })
  }
  /**
   * Method to delete the business item from business
   */
  const handleSuccessDeleteBusinessItem = (name, id) => {
    const params = businessState?.business[name].filter(item => item.id !== id)
    setBusinessState({
      ...businessState,
      business: {
        ...businessState?.business,
        [name]: params
      }
    })
  }

  /**
   * Method to update the business
   */
  const handleUpdateBusinessState = (result) => {
    const business = { ...businessState?.business }
    Object.assign(business, result)
    setBusinessState({
      ...businessState,
      business
    })
  }

  /**
   * Saves one config of the store. Returns `{ ok: true, result }` or `{ ok: false, error }`.
   * redesign stores 5.4: `options.inlineError` is for a caller that paints the failure itself (a section's SaveBar, an
   * AsyncSwitch): no «Loading» toast, and the error is not left in `actionStatus`, so the editor does not open its alert on top of it.
   */
  const handleUpdateBusinessConfigs = async (params, configId, options = {}) => {
    const failWith = (error) => setActionStatus({ loading: false, error: options?.inlineError ? null : error })
    try {
      setActionStatus({ ...actionStatus, loading: true })
      // the inline caller shows its own busy state (the bar's spinner, the switch's): a «Loading» toast outlives a failure
      if (!options?.inlineError) showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({ value: params })
      }
      const response = await fetch(`${ordering.root}/business/${business?.id || businessId}/configs/${configId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionStatus({ loading: false, error: null })
        // Functional update: several saves in a row with the same handler must not overwrite each other.
        setBusinessState(prev => ({
          ...prev,
          business: {
            ...prev.business,
            configs: prev.business.configs.map(config => config.id === configId ? content.result : config)
          }
        }))
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
        return { ok: true, result: content.result }
      }
      failWith(content.result)
      return { ok: false, error: content.result }
    } catch (err) {
      failWith([err.message])
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to get the themes from API
   */
  const getSites = async () => {
    try {
      setSiteState({ ...siteState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const site = result.find(site => site.code === 'website')
        setSiteState({ ...siteState, loading: false, site })
      } else {
        setSiteState({ ...siteState, loading: false, error: result })
      }
    } catch (err) {
      setSiteState({ ...siteState, loading: false, error: [err.message] })
    }
  }

  const handleSyncEvent = async (event = 'business') => {
    try {
      setBusinessState({
        ...businessState,
        loading: true
      })
      const response = await fetch(`https://integrations.ordering.co/pulseposdps/api/sync_${event}.php?store_id=${businessState?.business?.external_id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      })
      const { result, error } = await response.json()
      if (!error) {
        showToast(ToastType.Success, result?.[0] || t('OK', 'OK'))
      }
      setBusinessState({
        ...businessState,
        error: error ? result : null,
        loading: false
      })
    } catch (err) {
      setBusinessState({
        ...businessState,
        error: [err.message],
        loading: false
      })
    }
  }

  // main 4b7ff4f9 + owner decision 1A: the store no longer installs or connects Clover (nor asks for the
  // integration list to do it); Clover is connected from Connect › POS.

  // redesign stores 5.12: an emptied order-type rate is stored as `null` (parseFloat('') is NaN).
  const handleChangeTax = (name, value, orderType) => {
    if (value === null) {
      const _formTaxChanges = { ...formTaxChanges }
      delete _formTaxChanges.order_type_rates
      setFormTaxChanges(_formTaxChanges)
      return
    }
    if (orderType) {
      const isEmpty = value === '' || value === null || value === undefined
      setFormTaxChanges((prev) => ({
        ...prev,
        order_type_rates: {
          ...prev.order_type_rates,
          [orderType]: {
            ...prev.order_type_rates?.[orderType],
            [name]: isEmpty ? null : parseFloat(value)
          }
        }
      }))
    } else {
      setFormTaxChanges((prev) => ({
        ...prev,
        [name]: value
      }))
    }
  }

  // redesign stores 5.12: a successful GET frees `formTaxState.loading` (it stayed true); an API error or a thrown
  // request lands in `formTaxState.result` and leaves `taxes` as they were.
  // (main #478): the catalog has its own state (`taxCatalogState`, with a retry in the UI); a newer request aborts the one
  // before, only the latest one applies, and an answer that is not a list of taxes with ids is an error, never an empty catalog.
  const getTaxes = useCallback(async () => {
    taxRequest.current?.abort()
    const request = new AbortController()
    taxRequest.current = request
    const isCurrent = () => taxRequest.current === request && !request.signal.aborted
    setTaxCatalogState(prev => ({ ...prev, loading: true, error: null }))
    setFormTaxState(prev => ({ ...prev, loading: true }))
    try {
      const response = await fetch(`${ordering.root}/taxes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        signal: request.signal
      })
      const { error, result } = await response.json()
      if (error) {
        if (!isCurrent()) return
        setTaxCatalogState(prev => ({ ...prev, loading: false, error: 'Unable to load taxes' }))
        setFormTaxState(prev => ({ ...prev, loading: false, result: { error: true, result } }))
        return
      }
      if (response.ok === false || !Array.isArray(result) || result.some(tax => !tax || tax.id == null)) {
        throw new Error('Invalid taxes response')
      }
      if (!isCurrent()) return
      setTaxes(Object.fromEntries(result.map(tax => [`id:${tax.id}`, tax])))
      setTaxCatalogState({ loading: false, loaded: true, error: null })
      setFormTaxState(prev => ({ ...prev, loading: false, result: { error: false } }))
    } catch (err) {
      if (!isCurrent()) return
      setTaxCatalogState(prev => ({ ...prev, loading: false, error: err?.message || 'Unable to load taxes' }))
      setFormTaxState(prev => ({ ...prev, loading: false, result: { error: true, result: [err.message] } }))
    }
  }, [ordering.root, session.token])

  const pickTax = (data) => ({
    name: data.name,
    description: data.description,
    id: data.id,
    rate: data.rate,
    type: data.type,
    recipient: data.recipient,
    apply_to_fees: data.apply_to_fees,
    order_type_rates: data.order_type_rates || null
  })

  const pickFee = (data) => ({
    name: data.name,
    description: data.description,
    id: data.id,
    fixed: data.fixed,
    percentage: data.percentage,
    taxable: data.taxable,
    recipient: data.recipient,
    target: data.target
  })

  /**
   * Save (PUT with `id`, POST without) a tax or a fee.
   * redesign stores 5.12: returns `{ ok: true, result: <saved record> }` on success (and clears the pending editor
   * changes) or `{ ok: false, error }` (the pending changes stay). `options.inlineError` skips the "Loading" and error toasts: the
   * caller shows the error inline. The success toast stays.
   */
  const handleSaveTax = async (id, action, _data, options = {}) => {
    const inline = options?.inlineError === true
    try {
      setFormTaxState(prev => ({ ...prev, loading: true }))
      if (!inline) showToast(ToastType.Info, t('LOADING', 'Loading'))
      const response = await fetch(id ? `${ordering.root}/${action}/${id}` : `${ordering.root}/${action}`, {
        method: id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.auth}`
        },
        body: JSON.stringify({
          ...formTaxChanges,
          ..._data,
          ...(action === 'taxes' ? { target: 'product' } : {})
        })
      })
      const { error, result: data } = await response.json()
      if (error) {
        if (!inline) showSaveError(data)
        return { ok: false, error: data }
      }
      if (action === 'taxes') {
        setTaxes(prev => ({ ...prev, [`id:${data.id}`]: pickTax(data) }))
        if (id) events.emit('tax_changed', { tax: pickTax(data) })
        showToast(ToastType.Success, t('TAX_SAVED', 'Tax saved'))
      } else {
        setFees(prev => ({ ...prev, [`id:${data.id}`]: pickFee(data) }))
        if (id) events.emit('fee_changed', { fee: pickFee(data) })
        showToast(ToastType.Success, t('FEE_SAVED', 'Fee saved'))
      }
      setFormTaxChanges({})
      if (id) setTaxToEdit({ action: null, payload: null })
      return { ok: true, result: data }
    } catch (err) {
      if (!inline) showSaveError(err.message)
      return { ok: false, error: [err.message] }
    } finally {
      setFormTaxState(prev => ({ ...prev, loading: false }))
    }
  }

  // redesign stores 1.A (G4-10): a delete that fails says why (it used to look like nothing happened) and keeps the
  // tax; returns `{ ok: true }` or `{ ok: false, error }`.
  // redesign stores 5.12: builds a NEW object without the key (it mutated the state in place); a missing id answers
  // `{ ok: false }` without a request; `options.inlineError` skips the "Loading" and error toasts (the caller shows the error).
  const handleDeleteTax = async (id, action, options = {}) => {
    if (!id) return { ok: false, error: [t('STORES_CHANGE_FAILED', "We couldn't save the change.")] }
    const inline = options?.inlineError === true
    setFormTaxState(prev => ({ ...prev, loading: true }))
    if (!inline) showToast(ToastType.Info, t('LOADING', 'Loading'))
    try {
      const response = await fetch(`${ordering.root}/${action}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.auth}`
        }
      })
      const { error, result } = await response.json()
      if (error) {
        if (!inline) showSaveError(result)
        return { ok: false, error: result }
      }
      const key = `id:${id}`
      const without = (list) => {
        const next = { ...list }
        delete next[key]
        return next
      }
      if (action === 'taxes') {
        events.emit('tax_deleted', { tax: taxes[key], isRemove: true })
        setTaxes(without)
        showToast(ToastType.Success, t('TAX_DELETED', 'tax deleted'))
      } else {
        events.emit('fee_deleted', { tax: fees[key], isRemove: true })
        setFees(without)
        showToast(ToastType.Success, t('FEE_DELETED', 'Fee deleted'))
      }
      return { ok: true }
    } catch (err) {
      if (!inline) showSaveError(err.message)
      return { ok: false, error: [err.message] }
    } finally {
      setFormTaxState(prev => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    if (!businessState?.business) return
    handleSucessUpdateBusiness && handleSucessUpdateBusiness(businessState?.business)
  }, [businessState?.business])

  useEffect(() => {
    if (business) {
      setBusinessState({
        ...businessState,
        loading: false,
        business
      })
    } else {
      getBusinesses()
    }
  }, [businessId, business])

  useEffect(() => {
    if (!notGetSites) {
      getSites()
    }
  }, [])

  useEffect(() => {
    setTaxes({})
    setTaxCatalogState({ loading: !notGetTaxes, loaded: false, error: null })
    if (!notGetTaxes) getTaxes()
    return () => taxRequest.current?.abort()
  }, [getTaxes, notGetTaxes])

  useEffect(() => {
    if (!businessId || notGetStreamConnection) return

    let cancelled = false

    const loadStreamConnection = async () => {
      setStreamConnectionState({
        enabled: false,
        loading: true,
        status: null,
        error: null
      })

      const isBusinessOwner = session.user?.level === 2

      try {
        let streamOrdersEnabled = isBusinessOwner

        if (!streamOrdersEnabled) {
          const response = await fetch(`${ordering.root}/plugins`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.token}`
            }
          })
          const { error, result } = await response.json()
          streamOrdersEnabled = !error &&
            Array.isArray(result) &&
            result.some(isStreamOrdersPlugin)
        }

        if (cancelled) return

        if (!streamOrdersEnabled) {
          setStreamConnectionState({
            enabled: false,
            loading: false,
            status: null,
            error: null
          })
          return
        }

        const statusResponse = await fetch(
          `${STREAM_ORDERS_STATUS_URL}/${ordering.project}/api/business/${businessId}/status`,
          { headers: { Accept: 'application/json' } }
        )
        const statusContent = await statusResponse.json()

        if (cancelled) return

        if (statusContent.error) {
          setStreamConnectionState({
            enabled: true,
            loading: false,
            status: null,
            error: statusContent.result
          })
          return
        }

        setStreamConnectionState({
          enabled: true,
          loading: false,
          status: mapStreamStatus(statusContent.result),
          error: null
        })
      } catch (err) {
        if (cancelled) return
        setStreamConnectionState({
          enabled: false,
          loading: false,
          status: null,
          error: [err.message]
        })
      }
    }

    loadStreamConnection()

    return () => {
      cancelled = true
    }
  }, [businessId, notGetStreamConnection, ordering.project, ordering.root, session.token, session.user?.level])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            businessState={businessState}
            actionStatus={actionStatus}
            formState={formState}
            setFormState={setFormState}
            cleanFormState={cleanFormState}
            handleChangeActiveBusiness={handleChangeActiveBusiness}
            handleDuplicateBusiness={handleDuplicateBusiness}
            handleDeleteBusiness={handleDeleteBusiness}
            handleDeleteBusinessOwner={handleDeleteBusinessOwner}
            handleAddBusinessOwner={handleAddBusinessOwner}
            handleUpdateBusinessClick={handleUpdateBusinessClick}
            handleUpdateBusinessState={handleUpdateBusinessState}
            handleSuccessAddBusinessItem={handleSuccessAddBusinessItem}
            handleSuccessDeleteBusinessItem={handleSuccessDeleteBusinessItem}
            handleUpdateBusinessConfigs={handleUpdateBusinessConfigs}
            handleUpdateSpoonityKey={handleUpdateSpoonityKey}
            handleSyncEvent={handleSyncEvent}
            spoonityKeyState={spoonityKeyState}
            siteState={siteState}
            taxes={taxes}
            taxCatalogState={taxCatalogState}
            fees={fees}
            taxToEdit={taxToEdit}
            setTaxToEdit={setTaxToEdit}
            formTaxChanges={formTaxChanges}
            setFormTaxChanges={setFormTaxChanges}
            formTaxState={formTaxState}
            handleSaveTax={handleSaveTax}
            handleDeleteTax={handleDeleteTax}
            getTaxes={getTaxes}
            handleChangeTax={handleChangeTax}
            handleGoogleFeedToggle={handleGoogleFeedToggle}
            googleFeedSecondaryIncludedIds={googleFeedSecondaryIncludedIds}
            googleFeedInclusionListLoading={googleFeedInclusionListLoading}
            googleFeedSavingBusinessId={googleFeedSavingBusinessId}
            googleFeedSavingChannel={googleFeedSavingChannel}
            googleFeedExcludedBusinessIds={googleFeedExcludedBusinessIds}
            streamConnectionState={streamConnectionState}
          />
        )
      }
    </>
  )
}

BusinessDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string),
  /**
  * This must be contains businessId to fetch
  */
  businessId: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string
  ]),
  /**
  * Business, this must be contains an object with all business info
  */
  business: PropTypes.object
}

const defaultProps = {
  propsToFetch: ['id', 'vertical', 'name', 'email', 'slug', 'schedule', 'description', 'about', 'logo', 'header', 'phone', 'cellphone', 'owner_id', 'city_id', 'address', 'address_notes', 'zipcode', 'location', 'featured', 'timezone', 'currency', 'food', 'alcohol', 'groceries', 'laundry', 'use_printer', 'printer_id', 'minimum', 'delivery_price', 'always_deliver', 'tax_type', 'tax', 'delivery_time', 'pickup_time', 'service_fee', 'fixed_usage_fee', 'percentage_usage_fee', 'order_default_priority', 'cancel_order_after_minutes', 'enabled', 'preorder_time', 'maximum', 'schedule_ranges', 'franchise_id', 'site_id', 'external_id', 'front_layout', 'seo_image', 'seo_title', 'seo_description', 'eta_status_times', 'eta_variation_time', 'price_level', 'facebook_profile', 'instagram_profile', 'tiktok_profile', 'snapchat_profile', 'pinterest_profile', 'whatsapp_number', 'delivery_tax_rate', 'delivery_tax_type', 'disabled_reason', 'menus_count', 'available_menus_count', 'menus_shared_count', 'available_menus_shared_count', 'professionals', 'configs', 'checkoutfields', 'reviews', 'open', 'today', 'lazy_load_products_recommended', 'available_products_count', 'valid_service', 'num_zones', 'types', 'metafields', 'owners', 'gallery', 'city', 'webhooks', 'maximums', 'paymethods', 'ribbon', 'offers', 'agents', 'tax_id', 'taxes', 'custom_tax', 'snooze_until']
}
