import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { Button, ChecklistPopover, FilterBar, FilterChips, SearchField } from '../../Shared/Product'
import { pillValue } from '../../Shared/Product/filterValueText'
import { MessageSquare, Users } from '../../Shared/Icon'
import { audienceLabel, channelLabel, filterOptions } from './campaignData'

// redesign CA-B3 (decision 2; defects M-CA6, auditor #8): the one-row filter bar of the campaigns list: search (name or channel text, the
// controller's job), the Channel and Audience pills (each a list of checks), one chip per active value and «Clear filters». It holds no
// filter state: it shows what K/CampaignListing holds and reports each action once. No Status pill: the raw `status` is not what the
// table shows for a dynamic campaign (Active/Paused come from `enabled`), so a Status filter would mislead.
//
// @param {string}   [props.search]    The search text the controller holds ('' = none).
// @param {Function} props.onSearch    `(text: string) => void`, called after the wait the search of today had (at once on Enter and on clear).
// @param {object}   [props.values]    `{ contact_type: string[], audience_type: string[] }`: the raw values the API filters by. A key that is
//                                     missing is an empty list.
// @param {Function} props.onChange    `(next: { contact_type, audience_type }) => void`: ALWAYS both keys, complete.
// @param {Function} props.onClear     `() => void`: «Clear filters» (the host empties the search and both lists).
// @param {React.ReactNode} [props.tools] CM-1: the column manager, in the bar's `tools` slot (the end of the search row, as /orders).

// The wait before the search text reaches the controller: each change of it is a request of the list (SearchBar lazyLoad: 750 ms)
const SEARCH_DEBOUNCE_MS = 750

const idsOf = (values, key) => (Array.isArray(values?.[key]) ? values[key] : [])

export const CampaignsFilters = ({ search = '', onSearch, values, onChange, onClear, tools }) => {
  const [, t] = useLanguage()
  const channels = idsOf(values, 'contact_type')
  const audiences = idsOf(values, 'audience_type')
  const options = filterOptions(t)
  const write = (patch) => onChange?.({ contact_type: channels, audience_type: audiences, ...patch })

  // ---- search: typed here, sent after a wait (at once on Enter and on clear). A value set from outside shows unless the user is typing.
  const [searchText, setSearchText] = useState(search || '')
  const searchTimer = useRef(null)
  const searchInput = useRef(null)
  const sentSearch = useRef(search || '')
  sentSearch.current = search || ''
  useEffect(() => {
    if (!search) {
      setSearchText('')
      return
    }
    if (typeof document !== 'undefined' && document.activeElement !== searchInput.current) setSearchText(search)
  }, [search])
  useEffect(() => () => clearTimeout(searchTimer.current), [])
  const sendSearch = (text) => {
    clearTimeout(searchTimer.current)
    if (text !== sentSearch.current) onSearch?.(text)
  }
  const typeSearch = (text) => {
    setSearchText(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => sendSearch(text), SEARCH_DEBOUNCE_MS)
  }

  const searchLabel = t('CAMPAIGNS_SEARCH', 'Search campaigns')
  const searchNode = (
    <SearchField
      value={searchText}
      onChange={typeSearch}
      onClear={() => sendSearch('')}
      onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
      inputRef={searchInput}
      label={searchLabel}
      placeholder={searchLabel}
      clearLabel={t('CLEAR_SEARCH', 'Clear search')}
    />
  )

  // ---- pills ------------------------------------------------------------------------------------------------------------
  const channelPill = t('CAMPAIGNS_FILTER_CHANNEL', 'Channel')
  const audiencePill = t('CAMPAIGNS_FILTER_AUDIENCE', 'Audience')
  const toggle = (ids, id) => (ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id])
  const pickerLabels = {
    searchLabel: t('SEARCH', 'Search'),
    clearSearchLabel: t('CLEAR_SEARCH', 'Clear search'),
    loadingLabel: `${t('LOADING', 'Loading')}...`,
    noResultsLabel: t('NO_RESULTS_FOUND', 'No results found'),
    clearLabel: t('CLEAR', 'Clear')
  }

  const pills = (
    <>
      <ChecklistPopover
        icon={MessageSquare}
        label={channelPill}
        value={pillValue(channels, (id) => channelLabel(t, id))}
        priority='secondary'
        items={options.channel}
        selected={channels}
        onToggle={(id) => write({ contact_type: toggle(channels, id) })}
        onClear={() => write({ contact_type: [] })}
        {...pickerLabels}
      />
      <ChecklistPopover
        icon={Users}
        label={audiencePill}
        value={pillValue(audiences, (id) => audienceLabel(t, id))}
        priority='secondary'
        items={options.audience}
        selected={audiences}
        onToggle={(id) => write({ audience_type: toggle(audiences, id) })}
        onClear={() => write({ audience_type: [] })}
        {...pickerLabels}
      />
    </>
  )

  // ---- chips: one per active value, and «Clear filters» ---------------------------------------------------------------------
  const clearText = t('CLEAR_FILTERS', 'Clear filters')
  // both «Clear filters» buttons leave the page with the filters; the focus goes to the first control of the bar (the search) before they
  // do, so it never falls to <body> (as /users/customers, UC-R2b Q-04)
  const clearAll = () => {
    onClear?.()
    searchInput.current?.focus()
  }
  const chips = [
    ...channels.map(id => ({ key: `contact_type:${id}`, label: `${channelPill}: ${channelLabel(t, id)}`, onRemove: () => write({ contact_type: channels.filter(item => item !== id) }) })),
    ...audiences.map(id => ({ key: `audience_type:${id}`, label: `${audiencePill}: ${audienceLabel(t, id)}`, onRemove: () => write({ audience_type: audiences.filter(item => item !== id) }) }))
  ]
  const narrowing = Boolean(searchText || search) || chips.length > 0

  return (
    <FilterBar
      flush
      label={t('CAMPAIGNS_FILTERS', 'Campaign filters')}
      // the pills that do not fit go to «+N»; its name says how many, and how many of them hold a value
      overflowLabel={(count) => `+${count} ${t('MORE_FILTERS', 'more filters')}`}
      overflowActiveLabel={(count) => t('FILTERS_ACTIVE_COUNT', '_count_ active').replace('_count_', count)}
      // the row keeps the room of «Clear filters» even with no filter on, so the first filter never moves the bar
      clearReserve={clearText}
      search={searchNode}
      filters={pills}
      tools={tools}
      clear={narrowing ? <Button variant='ghost' onClick={clearAll}>{clearText}</Button> : undefined}
      chips={chips.length > 0
        ? (
          <FilterChips
            label={t('FILTERS_ACTIVE', 'Active filters')}
            clearAllLabel={clearText}
            onClearAll={clearAll}
            chips={chips.map(chip => ({
              ...chip,
              removeLabel: t('REMOVE_FILTER', 'Remove _filter_ filter').replace('_filter_', () => chip.label)
            }))}
          />
          )
        : undefined}
    />
  )
}
