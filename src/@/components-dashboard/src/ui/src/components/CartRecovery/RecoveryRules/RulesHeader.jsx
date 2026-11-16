import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { Button, FilterBar, IconButton, PageHeader, SearchField, Skeleton } from '../../Shared/Product'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { Menu as MenuIcon, Plus } from '../../Shared/Icon'
import './recovery-rules-list.css'

// redesign RA-B2 (decision 2; M-RA1, M-RA2): the page header of the cart recovery rules list. Title and count, the «N of M rules on» line
// (the same account open carts shows; since R2-G1 in its own row under the page header, not in its status slot), the help line as the description (always visible; the drag-and-drop sentence is gone, the list
// has no order to drag), Learn, «New rule» (the one primary action) and, under them, the search of today inside a filter bar.
// It holds no data: the host passes what to draw and hears each action once.
//
// @param {number}   [props.count]        Rules in the list; the count is not drawn while it is unknown.
// @param {{on:number,total:number}|null} [props.summary]  How many rules are on. `null` (still unknown) holds the line with a skeleton; `undefined` leaves it out.
// @param {Function} props.onNew          `() => void`: «New rule» (the host opens the panel to create one).
// @param {Function} [props.onOpenMenu]   Given while the sidebar is collapsed: the menu button goes before the title (today's `isCollapse`).
// @param {string}   [props.search]       The search text the controller holds ('' = none).
// @param {Function} props.onSearch       `(text: string) => void`, after the wait the search of today had (at once on Enter and on clear).
// @param {Array}    [props.learnOptions] `{ value, name, url }` of the help articles; LearnDropDown draws them for level 0 only.
// @param {React.ReactNode} [props.tools]  CM-1: the column manager, in the filter bar's `tools` slot (the end of the search row, as /orders).

// The wait before the search text reaches the controller: each change of it is a request of the list (SearchBar lazyLoad: 750 ms)
const SEARCH_DEBOUNCE_MS = 750

const isKnown = (value) => value != null && value !== '' && Number.isFinite(Number(value))

const formatNumber = (value, locale) => {
  try {
    return new Intl.NumberFormat(locale).format(Number(value))
  } catch (error) {
    return String(value)
  }
}

const figure = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

// «_on_ of _total_ rules on»: the placeholders of a translated template become nodes (a figure), in the order the language wants
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

const plain = (template, values) => template.replace(/_([a-z]+)_/g, (match, name) => (values[name] !== undefined ? values[name] : match))

export const RulesHeader = ({ count, summary, onNew, onOpenMenu, search = '', onSearch, learnOptions, tools }) => {
  const [languageState, t] = useLanguage()
  const locale = languageState?.language?.code
  const known = isKnown(count)
  const shown = known ? formatNumber(count, locale) : null
  const countLabel = Number(count) === 1
    ? t('RECOVERY_RULES_COUNT_ONE', '1 rule')
    : t('RECOVERY_RULES_COUNT_OTHER', '_count_ rules').replace('_count_', () => shown ?? String(count))

  // ---- the line «3 of 8 rules on»: a dot (warning when none is on, success otherwise) and the words, never the colour alone ----
  const summaryKnown = Boolean(summary) && isKnown(summary.on) && isKnown(summary.total)
  const summaryTemplate = t('RECOVERY_RULES_ON_SUMMARY', '_on_ of _total_ rules on')
  const status = summaryKnown
    ? (
      <span
        className='odc-ra-summary'
        data-state={Number(summary.on) > 0 ? 'on' : 'off'}
        title={plain(summaryTemplate, { on: formatNumber(summary.on, locale), total: formatNumber(summary.total, locale) })}
      >
        <span className='odc-ra-dot' aria-hidden='true' />
        <span className='odc-ra-summary-text'>
          {fill(summaryTemplate, { on: figure(formatNumber(summary.on, locale)), total: figure(formatNumber(summary.total, locale)) })}
        </span>
      </span>
      )
    : (summary === undefined ? null : <Skeleton size='calc(var(--od-x-type-title-size) * 9)' />) // redesign RA-I1: undefined (could not be read) leaves the line out

  // ---- search: typed here, sent after a wait (at once on Enter and on clear). A value set from outside shows unless the person is typing.
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

  const searchLabel = t('SEARCH_RULES', 'Search rules')
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

  return (
    <div className='odc-root odc-ra-header'>
      <PageHeader
        className='odc-ra-head'
        leading={onOpenMenu && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={onOpenMenu} />}
        title={t('CART_RECOVERY_RULES', 'Cart recovery rules')}
        count={known ? shown : undefined}
        countLabel={known ? countLabel : undefined}
        description={t('RECOVERY_RULES_HELP', 'Each rule writes to customers a set time after they last opened their cart.')}
        learn={learnOptions ? <LearnDropDown learnOptions={learnOptions} /> : undefined}
        primaryAction={(
          <Button variant='primary' icon={Plus} title={t('RECOVERY_RULES_NEW', 'New rule')} onClick={() => onNew?.()}>
            <span data-collapse-label=''>{t('RECOVERY_RULES_NEW', 'New rule')}</span>
          </Button>
        )}
      />
      {/* redesign R2-G1 (F1 of the mechanical measure): the line is its own row under the page header, at every width. In the status slot
          of the title row it took the room of the h1, which ended in an ellipsis at 390 in the 11 non-English languages. `null` (unknown)
          holds the row with a skeleton; `undefined` draws no row at all (no gap). */}
      {status && <div className='odc-ra-summary-row'>{status}</div>}
      <FilterBar flush label={searchLabel} search={searchNode} tools={tools} />
    </div>
  )
}
