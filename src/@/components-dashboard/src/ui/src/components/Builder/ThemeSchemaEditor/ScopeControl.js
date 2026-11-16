import React, { useCallback, useEffect, useId, useState } from 'react'

import { Button, RadioGroup, SearchField } from '../../Shared/Product'
import { formatText, humanize, optionsOf } from './schemaNodes'
import '../BuilderWebSite/builder-site.css'

// redesign B3a: the types are a P/RadioGroup (cards, as the old option cards), the search a P/SearchField (same
// 300 ms server search), the links P/Button `link`. The list stays a native single-choice listbox styled with tokens:
// P/SelectableList is a multi-select.

/** What each website type picks, and from which list. */
const MODES = { single_store: { kind: 'stores', key: 'businessId' }, franchise: { kind: 'franchises', key: 'franchiseId' } }
const SEARCH_DELAY = 300
// How close to the end of the list (px) the next page loads
const MORE_AT = 48
const EMPTY_LIST = { items: [], search: '', page: 0, totalPages: 0, total: 0, loading: false, loaded: false, error: false }

const modeOf = (scope) => scope.mode || (scope.franchiseId ? 'franchise' : scope.businessId ? 'single_store' : 'marketplace')

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
  ? <img src={src} alt='' className='odc-bs-logo' />
  : <span aria-hidden='true' className='odc-bs-logo' />

/** The picked store or franchise: its name, read by its id when no loaded page has it. */
const Picked = ({ t, texts, id, selection, onRetry }) => {
  if (!id) return <span className='odc-bs-muted'>{texts.pick}</span>
  if (selection?.item) {
    return (
      <span className='odc-bs-item'>
        <Logo src={selection.item.logo} />
        <strong className='odc-bs-item-name'>{selection.item.name || `#${id}`}</strong>
        {selection.item.enabled === false && <small className='odc-bs-muted'>{t('BUILDER_THEME_SITE_DISABLED', '(disabled)')}</small>}
      </span>
    )
  }
  if (selection?.missing) return <span role='alert' className='odc-bs-danger'>{texts.missing.replace('_id_', id)}</span>
  if (selection?.error) {
    return (
      <span className='odc-bs-item'>
        <strong>#{id}</strong>
        <span role='alert' className='odc-bs-danger'>{t('BUILDER_THEME_SITE_PICKED_LOAD_ERROR', 'We couldn’t read its name.')}</span>
        {onRetry && <Button variant='link' size='sm' onClick={onRetry}>{t('BUILDER_RETRY', 'Try again')}</Button>}
      </span>
    )
  }
  return <span aria-busy='true' className='odc-bs-muted'>#{id} · {t('LOADING', 'Loading')}</span>
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
  // P/SearchField spreads extra props on its frame: the input itself keeps aria-controls, as before
  const searchRef = useCallback(node => node?.setAttribute('aria-controls', listId), [listId])
  const types = optionsOf(ctx.schema, path).map(option => ({
    value: option.value,
    label: option.label ? formatText(t, option.label) : humanize(option.value),
    description: option.info ? formatText(t, option.info) : undefined
  }))

  return (
    <div className='odc-bs-scope'>
      <RadioGroup label={label} hideLabel variant='cards' options={types} value={mode} onValueChange={choose} />
      {picker && (
        <div role='group' aria-label={texts.title} className='odc-bs-picker'>
          <span id={pickedId} aria-live='polite' className='odc-bs-picked'>
            <small className='odc-bs-picked-title'>{texts.title}</small>
            <Picked t={t} texts={texts} id={id} selection={scopeSelection} onRetry={reloadScopeSelection} />
            {!id && scopeIncomplete && <small className='odc-bs-danger'>{texts.incomplete}</small>}
          </span>
          <SearchField
            className='odc-bs-search'
            value={query}
            onChange={setQuery}
            label={texts.search}
            placeholder={texts.search}
            clearLabel={t('CLEAR_SEARCH', 'Clear search')}
            inputRef={searchRef}
          />
          {list.error && (
            <span role='alert' className='odc-bs-error'>
              {t('BUILDER_THEME_SITE_SCOPE_LOAD_ERROR', 'We couldn’t load the list. Try again in a moment.')}
              <Button variant='link' size='sm' onClick={() => loadScopeOptions(kind, { search: query.trim(), force: true })}>{t('BUILDER_RETRY', 'Try again')}</Button>
            </span>
          )}
          {list.loaded && !list.loading && !list.error && !list.items.length && (
            <small role='status' className='odc-bs-empty'>
              {searched ? t('BUILDER_THEME_NO_MATCH', 'Nothing matches “_query_”.').replace('_query_', searched) : texts.none}
            </small>
          )}
          <div
            id={listId}
            role='listbox'
            aria-label={texts.list}
            aria-busy={list.loading ? 'true' : 'false'}
            aria-describedby={pickedId}
            onScroll={onScroll}
            className='odc-bs-list'
          >
            {list.items.map(item => {
              const selected = id !== null && id !== undefined && String(item.id) === String(id)
              return (
                <button
                  key={item.id}
                  type='button'
                  role='option'
                  aria-selected={selected ? 'true' : 'false'}
                  className='odc-bs-option'
                  onClick={() => setScope({ mode, [picker.key]: item.id, item })}
                >
                  <Logo src={item.logo} />
                  <span className='odc-bs-option-name'>{item.name}</span>
                  {item.slug && <small aria-hidden='true' className='odc-bs-option-slug'>{item.slug}</small>}
                </button>
              )
            })}
          </div>
          {(list.loading || hasMore) && (
            <span className='odc-bs-more'>
              <span role='status'>
                {list.loading
                  ? t('LOADING', 'Loading')
                  : t('BUILDER_THEME_SITE_SHOWING', 'Showing _shown_ of _total_').replace('_shown_', list.items.length).replace('_total_', list.total)}
              </span>
              {hasMore && !list.loading && <Button variant='link' size='sm' onClick={loadMore}>{t('BUILDER_THEME_SITE_LOAD_MORE', 'Load more')}</Button>}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
