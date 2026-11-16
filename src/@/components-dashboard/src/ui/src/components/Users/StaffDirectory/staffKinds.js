// redesign BO-B3 (decisions 1 and 10; auditor #3, #7d): the staff lists of main (business owners, call center agents, admins)
// shared Users/UsersListing and differed only in the level, the words and the Learn entries. Users/StaffDirectory is that one
// composition, driven by a kind. The three are wired: `business_owner`, `callcenter_agent` and `admin`
//, without copying the directory. A kind with `storesKey: null` (admins) has no stores: no column, no line on the card,
// they are not asked for, and adding one opens its Profile. Pure: no React, no network.

// The sections of the record, by the level OF THE RECORD (not of the page), as U/UserDetailsMenu decides them: saving the profile
// with another level changes them, as it does today. Ids are main's `?tab=` values, so main's links keep working as they are.
const OWNER_SECTIONS = ['profile', 'saved_places', 'businesses', 'orders']
const USER_SECTIONS = ['profile', 'saved_places', 'orders', 'businesses', 'push_tokens', 'school_students']
// redesign (B1b): main's professional record (U/UserDetailsMenu) has three tabs, in this order
const PROFESSIONAL_SECTIONS = ['profile', 'schedule', 'business_services']

export const STAFF_SECTION_IDS = ['profile', 'saved_places', 'businesses', 'orders', 'push_tokens', 'school_students', 'schedule', 'business_services']

/**
 * The sections a record shows. `level` is the record's; `isSchoolsOn` comes from
 * `isDashboardFeatureEnabled({ featureKey: 'schools', configs })`.
 *  - level 2 (business owner): Profile, Saved places, Businesses, Orders;
 *  - level 8 (professional): Profile, Schedule, Business & Services;
 *  - any other level: Profile, Saved places, Orders, Businesses (only level 9, call center agent), Push tokens and
 *    School students (only with the Schools module).
 */
export const staffSectionIds = ({ level, isSchoolsOn } = {}) => {
  if (level === 2) return [...OWNER_SECTIONS]
  if (level === 8) return [...PROFESSIONAL_SECTIONS]
  return USER_SECTIONS.filter((id) => {
    if (id === 'businesses') return level === 9
    if (id === 'school_students') return Boolean(isSchoolsOn)
    return true
  })
}

/**
 * main's `?tab=` → `{ section, customFields }`. `metafields` opened the Custom fields (today a dialog from ⋯) and
 * `personalization` was a disabled entry: both land on Profile. Anything unknown is Profile, the section main opens in.
 */
export const fromStaffTab = (tab) => {
  if (tab === 'metafields') return { section: 'profile', customFields: true }
  if (STAFF_SECTION_IDS.includes(tab)) return { section: tab, customFields: false }
  return { section: 'profile', customFields: false }
}

/** The section to show when the requested one does not exist for this record (its level changed, a link from another list). */
export const sectionOrDefault = (section, ids) => (ids.includes(section) ? section : 'profile')

// The words of a kind: translation keys with their default text. `_count_` is replaced by the number.
// `storesKey` is the user's property that holds the stores (K/BusinessManagerBusinesses `typeBusinessPropToFetch`); `null` when the kind has none.
export const STAFF_KINDS = {
  business_owner: {
    level: 2,
    storesKey: 'businesses',
    // main's toggle asked ConfirmAdmin only for level 0 rows (U/UsersList:81-93); only admins set it
    confirmAdminOnToggle: false,
    learn: ['business_owners_general_view', 'business_owner_details'],
    storageKey: 'od.business-owners.panel',
    // the «Filters» sheet: main's modal less «User type» (decision 4) and Loyalty level, which is a pill
    sheetKeys: ['name', 'lastname', 'email', 'ordersCount', 'countryPhoneCode', 'cellphone'],
    text: {
      title: { key: 'BUSINESS_OWNERS', text: 'Business owners' },
      one: { key: 'BUSINESS_OWNER', text: 'Business owner' },
      countOne: { key: 'BUSINESS_OWNERS_COUNT_ONE', text: '1 business owner' },
      countOther: { key: 'BUSINESS_OWNERS_COUNT_OTHER', text: '_count_ business owners' },
      add: { key: 'BUSINESS_OWNERS_ADD', text: 'Add business owner' },
      search: { key: 'BUSINESS_OWNERS_SEARCH', text: 'Search name, email or phone' },
      filterBar: { key: 'BUSINESS_OWNERS_FILTER_BAR', text: 'Filter business owners' },
      statusTabs: { key: 'BUSINESS_OWNERS_STATUS_TABS', text: 'Business owner status' },
      loading: { key: 'BUSINESS_OWNERS_LOADING', text: 'Loading business owners' },
      empty: { key: 'BUSINESS_OWNERS_EMPTY', text: 'No business owners yet' },
      emptyInactive: { key: 'BUSINESS_OWNERS_EMPTY_INACTIVE', text: 'No inactive business owners' },
      noMatch: { key: 'BUSINESS_OWNERS_NO_MATCH', text: 'No business owners match these filters' },
      loadError: { key: 'BUSINESS_OWNERS_LOAD_ERROR', text: "We couldn't load the business owners." },
      notFound: { key: 'BUSINESS_OWNERS_NOT_FOUND', text: "This business owner doesn't exist or was deleted." },
      detailLoadError: { key: 'BUSINESS_OWNERS_DETAIL_LOAD_ERROR', text: "We couldn't load this business owner." },
      sections: { key: 'BUSINESS_OWNERS_SECTIONS', text: 'Business owner sections' },
      resizePanel: { key: 'BUSINESS_OWNERS_RESIZE_PANEL', text: 'Resize the business owner panel' },
      selectionActions: { key: 'BUSINESS_OWNERS_SELECTION_ACTIONS', text: 'Actions for selected business owners' },
      deleteOne: { key: 'BUSINESS_OWNERS_DELETE_N_ONE', text: 'Delete _count_ business owner' },
      deleteOther: { key: 'BUSINESS_OWNERS_DELETE_N_OTHER', text: 'Delete _count_ business owners' },
      deleteTitleOne: { key: 'BUSINESS_OWNERS_DELETE_N_TITLE_ONE', text: 'Delete _count_ business owner?' },
      deleteTitleOther: { key: 'BUSINESS_OWNERS_DELETE_N_TITLE_OTHER', text: 'Delete _count_ business owners?' },
      deleteSeveralError: { key: 'BUSINESS_OWNERS_DELETE_SEVERAL_ERROR', text: "We couldn't delete the selected business owners. Try again." },
      deleteSeveralErrorTitle: { key: 'BUSINESS_OWNERS_DELETE_SEVERAL_ERROR_TITLE', text: "The business owners weren't deleted" },
      deleteConfirm: { key: 'BUSINESS_OWNERS_DELETE_CONFIRM', text: 'Delete business owner' },
      deleteError: { key: 'BUSINESS_OWNERS_DELETE_ERROR', text: "We couldn't delete this business owner. Try again." },
      deleteErrorTitle: { key: 'BUSINESS_OWNERS_DELETE_ERROR_TITLE', text: "The business owner wasn't deleted" }
    },
    // redesign D-1 (owner, 2026-10-19, decision 25 C8): the question before deactivating (business owners); activating is immediate.
    // A kind without this group (the admin: ConfirmAdmin is its question) asks nothing here
    deactivateCopy: {
      title: { key: 'BUSINESS_OWNERS_DEACTIVATE_TITLE', text: 'Deactivate _name_?' },
      body: { key: 'BUSINESS_OWNERS_DEACTIVATE_BODY', text: "They can't sign in to the dashboard until you activate them again." },
      confirm: { key: 'BUSINESS_OWNERS_DEACTIVATE_CONFIRM', text: 'Deactivate business owner' }
    },
    // Users/UsersExport `copy`. main exported every owner (active and inactive) with no search, tab or filter (U/UsersListing:135-140):
    // the page passes no filters to the export, so the sentence is always `scopeAll` (decision 8; P-3 for the owner).
    exportCopy: {
      button: { key: 'BUSINESS_OWNERS_EXPORT_CSV', text: 'Export CSV' },
      title: { key: 'BUSINESS_OWNERS_EXPORT_TITLE', text: 'Export business owners to CSV?' },
      confirm: { key: 'BUSINESS_OWNERS_EXPORT_CONFIRM', text: 'Export CSV' },
      scopeAll: { key: 'BUSINESS_OWNERS_EXPORT_SCOPE_ALL', text: "The file includes all business owners, active and inactive. The search, the tab and the filters don't apply." },
      scopeFiltered: { key: 'BUSINESS_OWNERS_EXPORT_SCOPE_ALL', text: "The file includes all business owners, active and inactive. The search, the tab and the filters don't apply." },
      resultTitle: { key: 'CUSTOMERS_EXPORT_RESULT_TITLE', text: 'Export' },
      requested: { key: 'CUSTOMERS_EXPORT_REQUESTED', text: 'The export was requested.' },
      error: { key: 'CUSTOMERS_EXPORT_ERROR', text: 'The export failed. Try again.' }
    }
  },
  // redesign CA-B1 (decisions 1-6 and 9): the call center agent, level 9. Same shape as the owner; its stores live in
  // `businesses_agent`, main passes no Learn entries to this page, and the orders column counts the agent's OWN orders (a zero is a number)
  callcenter_agent: {
    level: 9,
    storesKey: 'businesses_agent',
    // main asked ConfirmAdmin only for level 0 rows (U/UsersList:81-93)
    confirmAdminOnToggle: false,
    learn: [],
    storageKey: 'od.callcenter-agents.panel',
    sheetKeys: ['name', 'lastname', 'email', 'ordersCount', 'countryPhoneCode', 'cellphone'],
    ordersZeroAsNumber: true,
    text: {
      title: { key: 'CALL_CENTER_AGENTS', text: 'Call center agents' },
      one: { key: 'CALL_CENTER_AGENT', text: 'Call center agent' },
      countOne: { key: 'CALL_CENTER_AGENTS_COUNT_ONE', text: '1 call center agent' },
      countOther: { key: 'CALL_CENTER_AGENTS_COUNT_OTHER', text: '_count_ call center agents' },
      add: { key: 'CALL_CENTER_AGENTS_ADD', text: 'Add call center agent' },
      search: { key: 'CALL_CENTER_AGENTS_SEARCH', text: 'Search name, email or phone' },
      filterBar: { key: 'CALL_CENTER_AGENTS_FILTER_BAR', text: 'Filter call center agents' },
      statusTabs: { key: 'CALL_CENTER_AGENTS_STATUS_TABS', text: 'Call center agent status' },
      loading: { key: 'CALL_CENTER_AGENTS_LOADING', text: 'Loading call center agents' },
      empty: { key: 'CALL_CENTER_AGENTS_EMPTY', text: 'No call center agents yet' },
      emptyInactive: { key: 'CALL_CENTER_AGENTS_EMPTY_INACTIVE', text: 'No inactive call center agents' },
      noMatch: { key: 'CALL_CENTER_AGENTS_NO_MATCH', text: 'No call center agents match these filters' },
      loadError: { key: 'CALL_CENTER_AGENTS_LOAD_ERROR', text: "We couldn't load the call center agents." },
      notFound: { key: 'CALL_CENTER_AGENTS_NOT_FOUND', text: "This call center agent doesn't exist or was deleted." },
      detailLoadError: { key: 'CALL_CENTER_AGENTS_DETAIL_LOAD_ERROR', text: "We couldn't load this call center agent." },
      sections: { key: 'CALL_CENTER_AGENTS_SECTIONS', text: 'Call center agent sections' },
      resizePanel: { key: 'CALL_CENTER_AGENTS_RESIZE_PANEL', text: 'Resize the call center agent panel' },
      selectionActions: { key: 'CALL_CENTER_AGENTS_SELECTION_ACTIONS', text: 'Actions for selected call center agents' },
      deleteOne: { key: 'CALL_CENTER_AGENTS_DELETE_N_ONE', text: 'Delete _count_ call center agent' },
      deleteOther: { key: 'CALL_CENTER_AGENTS_DELETE_N_OTHER', text: 'Delete _count_ call center agents' },
      deleteTitleOne: { key: 'CALL_CENTER_AGENTS_DELETE_N_TITLE_ONE', text: 'Delete _count_ call center agent?' },
      deleteTitleOther: { key: 'CALL_CENTER_AGENTS_DELETE_N_TITLE_OTHER', text: 'Delete _count_ call center agents?' },
      deleteSeveralError: { key: 'CALL_CENTER_AGENTS_DELETE_SEVERAL_ERROR', text: "We couldn't delete the selected call center agents. Try again." },
      deleteSeveralErrorTitle: { key: 'CALL_CENTER_AGENTS_DELETE_SEVERAL_ERROR_TITLE', text: "The call center agents weren't deleted" },
      deleteConfirm: { key: 'CALL_CENTER_AGENTS_DELETE_CONFIRM', text: 'Delete call center agent' },
      deleteError: { key: 'CALL_CENTER_AGENTS_DELETE_ERROR', text: "We couldn't delete this call center agent. Try again." },
      deleteErrorTitle: { key: 'CALL_CENTER_AGENTS_DELETE_ERROR_TITLE', text: "The call center agent wasn't deleted" },
      ordersColumn: { key: 'CALL_CENTER_AGENTS_OWN_ORDERS', text: 'Own orders' }
    },
    // redesign D-1 (owner, 2026-10-19, decision 25 C8): the question before deactivating (call center agents); activating is immediate.
    // A kind without this group (the admin: ConfirmAdmin is its question) asks nothing here
    deactivateCopy: {
      title: { key: 'CALL_CENTER_AGENTS_DEACTIVATE_TITLE', text: 'Deactivate _name_?' },
      body: { key: 'CALL_CENTER_AGENTS_DEACTIVATE_BODY', text: "They can't sign in to the call center app or take orders until you activate them again." },
      confirm: { key: 'CALL_CENTER_AGENTS_DEACTIVATE_CONFIRM', text: 'Deactivate call center agent' }
    },
    // as the owner's: every agent, active and inactive, with no search, tab or filter (so the sentence is always `scopeAll`)
    exportCopy: {
      button: { key: 'CALL_CENTER_AGENTS_EXPORT_CSV', text: 'Export CSV' },
      title: { key: 'CALL_CENTER_AGENTS_EXPORT_TITLE', text: 'Export call center agents to CSV?' },
      confirm: { key: 'CALL_CENTER_AGENTS_EXPORT_CONFIRM', text: 'Export CSV' },
      scopeAll: { key: 'CALL_CENTER_AGENTS_EXPORT_SCOPE_ALL', text: "The file includes all call center agents, active and inactive. The search, the tab and the filters don't apply." },
      scopeFiltered: { key: 'CALL_CENTER_AGENTS_EXPORT_SCOPE_ALL', text: "The file includes all call center agents, active and inactive. The search, the tab and the filters don't apply." },
      resultTitle: { key: 'CUSTOMERS_EXPORT_RESULT_TITLE', text: 'Export' },
      requested: { key: 'CUSTOMERS_EXPORT_REQUESTED', text: 'The export was requested.' },
      error: { key: 'CUSTOMERS_EXPORT_ERROR', text: 'The export failed. Try again.' }
    }
  },
  // redesign AD-B1 (decisions 1-9): the admin, level 0. Same shape as the owner, but with no stores: main neither asks for
  // them nor shows them on this list (`storesKey: null`); the table's toggle asks ConfirmAdmin first for a level 0 row (main, U/UsersList:81-93; the record's switch does not, U/UserDetails:106-110);
  // the Learn entries are the ones main's page passed; the orders column is the owner's («Orders placed», «New»)
  // redesign D-1 (owner, 2026-10-19): no `deactivateCopy` on purpose, so the deactivation confirmation of the other kinds never stacks on ConfirmAdmin
  admin: {
    level: 0,
    storesKey: null,
    confirmAdminOnToggle: true,
    learn: ['managers_general_view', 'manager_details'],
    storageKey: 'od.admins.panel',
    sheetKeys: ['name', 'lastname', 'email', 'ordersCount', 'countryPhoneCode', 'cellphone'],
    text: {
      title: { key: 'ADMINS', text: 'Admins' },
      one: { key: 'ADMIN', text: 'Admin' },
      countOne: { key: 'ADMINS_COUNT_ONE', text: '1 admin' },
      countOther: { key: 'ADMINS_COUNT_OTHER', text: '_count_ admins' },
      add: { key: 'ADMINS_ADD', text: 'Add admin' },
      search: { key: 'ADMINS_SEARCH', text: 'Search name, email or phone' },
      filterBar: { key: 'ADMINS_FILTER_BAR', text: 'Filter admins' },
      statusTabs: { key: 'ADMINS_STATUS_TABS', text: 'Admin status' },
      loading: { key: 'ADMINS_LOADING', text: 'Loading admins' },
      empty: { key: 'ADMINS_EMPTY', text: 'No admins yet' },
      emptyInactive: { key: 'ADMINS_EMPTY_INACTIVE', text: 'No inactive admins' },
      noMatch: { key: 'ADMINS_NO_MATCH', text: 'No admins match these filters' },
      loadError: { key: 'ADMINS_LOAD_ERROR', text: "We couldn't load the admins." },
      notFound: { key: 'ADMINS_NOT_FOUND', text: "This admin doesn't exist or was deleted." },
      detailLoadError: { key: 'ADMINS_DETAIL_LOAD_ERROR', text: "We couldn't load this admin." },
      sections: { key: 'ADMINS_SECTIONS', text: 'Admin sections' },
      resizePanel: { key: 'ADMINS_RESIZE_PANEL', text: 'Resize the admin panel' },
      selectionActions: { key: 'ADMINS_SELECTION_ACTIONS', text: 'Actions for selected admins' },
      deleteOne: { key: 'ADMINS_DELETE_N_ONE', text: 'Delete _count_ admin' },
      deleteOther: { key: 'ADMINS_DELETE_N_OTHER', text: 'Delete _count_ admins' },
      deleteTitleOne: { key: 'ADMINS_DELETE_N_TITLE_ONE', text: 'Delete _count_ admin?' },
      deleteTitleOther: { key: 'ADMINS_DELETE_N_TITLE_OTHER', text: 'Delete _count_ admins?' },
      deleteSeveralError: { key: 'ADMINS_DELETE_SEVERAL_ERROR', text: "We couldn't delete the selected admins. Try again." },
      deleteSeveralErrorTitle: { key: 'ADMINS_DELETE_SEVERAL_ERROR_TITLE', text: "The admins weren't deleted" },
      deleteConfirm: { key: 'ADMINS_DELETE_CONFIRM', text: 'Delete admin' },
      deleteError: { key: 'ADMINS_DELETE_ERROR', text: "We couldn't delete this admin. Try again." },
      deleteErrorTitle: { key: 'ADMINS_DELETE_ERROR_TITLE', text: "The admin wasn't deleted" }
    },
    // as the owner's: every admin, active and inactive, with no search, tab or filter (so the sentence is always `scopeAll`)
    exportCopy: {
      button: { key: 'ADMINS_EXPORT_CSV', text: 'Export CSV' },
      title: { key: 'ADMINS_EXPORT_TITLE', text: 'Export admins to CSV?' },
      confirm: { key: 'ADMINS_EXPORT_CONFIRM', text: 'Export CSV' },
      scopeAll: { key: 'ADMINS_EXPORT_SCOPE_ALL', text: "The file includes all admins, active and inactive. The search, the tab and the filters don't apply." },
      scopeFiltered: { key: 'ADMINS_EXPORT_SCOPE_ALL', text: "The file includes all admins, active and inactive. The search, the tab and the filters don't apply." },
      resultTitle: { key: 'CUSTOMERS_EXPORT_RESULT_TITLE', text: 'Export' },
      requested: { key: 'CUSTOMERS_EXPORT_REQUESTED', text: 'The export was requested.' },
      error: { key: 'CUSTOMERS_EXPORT_ERROR', text: 'The export failed. Try again.' }
    }
  },
  // redesign (B1b, decisions 1-13): the professional, level 8. Same shape as the admin (no stores), plus the options only it
  // sets; a kind without them behaves as before:
  //  - `isProfessional`: the controller (K/UsersList) brings the occupations and filters by `occupation_id`;
  //  - `columns` (+ `columnManager`, `columnsStorageKey`): the table's columns in order, and the person may hide or move them;
  //  - `showLoyalty: false`: the filter bar has no Loyalty level (main's sheet for professionals has none);
  //  - `extraPropsToFetch`: what the record's sections paint and the list does not ask for by default (the schedule would draw 24/7 otherwise);
  //  - `addForm` / `afterAddSection`: the kind's own add form (its page injects it as StaffListing's `AddForm`: the directory does not import it, residue ratchet), and the section the new record opens in;
  //  - `calendarSync`, `deleteRequiresLevel0`: the record's header action, and «Delete» only for a level 0 session (as main);
  //  - `info`: main's ⓘ next to the title (its text is main's PROFESSIONALS_INFO, literally).
  professional: {
    level: 8,
    storesKey: null,
    confirmAdminOnToggle: false,
    learn: [],
    storageKey: 'od.professionals.panel',
    sheetKeys: ['name', 'lastname', 'email', 'countryPhoneCode', 'cellphone'],
    isProfessional: true,
    columns: ['owner', 'occupation', 'city', 'phone', 'email', 'status'],
    columnManager: true,
    columnsStorageKey: 'od.professionals.columns',
    showLoyalty: false,
    extraPropsToFetch: ['schedule', 'max_days_in_future', 'occupation_id', 'occupation', 'timezone'],
    addForm: 'professional',
    afterAddSection: 'business_services',
    calendarSync: true,
    deleteRequiresLevel0: true,
    info: {
      key: 'PROFESSIONALS_INFO',
      text: 'Create, assign and manage your professionals. Once the professional link his Google account, continue synchronizing your appointments with the professionals user using the Synchronize button inside of the account. Select the stores and configure the schedules for your services.'
    },
    text: {
      title: { key: 'PROFESSIONALS', text: 'Professionals' },
      one: { key: 'PROFESSIONAL', text: 'Professional' },
      countOne: { key: 'PROFESSIONALS_COUNT_ONE', text: '1 professional' },
      countOther: { key: 'PROFESSIONALS_COUNT_OTHER', text: '_count_ professionals' },
      add: { key: 'ADD_PROFESSIONAL', text: 'Add professional' },
      search: { key: 'PROFESSIONALS_SEARCH', text: 'Search name, email or phone' },
      filterBar: { key: 'PROFESSIONALS_FILTER_BAR', text: 'Filter professionals' },
      statusTabs: { key: 'PROFESSIONALS_STATUS_TABS', text: 'Professional status' },
      loading: { key: 'PROFESSIONALS_LOADING', text: 'Loading professionals' },
      empty: { key: 'PROFESSIONALS_EMPTY', text: 'No professionals yet' },
      emptyInactive: { key: 'PROFESSIONALS_EMPTY_INACTIVE', text: 'No inactive professionals' },
      noMatch: { key: 'PROFESSIONALS_NO_MATCH', text: 'No professionals match these filters' },
      loadError: { key: 'PROFESSIONALS_LOAD_ERROR', text: "We couldn't load the professionals." },
      notFound: { key: 'PROFESSIONALS_NOT_FOUND', text: "This professional doesn't exist or was deleted." },
      detailLoadError: { key: 'PROFESSIONALS_DETAIL_LOAD_ERROR', text: "We couldn't load this professional." },
      sections: { key: 'PROFESSIONALS_SECTIONS', text: 'Professional sections' },
      resizePanel: { key: 'PROFESSIONALS_RESIZE_PANEL', text: 'Resize the professional panel' },
      selectionActions: { key: 'PROFESSIONALS_SELECTION_ACTIONS', text: 'Actions for selected professionals' },
      deleteOne: { key: 'PROFESSIONALS_DELETE_N_ONE', text: 'Delete _count_ professional' },
      deleteOther: { key: 'PROFESSIONALS_DELETE_N_OTHER', text: 'Delete _count_ professionals' },
      deleteTitleOne: { key: 'PROFESSIONALS_DELETE_N_TITLE_ONE', text: 'Delete _count_ professional?' },
      deleteTitleOther: { key: 'PROFESSIONALS_DELETE_N_TITLE_OTHER', text: 'Delete _count_ professionals?' },
      deleteSeveralError: { key: 'PROFESSIONALS_DELETE_SEVERAL_ERROR', text: "We couldn't delete the selected professionals. Try again." },
      deleteSeveralErrorTitle: { key: 'PROFESSIONALS_DELETE_SEVERAL_ERROR_TITLE', text: "The professionals weren't deleted" },
      deleteConfirm: { key: 'PROFESSIONALS_DELETE_CONFIRM', text: 'Delete professional' },
      deleteError: { key: 'PROFESSIONALS_DELETE_ERROR', text: "We couldn't delete this professional. Try again." },
      deleteErrorTitle: { key: 'PROFESSIONALS_DELETE_ERROR_TITLE', text: "The professional wasn't deleted" },
      occupations: { key: 'PROFESSIONALS_OCCUPATION_FILTER', text: 'Occupation' }
    },
    // redesign D-1 (owner, 2026-10-19, decision 25 C8): the question before deactivating (professionals); activating is immediate.
    // A kind without this group (the admin: ConfirmAdmin is its question) asks nothing here
    deactivateCopy: {
      title: { key: 'PROFESSIONALS_DEACTIVATE_TITLE', text: 'Deactivate _name_?' },
      body: { key: 'PROFESSIONALS_DEACTIVATE_BODY', text: "They can't sign in until you activate them again." },
      confirm: { key: 'PROFESSIONALS_DEACTIVATE_CONFIRM', text: 'Deactivate professional' }
    },
    // as the admin's: every professional, active and inactive, with no search, tab or filter (so the sentence is always `scopeAll`)
    exportCopy: {
      button: { key: 'PROFESSIONALS_EXPORT_CSV', text: 'Export CSV' },
      title: { key: 'PROFESSIONALS_EXPORT_TITLE', text: 'Export professionals to CSV?' },
      confirm: { key: 'PROFESSIONALS_EXPORT_CONFIRM', text: 'Export CSV' },
      scopeAll: { key: 'PROFESSIONALS_EXPORT_SCOPE_ALL', text: "The file includes all professionals, active and inactive. The search, the tab and the filters don't apply." },
      scopeFiltered: { key: 'PROFESSIONALS_EXPORT_SCOPE_ALL', text: "The file includes all professionals, active and inactive. The search, the tab and the filters don't apply." },
      resultTitle: { key: 'CUSTOMERS_EXPORT_RESULT_TITLE', text: 'Export' },
      requested: { key: 'CUSTOMERS_EXPORT_REQUESTED', text: 'The export was requested.' },
      error: { key: 'CUSTOMERS_EXPORT_ERROR', text: 'The export failed. Try again.' }
    }
  }
}

/**
 * The user property that holds the stores of a record, by the level OF THE RECORD (main, U/UserDetails:193): a call center agent
 * (9) keeps them in `businesses_agent`, anyone else in `businesses`. A page can open a record of another level than its own.
 */
export const staffStoresKey = (level) => (level === 9 ? 'businesses_agent' : 'businesses')

/** A kind's text: `say(t, kind.text.add)`; `count` fills `_count_`. */
export const say = (t, entry, count) => {
  const text = t(entry.key, entry.text)
  return count === undefined ? text : String(text).replace('_count_', () => String(count))
}

/**
 * Literal t() calls so `i18n:generate` sees the keys the kinds pass as data (`{ key, text }`), as the command palette's seed does.
 * Never called with a real effect; `staffKinds.test.js` fails if a key of a kind is missing here.
 */
export const seedStaffKindsI18n = (t) => {
  if (typeof t !== 'function') return
  t('BUSINESS_OWNERS', 'Business owners')
  t('BUSINESS_OWNER', 'Business owner')
  t('BUSINESS_OWNERS_COUNT_ONE', '1 business owner')
  t('BUSINESS_OWNERS_COUNT_OTHER', '_count_ business owners')
  t('BUSINESS_OWNERS_ADD', 'Add business owner')
  t('BUSINESS_OWNERS_SEARCH', 'Search name, email or phone')
  t('BUSINESS_OWNERS_FILTER_BAR', 'Filter business owners')
  t('BUSINESS_OWNERS_STATUS_TABS', 'Business owner status')
  t('BUSINESS_OWNERS_LOADING', 'Loading business owners')
  t('BUSINESS_OWNERS_EMPTY', 'No business owners yet')
  t('BUSINESS_OWNERS_EMPTY_INACTIVE', 'No inactive business owners')
  t('BUSINESS_OWNERS_NO_MATCH', 'No business owners match these filters')
  t('BUSINESS_OWNERS_LOAD_ERROR', "We couldn't load the business owners.")
  t('BUSINESS_OWNERS_NOT_FOUND', "This business owner doesn't exist or was deleted.")
  t('BUSINESS_OWNERS_DETAIL_LOAD_ERROR', "We couldn't load this business owner.")
  t('BUSINESS_OWNERS_SECTIONS', 'Business owner sections')
  t('BUSINESS_OWNERS_RESIZE_PANEL', 'Resize the business owner panel')
  t('BUSINESS_OWNERS_SELECTION_ACTIONS', 'Actions for selected business owners')
  t('BUSINESS_OWNERS_DELETE_N_ONE', 'Delete _count_ business owner')
  t('BUSINESS_OWNERS_DELETE_N_OTHER', 'Delete _count_ business owners')
  t('BUSINESS_OWNERS_DELETE_N_TITLE_ONE', 'Delete _count_ business owner?')
  t('BUSINESS_OWNERS_DELETE_N_TITLE_OTHER', 'Delete _count_ business owners?')
  t('BUSINESS_OWNERS_DELETE_SEVERAL_ERROR', "We couldn't delete the selected business owners. Try again.")
  t('BUSINESS_OWNERS_DELETE_SEVERAL_ERROR_TITLE', "The business owners weren't deleted")
  t('BUSINESS_OWNERS_DELETE_CONFIRM', 'Delete business owner')
  t('BUSINESS_OWNERS_DELETE_ERROR', "We couldn't delete this business owner. Try again.")
  t('BUSINESS_OWNERS_DELETE_ERROR_TITLE', "The business owner wasn't deleted")
  t('BUSINESS_OWNERS_DEACTIVATE_TITLE', 'Deactivate _name_?')
  t('BUSINESS_OWNERS_DEACTIVATE_BODY', "They can't sign in to the dashboard until you activate them again.")
  t('BUSINESS_OWNERS_DEACTIVATE_CONFIRM', 'Deactivate business owner')
  t('BUSINESS_OWNERS_EXPORT_CSV', 'Export CSV')
  t('BUSINESS_OWNERS_EXPORT_TITLE', 'Export business owners to CSV?')
  t('BUSINESS_OWNERS_EXPORT_CONFIRM', 'Export CSV')
  t('BUSINESS_OWNERS_EXPORT_SCOPE_ALL', "The file includes all business owners, active and inactive. The search, the tab and the filters don't apply.")
  t('CUSTOMERS_EXPORT_RESULT_TITLE', 'Export')
  t('CUSTOMERS_EXPORT_REQUESTED', 'The export was requested.')
  t('CUSTOMERS_EXPORT_ERROR', 'The export failed. Try again.')
  t('CALL_CENTER_AGENTS', 'Call center agents')
  t('CALL_CENTER_AGENT', 'Call center agent')
  t('CALL_CENTER_AGENTS_COUNT_ONE', '1 call center agent')
  t('CALL_CENTER_AGENTS_COUNT_OTHER', '_count_ call center agents')
  t('CALL_CENTER_AGENTS_ADD', 'Add call center agent')
  t('CALL_CENTER_AGENTS_SEARCH', 'Search name, email or phone')
  t('CALL_CENTER_AGENTS_FILTER_BAR', 'Filter call center agents')
  t('CALL_CENTER_AGENTS_STATUS_TABS', 'Call center agent status')
  t('CALL_CENTER_AGENTS_LOADING', 'Loading call center agents')
  t('CALL_CENTER_AGENTS_EMPTY', 'No call center agents yet')
  t('CALL_CENTER_AGENTS_EMPTY_INACTIVE', 'No inactive call center agents')
  t('CALL_CENTER_AGENTS_NO_MATCH', 'No call center agents match these filters')
  t('CALL_CENTER_AGENTS_LOAD_ERROR', "We couldn't load the call center agents.")
  t('CALL_CENTER_AGENTS_NOT_FOUND', "This call center agent doesn't exist or was deleted.")
  t('CALL_CENTER_AGENTS_DETAIL_LOAD_ERROR', "We couldn't load this call center agent.")
  t('CALL_CENTER_AGENTS_SECTIONS', 'Call center agent sections')
  t('CALL_CENTER_AGENTS_RESIZE_PANEL', 'Resize the call center agent panel')
  t('CALL_CENTER_AGENTS_SELECTION_ACTIONS', 'Actions for selected call center agents')
  t('CALL_CENTER_AGENTS_DELETE_N_ONE', 'Delete _count_ call center agent')
  t('CALL_CENTER_AGENTS_DELETE_N_OTHER', 'Delete _count_ call center agents')
  t('CALL_CENTER_AGENTS_DELETE_N_TITLE_ONE', 'Delete _count_ call center agent?')
  t('CALL_CENTER_AGENTS_DELETE_N_TITLE_OTHER', 'Delete _count_ call center agents?')
  t('CALL_CENTER_AGENTS_DELETE_SEVERAL_ERROR', "We couldn't delete the selected call center agents. Try again.")
  t('CALL_CENTER_AGENTS_DELETE_SEVERAL_ERROR_TITLE', "The call center agents weren't deleted")
  t('CALL_CENTER_AGENTS_DELETE_CONFIRM', 'Delete call center agent')
  t('CALL_CENTER_AGENTS_DELETE_ERROR', "We couldn't delete this call center agent. Try again.")
  t('CALL_CENTER_AGENTS_DELETE_ERROR_TITLE', "The call center agent wasn't deleted")
  t('CALL_CENTER_AGENTS_DEACTIVATE_TITLE', 'Deactivate _name_?')
  t('CALL_CENTER_AGENTS_DEACTIVATE_BODY', "They can't sign in to the call center app or take orders until you activate them again.")
  t('CALL_CENTER_AGENTS_DEACTIVATE_CONFIRM', 'Deactivate call center agent')
  t('CALL_CENTER_AGENTS_OWN_ORDERS', 'Own orders')
  t('CALL_CENTER_AGENTS_EXPORT_CSV', 'Export CSV')
  t('CALL_CENTER_AGENTS_EXPORT_TITLE', 'Export call center agents to CSV?')
  t('CALL_CENTER_AGENTS_EXPORT_CONFIRM', 'Export CSV')
  t('CALL_CENTER_AGENTS_EXPORT_SCOPE_ALL', "The file includes all call center agents, active and inactive. The search, the tab and the filters don't apply.")
  t('ADMINS', 'Admins')
  t('ADMIN', 'Admin')
  t('ADMINS_COUNT_ONE', '1 admin')
  t('ADMINS_COUNT_OTHER', '_count_ admins')
  t('ADMINS_ADD', 'Add admin')
  t('ADMINS_SEARCH', 'Search name, email or phone')
  t('ADMINS_FILTER_BAR', 'Filter admins')
  t('ADMINS_STATUS_TABS', 'Admin status')
  t('ADMINS_LOADING', 'Loading admins')
  t('ADMINS_EMPTY', 'No admins yet')
  t('ADMINS_EMPTY_INACTIVE', 'No inactive admins')
  t('ADMINS_NO_MATCH', 'No admins match these filters')
  t('ADMINS_LOAD_ERROR', "We couldn't load the admins.")
  t('ADMINS_NOT_FOUND', "This admin doesn't exist or was deleted.")
  t('ADMINS_DETAIL_LOAD_ERROR', "We couldn't load this admin.")
  t('ADMINS_SECTIONS', 'Admin sections')
  t('ADMINS_RESIZE_PANEL', 'Resize the admin panel')
  t('ADMINS_SELECTION_ACTIONS', 'Actions for selected admins')
  t('ADMINS_DELETE_N_ONE', 'Delete _count_ admin')
  t('ADMINS_DELETE_N_OTHER', 'Delete _count_ admins')
  t('ADMINS_DELETE_N_TITLE_ONE', 'Delete _count_ admin?')
  t('ADMINS_DELETE_N_TITLE_OTHER', 'Delete _count_ admins?')
  t('ADMINS_DELETE_SEVERAL_ERROR', "We couldn't delete the selected admins. Try again.")
  t('ADMINS_DELETE_SEVERAL_ERROR_TITLE', "The admins weren't deleted")
  t('ADMINS_DELETE_CONFIRM', 'Delete admin')
  t('ADMINS_DELETE_ERROR', "We couldn't delete this admin. Try again.")
  t('ADMINS_DELETE_ERROR_TITLE', "The admin wasn't deleted")
  t('ADMINS_EXPORT_CSV', 'Export CSV')
  t('ADMINS_EXPORT_TITLE', 'Export admins to CSV?')
  t('ADMINS_EXPORT_CONFIRM', 'Export CSV')
  t('ADMINS_EXPORT_SCOPE_ALL', "The file includes all admins, active and inactive. The search, the tab and the filters don't apply.")
  t('PROFESSIONALS', 'Professionals')
  t('PROFESSIONAL', 'Professional')
  t('PROFESSIONALS_COUNT_ONE', '1 professional')
  t('PROFESSIONALS_COUNT_OTHER', '_count_ professionals')
  t('ADD_PROFESSIONAL', 'Add professional')
  t('PROFESSIONALS_SEARCH', 'Search name, email or phone')
  t('PROFESSIONALS_FILTER_BAR', 'Filter professionals')
  t('PROFESSIONALS_STATUS_TABS', 'Professional status')
  t('PROFESSIONALS_LOADING', 'Loading professionals')
  t('PROFESSIONALS_EMPTY', 'No professionals yet')
  t('PROFESSIONALS_EMPTY_INACTIVE', 'No inactive professionals')
  t('PROFESSIONALS_NO_MATCH', 'No professionals match these filters')
  t('PROFESSIONALS_LOAD_ERROR', "We couldn't load the professionals.")
  t('PROFESSIONALS_NOT_FOUND', "This professional doesn't exist or was deleted.")
  t('PROFESSIONALS_DETAIL_LOAD_ERROR', "We couldn't load this professional.")
  t('PROFESSIONALS_SECTIONS', 'Professional sections')
  t('PROFESSIONALS_RESIZE_PANEL', 'Resize the professional panel')
  t('PROFESSIONALS_SELECTION_ACTIONS', 'Actions for selected professionals')
  t('PROFESSIONALS_DELETE_N_ONE', 'Delete _count_ professional')
  t('PROFESSIONALS_DELETE_N_OTHER', 'Delete _count_ professionals')
  t('PROFESSIONALS_DELETE_N_TITLE_ONE', 'Delete _count_ professional?')
  t('PROFESSIONALS_DELETE_N_TITLE_OTHER', 'Delete _count_ professionals?')
  t('PROFESSIONALS_DELETE_SEVERAL_ERROR', "We couldn't delete the selected professionals. Try again.")
  t('PROFESSIONALS_DELETE_SEVERAL_ERROR_TITLE', "The professionals weren't deleted")
  t('PROFESSIONALS_DELETE_CONFIRM', 'Delete professional')
  t('PROFESSIONALS_DELETE_ERROR', "We couldn't delete this professional. Try again.")
  t('PROFESSIONALS_DELETE_ERROR_TITLE', "The professional wasn't deleted")
  t('PROFESSIONALS_DEACTIVATE_TITLE', 'Deactivate _name_?')
  t('PROFESSIONALS_DEACTIVATE_BODY', "They can't sign in until you activate them again.")
  t('PROFESSIONALS_DEACTIVATE_CONFIRM', 'Deactivate professional')
  t('PROFESSIONALS_OCCUPATION_FILTER', 'Occupation')
  t('PROFESSIONALS_INFO', 'Create, assign and manage your professionals. Once the professional link his Google account, continue synchronizing your appointments with the professionals user using the Synchronize button inside of the account. Select the stores and configure the schedules for your services.')
  t('PROFESSIONALS_EXPORT_CSV', 'Export CSV')
  t('PROFESSIONALS_EXPORT_TITLE', 'Export professionals to CSV?')
  t('PROFESSIONALS_EXPORT_CONFIRM', 'Export CSV')
  t('PROFESSIONALS_EXPORT_SCOPE_ALL', "The file includes all professionals, active and inactive. The search, the tab and the filters don't apply.")
}
