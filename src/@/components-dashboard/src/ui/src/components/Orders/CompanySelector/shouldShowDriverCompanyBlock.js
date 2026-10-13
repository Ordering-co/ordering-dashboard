export const hasAssignedDriverCompany = (assignedCompanyId) => {
  if (assignedCompanyId == null || assignedCompanyId === '' || assignedCompanyId === 'default') {
    return false
  }
  return true
}

export const shouldShowDriverCompanyBlock = ({
  isFilterView = false,
  loading = false,
  companies,
  assignedCompanyId
} = {}) => {
  if (isFilterView) return true
  if (loading) return false
  const hasCompanies = Array.isArray(companies) && companies.length > 0
  return hasCompanies || hasAssignedDriverCompany(assignedCompanyId)
}

export const shouldShowDriverCompanyPicker = ({
  isFilterView = false,
  loading = false,
  error,
  companies
} = {}) => {
  if (isFilterView) return true
  if (loading || error) return false
  return Array.isArray(companies) && companies.length > 0
}
