/* eslint-disable import/first */
// redesign cierre W0 (W0-PA4-01): with a project date format that has a word month (preset «DD MMM YYYY HH:mm») the typed
// fields of the range popover write and read the months with the Intl names of the user's language, the same as the pill,
// over the REAL UtilsProviders and the REAL catalog (whose MONTHn keys carry wrong machine translations: «Pue» for May in es).
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import catalog from '../../../../../../../../../../i18n/translations.json'

const lang = vi.hoisted(() => ({ configs: {}, code: 'en' }))
const translate = (key, text) => lang.catalog?.[key]?.[lang.code] || text

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: lang.code } }, translate],
  useConfig: () => [{ configs: lang.configs }]
}))
vi.mock('../../../../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: lang.configs }] }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ language: { code: lang.code } }, translate]
}))

import { DateTypeSelector } from '..'
import { UtilsProviders } from '../../../../../../contexts/UtilsContext'

const Harness = ({ initial, spies }) => {
  const [filterValues, setFilterValues] = useState({ dateType: 'term', ...initial })
  return (
    <UtilsProviders>
      <DateTypeSelector
        filterValues={filterValues}
        handleChangeDateType={(dateType) => setFilterValues({ ...filterValues, dateType })}
        handleChangeFromDate={(value) => { spies.from(value); setFilterValues(current => ({ ...current, deliveryFromDatetime: value })) }}
        handleChangeEndDate={(value) => { spies.end(value); setFilterValues(current => ({ ...current, deliveryEndDatetime: value })) }}
      />
    </UtilsProviders>
  )
}

beforeEach(() => {
  lang.catalog = catalog
  window.matchMedia = vi.fn((query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(() => {
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

// [language, May 1, May 5, Oct 1, Oct 5]
const CASES = [
  ['es', '01 may 2026', '05 may 2026', '01 oct 2026', '05 oct 2026'],
  ['fr', '01 mai 2026', '05 mai 2026', '01 oct. 2026', '05 oct. 2026'],
  ['nl', '01 mei 2026', '05 mei 2026', '01 okt 2026', '05 okt 2026'],
  ['de', '01 Mai 2026', '05 Mai 2026', '01 Okt 2026', '05 Okt 2026'],
  ['pt', '01 mai. 2026', '05 mai. 2026', '01 out. 2026', '05 out. 2026'],
  ['el', '01 Μαΐ 2026', '05 Μαΐ 2026', '01 Οκτ 2026', '05 Οκτ 2026'],
  ['en', '01 May 2026', '05 May 2026', '01 Oct 2026', '05 Oct 2026']
]

describe.each(CASES)('preset DD MMM YYYY HH:mm in %s', (code, may1, may5, oct1, oct5) => {
  beforeEach(() => {
    lang.code = code
    lang.configs = { dates_general_format: { value: 'DD MMM YYYY HH:mm' } }
  })

  it.each([['May', '2026-05-01 00:00:00', '2026-05-05 23:59:59', may1, may5], ['October', '2026-10-01 00:00:00', '2026-10-05 23:59:59', oct1, oct5]])(
    '%s: the fields say what the pill says, and the pill text can be typed back', async (_month, from, to, fromText, toText) => {
      const user = userEvent.setup()
      const spies = { from: vi.fn(), end: vi.fn() }
      render(<Harness initial={{ deliveryFromDatetime: from, deliveryEndDatetime: to }} spies={spies} />)
      const pill = screen.getAllByRole('button')[0]
      expect(pill.textContent).toBe(`${fromText} – ${toText}`)
      await user.click(pill)
      const dialog = await screen.findByRole('dialog')
      const [fromField, toField] = within(dialog).getAllByRole('textbox')
      expect(fromField).toHaveValue(fromText)
      expect(toField).toHaveValue(toText)
      // typing the visible text of the pill is accepted and sends the day
      await user.clear(fromField)
      spies.from.mockClear()
      await user.type(fromField, fromText)
      await waitFor(() => expect(spies.from).toHaveBeenCalledWith(from))
      expect(fromField).not.toHaveAttribute('aria-invalid', 'true')
    })

  it('rejects a month that is not a month of the language', async () => {
    const user = userEvent.setup()
    const spies = { from: vi.fn(), end: vi.fn() }
    render(<Harness initial={{ deliveryFromDatetime: '2026-05-01 00:00:00', deliveryEndDatetime: '2026-05-05 23:59:59' }} spies={spies} />)
    await user.click(screen.getAllByRole('button')[0])
    const dialog = await screen.findByRole('dialog')
    const fromField = within(dialog).getAllByRole('textbox')[0]
    await user.clear(fromField)
    spies.from.mockClear()
    await user.type(fromField, '01 Pue 2026')
    await user.tab()
    expect(spies.from).not.toHaveBeenCalled()
    expect(fromField).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('numeric project formats do not change', () => {
  it('DD/MM/YYYY in es still writes 01/05/2026', async () => {
    lang.code = 'es'
    lang.configs = { dates_general_format: { value: 'DD/MM/YYYY HH:mm' } }
    const user = userEvent.setup()
    render(<Harness initial={{ deliveryFromDatetime: '2026-05-01 00:00:00', deliveryEndDatetime: '2026-05-05 23:59:59' }} spies={{ from: vi.fn(), end: vi.fn() }} />)
    await user.click(screen.getAllByRole('button')[0])
    const dialog = await screen.findByRole('dialog')
    const [fromField, toField] = within(dialog).getAllByRole('textbox')
    expect(fromField).toHaveValue('01/05/2026')
    expect(toField).toHaveValue('05/05/2026')
  })
})
