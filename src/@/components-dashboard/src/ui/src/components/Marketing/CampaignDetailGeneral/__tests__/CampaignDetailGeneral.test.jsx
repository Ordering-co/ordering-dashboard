import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const translations = vi.hoisted(() => ({ overrides: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => translations.overrides[key] ?? fallback]
}))

vi.mock('../../../Shared', () => ({
  Modal: () => null,
  Alert: () => null,
  RangeCalendar: () => <div data-testid='range-calendar' />
}))

vi.mock('../../CampaignAmountOption', () => ({ CampaignAmountOption: () => null }))
vi.mock('../../CampaignSignUpOption', () => ({ CampaignSignUpOption: () => null }))
vi.mock('../../../../styles/Select/FirstSelect', () => ({ Select: () => <div /> }))

import { CampaignDetailGeneral } from '../index'

const renderGeneral = (overrides = {}) => {
  const handleChangeItem = vi.fn()
  renderWithProviders(
    <CampaignDetailGeneral
      formState={{ changes: {}, loading: false }}
      campaignState={{ campaign: { audience_type: 'fixed' } }}
      handleChangeItem={handleChangeItem}
      handleChangeInput={vi.fn()}
      handleChangeType={vi.fn()}
      handleDeleteCondition={vi.fn()}
      isAddMode
      audienceState={{}}
      contactState={{ changes: {} }}
      {...overrides}
    />
  )
  return { handleChangeItem }
}

describe('CampaignDetailGeneral radio pairs', () => {
  it('exposes Delivery Schedule as a named radiogroup with exact checked state', () => {
    renderGeneral()
    const group = screen.getByRole('radiogroup', { name: 'Delivery Schedule' })
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveAttribute('aria-checked', 'false')
    radios.forEach(radio => expect(radio).not.toHaveAttribute('aria-pressed'))
    radios.forEach(radio => expect(radio.querySelector('svg')).toHaveAttribute('aria-hidden', 'true'))
    expect(screen.queryByTestId('range-calendar')).toBeNull()
  })

  it('takes the Delivery Schedule heading from t() and names the radiogroup with it', () => {
    translations.overrides.DELIVERY_SCHEDULE = 'Translated Delivery Schedule'
    try {
      renderGeneral()
      expect(screen.getByRole('heading', { name: 'Translated Delivery Schedule' })).toBeInTheDocument()
      expect(screen.getByRole('radiogroup', { name: 'Translated Delivery Schedule' })).toBeInTheDocument()
    } finally {
      delete translations.overrides.DELIVERY_SCHEDULE
    }
  })

  it('selecting Schedule for later flips the pair and ASAP clears scheduled_at', () => {
    const { handleChangeItem } = renderGeneral()
    const group = screen.getByRole('radiogroup', { name: 'Delivery Schedule' })
    const [asap, later] = within(group).getAllByRole('radio')

    fireEvent.click(later)
    expect(asap).toHaveAttribute('aria-checked', 'false')
    expect(later).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('range-calendar')).toBeInTheDocument()

    fireEvent.click(asap)
    expect(handleChangeItem).toHaveBeenCalledWith('scheduled_at', null)
    expect(asap).toHaveAttribute('aria-checked', 'true')
    expect(later).toHaveAttribute('aria-checked', 'false')
  })

  it('exposes Dynamic and Fixed as radios with exact checked state', () => {
    const { handleChangeItem } = renderGeneral()
    const dynamic = screen.getByRole('radio', { name: 'Dynamic' })
    const fixed = screen.getByRole('radio', { name: 'Fixed' })
    expect(dynamic).toHaveAttribute('aria-checked', 'false')
    expect(fixed).toHaveAttribute('aria-checked', 'true')
    expect(dynamic).not.toHaveAttribute('aria-pressed')
    expect(fixed).not.toHaveAttribute('aria-pressed')

    fireEvent.click(dynamic)
    expect(handleChangeItem).toHaveBeenCalledWith('audience_type', 'dynamic')
  })

  it('groups Dynamic and Fixed in a named Audience radiogroup, apart from Delivery Schedule', () => {
    renderGeneral()
    const audience = screen.getByRole('radiogroup', { name: 'Audience' })
    expect(audience).toHaveAttribute('aria-labelledby', 'campaign-audience-heading')
    expect(document.getElementById('campaign-audience-heading')).toHaveTextContent('Audience')
    expect(within(audience).getByRole('radio', { name: 'Dynamic' })).toHaveAttribute('aria-checked', 'false')
    expect(within(audience).getByRole('radio', { name: 'Fixed' })).toHaveAttribute('aria-checked', 'true')

    // Delivery Schedule is nested: its two radios belong to the nearest group.
    const schedule = screen.getByRole('radiogroup', { name: 'Delivery Schedule' })
    expect(audience).toContainElement(schedule)
    const scheduleRadios = within(schedule).getAllByRole('radio')
    expect(scheduleRadios).toHaveLength(2)
    expect(within(schedule).queryByRole('radio', { name: 'Dynamic' })).toBeNull()
    expect(within(schedule).queryByRole('radio', { name: 'Fixed' })).toBeNull()
    scheduleRadios.forEach(radio => expect(radio.closest('[role=radiogroup]')).toBe(schedule))
    expect(screen.getByRole('radio', { name: 'Dynamic' }).closest('[role=radiogroup]')).toBe(audience)
    expect(screen.getByRole('radio', { name: 'Fixed' }).closest('[role=radiogroup]')).toBe(audience)
  })
})

describe('CampaignDetailGeneral radio keyboard contract', () => {
  const tabStopRadios = async (user, limit = 60) => {
    const stops = []
    for (let i = 0; i < limit; i++) {
      await user.tab()
      const el = document.activeElement
      if (!el || el === document.body || stops.includes(el)) break
      stops.push(el)
    }
    return stops.filter(el => el.getAttribute('role') === 'radio')
  }

  it('Tab reaches one radio per group: the checked one', async () => {
    const user = userEvent.setup()
    renderGeneral()
    const radios = await tabStopRadios(user)
    expect(radios.map(r => r.textContent.replace(/\s*\(.*$/, ''))).toEqual(['Fixed', 'ASAP'])
    expect(screen.getByRole('radio', { name: 'Dynamic' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('radio', { name: 'Schedule for later' })).toHaveAttribute('tabindex', '-1')
  })

  it('the first radio is the Tab stop of the Audience group when none is checked', async () => {
    renderGeneral({ campaignState: { campaign: {} } })
    expect(screen.getByRole('radio', { name: 'Dynamic' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Fixed' })).toHaveAttribute('tabindex', '-1')
  })

  it('arrows in Audience select and focus the other audience radio, never leaving for Delivery Schedule', async () => {
    const user = userEvent.setup()
    const { handleChangeItem } = renderGeneral()
    const dynamic = screen.getByRole('radio', { name: 'Dynamic' })
    const fixed = screen.getByRole('radio', { name: 'Fixed' })

    dynamic.focus()
    await user.keyboard('{ArrowDown}')
    expect(handleChangeItem).toHaveBeenLastCalledWith('audience_type', 'fixed')
    expect(fixed).toHaveFocus()

    fixed.focus()
    await user.keyboard('{ArrowRight}')
    expect(handleChangeItem).toHaveBeenLastCalledWith('audience_type', 'dynamic')
    expect(dynamic).toHaveFocus()

    // From Dynamic, going back wraps to Fixed, not to the nested ASAP / Schedule radios.
    await user.keyboard('{ArrowUp}')
    expect(handleChangeItem).toHaveBeenLastCalledWith('audience_type', 'fixed')
    expect(fixed).toHaveFocus()
    expect(screen.getByRole('radio', { name: /ASAP/ })).not.toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Schedule for later' })).not.toHaveFocus()
  })

  it('Home and End in Audience go to Dynamic and Fixed', async () => {
    const user = userEvent.setup()
    const { handleChangeItem } = renderGeneral()
    const dynamic = screen.getByRole('radio', { name: 'Dynamic' })
    screen.getByRole('radio', { name: 'Fixed' }).focus()
    await user.keyboard('{Home}')
    expect(handleChangeItem).toHaveBeenLastCalledWith('audience_type', 'dynamic')
    expect(dynamic).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('radio', { name: 'Fixed' })).toHaveFocus()
  })

  it('arrows in Delivery Schedule flip ASAP and Schedule for later, move focus and stay in the pair', async () => {
    const user = userEvent.setup()
    const { handleChangeItem } = renderGeneral()
    const asap = screen.getByRole('radio', { name: /ASAP/ })
    const later = screen.getByRole('radio', { name: 'Schedule for later' })

    asap.focus()
    await user.keyboard('{ArrowRight}')
    expect(later).toHaveAttribute('aria-checked', 'true')
    expect(asap).toHaveAttribute('aria-checked', 'false')
    expect(later).toHaveFocus()
    expect(later).toHaveAttribute('tabindex', '0')
    expect(asap).toHaveAttribute('tabindex', '-1')

    // Wraps inside the pair (does not jump to Dynamic / Fixed) and clears scheduled_at.
    await user.keyboard('{ArrowDown}')
    expect(handleChangeItem).toHaveBeenLastCalledWith('scheduled_at', null)
    expect(asap).toHaveAttribute('aria-checked', 'true')
    expect(asap).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(later).toHaveAttribute('aria-checked', 'true')
    expect(later).toHaveFocus()
    expect(handleChangeItem).not.toHaveBeenCalledWith('audience_type', expect.anything())
  })
})
