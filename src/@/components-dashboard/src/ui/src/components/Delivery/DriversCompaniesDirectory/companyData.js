// redesign DC-B2 (decision 2 | M-DC12): what the driver companies list reads from a company the API returns. Pure: no React.
//
// A company of GET /driver_companies: { id, name, logo, owner_type ('system' for an integration like Uber Direct), priority,
// limit, timezone, enabled, ... }.

const cleanText = (value) => (value === null || value === undefined ? '' : String(value)).replace(/\s+/g, ' ').trim()

// The name without stray spaces; a company with no name at all says so rather than drawing an empty line
export const companyName = (company, t) => cleanText(company?.name) || t('DRIVERS_COMPANIES_NO_NAME', 'No name')

// The four priorities the form offers (and main labels): Low, Normal, High, Urgent
export const PRIORITY_VALUES = [-1, 0, 1, 2]

// As main (`D/DriversCompaniesList` getPriorityTag): the value goes through parseInt, anything else is «Unknown»
export const priorityLabel = (priority, t) => {
  switch (parseInt(priority)) {
    case -1:
      return t('LOW', 'Low')
    case 0:
      return t('NORMAL', 'Normal')
    case 1:
      return t('HIGH', 'High')
    case 2:
      return t('URGENT', 'Urgent')
    default:
      return t('UNKNOWN', 'Unknown')
  }
}

// An integration of the system (also a delivery service in Connect), not a company the project created (M-DC12)
export const isIntegration = (company) => company?.owner_type === 'system'

// By name, without regard to case, as main does (`name.toLowerCase().includes(search.toLowerCase())`). An empty or blank
// search is no search: the list as it came.
export const filterCompanies = (list, search) => {
  const companies = Array.isArray(list) ? list : []
  if (String(search ?? '').trim() === '') return companies
  const needle = String(search).toLowerCase()
  return companies.filter(company => String(company?.name ?? '').toLowerCase().includes(needle))
}
