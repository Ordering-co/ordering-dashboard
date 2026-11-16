import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { Button, IconButton, PageHeader, SearchField, SegmentedControl } from '../../Shared/Product'
import { Menu as MenuIcon, Plus } from '../../Shared/Icon'
import { DriversExport } from './DriversExport'
import { directoryCopy } from './directoryRole'
import './drivers-filters.css'

// redesign DL-B4 (decision 3 | M-DL10 | M-DL12): the header and the filter row of /delivery/drivers-list. Title and count, Learn (the
// same `LearnDropDown` of main, which draws only for a level-zero session with options), the visible Export CSV and the one primary
// action, «Add driver», which keeps main's `data-tour="tour_add"` anchor (the tour of /delivery/drivers-managers uses it). Under it, the
// search and the status control. The menu button of a collapsed sidebar is main's (`useInfoShare`).
//
// There is NO «Filters applied. You may miss new orders.» here (M-DL10): that notice of main is about orders and was wrong on this page.
// The page builds its own notice (the level 5 without groups one) and passes it as `notice`.

// The wait before the search text reaches the controller, as the search of main (`SearchBar lazyLoad`): each change is a request
const SEARCH_DEBOUNCE_MS = 750

export const STATUS_OPTIONS = [
  { value: 'all', labelKey: 'ALL', label: 'All' },
  { value: 'available', labelKey: 'AVAILABLE', label: 'Available' },
  { value: 'busy', labelKey: 'BUSY', label: 'Busy' },
  { value: 'offline', labelKey: 'OFFLINE', label: 'Offline' }
]

export const DriversHeader = ({
  title,
  count,
  learnOptions,
  actionDisabled,
  onAddDriver,
  exportProps,
  search = '',
  onSearch,
  status = 'all',
  onStatusChange,
  showStatusFilter = true,
  notice,
  // redesign DM-B4 (decision 1 | M-DL12): 'drivers' (the default, nothing changes) or 'managers'; the count and the action texts come from directoryCopy
  role = 'drivers'
}) => {
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const known = count != null && Number.isFinite(Number(count))
  const copy = directoryCopy(role, t)
  const countLabel = Number(count) === 1
    ? copy.countOne
    : copy.countOther.replace('_count_', count)

  // ---- search: typed here, sent after a wait (at once on Enter and on clear) ----------------------------------------------
  const [searchText, setSearchText] = useState(search || '')
  const searchTimer = useRef(null)
  const searchInput = useRef(null)
  const sentSearch = useRef(search || '')
  sentSearch.current = search || ''
  // a value set from outside (⌘K, «Clear filters») shows unless the user is typing
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

  const exportLabel = t('DRIVERS_EXPORT_CSV', 'Export CSV')
  const addLabel = copy.add

  return (
    <div className='odc-dl-header'>
      <PageHeader
        // `odc-dl-head` scopes the narrow rules of Learn and Export CSV in drivers-filters.css (the class is PageHeader's own)
        className='odc-dl-head'
        title={title}
        count={known ? Number(count) : undefined}
        countLabel={known ? countLabel : undefined}
        learn={<LearnDropDown learnOptions={learnOptions} />}
        // the holder carries the tooltip of the icon-only state, since the button is not this file's
        actions={(
          <span className='odc-dl-export' title={exportLabel}>
            <DriversExport {...exportProps} role={role} disabled={actionDisabled} />
          </span>
        )}
        primaryAction={(
          // `data-tour` is main's anchor of the drivers tour (the former drivers header): not a class
          <Button variant='primary' icon={Plus} data-tour='tour_add' title={addLabel} disabled={actionDisabled} onClick={() => onAddDriver?.()}>
            <span data-collapse-label=''>{addLabel}</span>
          </Button>
        )}
        leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
      />
      <div className='odc-dl-filters'>
        <div className='odc-dl-search'>
          <SearchField
            value={searchText}
            onChange={typeSearch}
            onClear={() => sendSearch('')}
            onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
            inputRef={searchInput}
            label={t('SEARCH', 'Search')}
            placeholder={t('DRIVERS_SEARCH_PLACEHOLDER', 'Search name, email or phone')}
            clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          />
        </div>
        {showStatusFilter && (
          <div className='odc-dl-status'>
            <SegmentedControl
              label={t('DRIVERS_STATUS_FILTER', 'Status')}
              value={status}
              onValueChange={(next) => onStatusChange?.(next)}
              options={STATUS_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey, option.label) }))}
            />
          </div>
        )}
      </div>
      {notice}
    </div>
  )
}
