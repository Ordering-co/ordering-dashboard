export const DRIVERS_PATH = '/delivery/drivers-list'
export const DRIVER_MANAGERS_PATH = '/delivery/drivers-managers'
export const DRIVER_COMPANIES_PATH = '/delivery/drivers-companies'

const isEmptyLoadedList = (list, loaded) => !!loaded && !list?.length

export const getMissingResources = ({
  drivers,
  driversLoaded,
  companies,
  companiesLoaded,
  driversManagers,
  driversManagersLoaded
}) => ({
  drivers: isEmptyLoadedList(drivers, driversLoaded),
  companies: isEmptyLoadedList(companies, companiesLoaded),
  driversManagers: isEmptyLoadedList(driversManagers, driversManagersLoaded)
})

export const hasSelectedIds = (value) => {
  try {
    const ids = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(ids) && ids.length > 0
  } catch (err) {
    return false
  }
}

export const getMissingResourceMessages = (t) => ({
  drivers: t('DRIVER_GROUP_NO_DRIVERS', 'There are no drivers yet. A group of in house drivers needs at least one driver: add a driver first, or change the type to Driver companies.'),
  companies: t('DRIVER_GROUP_NO_DRIVER_COMPANIES', 'There are no driver companies yet. A group of driver companies needs at least one company: add a driver company first, or change the type to In house drivers.'),
  driversManagers: t('DRIVER_GROUP_DRIVER_MANAGER_NEEDED', 'There are no driver managers yet. A group needs a driver manager: add a driver manager first.')
})
