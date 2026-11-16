/* eslint-disable import/first */
// redesign (lot C; AD-8, AD-9, AD-10): the levels list of the points-based loyalty program in Product pieces.
// The controller is a stand-in that hands the UI a given `levelList`; the detail card, the sidebar and the modal are stubs that record
// what the list gives them (their own behavior has its tests). The Product pieces (Button, EmptyState, Skeleton) and the icons are the real ones.
// Covered: the order by minimum_points (not by id); every level is one native button named by the level, with the points it starts at;
// the neutral marker instead of the business logo; a Lucide chevron instead of bootstrap's; «Add new level» as a Product button that
// opens the empty detail; loading, empty and error; the `?level=` URL and the sidebar / modal split at 1100px, as before.
import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const ctl = vi.hoisted(() => ({ levelList: null, width: 1400, detail: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => `optimized:${url}` }],
  PointsWalletLevels: ({ UIComponent, ...props }) => <UIComponent {...props} levelList={ctl.levelList} />
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: ctl.width }) }))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  SideBar: ({ children }) => <div data-testid='sidebar'>{children}</div>,
  Modal: ({ children }) => <div data-testid='modal'>{children}</div>
}))
vi.mock('../../LoyaltyLevelDetail', () => ({
  LoyaltyLevelDetail: (props) => {
    ctl.detail = props
    return <div data-testid='detail'>{props.level?.id ? `level ${props.level.id}` : 'new level'}</div>
  }
}))

import { PointsWalletLevels } from '../index'

// the live data: the API answers by id (1..5) and the names run 1, 2, 4, 5, 3
const LIVE = [
  { id: 1, name: 'Level 1', minimum_points: 0, image: null },
  { id: 2, name: 'Level 2', minimum_points: 10, image: 'https://cdn.example/two.png' },
  { id: 3, name: 'Level 4', minimum_points: 50, image: null },
  { id: 4, name: 'Level 5', minimum_points: 100, image: null },
  { id: 5, name: 'Level 3', minimum_points: 18, image: null }
]

const props = () => ({
  handleDeleteLevelList: vi.fn(),
  handleUpdateLevelList: vi.fn(),
  handleAddLevelList: vi.fn(),
  handleParentSidebarMove: vi.fn(),
  onDirtyChange: vi.fn()
})

const renderLevels = (levelList, extra = {}, options = {}) => {
  ctl.levelList = levelList
  const p = { ...props(), ...extra }
  return { ...renderWithProviders(<PointsWalletLevels {...p} />, options), props: p }
}

const rowNames = () => screen.getAllByRole('button')
  .filter(button => !button.classList.contains('odc-btn'))
  .map(button => button.querySelector('.pwl-name')?.textContent)

beforeEach(() => {
  ctl.width = 1400
  ctl.detail = null
})

describe('PointsWalletLevels · the order (AD-8)', () => {
  it('shows the live levels as Level 1, 2, 3, 4, 5 although the API returns them by id', () => {
    renderLevels({ loading: false, error: null, levels: LIVE })
    expect(rowNames()).toEqual(['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'])
  })

  it('does not reorder the list it was given', () => {
    const levels = [...LIVE]
    renderLevels({ loading: false, error: null, levels })
    expect(levels.map(level => level.id)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('PointsWalletLevels · a level is one button (AD-9)', () => {
  it('names each row button by its level and says from how many points it applies', () => {
    renderLevels({ loading: false, error: null, levels: LIVE })
    const row = screen.getByRole('button', { name: /^Level 3\b/ })
    expect(row.tagName).toBe('BUTTON')
    expect(row).toHaveAttribute('type', 'button')
    expect(row).toHaveTextContent('From 18 points')
  })

  it('says «1 point» in the singular', () => {
    renderLevels({ loading: false, error: null, levels: [{ id: 1, name: 'Bronze', minimum_points: 1 }] })
    expect(screen.getByRole('button', { name: /Bronze/ })).toHaveTextContent('From 1 point')
    expect(screen.getByRole('button', { name: /Bronze/ })).not.toHaveTextContent('From 1 points')
  })

  it('leaves the points line out of a level without minimum_points', () => {
    renderLevels({ loading: false, error: null, levels: [{ id: 1, name: 'Open' }] })
    expect(screen.getByRole('button', { name: 'Open' })).not.toHaveTextContent('From')
  })

  it('opens the detail of the level that is clicked, and marks it as the current one', async () => {
    const user = userEvent.setup()
    renderLevels({ loading: false, error: null, levels: LIVE })
    expect(screen.getByRole('button', { name: /^Level 3\b/ })).not.toHaveAttribute('aria-current')
    await user.click(screen.getByRole('button', { name: /^Level 3\b/ }))
    expect(screen.getByTestId('detail')).toHaveTextContent('level 5')
    expect(screen.getByRole('button', { name: /^Level 3\b/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /^Level 1\b/ })).not.toHaveAttribute('aria-current')
  })

  it('draws a Lucide chevron, never the bootstrap one', () => {
    const { container } = renderLevels({ loading: false, error: null, levels: LIVE })
    expect(container.querySelectorAll('svg.lucide-chevron-right')).toHaveLength(5)
    expect(container.querySelector('.bi-chevron-right')).toBeNull()
    expect(container.querySelector('svg.bi')).toBeNull()
    container.querySelectorAll('svg.lucide-chevron-right').forEach(icon => expect(icon).toHaveAttribute('aria-hidden', 'true'))
  })

  it('shows the image of the level, optimized, when it has one', () => {
    const { container } = renderLevels({ loading: false, error: null, levels: LIVE })
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('src', 'optimized:https://cdn.example/two.png')
  })

  it('shows a neutral marker, not the business logo, for a level without image', () => {
    const { container } = renderLevels({ loading: false, error: null, levels: [LIVE[0]] }, {}, {
      theme: { colors: {}, images: { dummies: { businessLogo: 'https://dummy.example/logo.png' } } }
    })
    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).not.toContain('dummy.example')
    expect(container.querySelector('svg.lucide-star')).not.toBeNull()
  })

  it('falls back to the neutral marker when the image does not load', () => {
    const { container } = renderLevels({ loading: false, error: null, levels: [LIVE[1]] })
    fireEvent.error(container.querySelector('img'))
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg.lucide-star')).not.toBeNull()
  })
})

describe('PointsWalletLevels · Add new level (AD-10)', () => {
  it('is a Product button, secondary, with a plus icon', () => {
    const { container } = renderLevels({ loading: false, error: null, levels: LIVE })
    const add = screen.getByRole('button', { name: 'Add new level' })
    expect(add).toHaveClass('odc-btn')
    expect(add).toHaveAttribute('data-variant', 'secondary')
    expect(add.querySelector('svg.lucide-plus')).not.toBeNull()
    expect(container.querySelectorAll('.odc-btn')).toHaveLength(1)
  })

  it('opens the empty detail', async () => {
    const user = userEvent.setup()
    renderLevels({ loading: false, error: null, levels: LIVE })
    await user.click(screen.getByRole('button', { name: 'Add new level' }))
    expect(screen.getByTestId('detail')).toHaveTextContent('new level')
    expect(ctl.detail.level).toEqual({})
  })

  it('is there in every state: loading, empty and error', () => {
    const { unmount } = renderLevels({ loading: true, levels: [] })
    expect(screen.getByRole('button', { name: 'Add new level' })).toBeInTheDocument()
    unmount()
    const second = renderLevels({ loading: false, error: null, levels: [] })
    expect(screen.getByRole('button', { name: 'Add new level' })).toBeInTheDocument()
    second.unmount()
    renderLevels({ loading: false, error: ['boom'], levels: [] })
    expect(screen.getByRole('button', { name: 'Add new level' })).toBeInTheDocument()
  })
})

describe('PointsWalletLevels · loading, empty, error', () => {
  it('announces the loading as a busy status with Product skeletons', () => {
    const { container } = renderLevels({ loading: true, levels: [] })
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveAttribute('aria-label', 'Loading')
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(container.querySelector('.react-loading-skeleton')).toBeNull()
  })

  it('says there are no levels yet', () => {
    renderLevels({ loading: false, error: null, levels: [] })
    expect(screen.getByText('No levels yet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says the levels did not load, as an alert', () => {
    renderLevels({ loading: false, error: ['Server error'], levels: [] })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText("We couldn't load the levels.")).toBeInTheDocument()
    expect(screen.queryByText('No levels yet')).toBeNull()
  })
})

describe('PointsWalletLevels · the detail as before', () => {
  it('opens the level of ?level= in the sidebar from 1100px and moves the parent', () => {
    const { props: p } = renderLevels({ loading: false, error: null, levels: LIVE }, {}, { initialEntries: ['/settings?level=3'] })
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('detail')).toHaveTextContent('level 3')
    expect(p.handleParentSidebarMove).toHaveBeenCalledWith(550)
  })

  it('uses a modal below 1100px', async () => {
    ctl.width = 800
    const user = userEvent.setup()
    renderLevels({ loading: false, error: null, levels: LIVE })
    await user.click(screen.getByRole('button', { name: /^Level 1\b/ }))
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar')).toBeNull()
  })

  it('hands the detail the same props contract', async () => {
    const user = userEvent.setup()
    const { props: p } = renderLevels({ loading: false, error: null, levels: LIVE })
    await user.click(screen.getByRole('button', { name: /^Level 2\b/ }))
    expect(ctl.detail.handleDeleteLevelList).toBe(p.handleDeleteLevelList)
    expect(ctl.detail.handleUpdateLevelList).toBe(p.handleUpdateLevelList)
    expect(ctl.detail.handleAddLevelList).toBe(p.handleAddLevelList)
    expect(ctl.detail.onDirtyChange).toBe(p.onDirtyChange)
  })
})
