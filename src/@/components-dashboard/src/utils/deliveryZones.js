/**
 * Whether a delivery zone, as a store's zone list gives it, belongs to that store: a zone shared by another store comes with
 * `businesses` and a `pivot.business_id` (this store) that is not its `business_id` (the owner). One that is not shared is the store's.
 */
export const isOwnZone = (zone) => (zone?.businesses?.length ? zone?.pivot?.business_id === parseInt(zone?.business_id) : true)
