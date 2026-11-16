import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import { SettingsHubFormContext } from '../SettingsHubFormContext'
import { SAVED_NOTICE_MS, useHubFormReport, useSavedNotice } from '../useHubFormReport'

// redesign settings B

const Probe = ({ sectionKey = 'orders', dirty = false, saving = false }) => {
  useHubFormReport(sectionKey, { dirty, saving })
  return null
}

const renderProbe = (report, props) => render(
  <SettingsHubFormContext.Provider value={{ product: true, report }}>
    <Probe {...props} />
  </SettingsHubFormContext.Provider>
)

describe('useHubFormReport', () => {
  it('tells the hub its state, and updates it when it changes', () => {
    const report = vi.fn()
    const view = renderProbe(report, { dirty: false, saving: false })
    expect(report).toHaveBeenLastCalledWith('orders', { dirty: false, saving: false })

    view.rerender(
      <SettingsHubFormContext.Provider value={{ product: true, report }}>
        <Probe dirty saving={false} />
      </SettingsHubFormContext.Provider>
    )
    expect(report).toHaveBeenLastCalledWith('orders', { dirty: true, saving: false })

    view.rerender(
      <SettingsHubFormContext.Provider value={{ product: true, report }}>
        <Probe dirty saving />
      </SettingsHubFormContext.Provider>
    )
    expect(report).toHaveBeenLastCalledWith('orders', { dirty: true, saving: true })
  })

  it('drops its report when the form unmounts', () => {
    const report = vi.fn()
    const view = renderProbe(report, { dirty: true })
    view.unmount()
    expect(report).toHaveBeenLastCalledWith('orders', null)
  })

  it('drops the report of the old section when the key changes', () => {
    const report = vi.fn()
    const view = renderProbe(report, { sectionKey: 'orders', dirty: true })
    view.rerender(
      <SettingsHubFormContext.Provider value={{ product: true, report }}>
        <Probe sectionKey='payments' dirty />
      </SettingsHubFormContext.Provider>
    )
    expect(report).toHaveBeenCalledWith('orders', null)
    expect(report).toHaveBeenLastCalledWith('payments', { dirty: true, saving: false })
  })

  it('does nothing without the hub provider', () => {
    expect(() => render(<Probe dirty />).unmount()).not.toThrow()
  })
})

describe('useSavedNotice', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('turns on when a save ends well and off after four seconds', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(props => useSavedNotice(props), { initialProps: { saving: false, succeeded: false } })
    expect(result.current).toBe(false)

    rerender({ saving: true, succeeded: false })
    expect(result.current).toBe(false)

    rerender({ saving: false, succeeded: true })
    expect(result.current).toBe(true)

    act(() => { vi.advanceTimersByTime(SAVED_NOTICE_MS - 1) })
    expect(result.current).toBe(true)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe(false)
  })

  it('stays off when the save failed, and clears at once when another save starts', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(props => useSavedNotice(props), { initialProps: { saving: true, succeeded: false } })
    rerender({ saving: false, succeeded: false })
    expect(result.current).toBe(false)

    rerender({ saving: true, succeeded: false })
    rerender({ saving: false, succeeded: true })
    expect(result.current).toBe(true)
    rerender({ saving: true, succeeded: false })
    expect(result.current).toBe(false)
  })
})
