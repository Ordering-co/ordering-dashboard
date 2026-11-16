/* eslint-disable import/first */
// redesign drivers-dashboard B3 (decision 3): Online / Offline tabs, the Status segmented control and the summary line.
import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { DriverLoadFilter } from '../DriverLoadFilter'

const renderFilter = (props = {}) => {
  const handlers = { onTabChange: vi.fn(), onLoadChange: vi.fn() }
  const view = renderWithProviders(
    <DriverLoadFilter
      tab='online'
      onlineCount={7}
      offlineCount={6}
      load='all'
      counts={{ all: 9, busy: 2, notBusy: 7 }}
      {...handlers}
      {...props}
    />
  )
  return { ...handlers, ...view }
}

describe('DriverLoadFilter', () => {
  it('draws the Online and Offline tabs with their counts and marks the current one', () => {
    renderFilter()
    expect(screen.getByRole('tablist', { name: 'Drivers' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Online 7' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Offline 6' })).toHaveAttribute('aria-selected', 'false')
  })

  it('asks for the other tab when it is pressed', async () => {
    const { onTabChange } = renderFilter()
    await userEvent.click(screen.getByRole('tab', { name: 'Offline 6' }))
    expect(onTabChange).toHaveBeenCalledTimes(1)
    expect(onTabChange).toHaveBeenCalledWith('offline')
  })

  it('offers All, Not busy and Busy and asks for the one pressed', async () => {
    const { onLoadChange } = renderFilter()
    const group = screen.getByRole('group', { name: 'Status' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Not busy' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Busy' }))
    expect(onLoadChange).toHaveBeenCalledTimes(1)
    expect(onLoadChange).toHaveBeenCalledWith('busy')
  })

  it('summarises the three numbers as figures in a polite live region', () => {
    const { container } = renderFilter()
    const summary = container.querySelector('p.odd-summary')
    expect(summary).toHaveAttribute('aria-live', 'polite')
    expect(summary).toHaveTextContent('9 drivers · 7 not busy · 2 busy')
    expect(Array.from(summary.querySelectorAll('bdi.odc-figure')).map(node => node.textContent)).toEqual(['9', '7', '2'])
  })

  it('follows the counts when they change', () => {
    const { container, rerender } = renderFilter()
    rerender(
      <DriverLoadFilter
        tab='offline'
        onTabChange={vi.fn()}
        onlineCount={7}
        offlineCount={6}
        load='busy'
        onLoadChange={vi.fn()}
        counts={{ all: 3, busy: 1, notBusy: 2 }}
      />
    )
    expect(container.querySelector('p.odd-summary')).toHaveTextContent('3 drivers · 2 not busy · 1 busy')
    expect(screen.getByRole('tab', { name: 'Offline 6' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Busy' })).toHaveAttribute('aria-pressed', 'true')
  })
})

// redesign drivers-dashboard R1-05: «1 drivers»: the summary has a singular
describe('DriverLoadFilter · singular summary (R1-05)', () => {
  it('says «1 driver» for one driver', () => {
    const { container } = renderFilter({ counts: { all: 1, busy: 0, notBusy: 1 } })
    expect(container.querySelector('.odd-summary').textContent).toBe('1 driver · 1 not busy · 0 busy')
  })
})
