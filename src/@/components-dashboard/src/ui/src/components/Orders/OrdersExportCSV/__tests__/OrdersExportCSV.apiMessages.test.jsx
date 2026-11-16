/* eslint-disable import/first */
// redesign W0-2 r2 (W0-P1-05, W0-P1-04): the messages of «Export failed». The two report keys have the text main
// gave them when the project has no translation; what `actionStatus.error` holds that is not text never reaches React.
import React from 'react'
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ actionStatus: { loading: false, error: null, result: null }, dictionary: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => runtime.dictionary[key] ?? fallback],
  ExportCSV: ({ UIComponent, ...props }) => <UIComponent {...props} actionStatus={runtime.actionStatus} getCSV={vi.fn()} />
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280 }) }))

import { OrdersExportCSV } from '..'

const mount = () => renderWithProviders(<OrdersExportCSV filterValues={{ statuses: [] }} selectedSubOrderStatus={{}} />)
const failedDialog = async () => within(await screen.findByRole('alertdialog', { name: 'Export failed' }))

beforeEach(() => { runtime.actionStatus = { loading: false, error: null, result: null }; runtime.dictionary = {} })
afterEach(() => document.getElementById('app-modals')?.remove())

describe('OrdersExportCSV · messages of the failed export', () => {
  it.each([
    ['ERROR_REPORT_VERY_LONG_PERIOD', 'Error report, very long period'],
    ['ERROR_REPORT_MAX_A_DAY_AS_PERIOD', 'Error report, max a day as period']
  ])('%s without a translation shows the text of the table, not the raw key (W0-P1-05)', async (key, text) => {
    runtime.actionStatus = { loading: false, error: [key], result: null }
    mount()
    const dialog = await failedDialog()
    expect(dialog.getByText(text)).toBeInTheDocument()
    expect(dialog.queryByText(key)).not.toBeInTheDocument()
  })

  it('a translation of the project wins over the table', async () => {
    runtime.dictionary = { ERROR_REPORT_VERY_LONG_PERIOD: 'Periodo demasiado largo' }
    runtime.actionStatus = { loading: false, error: ['ERROR_REPORT_VERY_LONG_PERIOD'], result: null }
    mount()
    const dialog = await failedDialog()
    expect(dialog.getByText('Periodo demasiado largo')).toBeInTheDocument()
    expect(dialog.queryByText('Error report, very long period')).not.toBeInTheDocument()
  })

  it('any other message is told as it came', async () => {
    runtime.actionStatus = { loading: false, error: ['Export is not available'], result: null }
    mount()
    expect((await failedDialog()).getByText('Export is not available')).toBeInTheDocument()
  })

  it('what is not text does not throw and says nothing: objects without a message, a message that is an object (W0-P1-04)', async () => {
    runtime.actionStatus = { loading: false, error: [{ code: 500 }, { message: { deep: 'x' } }, {}, [], null, 'Export is not available'], result: null }
    mount()
    const dialog = await failedDialog()
    expect(dialog.getByText('Export is not available')).toBeInTheDocument()
    expect(document.querySelectorAll('.odc-export-messages p')).toHaveLength(1)
  })

  // (bugs H, 24a): a bare «429» said nothing; an HTTP code is told in one sentence.
  it('a number is told in one sentence, not as a bare code', async () => {
    runtime.actionStatus = { loading: false, error: [{ message: 429 }, 500], result: null }
    mount()
    const dialog = await failedDialog()
    expect(dialog.getByText('Could not export (error 429)')).toBeInTheDocument()
    expect(dialog.getByText('Could not export (error 500)')).toBeInTheDocument()
    expect(dialog.queryByText('429')).not.toBeInTheDocument()
    expect(dialog.queryByText('500')).not.toBeInTheDocument()
  })

  it('a code as text ("404") is told the same way', async () => {
    runtime.actionStatus = { loading: false, error: ['404'], result: null }
    mount()
    expect((await failedDialog()).getByText('Could not export (error 404)')).toBeInTheDocument()
  })

  it('the sentence comes from EXPORT_FAILED_CODE with the code in place of _code_', async () => {
    runtime.dictionary = { EXPORT_FAILED_CODE: 'No se pudo exportar (error _code_)' }
    runtime.actionStatus = { loading: false, error: [429], result: null }
    mount()
    expect((await failedDialog()).getByText('No se pudo exportar (error 429)')).toBeInTheDocument()
  })

  it('text that only contains digits among words stays as it came', async () => {
    runtime.actionStatus = { loading: false, error: ['Error 429 from the server'], result: null }
    mount()
    expect((await failedDialog()).getByText('Error 429 from the server')).toBeInTheDocument()
  })

  it('a lone error that is an object with a message still shows it', async () => {
    runtime.actionStatus = { loading: false, error: { message: 'Failed to fetch' }, result: null }
    mount()
    expect((await failedDialog()).getByText('Failed to fetch')).toBeInTheDocument()
  })
})
