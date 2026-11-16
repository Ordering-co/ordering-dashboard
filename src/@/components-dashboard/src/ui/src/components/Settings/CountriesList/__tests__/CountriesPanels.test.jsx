import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'

// The country list and its panel, the way the Settings hub mounts them (category=places). The shell parts that have nothing to do
// with the panel (SideBar, Pagination, dialogs) are stand-ins; the panel, the list and the form are the real ones.
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

vi.mock('../../../Shared', () => ({
  Pagination: () => null,
  Confirm: () => null,
  Alert: () => null,
  SideBar: ({ open, onClose, children }) => {
    React.useEffect(() => {
      const onKey = event => { if (event.code === 'Escape') onClose() }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }, [onClose])
    return open ? <aside data-testid='panel'>{children}</aside> : null
  }
}))

import { CountriesList } from '../index'
import { CountryDetails } from '../../CountryDetails'

const countries = () => [
  { id: 1, name: 'Spain', code: 'ES', enabled: true, cities: [] },
  { id: 2, name: 'Mexico', code: 'MX', enabled: false, cities: [] }
]

const Harness = ({ list = countries(), actionState = { loading: false, error: null } }) => {
  const [state, setState] = useState({ countries: list, loading: false, error: null })
  const [selected, setSelected] = useState([])
  return (
    <CountriesList
      actionState={actionState}
      countriesState={state}
      handleUpdateCountry={vi.fn()}
      handleAddCountry={(values) => setState(prev => ({ ...prev, countries: [...prev.countries, { id: 3, enabled: true, cities: [], ...values }] }))}
      handleDeleteCountry={vi.fn()}
      selectedCountries={selected}
      setSelectedCountries={setSelected}
    />
  )
}

const rowOf = (name) => screen.getByText(name).closest('[data-country-row]') || screen.getByText(name).parentElement.parentElement

describe('CountriesList and its panel: focus', () => {
  it('moves the focus into the panel when «Add new country» opens it, and gives it back on Esc', async () => {
    renderWithProviders(<Harness />, { initialEntries: ['/settings?group=locations&category=places'] })
    const opener = screen.getByRole('button', { name: 'Add new country' })
    opener.focus()
    fireEvent.click(opener)

    const title = await screen.findByRole('heading', { name: 'Add new country' })
    await waitFor(() => expect(title).toHaveFocus())

    fireEvent.keyDown(document, { code: 'Escape' })
    expect(screen.queryByTestId('panel')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add new country' })).toHaveFocus())
  })

  it('moves the focus into the panel of a country and brings it back to that country\'s row on Esc', async () => {
    renderWithProviders(<Harness />, { initialEntries: ['/settings?group=locations&category=places'] })
    const row = rowOf('Mexico')
    fireEvent.click(screen.getByText('Mexico'))

    const title = await screen.findByRole('heading', { name: 'Country settings' })
    await waitFor(() => expect(title).toHaveFocus())

    fireEvent.keyDown(document, { code: 'Escape' })
    expect(screen.queryByTestId('panel')).toBeNull()
    await waitFor(() => expect(row).toHaveFocus())
  })

  it('does not take the focus from a control the user went to by closing the panel', async () => {
    renderWithProviders(
      <div>
        <button type='button'>Elsewhere</button>
        <Harness />
      </div>,
      { initialEntries: ['/settings?group=locations&category=places'] }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add new country' }))
    await screen.findByRole('heading', { name: 'Add new country' })
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    elsewhere.focus()
    fireEvent.keyDown(document, { code: 'Escape' })
    expect(elsewhere).toHaveFocus()
  })
})

describe('CountryDetails and the hub guard', () => {
  const renderPanel = (props = {}) => {
    const report = vi.fn()
    const country = { id: 1, name: 'Spain', code: 'ES', enabled: true }
    const view = renderWithProviders(
      <SettingsHubFormContext.Provider value={{ product: true, report }}>
        <CountryDetails country={country} handleUpdateCountry={vi.fn()} handleAddCountry={vi.fn()} {...props} />
      </SettingsHubFormContext.Provider>
    )
    return { ...view, report, country }
  }
  const lastReport = (report) => report.mock.calls.filter(([key]) => key === 'places:country').at(-1)
  const nameInput = () => document.querySelector('input[name="name"]')

  it('reports dirty when the name differs from the saved one, and clean when it goes back', async () => {
    const { report } = renderPanel()
    expect(lastReport(report)).toEqual(['places:country', { dirty: false, saving: false }])

    await act(async () => { fireEvent.input(nameInput(), { target: { value: 'Espana' } }) })
    expect(lastReport(report)).toEqual(['places:country', { dirty: true, saving: false }])

    await act(async () => { fireEvent.input(nameInput(), { target: { value: 'Spain' } }) })
    expect(lastReport(report)).toEqual(['places:country', { dirty: false, saving: false }])
  })

  it('reports dirty when the code changes', async () => {
    const { report } = renderPanel()
    const code = Array.from(document.querySelectorAll('input')).find(input => input.value === 'ES')
    await act(async () => { fireEvent.change(code, { target: { value: 'pt' } }) })
    expect(lastReport(report)[1].dirty).toBe(true)
  })

  it('goes back to clean when the saved country now carries the typed value', async () => {
    const { report, rerender, country } = renderPanel()
    await act(async () => { fireEvent.input(nameInput(), { target: { value: 'Espana' } }) })
    expect(lastReport(report)[1].dirty).toBe(true)

    rerender(
      <SettingsHubFormContext.Provider value={{ product: true, report }}>
        <CountryDetails country={{ ...country, name: 'Espana' }} handleUpdateCountry={vi.fn()} handleAddCountry={vi.fn()} />
      </SettingsHubFormContext.Provider>
    )
    expect(lastReport(report)).toEqual(['places:country', { dirty: false, saving: false }])
  })

  it('a new country is dirty once something is typed, and the report goes away with the panel', async () => {
    const { report, unmount } = renderPanel({ country: null })
    expect(lastReport(report)[1].dirty).toBe(false)
    await act(async () => { fireEvent.input(nameInput(), { target: { value: 'Peru' } }) })
    expect(lastReport(report)[1].dirty).toBe(true)

    unmount()
    expect(lastReport(report)).toEqual(['places:country', null])
  })

  it('works without the hub', () => {
    renderWithProviders(<CountryDetails country={null} handleUpdateCountry={vi.fn()} handleAddCountry={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Add new country' })).toBeInTheDocument()
  })
})
