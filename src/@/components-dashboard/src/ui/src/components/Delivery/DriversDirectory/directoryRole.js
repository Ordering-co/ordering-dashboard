// redesign DM-B1 (decisions 1-3): /delivery/drivers-list and /delivery/drivers-managers share this composition. A `role` prop
// says which list it is: 'drivers' (the default, everything as left it) or 'managers'. What differs between the two lives here,
// so the pieces only ask «which role» and «which text». Pure: no React, no network.
//
// The texts go through literal t() calls with a key and a default (one per role and text) so the i18n scanner sees every key; the drivers'
// keys and defaults are the ones the pieces used before (their tests pin them).

export const ROLES = ['drivers', 'managers']

// Anything that is not 'managers' is the drivers list: a missing or unknown role never changes /delivery/drivers-list
export const roleOf = (role) => (role === 'managers' ? 'managers' : 'drivers')
export const isManagersRole = (role) => roleOf(role) === 'managers'

// The SplitView keeps its width per list (a driver panel and a manager panel are not the same width by force)
export const panelStorageKey = (role) => (isManagersRole(role) ? 'od.drivers-managers.panel' : 'od.drivers.panel')

const DRIVERS_COPY = (t) => ({
  countOne: t('DRIVERS_COUNT_ONE', '1 driver'),
  countOther: t('DRIVERS_COUNT_OTHER', '_count_ drivers'),
  add: t('ADD_DRIVER', 'Add driver'),
  one: t('DRIVER', 'Driver'),
  list: t('DRIVERS', 'Drivers'),
  column: t('DRIVER', 'Driver'),
  loading: t('DRIVERS_LOADING', 'Loading drivers'),
  noMatch: t('DRIVERS_NO_MATCH', 'No drivers match these filters'),
  empty: t('DRIVERS_EMPTY', 'No drivers yet'),
  loadError: t('DRIVERS_LOAD_ERROR', "We couldn't load the drivers."),
  selectionActions: t('DRIVERS_SELECTION_ACTIONS', 'Actions for selected drivers'),
  deleteNOne: t('DRIVERS_DELETE_N_ONE', 'Delete _count_ driver'),
  deleteNOther: t('DRIVERS_DELETE_N_OTHER', 'Delete _count_ drivers'),
  deleteNTitleOne: t('DRIVERS_DELETE_N_TITLE_ONE', 'Delete _count_ driver?'),
  deleteNTitleOther: t('DRIVERS_DELETE_N_TITLE_OTHER', 'Delete _count_ drivers?'),
  deleteTitle: t('DRIVERS_DELETE_TITLE', 'Delete _name_?'),
  deleteConfirm: t('DRIVERS_DELETE_CONFIRM', 'Delete driver'),
  deleteBody: t('DRIVERS_DELETE_BODY', "This can't be undone."),
  deleteSeveralError: t('DRIVERS_DELETE_SEVERAL_ERROR', "We couldn't delete the selected drivers. Try again."),
  deleteSeveralErrorTitle: t('DRIVERS_DELETE_SEVERAL_ERROR_TITLE', "The drivers weren't deleted"),
  resizePanel: t('DRIVERS_RESIZE_PANEL', 'Resize the driver panel'),
  notFound: t('DRIVERS_NOT_FOUND', "This driver doesn't exist or was deleted."),
  detailLoadError: t('DRIVERS_DETAIL_LOAD_ERROR', "We couldn't load this driver."),
  deleteError: t('DRIVERS_DELETE_ERROR', "We couldn't delete this driver. Try again."),
  deleteErrorTitle: t('DRIVERS_DELETE_ERROR_TITLE', "The driver wasn't deleted"),
  sections: t('DRIVERS_SECTIONS', 'Driver sections'),
  groupSection: t('DRIVER_GROUP', 'Driver group'),
  exportTitle: t('DRIVERS_EXPORT_TITLE', 'Export drivers to CSV?'),
  exportScope: t('DRIVERS_EXPORT_SCOPE', 'The file includes active and inactive drivers. The search and the status filter don\'t apply.')
})

// redesign DM-B1 (decision 3 | M-DM1): for a manager, main's «Driver group» tab edits the groups they ADMINISTER
// (`DriverGroupSetting isDriverManager` → `administrators`): it is called «Managed groups» here, same content and same `?tab=driver_group`.
const MANAGERS_COPY = (t) => ({
  countOne: t('DRIVERS_MANAGERS_COUNT_ONE', '1 manager'),
  countOther: t('DRIVERS_MANAGERS_COUNT_OTHER', '_count_ managers'),
  add: t('ADD_DRIVER_MANAGER', 'Add driver manager'),
  one: t('DRIVER_MANAGER', 'Driver manager'),
  list: t('DRIVERS_MANAGERS', 'Drivers managers'),
  column: t('DRIVERS_MANAGERS_COLUMN', 'Manager'),
  loading: t('DRIVERS_MANAGERS_LOADING', 'Loading driver managers'),
  noMatch: t('DRIVERS_MANAGERS_NO_MATCH', 'No driver managers match this search'),
  empty: t('DRIVERS_MANAGERS_EMPTY', 'No driver managers yet'),
  loadError: t('DRIVERS_MANAGERS_LOAD_ERROR', "We couldn't load the driver managers."),
  selectionActions: t('DRIVERS_MANAGERS_SELECTION_ACTIONS', 'Actions for selected driver managers'),
  deleteNOne: t('DRIVERS_MANAGERS_DELETE_N_ONE', 'Delete _count_ driver manager'),
  deleteNOther: t('DRIVERS_MANAGERS_DELETE_N_OTHER', 'Delete _count_ driver managers'),
  deleteNTitleOne: t('DRIVERS_MANAGERS_DELETE_N_TITLE_ONE', 'Delete _count_ driver manager?'),
  deleteNTitleOther: t('DRIVERS_MANAGERS_DELETE_N_TITLE_OTHER', 'Delete _count_ driver managers?'),
  deleteTitle: t('DRIVERS_MANAGERS_DELETE_TITLE', 'Delete _name_?'),
  deleteConfirm: t('DRIVERS_MANAGERS_DELETE_CONFIRM', 'Delete driver manager'),
  deleteBody: t('DRIVERS_MANAGERS_DELETE_BODY', "This can't be undone."),
  deleteSeveralError: t('DRIVERS_MANAGERS_DELETE_SEVERAL_ERROR', "We couldn't delete the selected driver managers. Try again."),
  deleteSeveralErrorTitle: t('DRIVERS_MANAGERS_DELETE_SEVERAL_ERROR_TITLE', "The driver managers weren't deleted"),
  resizePanel: t('DRIVERS_MANAGERS_RESIZE_PANEL', 'Resize the driver manager panel'),
  notFound: t('DRIVERS_MANAGERS_NOT_FOUND', "This driver manager doesn't exist or was deleted."),
  detailLoadError: t('DRIVERS_MANAGERS_DETAIL_LOAD_ERROR', "We couldn't load this driver manager."),
  deleteError: t('DRIVERS_MANAGERS_DELETE_ERROR', "We couldn't delete this driver manager. Try again."),
  deleteErrorTitle: t('DRIVERS_MANAGERS_DELETE_ERROR_TITLE', "The driver manager wasn't deleted"),
  sections: t('DRIVERS_MANAGERS_SECTIONS', 'Driver manager sections'),
  groupSection: t('DRIVERS_MANAGERS_MANAGED_GROUPS', 'Managed groups'),
  exportTitle: t('DRIVERS_MANAGERS_EXPORT_TITLE', 'Export driver managers to CSV?'),
  exportScope: t('DRIVERS_MANAGERS_EXPORT_SCOPE', 'The file includes active and inactive driver managers. The search doesn\'t apply.')
})

// The texts of a role: `directoryCopy(role, t).add`, `.countOther`…
export const directoryCopy = (role, t) => (isManagersRole(role) ? MANAGERS_COPY(t) : DRIVERS_COPY(t))
