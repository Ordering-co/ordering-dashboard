import React, { useEffect, useState } from 'react'

import { useLanguage } from '../../../../../index'
import {
  AsyncSwitch,
  Avatar,
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  RecordCardList
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Search, TriangleAlert, Truck } from '../../Shared/Icon'
import { companyName, isIntegration, priorityLabel } from './companyData'
import './companies-table.css'

// redesign DC-B2 (decision 2; M-DC2, M-DC3, M-DC4, M-DC12, M-DC14): the driver companies list as a Product DataTable (and
// RecordCards under 768px). It draws what the controller gives (`companies`) and what the host decides (selection, the open
// company, the save of the switch); it fetches nothing and owns no dialog. The «Actions» column of main is «Enabled» (its only
// control was the switch); Timezone and Limit step aside first on a narrow table and the Company cell carries them.
//
// Props (the contract the page, B5, consumes):
//   companies         the page's companies, as GET /driver_companies returns them (see companyData.js)
//   loading           true while the page loads: skeleton rows (cards under 768px), `pageSize` of them
//   error             the controller's error (a string, `{ message }` or a list): non-empty replaces the list, with «Retry»
//   searchValue       the text in the search box; non-blank turns the empty state into «No companies match» + «Clear search»
//   selectedIds       ids selected (they may include ids from other pages; only this page's count for the header)
//   onToggleSelect(id)        a row checkbox. Without it there is no selection column (and no checkboxes on the cards)
//   onToggleAll(pageIds)      the header (or the cards' «Select all»), given this page's selectable ids: the host decides what it does
//                             (the page: checked → clear, else every company that can be selected); its checked state is this page's
//                             selectable rows. redesign
//                             (n.º 10, P-1): an integration (owner_type system) is read only here: no checkbox, out of
//                             the ids, and its Enabled switch is disabled (it is managed in Connect › Delivery services)
//   activeId          the company open in the panel (a number or the string of the URL): its row is aria-current
//   onOpen(company)   a click or Enter on a row, a click on a card
//   onToggleEnabled(company, next) → Promise<{ ok, error }>   the save of the switch (B1: handleUpdateDriversCompany(id, { enabled })).
//                     The switch is P/AsyncSwitch: it is controlled by `company.enabled`, busy while this runs, and a failure
//                     (`{ ok: false, error }` or a throw) leaves it where it was and says so below it
//   confirmDisable(company) → Promise<boolean>   redesign D-5: turning a company OFF asks this first (the host's «Disable
//                     _name_?» dialog); false writes nothing and leaves the switch on. Turning ON never asks. Without it, OFF is immediate
//   actionDisabled    the user may not change companies: the switches and «Add driver company» are really disabled
//   onAdd()           «Add driver company» of the empty state
//   onClearSearch()   «Clear search» of the empty state
//   onRetry()         «Retry» of the error state (reloadDriversCompanies)
//   pageSize          how many skeleton rows to draw while loading (10 by default)

const DEFAULT_PAGE_SIZE = 10

// redesign DC-B2 (decision 2; as GroupsTable): width priorities. A column steps aside when the table is narrower than all the
// columns that outrank it plus its own: Timezone first, then Limit. Company is locked; Priority and Enabled stay (the switch is
// the action). What each asks for, in px, padding included (the selection cell counts too): the sum with the selection column is
// 48 + 200 + 96 + 80 + 176 + 104 = 704, so all five fit the ~728px of a 1024 window; without the selection column it is 656.
// Timezone thresholds at 704 (its own 176 gone, the rest needs 528: that is Limit's threshold). What steps aside is not lost:
// the Company cell's second line takes it.
const WIDTH_PRIORITY = ['timezone', 'limit']
const COLUMN_WIDTH = { selection: 48, company: 200, priority: 96, limit: 80, timezone: 176, enabled: 104 }

// The card is a link to `?id=`, as the order and group cards are: a middle click works; a plain click goes through `onOpen`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// A company with no limit has null (or nothing); a limit of 0 is a number and shows
const limitOf = (company) => (company?.limit === null || company?.limit === undefined ? '' : String(company.limit).trim())
const zoneOf = (company) => (company?.timezone === null || company?.timezone === undefined ? '' : String(company.timezone).trim())

// «a · b · c»: the separators go between the parts, never after the last one
const joined = (parts) => parts.map((part, index) => (
  <React.Fragment key={part.key}>
    {index > 0 && ' · '}
    {part}
  </React.Fragment>
))

export const CompaniesTable = ({
  companies = [],
  loading = false,
  error = null,
  searchValue = '',
  selectedIds = [],
  onToggleSelect,
  onToggleAll,
  activeId,
  onOpen,
  onToggleEnabled,
  confirmDisable,
  actionDisabled = false,
  onAdd,
  onClearSearch,
  onRetry,
  pageSize
}) => {
  const [, t] = useLanguage()
  const isPhone = useIsPhone()
  // the columns DataTable hid for want of width (it reports them once per change)
  const [widthHiddenIds, setWidthHiddenIds] = useState([])
  useEffect(() => {
    if (isPhone) setWidthHiddenIds([]) // the cards have no columns: what a table reported earlier is stale
  }, [isPhone])

  const skeletonCount = Number(pageSize) || DEFAULT_PAGE_SIZE
  const hasSelection = typeof onToggleSelect === 'function'
  // redesign (n.º 10, P-1): an integration cannot be selected (so neither deleted in bulk); «Select all» skips it
  const selectableIds = companies.filter(company => !isIntegration(company)).map(company => company.id)
  const isActive = (company) => activeId != null && activeId !== '' && String(activeId) === String(company.id)
  const activeRowId = companies.find(isActive)?.id
  const searching = String(searchValue ?? '').trim() !== ''

  const selectLabel = (company) => t('DRIVERS_COMPANIES_SELECT_NAME', 'Select _name_').replace('_name_', companyName(company, t))

  // ---- the parts the table and the cards draw alike ----
  const idPart = (company) => <bdi key='id' dir='ltr' className='odc-figure'>{`#${company.id}`}</bdi>
  const integrationPart = (company) => isIntegration(company) && (
    <span key='integration' className='odc-dc-tag'>{t('DRIVERS_COMPANIES_INTEGRATION', 'Integration')}</span>
  )
  // «Limit 25»: a bare number beside a priority and a timezone would read as nothing
  const limitPart = (company) => limitOf(company) !== '' && (
    <span key='limit'>{t('LIMIT', 'Limit')} <span className='odc-figure'>{limitOf(company)}</span></span>
  )
  const zonePart = (company) => zoneOf(company) !== '' && (
    <bdi key='timezone' dir='ltr'>{zoneOf(company)}</bdi>
  )

  // redesign DC-B2 (M-DC2): turning ON is one click; it waits for the API and, if it fails, does not move and says why.
  // redesign D-5 (owner, 2026-10-19, C8): turning OFF asks first (`confirmDisable`, the host's dialog); «no» writes nothing
  // redesign (n.º 10, P-1): an integration is read only here, so its switch is off for use
  const enabledSwitch = (company) => (
    <AsyncSwitch
      checked={!!company.enabled}
      disabled={actionDisabled || isIntegration(company)}
      label={t('DRIVERS_COMPANIES_ENABLE_NAME', 'Enable _name_').replace('_name_', companyName(company, t))}
      failureText={t('DRIVERS_COMPANIES_TOGGLE_ERROR', "The company didn't change. Try again.")}
      confirmChange={confirmDisable ? next => next || confirmDisable(company) : undefined}
      onToggle={next => onToggleEnabled?.(company, next)}
    />
  )

  // the logo and the name, then «#id · Integration», then what its columns left when they are away (Limit, Timezone)
  const companyCell = (company) => {
    const name = companyName(company, t)
    const parts = [
      idPart(company),
      integrationPart(company),
      widthHiddenIds.includes('limit') && limitPart(company),
      widthHiddenIds.includes('timezone') && zonePart(company)
    ].filter(Boolean)
    return (
      <span className='odc-dc-company'>
        <Avatar kind='business' src={company.logo} name={company.name} />
        <span className='odc-dc-who'>
          <strong className='odc-dc-name' dir='auto' title={name}>{name}</strong>
          <span className='odc-dc-sub'>{joined(parts)}</span>
        </span>
      </span>
    )
  }

  // ---- the states that are not rows ----
  const loadingLabel = t('DRIVERS_COMPANIES_LOADING', 'Loading companies')
  const listLabel = t('DELIVERY_COMPANIES', 'Delivery companies')

  const emptyState = () => {
    if (searching) {
      return (
        <EmptyState
          icon={Search}
          title={t('DRIVERS_COMPANIES_NO_MATCH', 'No companies match')}
          action={<Button onClick={() => onClearSearch?.()}>{t('CLEAR_SEARCH', 'Clear search')}</Button>}
        />
      )
    }
    return (
      <EmptyState
        icon={Truck}
        title={t('DRIVERS_COMPANIES_EMPTY', 'No driver companies yet')}
        action={<Button disabled={actionDisabled} onClick={() => onAdd?.()}>{t('ADD_DRIVER_COMPANY', 'Add driver company')}</Button>}
      />
    )
  }

  const anchored = (content) => <div className='odc-dc-list'>{content}</div>

  // A failure takes the place of the list (M-DC3), with the way to try again
  if (!loading && hasError(error)) {
    return anchored(
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('DRIVERS_COMPANIES_LOAD_ERROR', "We couldn't load the companies.")}
        action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  }

  // ---- phone: the same data as cards (nothing sideways, nothing out of reach) ----
  if (isPhone) {
    const toCard = (company) => {
      const name = companyName(company, t)
      const mark = integrationPart(company)
      return {
        id: company.id,
        href: hrefFor(company.id),
        label: name,
        // the full name in its title, as the row has it; the Integration mark rides beside it
        title: (
          <span className='odc-dc-card-title'>
            <span className='odc-dc-card-name' dir='auto' title={name}>{name}</span>
            {mark}
          </span>
        ),
        from: (
          <span className='odc-dc-card-meta'>
            {joined([
              idPart(company),
              <span key='priority'>{priorityLabel(company.priority, t)}</span>,
              limitPart(company),
              zonePart(company)
            ].filter(Boolean))}
          </span>
        ),
        active: isActive(company),
        actions: (
          <div className='odc-dc-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
            {hasSelection && !isIntegration(company) && (
              <Checkbox
                label={selectLabel(company)}
                checked={selectedIds.includes(company.id)}
                onCheckedChange={() => onToggleSelect(company.id)}
              />
            )}
            {enabledSwitch(company)}
          </div>
        ),
        onOpen: () => onOpen?.(company)
      }
    }
    // the same contract as DataTable's header, for this page's ids (the cards have no header)
    const selectedOnPage = selectableIds.filter(id => selectedIds.includes(id)).length
    const selectAll = hasSelection && selectableIds.length > 0
      ? {
          label: t('SELECT_ALL', 'Select all'),
          checked: selectedOnPage === 0 ? false : (selectedOnPage === selectableIds.length ? true : 'mixed'),
          onToggle: () => onToggleAll?.(selectableIds)
        }
      : undefined
    return anchored(
      <div className='odc-dc-cards'>
        <RecordCardList
          label={listLabel}
          items={loading ? [] : companies.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={skeletonCount}
          empty={emptyState()}
          selectAll={selectAll}
        />
      </div>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens (M-DC14) ----
  const DEFINITIONS = {
    company: { header: t('COMPANY', 'Company'), rowHeader: true, wrap: true, locked: true, skeleton: { lines: 2, lead: 'business' }, cell: companyCell },
    priority: { header: t('PRIORITY', 'Priority'), skeleton: { lines: 1 }, cell: company => priorityLabel(company.priority, t) },
    limit: {
      header: t('LIMIT', 'Limit'),
      align: 'end',
      skeleton: { lines: 1 },
      cell: company => (limitOf(company) !== '' ? <span className='odc-figure'>{limitOf(company)}</span> : null)
    },
    timezone: {
      header: t('TIMEZONE', 'Timezone'),
      skeleton: { lines: 1 },
      cell: company => (zoneOf(company) !== '' ? <span className='odc-dc-zone' dir='ltr'>{zoneOf(company)}</span> : null)
    },
    enabled: { header: t('ENABLED', 'Enabled'), skeleton: { lines: 1 }, cell: enabledSwitch }
  }
  const shown = ['company', 'priority', 'limit', 'timezone', 'enabled']
  // The threshold of a priority column is the width of the table with it and everything that outranks it
  const hideBelow = {}
  let needed = shown.reduce((sum, id) => sum + COLUMN_WIDTH[id], hasSelection ? COLUMN_WIDTH.selection : 0)
  WIDTH_PRIORITY.filter(id => shown.includes(id)).forEach(id => {
    hideBelow[id] = needed
    needed -= COLUMN_WIDTH[id]
  })
  const columns = shown.map(id => ({ id, ...DEFINITIONS[id], hideBelow: hideBelow[id] }))

  return anchored(
    <DataTable
      label={listLabel}
      columns={columns}
      rows={companies}
      getRowId={company => company.id}
      onWidthHiddenChange={setWidthHiddenIds}
      activeRowId={activeRowId}
      onOpenRow={company => onOpen?.(company)}
      // redesign (n.º 10): a page of integrations only has nothing to select, so no «Select all» either (as the cards)
      selection={hasSelection && (loading || selectableIds.length > 0)
        ? {
            selectedIds,
            onToggle: id => onToggleSelect(id),
            isSelectable: company => !isIntegration(company), // redesign (n.º 10, P-1): no checkbox for an integration
            // the header toggles this page: the host adds these ids, or takes them off when they are all in
            onToggleAll: () => onToggleAll?.(selectableIds),
            allLabel: t('SELECT_ALL', 'Select all'),
            rowLabel: selectLabel
          }
        : undefined}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={skeletonCount}
      empty={emptyState()}
    />
  )
}
