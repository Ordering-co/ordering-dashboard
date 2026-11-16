import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { DispatchToggles } from '../DispatchToggles'

vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, fallback) => fallback] }))

// redesign deliveries R1 fix (Q-01): the shared bar (chips, «Clear filters», SLA pill) reads the FilterValues context. The toggles
// must read their pressed state from it and write to it as well as to the controller, or the bar never learns about them and the
// next bar change drops what the toggles wrote.
const renderWithContext = (contextValues, props = {}) => {
  const handleFilterValues = vi.fn()
  const handleChangeFilterValues = vi.fn()
  const setTimeStatus = vi.fn()
  render(
    <FilterValuesContext.Provider value={[contextValues, { handleFilterValues }]}>
      <DispatchToggles filterValues={{ assigned: null, timeStatus: null }} handleChangeFilterValues={handleChangeFilterValues} setTimeStatus={setTimeStatus} {...props} />
    </FilterValuesContext.Provider>
  )
  return { handleFilterValues, handleChangeFilterValues, setTimeStatus }
}

describe('DispatchToggles · shared filter context (Q-01)', () => {
  it('reads the pressed state from the context the bar uses', () => {
    renderWithContext({ assigned: 1, timeStatus: 'delayed', businessIds: [7] })
    expect(screen.getByRole('button', { name: 'Unassigned' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Late' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('writes the same next values to the context and to the controller, keeping the other filters', () => {
    const { handleFilterValues, handleChangeFilterValues } = renderWithContext({ assigned: null, timeStatus: null, businessIds: [7] })
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    const next = { assigned: 1, timeStatus: null, businessIds: [7] }
    expect(handleFilterValues).toHaveBeenLastCalledWith(next)
    expect(handleChangeFilterValues).toHaveBeenLastCalledWith(next)
  })

  it('«Late» writes timeStatus to both and to setTimeStatus', () => {
    const { handleFilterValues, handleChangeFilterValues, setTimeStatus } = renderWithContext({ assigned: 1, timeStatus: null })
    fireEvent.click(screen.getByRole('button', { name: 'Late' }))
    expect(handleFilterValues).toHaveBeenLastCalledWith({ assigned: 1, timeStatus: 'delayed' })
    expect(handleChangeFilterValues).toHaveBeenLastCalledWith({ assigned: 1, timeStatus: 'delayed' })
    expect(setTimeStatus).toHaveBeenLastCalledWith('delayed')
  })
})
