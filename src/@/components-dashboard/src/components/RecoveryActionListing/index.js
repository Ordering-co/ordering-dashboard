import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { CHANNEL_CONCURRENCY, CHANNELS_PAGE_SIZE, clampPageSize, fetchAllPages, mapWithConcurrency } from '../../utils/recoveryRules'

const STATS_PARAMS = 'id,sent_count,recovered_count,recovered_total'
const pendingStats = { loading: true, error: null, sent_count: null, recovered_count: null, recovered_total: null }
// A missing or non-numeric counter stays null, never 0
const toCounter = (value) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const statsEntry = (counters) => ({
  loading: false,
  error: null,
  sent_count: toCounter(counters?.sent_count),
  recovered_count: toCounter(counters?.recovered_count),
  recovered_total: toCounter(counters?.recovered_total)
})

export const RecoveryActionListing = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    isSearchByName,
    isSearchByDescription
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const firstRender = useRef(true)
  const [searchValue, setSearchValue] = useState(null)
  const [recoveryActionList, setRecoveryActionList] = useState({ actions: [], loading: false, error: null })
  const [filterValues, setFilterValues] = useState({ clear: false, changes: {} })
  // redesign RA-B1 (decision 2): the channels of each rule of the page, { [ruleId]: { loading, channels, error } }
  const [channelsByRule, setChannelsByRule] = useState({})
  // redesign RA-I1 (decision 2): «N of M rules on» counts every rule, as open carts does (GET /event_rules?page_size=50), never only the
  // page or the search. null: not known yet; { on, total }; { error } when it could not be read (the header leaves the line out).
  const [rulesSummary, setRulesSummary] = useState(null)
  const rulesSummaryRef = useRef(null)
  rulesSummaryRef.current = rulesSummary
  const summaryRequestRef = useRef(0)
  const actionsRef = useRef([])
  actionsRef.current = recoveryActionList.actions
  const channelsAbortRef = useRef(null)
  // The counters ride on their own request: the table behind them may not exist on a tenant, and then only that request fails
  const [statsByRule, setStatsByRule] = useState({})
  const statsRequestRef = useRef(0)
  const mountedRef = useRef(true)
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage : 1,
    // redesign RA-B1 (auditor #6): a pageSize from the URL is held to the options of the pagination (10, 25, 50)
    pageSize: clampPageSize(paginationSettings.pageSize ?? 10),
    totalItems: null,
    totalPages: null
  })

  /**
   * Change text to search
   * @param {string} search Search value
   */
  const handleChangeSearch = (search) => {
    setSearchValue(search)
  }

  // redesign RA-B1 (decision 2): one GET /event_rules/:id/channels; an aborted request writes nothing
  const requestRuleChannels = async (ruleId, signal) => {
    const patch = (entry) => {
      if (!mountedRef.current || signal?.aborted) return
      setChannelsByRule(prev => ({ ...prev, [ruleId]: { ...(prev[ruleId] ?? {}), ...entry } }))
    }
    try {
      // the API paginates the channels: read every page, not just the first 10
      const content = await fetchAllPages(async (page) => {
        const response = await fetch(`${ordering.root}/event_rules/${ruleId}/channels?page=${page}&page_size=${CHANNELS_PAGE_SIZE}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          signal
        })
        return response.json()
      }, { signal })
      if (!content.error) {
        patch({ loading: false, channels: content.result, error: null })
      } else {
        patch({ loading: false, error: content.result })
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
      patch({ loading: false, error: [err.message] })
    }
  }

  // redesign RA-B1 (decision 2): the channels of the rules of a page, 6 at a time, abortable
  const loadPageChannels = (rules) => {
    const controller = new AbortController()
    channelsAbortRef.current = controller
    setChannelsByRule(Object.fromEntries(rules.map(rule => [rule.id, { loading: true, channels: [], error: null }])))
    mapWithConcurrency(rules, CHANNEL_CONCURRENCY, rule => requestRuleChannels(rule.id, controller.signal), { signal: controller.signal })
      .catch(() => {})
  }

  // A load that fails after the previous channel requests were aborted must not leave a row loading for ever
  const settleChannelsLoading = () => {
    setChannelsByRule(prev => Object.fromEntries(Object.entries(prev).map(([ruleId, entry]) => [ruleId, entry.loading ? { ...entry, loading: false } : entry])))
  }

  const reloadRuleChannels = async (ruleId) => {
    setChannelsByRule(prev => ({ ...prev, [ruleId]: { channels: [], ...(prev[ruleId] ?? {}), loading: true, error: null } }))
    await requestRuleChannels(ruleId, null)
  }

  /**
   * The panel calls this after it creates, edits, toggles or deletes a channel
   */
  const setRuleChannels = (ruleId, channels) => {
    setChannelsByRule(prev => ({ ...prev, [ruleId]: { loading: false, channels, error: null } }))
  }

  // The counters of the rules of a page, from a second request with the same page, size and search; an older page's answer is dropped
  const loadPageStats = async (rules, page, pageSize, whereQuery) => {
    const request = ++statsRequestRef.current
    const ids = rules.map(rule => rule.id)
    const settle = (build) => {
      if (!mountedRef.current || request !== statsRequestRef.current) return
      setStatsByRule(Object.fromEntries(ids.map(id => [id, build(id)])))
    }
    setStatsByRule(Object.fromEntries(ids.map(id => [id, pendingStats])))
    // an empty page has nothing to count
    if (ids.length === 0) return
    try {
      const response = await fetch(`${ordering.root}/event_rules?page=${page}&page_size=${pageSize}&params=${STATS_PARAMS}${whereQuery}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
      const content = await response.json()
      if (content.error) {
        settle(() => ({ ...pendingStats, loading: false, error: content.result }))
        return
      }
      const answered = Array.isArray(content.result) ? content.result : []
      settle(id => statsEntry(answered.find(item => item?.id === id)))
    } catch (err) {
      settle(() => ({ ...pendingStats, loading: false, error: [err.message] }))
    }
  }

  /**
   * Reads the counters of one rule (a rule opened by URL that is not on the page, or a retry). Resolves when done, never throws.
   * @param {Number} ruleId
   */
  const reloadRuleStats = async (ruleId) => {
    setStatsByRule(prev => ({ ...prev, [ruleId]: { ...pendingStats, ...(prev[ruleId] ?? {}), loading: true, error: null } }))
    const patch = (entry) => {
      if (!mountedRef.current) return
      setStatsByRule(prev => ({ ...prev, [ruleId]: entry }))
    }
    try {
      const response = await fetch(`${ordering.root}/event_rules/${ruleId}?params=${STATS_PARAMS}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
      const content = await response.json()
      if (content.error) patch({ ...pendingStats, loading: false, error: content.result })
      else patch(statsEntry(content.result))
    } catch (err) {
      patch({ ...pendingStats, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get the sites from API
   */
  const getRecoveryList = async (page, requestedPageSize) => {
    // redesign (row 83 R1-12): the size asked for is held to the options of the pagination and stored with the answer
    const pageSize = clampPageSize(requestedPageSize)
    try {
      // redesign RA-B1 (decision 2): another load starts, the channel requests of the old page stop
      channelsAbortRef.current?.abort()
      // redesign the summary that could not be read is read again with the page («Retry» is this call); a known one is not
      if (rulesSummaryRef.current?.error) loadRulesSummary()
      setRecoveryActionList({ ...recoveryActionList, loading: true })
      let where = null
      const conditions = []
      if (searchValue) {
        const searchConditions = []
        if (isSearchByName) {
          searchConditions.push(
            {
              attribute: 'name',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
              }
            }
          )
        }
        if (isSearchByDescription) {
          searchConditions.push(
            {
              attribute: 'description',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
              }
            }
          )
        }
        conditions.push({
          conector: 'OR',
          conditions: searchConditions
        })
      }

      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      // params=channels asks each rule with its channels; an api-core without it ignores the value and answers every field
      const whereQuery = where ? `&where=${JSON.stringify(where)}` : ''
      const fetchEndpoint = `${ordering.root}/event_rules?page=${page}&page_size=${pageSize}&params=channels${whereQuery}`

      const response = await fetch(fetchEndpoint, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setRecoveryActionList({
          loading: false,
          actions: content.result,
          error: null
        })
        // R1-12: from the latest props, not the ones of the render that defined this closure (they carried the old size back)
        setPaginationProps(prev => ({
          ...prev,
          pageSize,
          currentPage: content.pagination.current_page,
          totalPages: content.pagination.total_pages,
          totalItems: content.pagination.total,
          from: content.pagination.from,
          to: content.pagination.to
        }))
        const rules = Array.isArray(content.result) ? content.result : []
        // channels embedded in the list save the request per rule; without them (api-core before the change) each rule asks
        if (rules.every(rule => Array.isArray(rule?.channels))) {
          setChannelsByRule(Object.fromEntries(rules.map(rule => [rule.id, { loading: false, channels: rule.channels, error: null }])))
        } else loadPageChannels(rules)
        loadPageStats(rules, page, pageSize, whereQuery)
      } else {
        setRecoveryActionList({
          ...recoveryActionList,
          loading: false,
          error: content.result
        })
        settleChannelsLoading()
      }
      firstRender.current = false
    } catch (err) {
      setRecoveryActionList({
        ...recoveryActionList,
        loading: false,
        error: [err.message]
      })
      settleChannelsLoading()
    }
  }

  /**
   * Default fuction for recovery action workflow
   * redesign RA-B1 (M-RA3): resolves { ok, error }; a failure is not written to recoveryActionList.error
   * (nobody paints it): the switch that asked says it. The row is replaced by a copy, never mutated.
   */
  const handleUpdateAction = async (id, changes) => {
    try {
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/event_rules/${id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        // redesign RA-I1: a rule that changed state moves the summary by one
        const before = actionsRef.current.find(_action => _action.id === id)
        const after = content.result && 'enabled' in content.result ? content.result.enabled : changes?.enabled
        if (before && after !== undefined && Boolean(before.enabled) !== Boolean(after)) shiftSummary(after ? 1 : -1, 0)
        // redesign R2-I5 (live check of R1-01): a rule that is not on the page (opened by ?id=, or the search hid it) has no known previous
        // state here: read the summary again instead of guessing
        if (!before && after !== undefined) loadRulesSummary()
        setRecoveryActionList(prev => ({
          ...prev,
          actions: prev.actions.map(_action => _action.id === id ? { ..._action, ...content.result } : _action)
        }))
        showToast(ToastType.Success, t('RECOVERY_ACTION_SAVED', 'Recovery action saved'))
        // redesign R2-F1 (R1-01): the saved record goes back too; the panel's rule may have left the page, so no row carries it
        return { ok: true, error: null, rule: content.result }
      }
      return { ok: false, error: content.result }
    } catch (err) {
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to add the recovery action in the recovery action list
   * redesign RA-B1 (M-RA13): the counters are totalItems and to, never `total`
   * @param {Object} action recovery action to add
   */
  const handleSuccessAddRecoveryAction = (action) => {
    shiftSummary(action?.enabled ? 1 : 0, 1)
    setPaginationProps(prev => ({
      ...prev,
      to: (prev?.to ?? 0) + 1,
      totalItems: (prev?.totalItems ?? 0) + 1
    }))
    setRecoveryActionList(prev => ({ ...prev, actions: [...prev.actions, action] }))
    setChannelsByRule(prev => ({ ...prev, [action.id]: { loading: false, channels: [], error: null } }))
    // a rule just created has sent nothing
    setStatsByRule(prev => ({ ...prev, [action.id]: statsEntry({ sent_count: 0, recovered_count: 0, recovered_total: 0 }) }))
  }

  /**
   * Method to update the recovery action list
   */
  const handleSuccessUpdateRecoveryAction = (updatedActions) => {
    setRecoveryActionList({
      ...recoveryActionList,
      actions: updatedActions
    })
  }

  /**
   * Method to delete the recovery action in the recovery action list
   * redesign RA-B1 (M-RA13): the counters are totalItems and to, never `total`
   * @param {Number} actionId recovery action to delete
   */
  const handleSuccessDeleteRecoveryAction = (actionId) => {
    const deleted = actionsRef.current.find(action => action.id === actionId)
    // redesign R2-I5: a rule deleted from outside the page: read the summary again
    if (deleted) shiftSummary(deleted.enabled ? -1 : 0, -1)
    else loadRulesSummary()
    setPaginationProps(prev => ({
      ...prev,
      to: Math.max(0, (prev?.to ?? 0) - 1),
      totalItems: Math.max(0, (prev?.totalItems ?? 0) - 1)
    }))
    setRecoveryActionList(prev => ({ ...prev, actions: prev.actions.filter(action => action.id !== actionId) }))
    setChannelsByRule(prev => {
      const next = { ...prev }
      delete next[actionId]
      return next
    })
    setStatsByRule(prev => {
      const next = { ...prev }
      delete next[actionId]
      return next
    })
  }

  // redesign RA-I1: the summary of every rule, read once (the page and the search do not change it)
  const shiftSummary = (on, total) => {
    setRulesSummary(prev => (prev && !prev.error
      ? { on: Math.max(0, prev.on + on), total: Math.max(0, prev.total + total) }
      : prev))
  }

  const loadRulesSummary = async () => {
    // an older answer never replaces a newer one
    const request = ++summaryRequestRef.current
    try {
      const response = await fetch(`${ordering.root}/event_rules?page=1&page_size=50`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
      const content = await response.json()
      if (!mountedRef.current || request !== summaryRequestRef.current) return
      if (content.error) {
        setRulesSummary({ error: content.result })
        return
      }
      const rules = Array.isArray(content.result) ? content.result : []
      setRulesSummary({ on: rules.filter(rule => rule?.enabled).length, total: content.pagination?.total ?? rules.length })
    } catch (err) {
      if (mountedRef.current && request === summaryRequestRef.current) setRulesSummary({ error: [err.message] })
    }
  }

  // redesign RA-B1 (decision 2): leaving the page stops the channel requests that are still running
  useEffect(() => {
    loadRulesSummary()
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      channelsAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (recoveryActionList.loading) return
    getRecoveryList(firstRender.current ? paginationProps.currentPage : 1, paginationProps.pageSize)
  }, [searchValue])

  useEffect(() => {
    if ((Object.keys(filterValues?.changes).length > 0 || filterValues.clear) && !recoveryActionList.loading) getRecoveryList(1, paginationProps.pageSize)
  }, [filterValues])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          searchValue={searchValue}
          paginationProps={paginationProps}
          recoveryActionList={recoveryActionList}
          getRecoveryList={getRecoveryList}
          setFilterValues={setFilterValues}
          setPaginationProps={setPaginationProps}
          handleChangeSearch={handleChangeSearch}
          channelsByRule={channelsByRule}
          statsByRule={statsByRule}
          reloadRuleStats={reloadRuleStats}
          rulesSummary={rulesSummary}
          reloadRuleChannels={reloadRuleChannels}
          setRuleChannels={setRuleChannels}
          handleUpdateAction={handleUpdateAction}
          handleSuccessAddRecoveryAction={handleSuccessAddRecoveryAction}
          handleSuccessUpdateRecoveryAction={handleSuccessUpdateRecoveryAction}
          handleSuccessDeleteRecoveryAction={handleSuccessDeleteRecoveryAction}
        />
      )}
    </>
  )
}

RecoveryActionListing.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
