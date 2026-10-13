import React, { useEffect, useRef, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ArrowClockwise } from 'react-bootstrap-icons'

import { useLanguage, useApi, useSession } from '../../../../../index'
import { SearchBar } from '../../Shared'
import {
  USAGE_LIMITS_MANUAL_COOLDOWN_MS,
  formatUsageDuration,
  getUsageErrorMessage,
  getUsageSecondsLeft,
  humanizeUsageName,
  matchesUsageSearch,
  parseUsageScope,
  sortUsageLimits
} from './utils'
import {
  CardFooter,
  CardHeader,
  CardMeta,
  CardTitle,
  Container,
  CooldownBar,
  CooldownCount,
  EmptyState,
  FooterMeta,
  LimitCard,
  LimitList,
  Notice,
  Percent,
  ProgressFill,
  ProgressTrack,
  RefreshButton,
  SearchWrapper,
  StatusBadge,
  Toolbar,
  ToolbarActions,
  UsageText
} from './styles'

const formatCount = (value) => Number(value).toLocaleString()

/**
 * Read-only view of the project's API usage limits.
 * Lives in Settings > Apps & developers. Admin only (the hub route is level 0).
 * Never asks for `?include=monitor`: monitor-only limits stay internal.
 * Loads on open and on Refresh only: no polling.
 */
export const ApiUsageLimits = () => {
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [state, setState] = useState({ loading: true, refreshing: false, error: null, result: null, fetchedAt: null })
  const [now, setNow] = useState(() => Date.now())
  const [search, setSearch] = useState('')
  const [requestedAt, setRequestedAt] = useState(0)
  const lastRequestRef = useRef(0)
  const inFlightRef = useRef(false)
  const controllerRef = useRef(null)

  const fetchLimits = async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    lastRequestRef.current = Date.now()
    setRequestedAt(lastRequestRef.current)
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    controllerRef.current = controller
    setState(prev => ({ ...prev, loading: !prev.result, refreshing: !!prev.result }))
    try {
      const headers = { Authorization: `Bearer ${token}` }
      // App and client limits are measured on the dashboard's own requests.
      if (ordering.appId) headers['X-APP-X'] = ordering.appId
      if (ordering.appInternalName) headers['X-INTERNAL-PRODUCT-X'] = ordering.appInternalName
      const response = await fetch(`${ordering.root}/usage_limits`, {
        headers,
        cache: 'no-store',
        signal: controller?.signal
      })
      const content = await response.json()
      if (!response.ok || content?.error || !content?.result) {
        throw new Error(getUsageErrorMessage(content?.result) || '')
      }
      setState({ loading: false, refreshing: false, error: null, result: content.result, fetchedAt: Date.now() })
    } catch (err) {
      if (err?.name === 'AbortError') return
      const fallback = t('API_USAGE_LOAD_ERROR', 'We could not load the usage limits. Try again in a moment.')
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: err?.message ? `${fallback} (${err.message})` : fallback
      }))
    } finally {
      inFlightRef.current = false
    }
  }

  useEffect(() => {
    fetchLimits()
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(timer)
      controllerRef.current?.abort()
    }
  }, [])

  const limits = state.result?.limits || []

  // Tick faster while the Refresh button cools down, so its countdown stays exact
  // and it wakes up right at 5 s instead of on the next 1 s tick.
  useEffect(() => {
    const endsAt = requestedAt + USAGE_LIMITS_MANUAL_COOLDOWN_MS
    if (endsAt <= Date.now()) return
    const timer = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= endsAt) clearInterval(timer)
    }, 250)
    return () => clearInterval(timer)
  }, [requestedAt])

  const durationUnits = {
    d: t('API_USAGE_UNIT_DAYS', 'd'),
    h: t('API_USAGE_UNIT_HOURS', 'h'),
    min: t('API_USAGE_UNIT_MINUTES', 'min'),
    s: t('API_USAGE_UNIT_SECONDS', 's')
  }

  const resourceLabels = {
    email: t('API_USAGE_RESOURCE_EMAIL', 'Emails'),
    sms: t('API_USAGE_RESOURCE_SMS', 'SMS messages'),
    whatsapp: t('API_USAGE_RESOURCE_WHATSAPP', 'WhatsApp messages'),
    push: t('API_USAGE_RESOURCE_PUSH', 'Push notifications'),
    webhook: t('API_USAGE_RESOURCE_WEBHOOK', 'Webhooks'),
    report: t('API_USAGE_RESOURCE_REPORT', 'Reports'),
    storage: t('API_USAGE_RESOURCE_STORAGE', 'Storage')
  }

  const windowLabels = {
    second: t('API_USAGE_WINDOW_SECOND', 'per second'),
    minute: t('API_USAGE_WINDOW_MINUTE', 'per minute'),
    hour: t('API_USAGE_WINDOW_HOUR', 'per hour'),
    day: t('API_USAGE_WINDOW_DAY', 'per day'),
    month: t('API_USAGE_WINDOW_MONTH', 'per month')
  }

  const metricLabels = {
    requests: t('API_USAGE_METRIC_REQUESTS', 'requests'),
    units: t('API_USAGE_METRIC_UNITS', 'units')
  }

  const keyLabels = {
    app: t('API_USAGE_KEY_APP', 'Per app'),
    client: t('API_USAGE_KEY_CLIENT', 'Per client type')
  }

  const modeLabels = {
    soft: t('API_USAGE_MODE_SOFT', 'Alert only'),
    hard: t('API_USAGE_MODE_HARD', 'Blocks when exceeded'),
    ban: t('API_USAGE_MODE_BAN', 'Blocks and bans when exceeded'),
    monitor: t('API_USAGE_MODE_MONITOR', 'Measured only')
  }

  const statusLabels = {
    ok: t('API_USAGE_STATUS_OK', 'OK'),
    warning: t('API_USAGE_STATUS_WARNING', 'Near the limit'),
    exceeded: t('API_USAGE_STATUS_EXCEEDED', 'Limit exceeded')
  }

  const describeScope = (scopeValue) => {
    const scope = parseUsageScope(scopeValue)
    if (scope.type === 'project') {
      return { title: t('API_USAGE_SCOPE_PROJECT', 'Whole project'), kind: t('API_USAGE_SCOPE_PROJECT_HELP', 'All API requests') }
    }
    if (scope.type === 'http') {
      return { title: `${scope.method} ${scope.path}`, kind: t('API_USAGE_SCOPE_ENDPOINT', 'Endpoint') }
    }
    if (scope.type === 'resource') {
      return {
        title: resourceLabels[scope.name] || humanizeUsageName(scope.name),
        kind: t('API_USAGE_SCOPE_RESOURCE', 'Resource')
      }
    }
    if (scope.type === 'custom') {
      return { title: humanizeUsageName(scope.name), kind: t('API_USAGE_SCOPE_CUSTOM', 'Custom counter') }
    }
    return { title: scope.name, kind: null }
  }

  const describeLimit = (limit) => {
    const { title, kind } = describeScope(limit.scope)
    const hasUsage = typeof limit.usage === 'number' && typeof limit.used_pct === 'number'
    const status = hasUsage ? limit.status : null
    const metric = metricLabels[limit.metric] || humanizeUsageName(limit.metric).toLowerCase()
    const windowLabel = windowLabels[limit.window] || limit.window
    const statusLabel = status ? (statusLabels[status] || status) : t('API_USAGE_STATUS_UNKNOWN', 'No usage data')
    const meta = [kind, keyLabels[limit.key], modeLabels[limit.mode]].filter(Boolean).join(' · ')
    // Search sees what the card shows plus the raw API values (`sms`, `hard`, `http:POST auth`).
    const searchTexts = [
      title, kind, windowLabel, metric, statusLabel, keyLabels[limit.key], modeLabels[limit.mode],
      limit.scope, limit.key, limit.metric, limit.window, limit.mode, limit.status
    ]
    return { title, meta, metric, windowLabel, hasUsage, status, statusLabel, searchTexts }
  }

  const renderLimit = ({ limit, view }) => {
    const { title, meta, metric, windowLabel, hasUsage, status, statusLabel } = view
    const pct = hasUsage ? Math.min(100, Math.max(0, limit.used_pct)) : 0
    const secondsLeft = getUsageSecondsLeft(limit, now, state.fetchedAt)

    return (
      <LimitCard
        key={[limit.scope, limit.key, limit.metric, limit.window, limit.mode].join('|')}
        data-testid='api-usage-limit'
      >
        <CardHeader>
          <div>
            <CardTitle>{title} · {windowLabel}</CardTitle>
            {!!meta && <CardMeta>{meta}</CardMeta>}
          </div>
          <StatusBadge $status={status}>
            {statusLabel}
          </StatusBadge>
        </CardHeader>
        <ProgressTrack
          role='progressbar'
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={hasUsage ? pct : undefined}
        >
          {hasUsage && <ProgressFill $pct={pct} $status={status} />}
        </ProgressTrack>
        <CardFooter>
          <UsageText>
            {hasUsage
              ? (
                <>
                  <strong>{formatCount(limit.usage)}</strong> / {formatCount(limit.limit)} {metric}
                  <Percent $status={status}>{Math.round(limit.used_pct)}%</Percent>
                </>
                )
              : (
                <>
                  {t('API_USAGE_LIMIT', 'Limit')}: <strong>{formatCount(limit.limit)}</strong> {metric}
                </>
                )}
          </UsageText>
          <FooterMeta>
            {[
              hasUsage && typeof limit.remaining === 'number'
                ? `${t('API_USAGE_REMAINING', 'Remaining')}: ${formatCount(Math.max(0, limit.remaining))}`
                : null,
              secondsLeft === null
                ? null
                : secondsLeft === 0
                  ? t('API_USAGE_RESET_REFRESH', 'Window restarted, refresh to update')
                  : `${t('API_USAGE_RESETS_IN', 'Resets in')} ${formatUsageDuration(secondsLeft, durationUnits)}`
            ].filter(Boolean).join(' · ')}
          </FooterMeta>
        </CardFooter>
      </LimitCard>
    )
  }

  if (state.loading) {
    return (
      <Container>
        <Skeleton height={32} width={200} />
        <Skeleton height={96} count={2} style={{ marginBottom: 12 }} />
      </Container>
    )
  }

  // Any request (open, poll, manual) starts the cooldown, so the button never asks twice within 5 s.
  const cooldownLeftMs = Math.max(0, requestedAt + USAGE_LIMITS_MANUAL_COOLDOWN_MS - Math.max(now, requestedAt))
  const isCoolingDown = requestedAt > 0 && cooldownLeftMs > 0
  const cooldownSeconds = Math.ceil(cooldownLeftMs / 1000)
  const handleManualRefresh = () => {
    if (Date.now() - lastRequestRef.current < USAGE_LIMITS_MANUAL_COOLDOWN_MS) return
    setNow(Date.now())
    fetchLimits()
  }
  const visibleLimits = sortUsageLimits(limits)
    .map(limit => ({ limit, view: describeLimit(limit) }))
    .filter(({ view }) => matchesUsageSearch(search, view.searchTexts))

  return (
    <Container>
      <Toolbar>
        {limits.length > 0 && (
          <SearchWrapper>
            <SearchBar
              search={search}
              onSearch={setSearch}
              placeholder={t('API_USAGE_SEARCH', 'Search limits')}
            />
          </SearchWrapper>
        )}
        <ToolbarActions>
          <RefreshButton
            type='button'
            onClick={handleManualRefresh}
            disabled={state.refreshing || isCoolingDown}
            title={isCoolingDown && !state.refreshing
              ? t('API_USAGE_REFRESH_AVAILABLE_IN', 'You can refresh again in _seconds_ s').replace('_seconds_', cooldownSeconds)
              : undefined}
          >
            <ArrowClockwise />
            {state.refreshing ? t('API_USAGE_REFRESHING', 'Refreshing') : t('REFRESH', 'Refresh')}
            {isCoolingDown && !state.refreshing && (
              <CooldownCount aria-hidden='true'>{cooldownSeconds} {durationUnits.s}</CooldownCount>
            )}
            {isCoolingDown && (
              <CooldownBar
                key={requestedAt}
                aria-hidden='true'
                data-testid='api-usage-refresh-cooldown'
                $durationMs={USAGE_LIMITS_MANUAL_COOLDOWN_MS}
              />
            )}
          </RefreshButton>
        </ToolbarActions>
      </Toolbar>

      {!!state.error && <Notice $tone='danger' role='alert'>{state.error}</Notice>}

      {state.result?.degraded && (
        <Notice role='status'>
          {t('API_USAGE_DEGRADED', 'Usage data is not available right now. The limits are shown without their current usage.')}
        </Notice>
      )}

      {state.result && limits.length === 0 && (
        <EmptyState>
          <h3>{t('API_USAGE_EMPTY', 'This project has no active usage limits.')}</h3>
          <p>{t('API_USAGE_EMPTY_HELP', 'When a limit applies to this project, it shows here with its current usage.')}</p>
        </EmptyState>
      )}

      {limits.length > 0 && visibleLimits.length === 0 && (
        <EmptyState>
          <h3>{t('API_USAGE_SEARCH_EMPTY', 'No limits match your search.')}</h3>
          <p>{t('API_USAGE_SEARCH_EMPTY_HELP', 'Try another word, like an endpoint, a resource or a status.')}</p>
        </EmptyState>
      )}

      {visibleLimits.length > 0 && (
        <LimitList>
          {visibleLimits.map(renderLimit)}
        </LimitList>
      )}
    </Container>
  )
}
