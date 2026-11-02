import React, { useEffect, useId, useState } from 'react'

import { NumberControl, StyleOptions } from '../BuilderWebTheme/styles'
import { formatText, humanize, optionsOf } from './schemaNodes'

/** What each website type picks, and from which list. */
const MODES = { single_store: { kind: 'stores', key: 'businessId' }, franchise: { kind: 'franchises', key: 'franchiseId' } }
const SEARCH_DELAY = 300
// How close to the end of the list (px) the next page loads
const MORE_AT = 48
const EMPTY_LIST = { items: [], search: '', page: 0, totalPages: 0, total: 0, loading: false, loaded: false, error: false }

const modeOf = (scope) => scope.mode || (scope.franchiseId ? 'franchise' : scope.businessId ? 'single_store' : 'marketplace')

const MUTED = '#5E6B7D'
const DANGER = '#B0213D'
const linkButton = { padding: 0, border: 0, background: 'none', color: '#2C7BE5', font: 'inherit', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }

/** The texts of a picker, by what it picks. */
const textsOf = (t, kind) => kind === 'stores'
  ? {
      title: t('BUILDER_THEME_SITE_STORE', 'Store'),
      pick: t('BUILDER_THEME_SITE_PICK_STORE', 'Choose the store'),
      search: t('BUILDER_THEME_SITE_SEARCH_STORES', 'Search stores by name, slug or ID'),
      list: t('BUILDER_THEME_SITE_STORES', 'Stores'),
      none: t('BUILDER_THEME_SITE_NO_STORES', 'There are no enabled stores yet.'),
      missing: t('BUILDER_THEME_SITE_STORE_MISSING', 'Store #_id_ isn’t available anymore. Choose another one.'),
      incomplete: t('BUILDER_THEME_SITE_STORE_REQUIRED', 'Choose a store to save this website type.')
    }
  : {
      title: t('BUILDER_THEME_SITE_FRANCHISE', 'Franchise'),
      pick: t('BUILDER_THEME_SITE_PICK_FRANCHISE', 'Choose the franchise'),
      search: t('BUILDER_THEME_SITE_SEARCH_FRANCHISES', 'Search franchises by name, slug or ID'),
      list: t('BUILDER_THEME_SITE_FRANCHISES', 'Franchises'),
      none: t('BUILDER_THEME_SITE_NO_FRANCHISES', 'There are no enabled franchises yet.'),
      missing: t('BUILDER_THEME_SITE_FRANCHISE_MISSING', 'Franchise #_id_ isn’t available anymore. Choose another one.'),
      incomplete: t('BUILDER_THEME_SITE_FRANCHISE_REQUIRED', 'Choose a franchise to save this website type.')
    }

const Logo = ({ src }) => src
  ? <img src={src} alt='' style={{ width: 24, height: 24, flex: 'none', borderRadius: 4, objectFit: 'cover' }} />
  : <span aria-hidden='true' style={{ width: 24, height: 24, flex: 'none', borderRadius: 4, background: '#F1F3F5' }} />

/** The picked store or franchise: its name, read by its id when no loaded page has it. */
const Picked = ({ t, texts, id, selection, onRetry }) => {
  if (!id) return <span style={{ color: MUTED }}>{texts.pick}</span>
  if (selection?.item) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Logo src={selection.item.logo} />
        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selection.item.name || `#${id}`}</strong>
        {selection.item.enabled === false && <small style={{ color: MUTED }}>{t('BUILDER_THEME_SITE_DISABLED', '(disabled)')}</small>}
      </span>
    )
  }
  if (selection?.missing) return <span role='alert' style={{ color: DANGER }}>{texts.missing.replace('_id_', id)}</span>
  if (selection?.error) {
    return (
      <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <strong>#{id}</strong>
        <span role='alert' style={{ color: DANGER }}>{t('BUILDER_THEME_SITE_PICKED_LOAD_ERROR', 'We couldn’t read its name.')}</span>
        {onRetry && <button type='button' style={linkButton} onClick={onRetry}>{t('BUILDER_RETRY', 'Try again')}</button>}
      </span>
    )
  }
  return <span aria-busy='true' style={{ color: MUTED }}>#{id} · {t('LOADING', 'Loading')}</span>
}

/**
 * What a website shows (its type, `scope`): the whole marketplace, one store
 * or one franchise, picked from the project's with a search. It isn't a value
 * of the theme: `ctx.siteScope` brings the product's (`scope`, `setScope`,
 * `setScopeMode`), the stores and franchises to pick from, a page at a time
 * (`scopeOptions`, `loadScopeOptions`), and the picked one (`scopeSelection`).
 * The node's options name the three types.
 */
export const ScopeControl = ({ ctx, path, label }) => {
  const { t } = ctx
  const {
    scope = {},
    setScope,
    setScopeMode,
    scopeOptions = {},
    scopeSelection,
    scopeIncomplete,
    loadScopeOptions,
    reloadScopeSelection
  } = ctx.siteScope || {}
  const name = useId()
  const pickedId = useId()
  const listId = useId()
  const mode = modeOf(scope)
  const picker = MODES[mode]
  const kind = picker?.kind
  const list = (kind && scopeOptions[kind]) || EMPTY_LIST
  const texts = kind ? textsOf(t, kind) : null
  const [query, setQuery] = useState('')

  // Another type starts with its whole list
  useEffect(() => { setQuery('') }, [kind])
  // The list loads when the type needs it, and again (on the server) as the search changes
  useEffect(() => {
    if (!kind || !loadScopeOptions) return
    const text = query.trim()
    if (text === (list.search || '') && (list.loaded || list.loading)) return
    // The whole list at once; a search once the typing stops
    if (!text) {
      loadScopeOptions(kind, { search: '' })
      return
    }
    const timer = setTimeout(() => loadScopeOptions(kind, { search: text }), SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [kind, query])

  const hasMore = list.loaded && !list.error && list.page < list.totalPages
  const loadMore = () => { if (hasMore && !list.loading) loadScopeOptions(kind, { more: true }) }
  const onScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget
    if (scrollTop + clientHeight >= scrollHeight - MORE_AT) loadMore()
  }

  const choose = (next) => {
    if (setScopeMode) setScopeMode(next)
    else setScope && setScope(MODES[next] ? { mode: next } : {})
  }

  const id = picker ? scope[picker.key] : null
  const searched = list.search || ''

  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <StyleOptions role='radiogroup' aria-label={label} style={{ padding: 0 }}>
        {optionsOf(ctx.schema, path).map((option, index) => {
          const text = option.label ? formatText(t, option.label) : humanize(option.value)
          return (
            <label key={option.value}>
              <strong>
                <input type='radio' name={name} value={option.value} aria-label={text} aria-describedby={option.info ? `${name}-${index}` : undefined} checked={mode === option.value} onChange={() => choose(option.value)} />
                {text}
              </strong>
              {option.info && <small id={`${name}-${index}`}>{formatText(t, option.info)}</small>}
            </label>
          )
        })}
      </StyleOptions>
      {picker && (
        <span role='group' aria-label={texts.title} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <span id={pickedId} aria-live='polite' style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
            <small style={{ color: MUTED, fontWeight: 600 }}>{texts.title}</small>
            <Picked t={t} texts={texts} id={id} selection={scopeSelection} onRetry={reloadScopeSelection} />
            {!id && scopeIncomplete && <small style={{ color: DANGER }}>{texts.incomplete}</small>}
          </span>
          <NumberControl
            type='search'
            value={query}
            placeholder={texts.search}
            aria-label={texts.search}
            aria-controls={listId}
            onChange={(e) => setQuery(e.target.value)}
          />
          {list.error && (
            <span role='alert' style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline', color: DANGER, fontSize: 13 }}>
              {t('BUILDER_THEME_SITE_SCOPE_LOAD_ERROR', 'We couldn’t load the list. Try again in a moment.')}
              <button type='button' style={linkButton} onClick={() => loadScopeOptions(kind, { search: query.trim(), force: true })}>{t('BUILDER_RETRY', 'Try again')}</button>
            </span>
          )}
          {list.loaded && !list.loading && !list.error && !list.items.length && (
            <small role='status' style={{ color: MUTED }}>
              {searched ? t('BUILDER_THEME_NO_MATCH', 'Nothing matches “_query_”.').replace('_query_', searched) : texts.none}
            </small>
          )}
          <span
            id={listId}
            role='listbox'
            aria-label={texts.list}
            aria-busy={list.loading ? 'true' : 'false'}
            aria-describedby={pickedId}
            onScroll={onScroll}
            style={{ display: 'flex', flexDirection: 'column', maxHeight: 240, overflowY: 'auto', border: list.items.length ? '1px solid #E3E7EC' : 0, borderRadius: 8 }}
          >
            {list.items.map(item => {
              const selected = id !== null && id !== undefined && String(item.id) === String(id)
              return (
                <button
                  key={item.id}
                  type='button'
                  role='option'
                  aria-selected={selected ? 'true' : 'false'}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: 0, borderBottom: '1px solid #F1F3F5', background: selected ? '#E9F2FE' : 'transparent', textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => setScope({ mode, [picker.key]: item.id, item })}
                >
                  <Logo src={item.logo} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  {item.slug && <small aria-hidden='true' style={{ marginLeft: 'auto', color: MUTED }}>{item.slug}</small>}
                </button>
              )
            })}
          </span>
          {(list.loading || hasMore) && (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, color: MUTED }}>
              <span role='status'>
                {list.loading
                  ? t('LOADING', 'Loading')
                  : t('BUILDER_THEME_SITE_SHOWING', 'Showing _shown_ of _total_').replace('_shown_', list.items.length).replace('_total_', list.total)}
              </span>
              {hasMore && !list.loading && <button type='button' style={linkButton} onClick={loadMore}>{t('BUILDER_THEME_SITE_LOAD_MORE', 'Load more')}</button>}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
