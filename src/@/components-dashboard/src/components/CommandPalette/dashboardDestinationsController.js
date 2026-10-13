import { fetchBusinessSearchRows, fetchRecordSearchRows, fetchRecordSearchWithSlowPolicy } from './dashboardSearchRequests'
import {
  buildOrderDetailPath,
  buildUserDetailPath,
  buildUserSearchWhere,
  canSearchOrders,
  canSearchOrderQuery,
  classifyRecordQuery,
  getSearchableUserLevels,
  USER_LEVEL_DESTINATIONS
} from '../../utils/commandPaletteRecords'
import { buildRecordHandoffEntries } from '../../utils/commandPaletteHandoff'
import { buildPaletteStorePath } from '../../utils/businessDetailSections'
import { readCommandPaletteSlowSearch } from '../../utils/commandPaletteSearchMode'
import {
  buildDashboardDestinationPath,
  DASHBOARD_DESTINATION_LIMIT,
  MAX_DASHBOARD_RECORD_ID,
  normalizeDashboardSearchRequest,
  rankDashboardEntries,
  resolveDashboardDestination,
  toDashboardEnvelope,
  toDashboardEnvelopeItem
} from '../../utils/dashboardDestinations'

const SEARCH_TIMEOUT_MS = 8000
const BUSINESS_LIMIT = 8
const RECORD_LIMIT = 5
const TIMEOUT = Symbol('dashboard-search-timeout')
const ABORTED = Symbol('dashboard-search-aborted')

const abortError = () => {
  const error = new Error('The dashboard search was cancelled')
  error.name = 'AbortError'
  return error
}

const staleError = () => {
  const error = new Error('The dashboard search security scope changed')
  error.name = 'StaleDashboardSearchError'
  return error
}

const makeOperation = (signal) => {
  const controller = new AbortController()
  let timedOut = false
  let resolveInterrupt
  const interruptPromise = new Promise(resolve => { resolveInterrupt = resolve })
  const abort = () => {
    controller.abort()
    resolveInterrupt(ABORTED)
  }
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
    resolveInterrupt(TIMEOUT)
  }, SEARCH_TIMEOUT_MS)
  return {
    signal: controller.signal,
    interruptPromise,
    get timedOut () { return timedOut },
    finish: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }
}

const awaitOperation = async (promise, operation, assertCurrent) => {
  const result = await Promise.race([
    Promise.resolve(promise).then(value => ({ value }), error => ({ error })),
    operation.interruptPromise.then(reason => ({ interrupted: reason }))
  ])
  if (result.interrupted === TIMEOUT) return { timeout: true }
  if (result.interrupted === ABORTED) throw abortError()
  if (result.error) throw result.error
  assertCurrent()
  return { value: result.value }
}

const isContactValue = (value) => /@/.test(value) || /^\+?[\d\s().-]{7,}$/.test(value)

const businessDisplayName = (business, t) => {
  const name = typeof business?.name === 'string' ? business.name.trim() : ''
  return name && !isContactValue(name) ? name : `${t('BUSINESS', 'Business')} #${business?.id}`
}

const businessItem = (business, t) => ({
  id: `business:${business.id}`,
  kind: 'business',
  title: businessDisplayName(business, t),
  subtitle: `#${business.id}`
})

const recordItem = (type, row, title, subtitle) => ({
  id: `${type}:${row.id}`,
  kind: 'record',
  title,
  subtitle
})

const destinationBusinessItem = (entry, business, t) => ({
  id: `${entry.id}::business:${business.id}`,
  title: `${entry.title} · ${businessDisplayName(business, t)}`,
  subtitle: [entry.subtitle, `#${business.id}`].filter(Boolean).join(' · '),
  destinationId: entry.id,
  kind: entry.kind,
  parent_id: entry.parent_id,
  business
})

const parseBusinessDestination = (id) => {
  const match = /^(.+)::business:(\d+)$/.exec(String(id || ''))
  return match ? { destinationId: match[1], businessId: Number(match[2]) } : null
}

const routeForRemote = ({ id, targetLevel, userLevels, user, business }) => {
  const [kind, rawId] = String(id || '').split(':')
  const recordId = Number(rawId)
  if (!Number.isInteger(recordId) || recordId < 1 || recordId > MAX_DASHBOARD_RECORD_ID) return null
  if (kind === 'business') return buildPaletteStorePath({}, business)
  if (kind === 'order' && canSearchOrders({ level: user?.level, canOpenOrders: true })) {
    return buildOrderDetailPath(recordId)
  }
  if (kind === 'user') {
    const target = USER_LEVEL_DESTINATIONS[targetLevel]
    return target && userLevels.includes(targetLevel) ? buildUserDetailPath(targetLevel, recordId) : null
  }
  return null
}

const getPageBusinessId = (locationSearch) => {
  const rawId = new URLSearchParams(locationSearch || '').get('business_id')
  if (!rawId || !/^\d+$/.test(rawId)) return null
  const businessId = Number(rawId)
  return Number.isInteger(businessId) && businessId >= 1 && businessId <= MAX_DASHBOARD_RECORD_ID ? businessId : null
}

export const createDashboardDestinationsController = (latestRef) => {
  const isSecurityCurrent = (start) => {
    const current = latestRef.current
    return !!current && current.scope === start.scope && current.securityKey === start.securityKey
  }

  const assertSecurityCurrent = (start) => {
    if (!isSecurityCurrent(start)) throw staleError()
    return latestRef.current
  }

  const assertCurrent = (start, operation) => {
    if (operation.signal.aborted) throw abortError()
    return assertSecurityCurrent(start)
  }

  const getReadySnapshot = async (start, operation, { force = false } = {}) => {
    if (!start.ensureCatalogs) return { ...start }
    const result = await awaitOperation(start.ensureCatalogs({ signal: operation.signal, force }), operation, () => assertCurrent(start, operation))
    if (result.timeout) return { ...start, catalogErrors: [...(start.catalogErrors || []), 'CATALOG_TIMEOUT'] }
    const readiness = result.value || {}
    const latest = assertCurrent(start, operation)
    return {
      ...latest,
      ...readiness,
      catalog: readiness.catalog || latest.catalog || start.catalog,
      catalogErrors: readiness.catalogErrors || latest.catalogErrors || start.catalogErrors || []
    }
  }

  const search = async (request = {}, { signal } = {}) => {
    const start = latestRef.current
    if (!start) return toDashboardEnvelope({ status: 'unavailable', errors: ['DESTINATIONS_UNAVAILABLE'] })
    const operation = makeOperation(signal)
    let timeoutEnvelope
    try {
      if (operation.signal.aborted) throw abortError()
      let normalized
      try {
        normalized = normalizeDashboardSearchRequest(request)
      } catch (error) {
        return toDashboardEnvelope({
          scope: start.scope,
          revision: start.revision,
          status: 'unavailable',
          errors: [error?.message || 'INVALID_SEARCH_REQUEST']
        })
      }

      let snapshot
      try {
        snapshot = await getReadySnapshot(start, operation)
      } catch (error) {
        if (error?.name === 'AbortError') throw error
        if (error?.name === 'StaleDashboardSearchError') {
          return toDashboardEnvelope({ scope: start.scope, revision: start.revision, query: normalized.query, status: 'unavailable', errors: ['STALE_SEARCH'] })
        }
        return toDashboardEnvelope({ scope: start.scope, revision: start.revision, query: normalized.query, status: 'unavailable', errors: ['CATALOG_ERROR'] })
      }
      assertSecurityCurrent(start)
      const catalog = snapshot.catalog || start.catalog
      const catalogErrors = snapshot.catalogErrors || []
      const scope = start.scope
      const revision = latestRef.current?.revision || snapshot.revision || start.revision
      const localEntries = normalized.intent === 'business'
        ? []
        : normalized.destination_id
          ? (() => {
              const target = resolveDashboardDestination(catalog, normalized.destination_id)
              return target ? [target] : []
            })()
          : rankDashboardEntries(catalog?.entries || [], normalized.query)
      const localOnly = (status = 'ok', errors = [], items = localEntries) => toDashboardEnvelope({
        scope,
        revision: latestRef.current?.revision || revision,
        query: normalized.query,
        status: catalogErrors.length && status === 'ok' ? 'partial' : status,
        items: items.map(item => toDashboardEnvelopeItem(item)).filter(Boolean),
        errors: [...catalogErrors, ...errors]
      })
      timeoutEnvelope = localOnly('partial', ['SEARCH_TIMEOUT'])

      if (normalized.destination_id && !localEntries.length) return localOnly('unavailable', ['DESTINATION_UNAVAILABLE'], [])
      if (normalized.destination_id && localEntries[0].requires !== 'business') {
        return localOnly('ok', [], localEntries)
      }

      const entriesRequiringBusiness = localEntries.filter(entry => entry.requires === 'business')
      const explicitlyNamedBusiness = Object.prototype.hasOwnProperty.call(normalized, 'business_query')
      const explicitBusinessId = normalized.business_id
      const pageBusinessId = !explicitlyNamedBusiness && explicitBusinessId === undefined && (!normalized.intent || normalized.use_current_business === true)
        ? getPageBusinessId(snapshot.locationSearch)
        : null
      const selectedBusinessId = explicitBusinessId ?? pageBusinessId
      const businessIdFilter = explicitlyNamedBusiness ? null : selectedBusinessId
      const shouldResolveBusinesses = entriesRequiringBusiness.length > 0 &&
        (explicitlyNamedBusiness || (businessIdFilter !== null && businessIdFilter !== undefined))

      if (entriesRequiringBusiness.length && !snapshot.navCatalog?.businessesAllowed) {
        return toDashboardEnvelope({
          scope,
          revision,
          query: normalized.query,
          status: normalized.destination_id ? 'unavailable' : 'partial',
          items: localEntries.map(entry => toDashboardEnvelopeItem(entry, { requiresBusiness: entry.requires === 'business' })).filter(Boolean),
          errors: [...catalogErrors, 'BUSINESS_FORBIDDEN']
        })
      }

      if (normalized.destination_id && entriesRequiringBusiness.length && !shouldResolveBusinesses) {
        const chooser = toDashboardEnvelopeItem(entriesRequiringBusiness[0], { requiresBusiness: true })
        return toDashboardEnvelope({
          scope,
          revision,
          query: normalized.query,
          status: catalogErrors.length ? 'partial' : 'ok',
          items: [chooser],
          errors: catalogErrors
        })
      }

      const slowSearch = readCommandPaletteSlowSearch(snapshot.project)
      const userLevels = getSearchableUserLevels({ level: snapshot.level, can: snapshot.navCatalog?.can || (() => false) })
      const recordQuery = normalized.query
      const remote = { businesses: [], orders: [], users: [], destinationBusinesses: [] }
      const errors = [...catalogErrors]
      const tasks = []
      const task = (key, promise) => {
        tasks.push(Promise.resolve(promise).then(rows => {
          assertCurrent(start, operation)
          remote[key] = rows
        }).catch(error => {
          if (error?.name === 'AbortError' || error?.name === 'StaleDashboardSearchError') return
          errors.push(key === 'destinationBusinesses' ? 'BUSINESS_SEARCH_ERROR' : 'REMOTE_SEARCH_ERROR')
        }))
      }

      if (shouldResolveBusinesses) {
        const term = explicitlyNamedBusiness ? normalized.business_query : String(businessIdFilter)
        task('destinationBusinesses', fetchBusinessSearchRows({
          ordering: snapshot.ordering,
          token: snapshot.token,
          user: snapshot.user,
          term,
          limit: BUSINESS_LIMIT,
          signal: operation.signal
        }).then(rows => {
          const matches = businessIdFilter !== undefined && businessIdFilter !== null
            ? rows.filter(row => Number(row.id) === businessIdFilter)
            : rows
          return matches.slice(0, BUSINESS_LIMIT)
        }))
      }

      const businessQuery = normalized.intent === 'business' ? (normalized.business_query || recordQuery) : recordQuery
      if (!normalized.destination_id && (recordQuery || businessQuery)) {
        if (normalized.intent !== 'feature' && normalized.intent !== 'record' && (normalized.intent === 'business' || (!explicitlyNamedBusiness && selectedBusinessId == null)) &&
          snapshot.navCatalog?.businessesAllowed && (businessQuery.length >= 2 || /^\d+$/.test(businessQuery))) {
          task('businesses', fetchBusinessSearchRows({
            ordering: snapshot.ordering,
            token: snapshot.token,
            user: snapshot.user,
            term: businessQuery,
            limit: BUSINESS_LIMIT,
            signal: operation.signal
          }))
        }
        const orderExtended = !slowSearch.orders
        if (normalized.intent !== 'feature' && normalized.intent !== 'business' && canSearchOrders({ level: snapshot.level, canOpenOrders: snapshot.navCatalog?.can?.('/orders') }) &&
          canSearchOrderQuery(recordQuery, { extended: orderExtended })) {
          task('orders', fetchRecordSearchWithSlowPolicy({
            project: snapshot.project,
            entity: 'orders',
            ordering: snapshot.ordering,
            token: snapshot.token,
            query: recordQuery,
            extended: orderExtended,
            limit: RECORD_LIMIT,
            signal: operation.signal
          }))
        }
        if (normalized.intent !== 'feature' && normalized.intent !== 'business' && userLevels.length && buildUserSearchWhere(recordQuery, userLevels, { extended: !slowSearch.users })) {
          task('users', fetchRecordSearchWithSlowPolicy({
            project: snapshot.project,
            entity: 'users',
            ordering: snapshot.ordering,
            token: snapshot.token,
            query: recordQuery,
            levels: userLevels,
            extended: !slowSearch.users,
            limit: RECORD_LIMIT,
            signal: operation.signal
          }))
        }
      }

      const allTasks = Promise.allSettled(tasks)
      const settled = await Promise.race([
        allTasks.then(value => ({ value })),
        operation.interruptPromise.then(reason => ({ interrupted: reason }))
      ])
      if (settled.interrupted === TIMEOUT) {
        assertSecurityCurrent(start)
        errors.push('SEARCH_TIMEOUT')
      } else if (settled.interrupted === ABORTED) throw abortError()
      else assertCurrent(start, operation)
      if (operation.timedOut && !errors.includes('SEARCH_TIMEOUT')) errors.push('SEARCH_TIMEOUT')

      const resolvedBusinessEntries = entriesRequiringBusiness.flatMap(entry =>
        remote.destinationBusinesses.map(business => destinationBusinessItem(entry, business, snapshot.t))
      )
      if (shouldResolveBusinesses && (
        (explicitlyNamedBusiness && normalized.business_query && !remote.destinationBusinesses.length) ||
        (businessIdFilter !== undefined && businessIdFilter !== null && !remote.destinationBusinesses.length)
      )) {
        errors.push('BUSINESS_NOT_FOUND')
      }
      const expandedLocalEntries = localEntries.flatMap(entry => {
        if (entry.requires !== 'business') return [entry]
        return resolvedBusinessEntries.filter(item => item.destinationId === entry.id).length
          ? resolvedBusinessEntries.filter(item => item.destinationId === entry.id)
          : [toDashboardEnvelopeItem(entry, { requiresBusiness: true })]
      }).filter(Boolean)

      const remoteBusinessItems = remote.businesses.map(business => businessItem(business, snapshot.t))
      const remoteOrderItems = remote.orders.map(row => recordItem(
        'order',
        row,
        snapshot.t('COMMAND_PALETTE_ORDER_TITLE', 'Order #_id_').replace('_id_', row.id),
        [row.business?.name && !isContactValue(row.business.name) ? row.business.name : '', row.status].filter(Boolean).join(' · ')
      ))
      const remoteUserItems = remote.users.map(row => {
        const role = USER_LEVEL_DESTINATIONS[row.level]
        const name = [row.name, row.lastname].filter(value => typeof value === 'string' && !isContactValue(value)).join(' ')
        return recordItem(
          'user',
          row,
          name || `#${row.id}`,
          role ? snapshot.t(role.labelKey, role.label) : ''
        )
      })
      const kind = classifyRecordQuery(recordQuery)?.kind
      const foundUserLevels = [...new Set(remote.users.map(row => row.level).filter(found => userLevels.includes(found)))]
      const handoffs = recordQuery && normalized.intent !== 'feature' && normalized.intent !== 'business'
        ? buildRecordHandoffEntries({
          t: snapshot.t,
          query: recordQuery,
          user: snapshot.user,
          configs: snapshot.configs,
          userLevels: foundUserLevels
        })
        : []
      const candidates = normalized.intent === 'business'
        ? remoteBusinessItems
        : normalized.intent === 'feature'
          ? expandedLocalEntries
          : normalized.destination_id
            ? expandedLocalEntries
            : kind === 'number'
              ? [...remoteOrderItems, ...remoteBusinessItems, ...remoteUserItems, ...handoffs, ...expandedLocalEntries]
              : kind === 'phone' || kind === 'email'
                ? [...remoteUserItems, ...remoteOrderItems, ...remoteBusinessItems, ...handoffs, ...expandedLocalEntries]
                : [...expandedLocalEntries, ...remoteBusinessItems, ...remoteOrderItems, ...remoteUserItems, ...handoffs]
      const items = candidates.slice(0, DASHBOARD_DESTINATION_LIMIT)
        .map(item => toDashboardEnvelopeItem(item, {
          requiresBusiness: item.requires_business || item.requires === 'business',
          businessId: item.business?.id,
          query: item.handoff ? recordQuery : undefined
        }))
        .filter(Boolean)
      return toDashboardEnvelope({
        scope,
        revision: latestRef.current?.revision || revision,
        query: normalized.query,
        status: errors.length ? 'partial' : 'ok',
        items,
        errors
      })
    } catch (error) {
      if (error?.name === 'StaleDashboardSearchError') {
        return toDashboardEnvelope({
          scope: start.scope,
          revision: start.revision,
          query: typeof request?.query === 'string' ? request.query.slice(0, 200) : '',
          status: 'unavailable',
          items: [],
          errors: ['STALE_SEARCH']
        })
      }
      if (error?.name === 'AbortError' && !operation.timedOut) throw error
      if (operation.timedOut) {
        if (!isSecurityCurrent(start)) {
          return toDashboardEnvelope({
            scope: start.scope,
            revision: start.revision,
            query: typeof request?.query === 'string' ? request.query.slice(0, 200) : '',
            status: 'unavailable',
            items: [],
            errors: ['STALE_SEARCH']
          })
        }
        return timeoutEnvelope || toDashboardEnvelope({
          scope: start.scope,
          revision: start.revision,
          query: typeof request?.query === 'string' ? request.query.slice(0, 200) : '',
          status: 'unavailable',
          items: [],
          errors: ['SEARCH_TIMEOUT']
        })
      }
      return toDashboardEnvelope({
        scope: start.scope,
        revision: start.revision,
        query: typeof request?.query === 'string' ? request.query.slice(0, 200) : '',
        status: 'unavailable',
        items: [],
        errors: ['SEARCH_ERROR']
      })
    } finally {
      operation.finish()
    }
  }

  const open = async (item, { scope, revision, signal } = {}) => {
    const start = latestRef.current
    if (!start || !item || typeof item.id !== 'string' || (scope && scope !== start.scope)) {
      return { status: 'unavailable' }
    }
    const operation = makeOperation(signal)
    try {
      if (operation.signal.aborted) throw abortError()
      let snapshot = await getReadySnapshot(start, operation)
      if (operation.timedOut) return { status: 'error' }
      let catalog = snapshot.catalog || start.catalog
      if (scope && scope !== snapshot.scope) return { status: 'unavailable' }
      const parsed = parseBusinessDestination(item.id)
      const destinationId = parsed?.destinationId || item.id
      let entry = resolveDashboardDestination(catalog, destinationId)
      const currentRevision = latestRef.current?.revision || snapshot.revision
      const isStale = !!revision && revision !== currentRevision
      const itemKind = String(item.id).split(':')[0]
      const isRemoteRecord = ['business', 'order', 'user', 'handoff'].includes(itemKind)
      if (!isRemoteRecord && (catalog?.dynamicIds?.has(destinationId) || (isStale && !entry))) {
        const refreshed = await awaitOperation(getReadySnapshot(start, operation, { force: true }), operation, () => assertCurrent(start, operation))
        if (refreshed.timeout) return { status: 'error' }
        snapshot = refreshed.value
        catalog = snapshot.catalog || catalog
        entry = resolveDashboardDestination(catalog, destinationId)
      }

      if (item.id.startsWith('handoff:')) {
        const query = item?.params?.query
        if (typeof query !== 'string' || !query.trim() || query.length > 120) return { status: 'unavailable' }
        const handoff = buildRecordHandoffEntries({
          t: snapshot.t,
          query,
          user: snapshot.user,
          configs: snapshot.configs,
          userLevels: getSearchableUserLevels({ level: snapshot.level, can: snapshot.navCatalog?.can || (() => false) })
        }).find(candidate => candidate.id === item.id)
        if (!handoff?.path) return { status: 'unavailable' }
        assertCurrent(start, operation)
        snapshot.setAssistantOpen(typeof window !== 'undefined' && window.innerWidth >= 768)
        assertCurrent(start, operation)
        snapshot.navigate(handoff.path, { remount: true })
        return { status: 'opened', scope: start.scope, revision: latestRef.current?.revision || snapshot.revision }
      }

      if (entry) {
        if (entry.requires === 'business') {
          if (!snapshot.navCatalog?.businessesAllowed) return { status: 'unavailable' }
          const businessId = item?.params?.business_id ?? parsed?.businessId
          if (businessId === undefined) return { status: 'needs_business', scope: start.scope, revision: latestRef.current?.revision || snapshot.revision }
          if (!Number.isInteger(businessId) || businessId < 1 || businessId > MAX_DASHBOARD_RECORD_ID ||
            !snapshot.navCatalog?.businessesAllowed) return { status: 'unavailable' }
          const { value: businesses, timeout } = await awaitOperation(fetchBusinessSearchRows({
            ordering: snapshot.ordering,
            token: snapshot.token,
            user: snapshot.user,
            term: String(businessId),
            limit: BUSINESS_LIMIT,
            signal: operation.signal
          }), operation, () => assertCurrent(start, operation))
          if (timeout) return { status: 'error' }
          const business = businesses.find(row => Number(row.id) === businessId)
          if (!business) return { status: 'unavailable' }
          const path = buildDashboardDestinationPath(entry, business)
          if (!path) return { status: 'unavailable' }
          assertCurrent(start, operation)
          snapshot.setAssistantOpen(typeof window !== 'undefined' && window.innerWidth >= 768)
          assertCurrent(start, operation)
          snapshot.navigate(path, { remount: !!entry.remount })
          return { status: 'opened', scope: start.scope, revision: latestRef.current?.revision || snapshot.revision }
        }
        const path = buildDashboardDestinationPath(entry)
        if (!path) return { status: 'unavailable' }
        assertCurrent(start, operation)
        snapshot.setAssistantOpen(typeof window !== 'undefined' && window.innerWidth >= 768)
        assertCurrent(start, operation)
        snapshot.navigate(path, { remount: !!entry.remount })
        return { status: 'opened', scope: start.scope, revision: latestRef.current?.revision || snapshot.revision }
      }

      if (String(item.id).split(':').length !== 2) return { status: 'unavailable' }
      const [kind, rawId] = String(item.id).split(':')
      const recordId = Number(rawId)
      if (!Number.isInteger(recordId) || recordId < 1 || recordId > MAX_DASHBOARD_RECORD_ID) return { status: 'unavailable' }
      const userLevels = getSearchableUserLevels({ level: snapshot.level, can: snapshot.navCatalog?.can || (() => false) })
      let targetLevel
      let business
      if (kind === 'business') {
        if (!snapshot.navCatalog?.businessesAllowed) return { status: 'unavailable' }
        const { value: rows, timeout } = await awaitOperation(fetchBusinessSearchRows({
          ordering: snapshot.ordering,
          token: snapshot.token,
          user: snapshot.user,
          term: String(recordId),
          limit: BUSINESS_LIMIT,
          signal: operation.signal
        }), operation, () => assertCurrent(start, operation))
        if (timeout) return { status: 'error' }
        business = rows.find(row => Number(row.id) === recordId)
        if (!business) return { status: 'unavailable' }
      } else if (kind === 'order') {
        if (!canSearchOrders({ level: snapshot.level, canOpenOrders: snapshot.navCatalog?.can?.('/orders') })) return { status: 'unavailable' }
        const { value: rows, timeout } = await awaitOperation(fetchRecordSearchRows({
          entity: 'orders',
          ordering: snapshot.ordering,
          token: snapshot.token,
          query: String(recordId),
          extended: false,
          limit: RECORD_LIMIT,
          signal: operation.signal
        }), operation, () => assertCurrent(start, operation))
        if (timeout) return { status: 'error' }
        if (!rows.some(row => Number(row.id) === recordId)) return { status: 'unavailable' }
      } else if (kind === 'user') {
        if (!userLevels.length) return { status: 'unavailable' }
        const { value: rows, timeout } = await awaitOperation(fetchRecordSearchRows({
          entity: 'users',
          ordering: snapshot.ordering,
          token: snapshot.token,
          query: String(recordId),
          levels: userLevels,
          extended: false,
          limit: RECORD_LIMIT,
          signal: operation.signal
        }), operation, () => assertCurrent(start, operation))
        if (timeout) return { status: 'error' }
        const row = rows.find(found => Number(found.id) === recordId && userLevels.includes(Number(found.level)))
        if (!row) return { status: 'unavailable' }
        targetLevel = Number(row.level)
      } else {
        return { status: 'unavailable' }
      }
      const path = routeForRemote({ id: item.id, targetLevel, userLevels, user: snapshot.user, business })
      if (!path) return { status: 'unavailable' }
      assertCurrent(start, operation)
      snapshot.setAssistantOpen(typeof window !== 'undefined' && window.innerWidth >= 768)
      assertCurrent(start, operation)
      snapshot.navigate(path, { remount: kind === 'order' || kind === 'user' })
      return { status: 'opened', scope: start.scope, revision: latestRef.current?.revision || snapshot.revision }
    } catch (error) {
      if (error?.name === 'AbortError' && !operation.timedOut) throw error
      if (operation.timedOut) return { status: 'error' }
      if (error?.name === 'StaleDashboardSearchError') return { status: 'unavailable' }
      return { status: 'error' }
    } finally {
      operation.finish()
    }
  }

  return { search, open }
}
