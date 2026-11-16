import React, { useEffect, useState } from 'react'

import { useApi, useLanguage } from '../../../../../index'
import { PartyPicker } from '../AnalyticsKit/PartyPicker'

// redesign reviews FD2 (D7, RV-10): the driver of the CSV, a filter pill (K/PartyPicker) with «All drivers» first. The list is the one
// `main` asked for (ReviewsListing/index.js loadDrivers): users of level 4 as the dashboard sees them, `id`, `name` and `lastname`,
// the first 50, searched by `name` on the server. In `main` it was asked for as soon as the Drivers tab opened, whether or not the
// CSV was ever asked for; here `ListSource` is mounted by the picker only while its popover is open, so nothing goes out until
// someone opens the pill (RV-10).

const PAGE_SIZE = 50
const DRIVER_LEVEL = 4

const nameOf = (driver) => [driver?.name, driver?.lastname].filter(Boolean).join(' ').trim() || `#${driver?.id}`

// One component for every picker, defined here and not inside a render, so the popover does not remount (and ask again) when the dialog renders
const DriverListSource = ({ children }) => {
  const [ordering] = useApi()
  const [search, setSearch] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ loading: true, error: false, drivers: [] })

  useEffect(() => {
    let current = true
    const conditions = [{ attribute: 'level', value: DRIVER_LEVEL }]
    // redesign reviews R1 (Q1-1): encoded, as ReviewProductList does. A bare `%Ca…` reads as a hex escape on the server, which then drops
    // the whole `where` (level 4 included) and lists users of any level.
    if (search) conditions.push({ attribute: 'name', value: { condition: 'ilike', value: encodeURI(`%${search}%`) } })
    setState(previous => ({ ...previous, loading: true, error: false }))
    ordering.users().asDashboard()
      .select(['id', 'name', 'lastname'])
      .where({ conditions, conector: 'AND' })
      .get({ query: { page: 1, page_size: PAGE_SIZE } })
      .then(({ content }) => {
        if (!current) return
        setState(content?.error
          ? { loading: false, error: true, drivers: [] }
          : { loading: false, error: false, drivers: Array.isArray(content?.result) ? content.result : [] })
      })
      .catch(() => {
        if (current) setState({ loading: false, error: true, drivers: [] })
      })
    return () => { current = false }
  }, [search, attempt])

  return children({
    items: state.drivers.map(driver => ({ id: driver.id, name: nameOf(driver) })),
    loading: state.loading,
    error: state.error,
    search,
    setSearch,
    retry: () => setAttempt(count => count + 1)
  })
}

/** `driver` is `{ selected, select }`: `selected` is `{ id, name }` or `null` (all the drivers); `select` gets the same, `null` for «All drivers». */
export const DriverPicker = ({ driver }) => {
  const [, t] = useLanguage()
  const allLabel = t('REVIEWS_ALL_DRIVERS', 'All drivers')
  return (
    <PartyPicker
      party={{ kind: 'driver', selected: driver.selected, select: driver.select }}
      variant='pill'
      label={t('DRIVER', 'Driver')}
      placeholder={allLabel}
      ListSource={DriverListSource}
      serverSearch
      allOption={{ label: allLabel }}
    />
  )
}
