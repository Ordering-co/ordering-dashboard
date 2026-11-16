/* eslint-disable import/first */
// main's GoogleBusinessSearch cases (Stores/GoogleBusinessSearch/index.test.jsx, ) on its Product face for the
// add, StoreAddGoogle, with main's controller behind it. The checkboxes are Product's (role checkbox, named by their text).
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import theme from '~/theme.json'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockConfigs = { current: {} }
const mockPlaces = vi.hoisted(() => ({
  fetchGoogleBusiness: vi.fn(),
  fetchGoogleAddress: vi.fn(),
  searchNearbyBusinesses: vi.fn()
}))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mockConfigs.current }]
}))

vi.mock('../../../../../../components/GoogleAutocompleteInput/placesApi', () => ({
  ...mockPlaces,
  LEGACY_BUSINESS_FIELDS: ['place_id']
}))

vi.mock('../../../../../../index', async () => {
  const { GoogleBusinessSearch } = await import('../../../../../../components/GoogleBusinessSearch')
  return {
    useLanguage: () => [null, (_key, fallback) => fallback],
    useConfig: () => [{ configs: mockConfigs.current }],
    GoogleAutocompleteInput: ({ onSelectPlace, placeholder, childRef }) => (
      <div>
        <input aria-label={placeholder} ref={childRef} />
        <button type='button' onClick={() => onSelectPlace({ placeId: 'biz-1', types: ['restaurant', 'establishment'] })}>pick business</button>
        <button type='button' onClick={() => onSelectPlace({ placeId: 'addr-1', types: ['street_address'] })}>pick address</button>
      </div>
    ),
    GoogleBusinessSearch
  }
})

import { StoreAddGoogle } from '../StoreAddGoogle'

const lapses = [{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }]
const business = {
  placeId: 'biz-1',
  name: 'Joe’s Pizza',
  phone: '+1 212-366-1182',
  address: '7 Carmine St, New York',
  location: { lat: 40.73, lng: -74 },
  zipcode: '10014',
  schedule: Array.from({ length: 7 }, () => ({ enabled: true, lapses })),
  website: 'https://joespizzanyc.com/',
  mapsUrl: 'https://maps.google.com/?cid=1',
  category: 'Pizza restaurant',
  status: 'CLOSED_PERMANENTLY',
  canCopyPhotos: true,
  photos: [
    { id: 'photo-0', thumbnailUrl: 'https://thumb/0', url: 'https://full/0', logoUrl: 'https://logo/0', attributions: [{ name: 'Ana', uri: 'https://contrib/ana' }] },
    { id: 'photo-1', thumbnailUrl: 'https://thumb/1', url: 'https://full/1', logoUrl: 'https://logo/1', attributions: [] }
  ]
}

const getFields = place => ({
  name: { name: place.name },
  phone: { phone: place.phone },
  address: { address: place.address, location: place.location, timezone: place.timezone },
  schedule: { schedule: place.schedule }
})

const renderSearch = (props = {}) => renderWithProviders(
  <StoreAddGoogle getFields={getFields} onChange={vi.fn()} onAppliedChange={vi.fn()} {...props} />,
  { theme }
)

describe('StoreAddGoogle (main\'s GoogleBusinessSearch on Product)', () => {
  beforeEach(() => {
    mockConfigs.current = { google_maps_api_key: { value: 'key' } }
    Object.values(mockPlaces).forEach(mock => mock.mockReset())
    global.fetch = vi.fn(async (url) => {
      if (`${url}`.includes('/timezone/')) return { ok: true, json: async () => ({ timeZoneId: 'America/New_York' }) }
      return { ok: true, blob: async () => new Blob(['image'], { type: 'image/jpeg' }) }
    })
  })

  afterEach(cleanup)

  it('renders nothing when the project has no Google Maps key', () => {
    mockConfigs.current = {}
    const { container } = renderSearch()

    expect(container).toBeEmptyDOMElement()
  })

  it('is a named group with the search field, labelled and with its help', () => {
    renderSearch()

    expect(screen.getByRole('region', { name: /Find your business on Google/ })).toBeInTheDocument()
    expect(screen.getByText('Search by business name or address. You can review and edit everything before saving.')).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()
  })

  it('offers each photo for the gallery, the header or the logo when the add takes the three', async () => {
    renderSearch({ initialBusiness: business, photoRoles: ['gallery', 'header', 'logo'] })

    expect(await screen.findByText('Photos from Google')).toBeInTheDocument()
    expect(screen.getAllByText('Do not use')).toHaveLength(2)
    expect(screen.queryByRole('checkbox', { name: 'Business logo' })).toBeNull()
  })

  it('asks to confirm the business before filling the form, then fills empty fields and suggests the rest', async () => {
    mockPlaces.fetchGoogleBusiness.mockResolvedValue(business)
    const onChange = vi.fn()
    const onAppliedChange = vi.fn()
    renderSearch({ values: { name: 'Joe Pizza', phone: '' }, onChange, onAppliedChange })

    fireEvent.click(screen.getByText('pick business'))

    expect(await screen.findByText('Is this your business?')).toBeInTheDocument()
    expect(screen.getByText('Pizza restaurant')).toBeInTheDocument()
    expect(screen.getByText('https://joespizzanyc.com/')).toHaveAttribute('href', 'https://joespizzanyc.com/')
    expect(screen.getByText('Google lists this business as permanently closed.')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Yes, use this data'))

    expect(await screen.findByText('Using data from Google')).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith({
      phone: '+1 212-366-1182',
      address: '7 Carmine St, New York',
      location: { lat: 40.73, lng: -74 },
      timezone: 'America/New_York',
      schedule: business.schedule
    })
    expect(onAppliedChange).toHaveBeenCalledWith(expect.not.objectContaining({ name: expect.anything() }))

    expect(screen.getByText(/Google suggests: Joe’s Pizza/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Use'))

    expect(onChange).toHaveBeenLastCalledWith({ name: 'Joe’s Pizza' })
    expect(screen.queryByText(/Google suggests/)).not.toBeInTheDocument()
  })

  // review: each step replaces the one that had the focus
  it('takes the focus to each new step once the person works in the search, and back to the search on «No»', async () => {
    mockPlaces.fetchGoogleBusiness.mockResolvedValue(business)
    renderSearch()

    const pick = screen.getByText('pick business')
    pick.focus()
    fireEvent.click(pick)

    const title = await screen.findByRole('heading', { name: 'Is this your business?' })
    await waitFor(() => expect(title).toHaveFocus())
    fireEvent.click(screen.getByText('No, search another'))
    await waitFor(() => expect(screen.getByLabelText('Business name or address')).toHaveFocus())
  })

  it('leaves the focus alone when a business arrives already confirmed', async () => {
    renderSearch({ initialBusiness: business })

    await screen.findByRole('heading', { name: 'Using data from Google' })
    expect(document.body).toHaveFocus()
  })

  // main (ba9758f9d, R2): the photo thumbnails send the site origin, so referrer-restricted keys accept them
  it('sends the site origin as referrer for Google photos so referrer-restricted keys accept them', async () => {
    mockPlaces.fetchGoogleBusiness.mockResolvedValue(business)
    const { container } = renderSearch({ photoRoles: ['logo'] })

    fireEvent.click(screen.getByText('pick business'))
    await screen.findByText('Is this your business?')
    expect(container.querySelector('img[src="https://thumb/0"]')).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')

    fireEvent.click(screen.getByText('Yes, use this data'))
    await screen.findByText('Photos from Google')
    const thumbnails = [...container.querySelectorAll('img')].filter(img => img.getAttribute('src')?.startsWith('https://thumb/'))
    expect(thumbnails).toHaveLength(2)
    thumbnails.forEach(img => expect(img).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin'))
  })

  it('goes back to the search when the user rejects the business', async () => {
    mockPlaces.fetchGoogleBusiness.mockResolvedValue(business)
    const onChange = vi.fn()
    renderSearch({ onChange })

    fireEvent.click(screen.getByText('pick business'))
    fireEvent.click(await screen.findByText('No, search another'))

    expect(screen.queryByText('Is this your business?')).not.toBeInTheDocument()
    expect(screen.getByText('pick business')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('lists the businesses at a chosen address instead of using the address as a business', async () => {
    mockPlaces.fetchGoogleAddress.mockResolvedValue({ address: '7 Carmine St', location: { lat: 1, lng: 2 } })
    mockPlaces.searchNearbyBusinesses.mockResolvedValue([{ placeId: 'biz-1', name: 'Joe’s Pizza', address: '7 Carmine St', category: 'Pizza restaurant' }])
    mockPlaces.fetchGoogleBusiness.mockResolvedValue(business)
    renderSearch()

    fireEvent.click(screen.getByText('pick address'))

    expect(await screen.findByText('Businesses at this address')).toBeInTheDocument()
    expect(mockPlaces.searchNearbyBusinesses).toHaveBeenCalledWith({ lat: 1, lng: 2 })

    fireEvent.click(screen.getByText('Joe’s Pizza'))

    expect(await screen.findByText('Is this your business?')).toBeInTheDocument()
    expect(mockPlaces.fetchGoogleBusiness).toHaveBeenCalledWith({ placeId: 'biz-1' })
  })

  it('tells the user when no business was found at the address', async () => {
    mockPlaces.fetchGoogleAddress.mockResolvedValue({ address: 'Empty lot', location: { lat: 1, lng: 2 } })
    mockPlaces.searchNearbyBusinesses.mockResolvedValue([])
    renderSearch()

    fireEvent.click(screen.getByText('pick address'))

    expect(await screen.findByText(/We did not find businesses at this address/)).toBeInTheDocument()
  })

  it('keeps the form untouched when Google fails and lets the user retry', async () => {
    mockPlaces.fetchGoogleBusiness.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce(business)
    const onChange = vi.fn()
    renderSearch({ onChange })

    fireEvent.click(screen.getByText('pick business'))

    expect(await screen.findByRole('alert')).toHaveTextContent('What you already entered was kept')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Retry'))

    expect(await screen.findByText('Is this your business?')).toBeInTheDocument()
  })

  // the list's and the catalog's modal is gone, so searching here is how a business reaches the add. It fills every
  // group of `getFields`, the page's mapping (BusinessAdd.test.jsx), where the modal's business used to arrive.
  it('a business searched and confirmed here fills the same groups the modal\'s business filled', async () => {
    mockPlaces.fetchGoogleBusiness.mockResolvedValue(business)
    const onChange = vi.fn()
    const direct = vi.fn()
    const { unmount } = renderSearch({ initialBusiness: business, onChange: direct })
    await waitFor(() => expect(direct).toHaveBeenCalled())
    unmount()

    renderSearch({ onChange })
    fireEvent.click(screen.getByText('pick business'))
    fireEvent.click(await screen.findByText('Yes, use this data'))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0]).toEqual(direct.mock.calls[0][0])
  })

  it('applies a business confirmed elsewhere as soon as it mounts', async () => {
    const onChange = vi.fn()
    renderSearch({ initialBusiness: business, onChange })

    expect(await screen.findByText('Using data from Google')).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'Joe’s Pizza' }))
    expect(mockPlaces.fetchGoogleBusiness).not.toHaveBeenCalled()
  })

  it('loads and applies the place from a deep link', async () => {
    mockPlaces.fetchGoogleBusiness.mockResolvedValue(business)
    const onChange = vi.fn()
    renderSearch({ initialPlaceId: 'biz-1', onChange })

    expect(await screen.findByText('Using data from Google')).toBeInTheDocument()
    expect(mockPlaces.fetchGoogleBusiness).toHaveBeenCalledWith({ placeId: 'biz-1' })
  })

  it('copies only the chosen photos, with credits shown, after the user confirms the rights', async () => {
    const onPhotos = vi.fn()
    renderSearch({ initialBusiness: business, photoRoles: ['logo'], onPhotos })

    expect(await screen.findByText('Photos from Google')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toHaveAttribute('href', 'https://contrib/ana')

    const [firstLogo, secondLogo] = screen.getAllByRole('checkbox', { name: 'Business logo' })
    fireEvent.click(firstLogo)
    fireEvent.click(secondLogo)
    expect(firstLogo).not.toBeChecked()
    expect(secondLogo).toBeChecked()

    const useButton = screen.getByRole('button', { name: 'Use selected photos (1)' })
    expect(useButton).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: /I confirm these photos belong to my business/ }))
    fireEvent.click(useButton)

    await waitFor(() => expect(onPhotos).toHaveBeenCalledWith([{ role: 'logo', file: expect.stringMatching(/^data:image\/jpeg;base64,/) }]))
    expect(global.fetch).toHaveBeenCalledWith('https://logo/1')
    expect(await screen.findByText('Photos added: 1')).toBeInTheDocument()
  })

  it('does not offer to copy photos that the legacy Places service cannot download', async () => {
    renderSearch({ initialBusiness: { ...business, canCopyPhotos: false }, photoRoles: ['logo'] })

    expect(await screen.findByText(/Photos from Google are not available for this project/)).toBeInTheDocument()
    expect(screen.queryByText('Photos from Google')).not.toBeInTheDocument()
  })

  it('falls back to the project timezone when Google cannot resolve it', async () => {
    mockConfigs.current = { google_maps_api_key: { value: 'key' }, timezone: { value: 'Africa/Johannesburg' } }
    global.fetch = vi.fn(async () => { throw new Error('Failed to fetch') })
    const onChange = vi.fn()
    renderSearch({ initialBusiness: business, onChange })

    expect(await screen.findByText('Using data from Google')).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'Africa/Johannesburg' }))
  })

  it('uses the previous default timezone when the project has none configured', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'REQUEST_DENIED' }) }))
    const onChange = vi.fn()
    renderSearch({ initialBusiness: business, values: { timezone: '' }, onChange })

    expect(await screen.findByText('Using data from Google')).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'America/New_York' }))
  })

  it('drops photos still downloading when the user switches to another business', async () => {
    let finishDownload
    global.fetch = vi.fn((url) => {
      if (`${url}`.includes('/timezone/')) return Promise.resolve({ ok: true, json: async () => ({ timeZoneId: 'America/New_York' }) })
      return new Promise(resolve => { finishDownload = () => resolve({ ok: true, blob: async () => new Blob(['image'], { type: 'image/jpeg' }) }) })
    })
    const onPhotos = vi.fn()
    renderSearch({ initialBusiness: business, photoRoles: ['logo'], onPhotos })

    fireEvent.click((await screen.findAllByRole('checkbox', { name: 'Business logo' }))[0])
    fireEvent.click(screen.getByRole('checkbox', { name: /I confirm these photos belong to my business/ }))
    fireEvent.click(screen.getByText('Use selected photos (1)'))
    await waitFor(() => expect(finishDownload).toBeDefined())

    fireEvent.click(screen.getByText('Change business'))
    finishDownload()

    await waitFor(() => expect(screen.getByText('pick business')).toBeInTheDocument())
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(onPhotos).not.toHaveBeenCalled()
  })

  it('reports photos that could not be copied', async () => {
    global.fetch = vi.fn(async (url) => {
      if (`${url}`.includes('/timezone/')) return { ok: true, json: async () => ({}) }
      return { ok: false, status: 403 }
    })
    const onPhotos = vi.fn()
    renderSearch({ initialBusiness: business, photoRoles: ['logo'], onPhotos })

    fireEvent.click((await screen.findAllByRole('checkbox', { name: 'Business logo' }))[0])
    fireEvent.click(screen.getByRole('checkbox', { name: /I confirm these photos belong to my business/ }))
    fireEvent.click(screen.getByText('Use selected photos (1)'))

    expect(await screen.findByText(/We could not copy 1 photo/)).toBeInTheDocument()
    expect(onPhotos).not.toHaveBeenCalled()
  })
})
