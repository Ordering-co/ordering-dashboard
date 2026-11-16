import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'
import { DEFAULT_FILTER_VALUES, FilterValuesProvider, useFilterValues } from '../../../@/components-dashboard/src/ui/src/contexts/FilterValuesContext'

const captured = vi.hoisted(() => ({ props: null, renders: 0, mounts: [] }))

vi.mock('../../../components/HelmetTags', () => ({
  HelmetTags: ({ page }) => <div data-testid='helmet-tags' data-page={page} />
}))

vi.mock('~ui', async () => {
  const React = await import('react')
  const { createUiPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  const base = await createUiPageMocks()
  // (D-22): the controller stub records the props the page gives it
  const { useFilterValues: useSharedFilterValues } = await import('../../../@/components-dashboard/src/ui/src/contexts/FilterValuesContext')
  const DeliveriesManager = (props) => {
    const [sharedValues] = useSharedFilterValues()
    captured.props = props
    captured.renders += 1
    // (D-22, review M2): what the shared context held when the controller mounted
    React.useEffect(() => { captured.mounts.push(sharedValues) }, [])
    return React.createElement('div', { 'data-testid': 'page-ui' })
  }
  return { ...base, DeliveriesManager }
})

vi.mock('~components', async () => {
  const { createComponentsPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return createComponentsPageMocks()
})

vi.mock('../../../config', () => ({ default: {} }))

import { DeliveriesManager } from '../index'

let sharedFilters
const Probe = () => {
  sharedFilters = useFilterValues()[0]
  return null
}

// (D-22, review M3): filters left in the shared context by an earlier visit (the provider is not reset)
const STALE_FILTERS = { timeStatus: 'delayed', businessIds: [9], driverIds: [3] }
const PresetFilters = ({ values, children }) => {
  const [, { handleFilterValues }] = useFilterValues()
  const [done, setDone] = React.useState(false)
  React.useLayoutEffect(() => {
    handleFilterValues({ ...DEFAULT_FILTER_VALUES, ...values })
    setDone(true)
  }, [])
  return done ? children : null
}

const renderPage = (entry, { stale } = {}) => {
  window.history.replaceState(null, '', entry)
  const page = (
    <>
      <Probe />
      <DeliveriesManager />
    </>
  )
  return renderWithProviders(
    <FilterValuesProvider>
      {stale ? <PresetFilters values={stale}>{page}</PresetFilters> : page}
    </FilterValuesProvider>,
    { initialEntries: [entry] }
  )
}

describe('DeliveriesManager page', () => {
  afterEach(() => {
    captured.props = null
    captured.renders = 0
    captured.mounts = []
    window.history.replaceState(null, '', '/')
  })

  it('renders its helmet tags and main controller', () => {
    renderWithProviders(<DeliveriesManager />)

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'deliveries')
    expect(screen.getByTestId('page-ui')).toBeInTheDocument()
  })

  // (D-22)
  it('seeds the shared filters from the URL for the first fetch', () => {
    renderPage('/deliveries?status=inProgress&unassigned=1&business=12')

    expect(captured.props.defaultFilterValues).toMatchObject({ assigned: 1, businessIds: [12] })
    expect(captured.props.defaultTimeStatus).toBeUndefined()
  })

  it('starts the time status as delayed with ?late=1', () => {
    renderPage('/deliveries?late=1')

    expect(captured.props.defaultFilterValues).toMatchObject({ timeStatus: 'delayed' })
    expect(captured.props.defaultTimeStatus).toBe('delayed')
  })

  it('leaves the props as today without params', () => {
    renderPage('/deliveries?status=pending')

    expect(captured.props.defaultFilterValues).toEqual([])
    expect('defaultTimeStatus' in captured.props).toBe(false)
  })

  // (D-22, review M2): the controller (and OrdersHeaderFilterGroup, which pushes the context into it on mount)
  // must not mount before the shared context is seeded, or the first fetches go out unfiltered.
  it('mounts the controller only once the shared context is seeded', () => {
    renderPage('/deliveries?status=inProgress&unassigned=1')

    expect(captured.mounts).toHaveLength(1)
    expect(captured.mounts[0]).toMatchObject({ assigned: 1 })
    expect(captured.renders).toBe(1)
  })

  it('does not mount the controller with the unseeded context when the URL has a late seed', () => {
    renderPage('/deliveries?late=1&business=12')

    expect(captured.mounts).toHaveLength(1)
    expect(captured.mounts[0]).toMatchObject({ timeStatus: 'delayed', businessIds: [12] })
  })

  // (D-22, review M3): a seeded link is a deep link, it starts from neutral filters
  it('starts from neutral filters plus the seed, dropping stale shared values', () => {
    renderPage('/deliveries?unassigned=1', { stale: STALE_FILTERS })

    const expected = { ...DEFAULT_FILTER_VALUES, assigned: 1 }
    expect(sharedFilters).toEqual(expected)
    expect(sharedFilters.timeStatus).toBe(null)
    expect(sharedFilters.businessIds).toEqual([])
    expect(captured.props.defaultFilterValues).toEqual(expected)
    expect(captured.mounts[0]).toEqual(expected)
    expect('defaultTimeStatus' in captured.props).toBe(false)
  })

  it('mounts the controller on the first pass without a seed', () => {
    renderPage('/deliveries?status=pending')

    expect(captured.renders).toBe(1)
    expect(captured.mounts).toHaveLength(1)
  })

  it('keeps the stale shared filters without a seed', () => {
    renderPage('/deliveries?status=pending&id=4', { stale: STALE_FILTERS })

    expect(sharedFilters).toMatchObject(STALE_FILTERS)
    expect(captured.mounts[0]).toMatchObject(STALE_FILTERS)
    expect(captured.props.defaultFilterValues).toEqual([])
    expect(window.location.search).toBe('?status=pending&id=4')
  })

  it('puts the seed in the shared context and removes the consumed params, keeping the rest', () => {
    renderPage('/deliveries?status=inProgress&unassigned=1&business=12&late=1')

    expect(sharedFilters).toMatchObject({ assigned: 1, businessIds: [12], timeStatus: 'delayed' })
    expect(window.location.search).toBe('?status=inProgress')
  })
})
