import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { useLanguage } from '../../../../../index'
import { Button, IconButton, PageHeader, SegmentedControl, Tabs } from '../../Shared/Product'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { Menu as MenuIcon, Plus, RotateCw, Upload } from '../../Shared/Icon'
import { addQueryToUrl, learnOptionsValues } from '../../../utils'
import { ImportersButton } from '../ImportersButton'
import './stores-list.css'

// redesign SL-F1 (A1): the head of /stores/list. Title and count, Learn, the actions that were in BusinessesListingHeader (all of
// them in view, none in a menu), and under them the Active / Inactive tabs and the List / Card switch.
//
// It draws what the controller gives it and holds no list state. The page (BusinessesListingUI, wired in A3) passes:
//
// @param {object}   props
// @param {Function} props.handleRefreshBusinesses       Refresh button: `loadBusinesses`.
// @param {Function} props.handleGotToAdd                Add new store: `handleGotToAdd()`, no arguments.
// @param {boolean}  props.loading                       `businessList.loading`. Refresh, Importers and Add are only there when `!loading && !noBusinesses` (Importers also without stores, ).
// @param {boolean}  props.noBusinesses                  The project has no stores: only Importers, no tabs, no view switch.
// @param {boolean}  [props.loadFailed]                  The load of the list failed (its empty list is not «no stores»): tabs and view switch stay next to the error. BusinessesListing passes `noBusinesses` false then, so the actions stay too.
// @param {boolean}  props.allowBusinessRegister         Add new store is only there when true.
// @param {{total?: number}} [props.pagination]          The pagination of the tab on screen; `total` is the count beside the title.
// @param {boolean}  props.selectedBusinessActiveState   true = Active tab, false = Inactive tab.
// @param {Function} props.handleChangeBusinessActiveState  `(active: boolean) => void`; also writes `?active=` like BusinessActiveStateFilter.
// @param {boolean}  [props.isUseQuery]                  Read `?active=` on mount and write `active=true` when it is missing.
// @param {'list'|'card'} props.viewMethod               The view on screen.
// @param {Function} props.handleViewMethod              `(method: 'list' | 'card') => void`.
// @param {Function} [props.onOpenMenu]                  Only with the sidebar collapsed: shows «Open menu» before the title.
// @param {boolean}  [props.isPhone]                     redesign stores 3.A, P-1: Importers and Refresh go to the «More actions» menu (Learn and Add stay in view). Decision 35 (batch AE): no List / Card switch, the table draws cards in both views.

// The 14 help articles of the page, as BusinessesListingHeader listed them (level-zero sessions only, LearnDropDown decides that)
const LEARN_KEYS = [
  'store_general_view',
  'store_details',
  'store_schedule',
  'store_menu',
  'store_delivery_pickup',
  'store_notifications',
  'store_payment_methods',
  'store_tax_fees',
  'store_promotions',
  'store_channels',
  'store_qr_codes',
  'store_sales_channels',
  'store_layout',
  'store_webhooks'
]

/**
 * Active / Inactive. The behaviour of BusinessActiveStateFilter: a click changes the state and writes `?active=`; on mount, with
 * `isUseQuery`, the value in the URL wins and a URL without `active` gets `active=true`. It is only mounted with stores, as before.
 */
const ActiveStateTabs = ({ selected, onChange, isUseQuery }) => {
  const [, t] = useLanguage()
  const query = new URLSearchParams(useLocation().search)
  const defaultActive = query.get('active')

  useEffect(() => {
    if (!isUseQuery) return
    if (defaultActive) {
      onChange(defaultActive === 'true')
      return
    }
    addQueryToUrl({ active: 'true' })
  }, [])

  const handleChange = (value) => {
    const active = value === 'true'
    onChange(active)
    addQueryToUrl({ active })
  }

  return (
    <Tabs
      className='odc-sl-tabs'
      label={t('STATUS', 'Status')}
      value={selected ? 'true' : 'false'}
      onValueChange={handleChange}
      items={[
        { value: 'true', label: t('ACTIVE', 'Active') },
        { value: 'false', label: t('INACTIVE', 'Inactive') }
      ]}
    />
  )
}

export const StoresHeader = ({
  handleRefreshBusinesses,
  handleGotToAdd,
  loading,
  noBusinesses,
  loadFailed,
  allowBusinessRegister,
  pagination,
  selectedBusinessActiveState,
  handleChangeBusinessActiveState,
  isUseQuery,
  viewMethod,
  handleViewMethod,
  onOpenMenu,
  isPhone
}) => {
  const [, t] = useLanguage()
  const showActions = !loading && !noBusinesses

  const total = pagination?.total
  const hasTotal = Number.isFinite(total)
  const countLabel = total === 1
    ? t('STORES_COUNT_ONE', '1 store')
    : t('STORES_COUNT_OTHER', '_count_ stores').replace('_count_', total)

  const learn = <LearnDropDown learnOptions={learnOptionsValues(LEARN_KEYS, t)} />

  // Importers, Sync and Refresh are in view, with the conditions they had: `!loading && !noBusinesses`. Not a menu.
  //
  // redesign stores 3.A, P-1: on the phone the three go to the «More actions» menu of PageHeader (Learn and
  // «Add new store» stay in view). The Importers panel is owned by this component (`importersOpen`).
  // Review F4: the menu stays while the list loads (without stores it keeps only Importers), so choosing Refresh in it does not take the «⋯»
  // away from under the focus.
  //
  // redesign stores 3.C, G1-20: at every width ImportersButton is mounted once, without its trigger, OUTSIDE the
  // actions, so the panel and an import in progress survive a reload of the list. The button in the actions (desktop) and the menu
  // item (phone) only open it. With that, a finished import refreshes the list (`onImportSuccess`), which used to be left out only
  // because the reload closed the panel. When the panel closes, the focus goes back to what opened it: the button (it may have
  // remounted with the reload) or the «⋯» (the menu item is gone).
  // the «⋯» is found by its name, as CatalogHeader does: the Learn menu in the same row also announces
  // `aria-haspopup="menu"` and comes first.
  const [importersOpen, setImportersOpen] = useState(false)
  const headRef = useRef(null)
  const importersTriggerRef = useRef(null)
  const moreLabel = t('MORE_ACTIONS', 'More actions')
  const returnFocusRef = useMemo(() => ({
    get current () {
      if (isPhone) {
        const triggers = headRef.current?.querySelectorAll('.odc-pagehead-actions [aria-haspopup="menu"]') || []
        return Array.from(triggers).find(trigger => trigger.getAttribute('aria-label') === moreLabel) || null
      }
      return importersTriggerRef.current
    }
  }), [isPhone, moreLabel])
  // bugs E: a project with no stores keeps Importers (one of the importers is the stores one, `sync_businesses`), so
  // it can import its first stores from here. Only Importers: Refresh and Add keep their `!noBusinesses` condition. main
  // removed the Sync button.
  const importersAction = { key: 'importers', label: t('IMPORTERS', 'Importers'), icon: Upload, onSelect: () => setImportersOpen(true) }
  const menuActions = !noBusinesses
    ? [
        importersAction,
        { key: 'refresh', label: t('REFRESH', 'Refresh'), icon: RotateCw, onSelect: () => handleRefreshBusinesses() }
      ]
    : [importersAction]
  const importersTrigger = <Button ref={importersTriggerRef} icon={Upload} onClick={() => setImportersOpen(true)}>{t('IMPORTERS', 'Importers')}</Button>
  const actions = isPhone
    ? menuActions
    : showActions
      ? (
        <>
          {importersTrigger}
          <Button icon={RotateCw} onClick={() => handleRefreshBusinesses()}>{t('REFRESH', 'Refresh')}</Button>
        </>
        )
      : !loading && noBusinesses ? importersTrigger : undefined

  const primaryAction = showActions && allowBusinessRegister
    ? <Button variant='primary' icon={Plus} onClick={() => handleGotToAdd()}>{t('ADD_NEW_STORE', 'Add new store')}</Button>
    : undefined

  return (
    <div className='odc-root odc-sl-head' ref={headRef}>
      <PageHeader
        title={t('STORES', 'Stores')}
        count={hasTotal ? total : undefined}
        countLabel={hasTotal ? countLabel : undefined}
        learn={learn}
        actions={actions}
        moreLabel={isPhone ? moreLabel : undefined}
        primaryAction={primaryAction}
        leading={onOpenMenu && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={onOpenMenu} />}
      />
      {/* redesign stores 3.A, P-1 / 3.C, G1-20: the panel host of the Importers button and of the phone's «⋯» menu;
          outside the page header, and outside the actions so it does not unmount while the list loads */}
      <ImportersButton
        hideTrigger
        open={importersOpen}
        onOpenChange={setImportersOpen}
        onImportSuccess={() => handleRefreshBusinesses()}
        returnFocusRef={returnFocusRef}
      />
      {(!noBusinesses || loadFailed) && (
        <div className='odc-sl-viewrow'>
          <ActiveStateTabs
            selected={Boolean(selectedBusinessActiveState)}
            onChange={handleChangeBusinessActiveState}
            isUseQuery={isUseQuery}
          />
          {/* owner decision 35 (batch AE): on a phone the table draws cards in both views, so the switch would do nothing */}
          {!isPhone && (
            <div className='odc-sl-viewswitch'>
              <SegmentedControl
                label={t('VIEW', 'View')}
                value={viewMethod}
                onValueChange={handleViewMethod}
                options={[
                  { value: 'list', label: t('LIST_VIEW', 'List view') },
                  { value: 'card', label: t('CARD_VIEW', 'Card view') }
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
