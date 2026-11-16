import React, { useEffect, useState } from 'react'

import { useLanguage } from '../../../../../index'
import {
  AsyncSwitch,
  Avatar,
  Button,
  DataTable,
  EmptyState,
  RecordCardList,
  Skeleton,
  Status
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Search, TriangleAlert, Truck } from '../../Shared/Icon'
import { groupOf, providerName, providerStatus, statusFamily, statusLabel, storesCount } from './providerData'
import './providers-table.css'

// redesign DS-B2 (decision 6; M-DS1, M-DS5, M-DS26): the delivery services list as a Product DataTable (and RecordCards under
// 768px). It draws what the page gives and fetches nothing: the state of each row is read from the configs dictionary the app
// already loaded (0 requests) and the stores from the one `drivergroups` request the controller makes. «Connect to» is gone
// (it never drew anything: the list does not bring the stores) and the id sits under the name, as a figure.
//
// Props (the contract the page, B4, consumes):
//   companies         the page's companies, as GET /driver_companies returns them (see providerData.js)
//   groupsInfo        { loading, error, groups: { [groupId]: { id, business, enabled } } } (K/DeliveryServices, B1)
//   configs           the configs dictionary of useConfig() (`configState.configs`), for the credentials of each plugin
//   configsLoading    the dictionary is still loading: the Status of an installed provider with a group (the only one that needs
//                     the credentials) is a skeleton instead of a word that would be wrong for a moment. Not installed and
//                     group missing do not need configs and keep their word
//   actionDisabled    the user may not change providers: the switches and Install are really disabled
//   activeId          the provider open in the panel (a number or the string of the URL): its row is aria-current
//   onOpen(company)   a click or Enter on a row, a click on a card. Always: the page decides what a provider without plugin
//                     or group does (the warnings of main)
//   onToggle(company, next) → Promise<{ ok, error }>   the save of the switch (B1: handleUpdateDeliveryService(id, { enabled })).
//                     It is handed the company of THE ROW (M-DS1: main wrote the id of the open panel). The switch is
//                     P/AsyncSwitch: controlled by `company.enabled`, busy while this runs, and a failure (`{ ok: false, error }`
//                     or a throw) leaves it where it was and says so below it (M-DS5)
//   confirmPause(company) → Promise<boolean>   (optional, redesign D-5) the page's question before PAUSING: the switch asks it
//                     (AsyncSwitch's `confirmChange`) and saves only on a true. Resuming never asks. Without it a press saves at once
//   onInstall(company) → Promise<{ ok }>   Install, for a provider with no plugin
//   installingId      the company being installed: its Install is busy, the others are disabled (main )
//   loading           true while the page loads: skeleton rows (cards under 768px)
//   error             the controller's error (a string, `{ message }` or a list): non-empty replaces the list, with «Retry»
//   onRetry()         «Retry» of the error state (reloadDeliveryServices)
//   searchValue       the text in the search box; non-blank turns the empty state into «No providers match» + «Clear search»
//   onClearSearch()   «Clear search»
//   pageSize          how many skeleton rows to draw while loading (10 by default)

const DEFAULT_PAGE_SIZE = 10

// redesign DS-B2 (decision 6): width priorities. Stores steps aside when the table is narrower than all the columns together
// (the panel open). What steps aside is not lost: the Provider cell's second line takes it («10 stores»). Provider is locked;
// Status, Enabled and Install stay (the switch and the button are the actions). What each asks for, in px, padding included:
// the five add up to 688, so all fit the ~728px of a 1024 window with no panel.
const COLUMN_WIDTH = { provider: 224, status: 176, stores: 88, enabled: 104, actions: 96 }

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpen`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// «1 store» / «3 stores»: the keys the stores list already has
const storesText = (count, t) => (count === 1
  ? t('STORES_COUNT_ONE', '1 store')
  : t('STORES_COUNT_OTHER', '_count_ stores').replace('_count_', count))

export const ProvidersTable = ({
  companies = [],
  groupsInfo,
  configs,
  configsLoading = false,
  actionDisabled = false,
  activeId,
  onOpen,
  onToggle,
  confirmPause,
  onInstall,
  installingId = null,
  loading = false,
  error = null,
  onRetry,
  searchValue = '',
  onClearSearch,
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
  const isActive = (company) => activeId != null && activeId !== '' && String(activeId) === String(company.id)
  const activeRowId = companies.find(isActive)?.id
  const searching = String(searchValue ?? '').trim() !== ''

  // ---- the cells (the table and the cards draw the same ones) ----
  const statusOf = (company) => providerStatus(company, { configs })

  // the status of a row that is installed AND has a group is read from the credentials; until they are here it is not known
  const awaitsConfigs = (company) => configsLoading && Boolean(company.plugin_id) && Boolean(groupOf(company))

  const statusCell = (company) => {
    if (awaitsConfigs(company)) return <span className='odc-ds-status-wait'><Skeleton size='100%' /></span>
    const status = statusOf(company)
    return <Status family={statusFamily(status)} label={statusLabel(status, t)} />
  }

  // redesign DS-B2 (M-DS1, M-DS5): it waits for the API and, if it fails, does not move and says why. Only installed providers get
  // one (without a plugin the table draws «—», the card draws Install).
  // redesign D-5 (owner, 2026-10-19): pausing asks first (`confirmPause`, the page's dialog); resuming is still one click.
  // `confirmChange` keeps the switch un-flipped while the question is open.
  const enabledSwitch = (company) => (
    <AsyncSwitch
      checked={!!company.enabled}
      disabled={!company.plugin_id || actionDisabled}
      label={t('DELIVERY_SERVICES_ENABLE_NAME', 'Enable _name_').replace('_name_', providerName(company))}
      failureText={t('DELIVERY_SERVICES_TOGGLE_ERROR', "The provider didn't change. Try again.")}
      confirmChange={confirmPause ? next => next || confirmPause(company) : undefined}
      onToggle={next => onToggle?.(company, next)}
    />
  )

  // redesign DS-B2 (decision 4): busy while this company installs; it never opens the row
  const installButton = (company) => (
    <Button
      busy={installingId != null && String(installingId) === String(company.id)}
      // main: one install at a time; the other Install buttons wait
      disabled={actionDisabled || (installingId != null && String(installingId) !== String(company.id))}
      // redesign DS-B2 (M-DS26): many rows, one word. The name carries the provider; the visible text stays «Install»
      aria-label={t('DELIVERY_SERVICES_INSTALL_NAME', 'Install _name_').replace('_name_', providerName(company))}
      onClick={(event) => {
        event.stopPropagation()
        onInstall?.(company)
      }}
    >
      {t('INSTALL', 'Install')}
    </Button>
  )

  const dash = <span>—</span>

  // (T10): «—» for a value that does not exist, with its words for screen readers
  const noData = (
    <span>
      <span aria-hidden='true'>—</span>
      <span className='odc-sr-only'>{t('NO_DATA', 'No data')}</span>
    </span>
  )

  // The number of stores of the company's group: a figure; a skeleton while they load; «—» with no group, when the answer
  // does not carry the group, or when it failed (the reason in its title and for screen readers, not a banner per cell)
  const storesCell = (company) => {
    if (!groupOf(company)) return dash
    if (groupsInfo?.loading) return <Skeleton size='40%' align='end' />
    if (hasError(groupsInfo?.error)) {
      const reason = t('DELIVERY_SERVICES_STORES_ERROR', "We couldn't load the stores.")
      return (
        <span title={reason}>
          <span aria-hidden='true'>—</span>
          <span className='odc-sr-only'>{reason}</span>
        </span>
      )
    }
    const count = storesCount(company, groupsInfo)
    return count === null ? dash : <span className='odc-figure'>{count}</span>
  }

  // «#id · group #n» (just «#id» with no group), then what the Stores column left when it is away
  const providerCell = (company) => {
    const name = providerName(company)
    const group = groupOf(company)
    const count = storesCount(company, groupsInfo)
    const parts = [
      <bdi key='id' dir='ltr' className='odc-figure'>{`#${company.id}`}</bdi>,
      group && <bdi key='group' dir='ltr' className='odc-figure'>{t('DELIVERY_SERVICES_GROUP_NUMBER', 'group #_number_').replace('_number_', group.id)}</bdi>,
      widthHiddenIds.includes('stores') && count !== null && <span key='stores'>{storesText(count, t)}</span>
    ].filter(Boolean)
    return (
      <span className='odc-ds-provider'>
        <Avatar kind='business' name={company.name} src={company.logo || undefined} />
        <span className='odc-ds-who'>
          <strong className='odc-ds-name' dir='auto' title={name}>{name}</strong>
          <span className='odc-ds-sub'>
            {parts.map((part, index) => (
              <React.Fragment key={part.key}>
                {index > 0 && ' · '}
                {part}
              </React.Fragment>
            ))}
          </span>
        </span>
      </span>
    )
  }

  // ---- the states that are not rows ----
  const loadingLabel = t('DELIVERY_SERVICES_LOADING', 'Loading delivery services')
  const listLabel = t('CONNECT_DELIVERY_SERVICES', 'Delivery services')

  const emptyState = () => {
    if (searching) {
      return (
        <EmptyState
          icon={Search}
          title={t('DELIVERY_SERVICES_NO_MATCH', 'No providers match')}
          action={<Button onClick={() => onClearSearch?.()}>{t('CLEAR_SEARCH', 'Clear search')}</Button>}
        />
      )
    }
    return <EmptyState icon={Truck} title={t('DELIVERY_SERVICES_EMPTY', 'No delivery services yet')} />
  }

  // The anchor of the tour sits on the container of the list, whatever the list is drawing
  const anchored = (content) => <div className='odc-ds-list' data-tour='tour_delivery_completed'>{content}</div>

  // A failure takes the place of the list, with the way to try again
  if (!loading && hasError(error)) {
    return anchored(
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('DELIVERY_SERVICES_LOAD_ERROR', "We couldn't load the delivery services.")}
        action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  }

  // ---- phone: the same data as cards (nothing sideways, nothing out of reach) ----
  if (isPhone) {
    const toCard = (company) => {
      const name = providerName(company)
      const count = storesCount(company, groupsInfo)
      return {
        id: company.id,
        href: hrefFor(company.id),
        label: name,
        title: <span className='odc-ds-card-name' dir='auto' title={name}>{name}</span>,
        // «#id · status · N stores»: the status is in the line, as the spec has it, so the card says nothing twice
        from: (
          <span className='odc-ds-card-meta'>
            {[
              <bdi key='id' dir='ltr' className='odc-figure'>{`#${company.id}`}</bdi>,
              <React.Fragment key='status'>{statusCell(company)}</React.Fragment>,
              count !== null && <span key='stores'>{storesText(count, t)}</span>
            ].filter(Boolean).map((part, index) => (
              <React.Fragment key={part.key}>
                {index > 0 && ' · '}
                {part}
              </React.Fragment>
            ))}
          </span>
        ),
        active: isActive(company),
        // the switch of an installed provider, Install for one that is not (a switch with nothing behind it would be a dead control)
        actions: (
          <div className='odc-ds-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
            {company.plugin_id ? enabledSwitch(company) : installButton(company)}
          </div>
        ),
        onOpen: () => onOpen?.(company)
      }
    }
    return anchored(
      <div className='odc-ds-cards'>
        <RecordCardList
          label={listLabel}
          items={loading ? [] : companies.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={skeletonCount}
          empty={emptyState()}
        />
      </div>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens ----
  const DEFINITIONS = {
    provider: { header: t('DELIVERY_SERVICES_PROVIDER', 'Provider'), rowHeader: true, wrap: true, locked: true, skeleton: { lines: 2, lead: 'business' }, cell: providerCell },
    status: { header: t('STATUS', 'Status'), skeleton: { lines: 1, lead: 'dot' }, cell: statusCell },
    stores: { header: t('STORES', 'Stores'), align: 'end', skeleton: { lines: 1 }, cell: storesCell },
    // (T10): a provider with no plugin has nothing to enable, so no `checked disabled` switch: «—» with its text, and Install in Actions (as the phone card)
    enabled: { header: t('ENABLED', 'Enabled'), skeleton: { lines: 1 }, cell: company => (company.plugin_id ? enabledSwitch(company) : noData) },
    // no visible header: the column is the button, named «Actions» for screen readers
    actions: { header: '', srHeader: t('ACTIONS', 'Actions'), skeleton: { lines: 1 }, cell: company => (company.plugin_id ? null : installButton(company)) }
  }
  const shown = ['provider', 'status', 'stores', 'enabled', 'actions']
  // Stores steps aside below the width of the table with everything in it
  const storesHideBelow = shown.reduce((sum, id) => sum + COLUMN_WIDTH[id], 0)
  const columns = shown.map(id => ({ id, ...DEFINITIONS[id], hideBelow: id === 'stores' ? storesHideBelow : undefined }))

  return anchored(
    <DataTable
      label={listLabel}
      columns={columns}
      rows={companies}
      getRowId={company => company.id}
      onWidthHiddenChange={setWidthHiddenIds}
      activeRowId={activeRowId}
      onOpenRow={company => onOpen?.(company)}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={skeletonCount}
      empty={emptyState()}
    />
  )
}
