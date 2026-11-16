/* eslint-disable import/first */
// redesign IM-B / main sync: the run status line of an importer row, ported from main's ImportersPanel
// (ImporterRow + ImportRunStatus, commits 30af024c, ac049f23, fc6cf47f). The store, the hook and the menu read are the REAL ones
// (menuImportRuns, useMenuImportRun, useBusinessMenuSnapshot); only the Ordering API is a stub, so the assertions are main's: same
// copy, same tones, same writes to the stored run.
import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { menuSnapshotGet, api } = vi.hoisted(() => {
  const menuSnapshotGet = vi.fn()
  return {
    menuSnapshotGet,
    api: {
      project: 'demo',
      root: 'https://api.example.com',
      businesses: () => ({ select: () => ({ get: menuSnapshotGet }) })
    }
  }
})

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useApi: () => [api]
}))
vi.mock('~components', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useApi: () => [api]
}))

import { ImporterRunStatus } from '../ImporterRunStatus'
import { IMPORTER_CARDS } from '../importerCards'
import { clearRun, getRun, RUN_EXPIRES_AFTER_MS, saveRun } from '../menuImportRuns'

const card = IMPORTER_CARDS.find(({ id }) => id === 'doordash')
const business = { id: 42, name: 'Pizza Pro' }
const runRef = { project: 'demo', businessId: 42, source: 'doordash' }
const startedAt = '2026-10-13T10:32:00.000Z'
const finishedAt = '2026-10-13T10:41:00.000Z'
const checkedAt = '2026-10-13T11:05:00.000Z'
const timeOf = (iso) => dayjs(iso).format('h:mm A')
const baseRun = {
  status: 'importing',
  startedAt,
  finishedAt: null,
  sourceUrl: 'https://www.doordash.com/store/test',
  appliedCount: null,
  errorMessage: null,
  menuBefore: { categories: 3, products: 120 },
  menuAfter: null
}
const clockAt = (iso, offsetMs = 0) => {
  vi.useRealTimers()
  vi.useFakeTimers({ now: Date.parse(iso) + offsetMs, toFake: ['Date'] })
}
const menuWith = (products, categories = 1) => ({
  content: { error: false, result: { id: 42, categories: Array.from({ length: categories }, (_, i) => ({ id: i })), available_products_count: products } }
})

let onRetry
const renderStatus = (props = {}) => render(
  <ImporterRunStatus card={card} business={business} onRetry={onRetry} {...props} />
)
const status = () => screen.queryByTestId('importer-run-status')
const check = async () => {
  await act(async () => {
    fireEvent.click(within(status()).getByRole('button', { name: 'Check now' }))
  })
}

beforeEach(() => {
  window.localStorage.clear()
  clearRun(runRef)
  menuSnapshotGet.mockReset()
  onRetry = vi.fn()
  clockAt(finishedAt, 60_000)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ImporterRunStatus', () => {
  it('shows nothing without a run', () => {
    renderStatus()
    expect(status()).toBeNull()
  })

  it('shows «Importing since» the start time, in a live region, with no action while it runs', () => {
    clockAt(startedAt, 60_000)
    saveRun(runRef, baseRun)
    renderStatus()
    expect(status()).toHaveTextContent(`Importing since ${timeOf(startedAt)}`)
    expect(status()).toHaveAttribute('data-tone', 'progress')
    expect(within(status()).getByRole('status')).toHaveTextContent(`Importing since ${timeOf(startedAt)}`)
    expect(within(status()).queryAllByRole('button')).toHaveLength(0)
  })

  it('shows «Completed» with the menu counts after the import, and Dismiss', () => {
    saveRun(runRef, { ...baseRun, status: 'success', finishedAt, appliedCount: 1, menuAfter: { categories: 12, products: 120 } })
    renderStatus()
    expect(status()).toHaveTextContent(`Completed ${timeOf(finishedAt)} · 12 categories, 120 products`)
    expect(status()).toHaveAttribute('data-tone', 'success')
    expect(within(status()).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('shows «Failed» with the message and a Retry that calls onRetry', () => {
    saveRun(runRef, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Check the import details and try again.' })
    renderStatus()
    expect(status()).toHaveTextContent(`Failed ${timeOf(finishedAt)} — Check the import details and try again.`)
    expect(status()).toHaveAttribute('data-tone', 'danger')
    fireEvent.click(within(status()).getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('reads a lost connection as «may still be running», never as unknown', () => {
    clockAt(startedAt, 16 * 60_000)
    saveRun(runRef, baseRun)
    renderStatus()
    expect(status()).toHaveTextContent(`Connection lost — the import may still be running. Started ${timeOf(startedAt)}`)
    expect(status()).toHaveAttribute('data-tone', 'warning')
    expect(status()).not.toHaveTextContent(/unknown/i)
    expect(within(status()).getByRole('button', { name: 'Check now' })).toBeInTheDocument()
  })

  it('shows «Checking…» and disables the button while the menu is being read', async () => {
    saveRun(runRef, { ...baseRun, status: 'unknown', menuBefore: null })
    let resolveGet
    menuSnapshotGet.mockReturnValue(new Promise((resolve) => { resolveGet = resolve }))
    renderStatus()
    await check()
    expect(within(status()).getByRole('button', { name: 'Checking…' })).toBeDisabled()
    await act(async () => { resolveGet(menuWith(120)) })
    expect(within(status()).getByRole('button', { name: 'Check now' })).not.toBeDisabled()
  })

  it('resolves the line when Check now sees the menu grew, without claiming «Completed», and keeps it after a remount', async () => {
    clockAt(checkedAt)
    saveRun(runRef, { ...baseRun, status: 'unknown' })
    menuSnapshotGet.mockResolvedValue(menuWith(180))
    const { unmount } = renderStatus()
    await check()
    expect(status()).toHaveTextContent(`Menu grew from 120 to 180 products after the import · checked ${timeOf(checkedAt)}`)
    expect(status()).toHaveAttribute('data-tone', 'success')
    expect(status()).not.toHaveTextContent(/unknown|Completed/i)
    expect(within(status()).queryByRole('button', { name: 'Check now' })).toBeNull()
    expect(within(status()).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
    expect(getRun(runRef)).toMatchObject({ status: 'unknown', checkedAt, menuAfter: { categories: 1, products: 180 } })
    unmount()
    renderStatus()
    expect(status()).toHaveTextContent(`Menu grew from 120 to 180 products after the import · checked ${timeOf(checkedAt)}`)
    expect(menuSnapshotGet).toHaveBeenCalledTimes(1)
  })

  it('closes the run as failed when Check now sees the menu did not grow (main fc6cf47f)', async () => {
    clockAt(checkedAt)
    saveRun(runRef, { ...baseRun, status: 'unknown' })
    menuSnapshotGet.mockResolvedValue(menuWith(120, 3))
    renderStatus()
    await check()
    expect(status()).toHaveTextContent(`Failed ${timeOf(checkedAt)} — The menu did not grow, so the import did not finish.`)
    expect(status()).toHaveAttribute('data-tone', 'danger')
    expect(status()).not.toHaveTextContent(/unknown/i)
    expect(within(status()).queryByRole('button', { name: 'Check now' })).toBeNull()
    expect(within(status()).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(getRun(runRef)).toMatchObject({
      status: 'failed',
      finishedAt: checkedAt,
      errorMessage: 'The menu did not grow, so the import did not finish.'
    })
  })

  it('closes as failed a stored check that saw no growth, and writes it back', () => {
    clockAt(checkedAt, 60_000)
    saveRun(runRef, { ...baseRun, status: 'unknown', checkedAt, menuAfter: { categories: 3, products: 120 } })
    renderStatus()
    expect(status()).toHaveTextContent(`Failed ${timeOf(checkedAt)} — The menu did not grow, so the import did not finish.`)
    expect(getRun(runRef)).toMatchObject({ status: 'failed', finishedAt: checkedAt })
  })

  it('reports the current counts when there was no pre-import snapshot to compare with', async () => {
    clockAt(checkedAt)
    saveRun(runRef, { ...baseRun, status: 'unknown', menuBefore: null })
    menuSnapshotGet.mockResolvedValue(menuWith(36, 2))
    renderStatus()
    await check()
    expect(status()).toHaveTextContent(`The import may still be running — 2 categories, 36 products now. Checked ${timeOf(checkedAt)}`)
    expect(status()).toHaveAttribute('data-tone', 'warning')
  })

  it('does not persist a failed check and says the menu could not be read', async () => {
    saveRun(runRef, { ...baseRun, status: 'unknown' })
    menuSnapshotGet.mockRejectedValue(new Error('network'))
    renderStatus()
    await check()
    expect(status()).toHaveTextContent('Could not check the menu right now.')
    expect(getRun(runRef).checkedAt).toBeUndefined()
    expect(status()).toHaveTextContent(`Connection lost — the import may still be running. Started ${timeOf(startedAt)}`)
  })

  it('Dismiss clears the stored run and hides the line', () => {
    saveRun(runRef, { ...baseRun, status: 'unknown' })
    renderStatus()
    fireEvent.click(within(status()).getByRole('button', { name: 'Dismiss' }))
    expect(status()).toBeNull()
    expect(getRun(runRef)).toBeNull()
  })

  it('offers Dismiss on success and failed, never while importing', () => {
    clockAt(startedAt, 60_000)
    saveRun(runRef, baseRun)
    const first = renderStatus()
    expect(within(status()).queryByRole('button', { name: 'Dismiss' })).toBeNull()
    first.unmount()

    clockAt(finishedAt, 60_000)
    saveRun(runRef, { ...baseRun, status: 'success', finishedAt, menuAfter: { categories: 1, products: 1 } })
    const second = renderStatus()
    expect(within(status()).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
    second.unmount()

    saveRun(runRef, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    renderStatus()
    expect(within(status()).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('shows nothing while `hidden` (the dialog of this importer is open), and shows the run again when it closes', () => {
    saveRun(runRef, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    const { rerender } = renderStatus({ hidden: true })
    expect(status()).toBeNull()
    rerender(<ImporterRunStatus card={card} business={business} onRetry={onRetry} hidden={false} />)
    expect(status()).toHaveTextContent('Boom')
  })

  it('reads a run as nothing once it expired from its last activity, whatever its state', () => {
    clockAt(finishedAt, RUN_EXPIRES_AFTER_MS + 1)
    saveRun(runRef, { ...baseRun, status: 'success', finishedAt, menuAfter: { categories: 1, products: 1 } })
    const first = renderStatus()
    expect(status()).toBeNull()
    first.unmount()

    clockAt(checkedAt, RUN_EXPIRES_AFTER_MS + 1)
    saveRun(runRef, { ...baseRun, status: 'unknown', checkedAt, menuAfter: { categories: 3, products: 180 } })
    const second = renderStatus()
    expect(status()).toBeNull()
    second.unmount()

    clockAt(finishedAt, RUN_EXPIRES_AFTER_MS + 1)
    saveRun(runRef, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    const third = renderStatus()
    expect(status()).toBeNull()
    third.unmount()

    // an unchanged check inside the window stays visible, as failed
    clockAt(checkedAt, RUN_EXPIRES_AFTER_MS - 1)
    saveRun(runRef, { ...baseRun, status: 'unknown', checkedAt, menuAfter: { categories: 1, products: 120 } })
    renderStatus()
    expect(status()).toHaveTextContent('The menu did not grow, so the import did not finish.')
  })

  it('every action is a native button of type button', () => {
    saveRun(runRef, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    renderStatus()
    const buttons = within(status()).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['Retry', 'Dismiss'])
    for (const button of buttons) {
      expect(button.tagName).toBe('BUTTON')
      expect(button).toHaveAttribute('type', 'button')
    }
  })

  it('reads only the run of its own business and importer', () => {
    saveRun({ ...runRef, source: 'ubereats' }, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    saveRun({ ...runRef, businessId: 43 }, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    renderStatus()
    expect(status()).toBeNull()
  })
})
