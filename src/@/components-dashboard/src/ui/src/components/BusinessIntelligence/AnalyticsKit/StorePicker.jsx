import React, { useRef, useState } from 'react'

import { DashboardBusinessList, useConfig, useEvent, useLanguage, useSession, useUtils } from '../../../../../index'
import { canRegisterStores } from '../../../../../utils/storeAdd'
import { PartyPicker } from './PartyPicker'

// redesign reviews: promoted from BusinessPaymentReports/ to the kit, unchanged (playbook §3).
// redesign reviews FA2 (D6, D7, auditor 1, 2, 5): opt-in props `includeInactive`, `allLabel`, `defaultOpen`, `label`, `placeholder`.
// redesign business-payments FC1 (D2, D10): the store of the page, a filter pill (`PartyPicker` of the BI kit, promoted from
// /intelligence/invoice) with the logo and the city of each store. The list is the controller of `main`, `DashboardBusinessList`,
// with the props `BusinessSelectHeader` gives it (`Stores/BusinessSelectHeader/index.js:205-219`) and `propsToFetch` as `BPR:757`
// (it needs `external_id` for the legacy reports), mounted by `ListSource` ONLY while the popover is open: nothing is asked for
// (the stores, `/countries`) until someone opens it, as in `main`. «No results found» offers «Add new store» (D-18, J2), a
// working link to /stores/add with the rule of the store list; in `main` that button threw a TypeError on this page (D10, P5).
// `plugin` is not read: `main` does not gate the picker on the plugin check.

const PAGE_SIZE = 6
const PROPS_TO_FETCH = ['name', 'slug', 'logo', 'city', 'external_id']

const cityName = (city) => (typeof city === 'string' ? city : city?.name)

// What `DashboardBusinessList` gives its `UIComponent`, in the shape of `PartyPicker`'s list, handed to the child function. The
// whole business objects are remembered (`known`): the picker returns only `{ id, name }` and the controller of the page needs the
// rest (`external_id`).
const BusinessListBridge = ({ businessList, pagination, searchValue, onSearch, getPageBusinesses, renderList, known }) => {
  const [{ optimizeImage } = {}] = useUtils() || []
  const businesses = Array.isArray(businessList?.businesses) ? businessList.businesses : []
  businesses.forEach(business => known.current.set(business.id, business))

  const pageSize = pagination?.pageSize || PAGE_SIZE
  const page = pagination?.currentPage || 1
  return renderList({
    items: businesses.map(business => ({
      id: business.id,
      name: business.name,
      photo: business.logo && optimizeImage ? optimizeImage(business.logo, 'h_50,c_limit') : business.logo || undefined,
      secondary: cityName(business.city)
    })),
    loading: Boolean(businessList?.loading),
    error: Boolean(businessList?.error),
    page,
    totalPages: pagination?.totalPages || 1,
    search: searchValue ?? '',
    setSearch: onSearch,
    goToPage: (next) => getPageBusinesses(pageSize, next),
    retry: () => getPageBusinesses(pageSize, page)
  })
}

// One component per picker, made once, so the popover does not remount (and ask again) on each render of the page. `options` is a
// ref the picker keeps current (redesign reviews FA2: `includeInactive` is read each time the source renders, not when it is made)
const makeListSource = (known, options) => {
  const BusinessListSource = ({ children }) => (
    <DashboardBusinessList
      asDashboard
      {...(options.current.includeInactive ? { noActiveStatusCondition: true } : {})}
      loadMorePageSize={PAGE_SIZE}
      paginationSettings={{ pageSize: PAGE_SIZE }}
      isSearchByBusinessName
      isSearchByBusinessEmail
      isSearchByBusinessPhone
      propsToFetch={PROPS_TO_FETCH}
      UIComponent={BusinessListBridge}
      renderList={children}
      known={known}
    />
  )
  return BusinessListSource
}

/**
 * redesign reviews FA2 (D6, D7, auditor 1, 2, 5): optional props; without them the picker is the one of /intelligence/business-payments.
 * @param {boolean} [includeInactive] The list includes the disabled businesses (`noActiveStatusCondition` of `DashboardBusinessList`).
 * @param {string}  [allLabel]        A first option «All» that chooses no store (`business.select(null)`); it is also what the pill says
 *                                    while no store is chosen (after «Loading», while the store of the URL is being read).
 * @param {boolean} [defaultOpen]     The pill is open when it mounts.
 * @param {string}  [label]           Replaces «Business».
 * @param {string}  [placeholder]     Replaces «Select business» (an `allLabel` takes the pill before it).
 */
export const StorePicker = ({ business, includeInactive = false, allLabel, defaultOpen = false, label, placeholder: placeholderProp }) => {
  const [, t] = useLanguage()
  const known = useRef(new Map())
  const options = useRef({ includeInactive })
  options.current = { includeInactive }
  const [ListSource] = useState(() => makeListSource(known, options))
  // J2 (D-18, ): an empty list offers the one «Add new store» of the dashboard (/stores/add), with the rule of the store
  // list; in main this picker's button threw a TypeError (D10, P5)
  const [{ user } = {}] = useSession() || []
  const [{ configs } = {}] = useConfig() || []
  const [events] = useEvent() || []
  const emptyAction = canRegisterStores(user, configs)
    ? { label: t('ADD_NEW_STORE', 'Add new store'), onSelect: () => events?.emit('go_to_page', { page: 'business_add' }) }
    : undefined

  const select = (choice) => {
    // «All» arrives as null: no store, nothing to look up
    business.select?.(choice == null ? null : (known.current.get(choice.id) ?? choice))
  }
  const party = { kind: 'business', selected: business.selected, select }
  // the store of the URL is being read: the pill does not offer to choose one meanwhile
  const placeholder = business.restoring && !business.selected
    ? t('LOADING', 'Loading')
    : (allLabel ?? placeholderProp ?? t('SELECT_BUSINESS', 'Select business'))

  return (
    <PartyPicker
      party={party}
      variant='pill'
      avatars='business'
      secondary
      pageSize={PAGE_SIZE}
      label={label ?? t('BUSINESS', 'Business')}
      placeholder={placeholder}
      ListSource={ListSource}
      allOption={allLabel != null ? { label: allLabel } : undefined}
      defaultOpen={defaultOpen}
      emptyAction={emptyAction}
    />
  )
}
