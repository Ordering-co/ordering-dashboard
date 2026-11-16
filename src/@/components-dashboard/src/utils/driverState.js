// redesign DL-B2 (decision 3): promoted from O/DriversDashboard/driverState.js so /drivers-dashboard and /delivery/drivers-list say a
// driver's state the same way. Pure: no React, no translations.

// DD-11: names with stray or doubled spaces
export const fullName = (driver) => [driver?.name, driver?.lastname]
  .map((part) => (part === null || part === undefined ? '' : String(part)))
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim()

// Offline when not connected, whatever else; Busy when connected with orders; else Available
export const driverState = (driver) => {
  if (!driver?.available) return 'offline'
  return driver?.busy ? 'busy' : 'available'
}
