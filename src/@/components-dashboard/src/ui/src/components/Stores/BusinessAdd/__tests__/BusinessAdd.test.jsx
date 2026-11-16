/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory } from 'react-router-dom'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign the store add page on Product. The controller is replaced by a stub that hands the page what the test
// sets; the groups owned by other files (Location, zone, images) are stubs that report their props.

const mockConfigs = vi.hoisted(() => ({ current: {} }))
const controller = vi.hoisted(() => ({ props: {}, seen: null }))
const zoneProps = vi.hoisted(() => ({ current: null }))
const locationProps = vi.hoisted(() => ({ current: null }))
const searchProps = vi.hoisted(() => ({ current: null }))
const emit = vi.hoisted(() => vi.fn())
const infoShare = vi.hoisted(() => ({ collapsed: false, handleMenuCollapse: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useEvent: () => [{ emit }],
  useConfig: () => [{ configs: mockConfigs.current }],
  BusinessAdd: ({ UIComponent, ...props }) => {
    controller.seen = props
    return <UIComponent {...props} {...controller.props} />
  }
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.collapsed }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))
vi.mock('../StoreAddLocation', () => ({ StoreAddLocation: (props) => { locationProps.current = props; return <section data-testid='location' /> } }))
vi.mock('../StoreAddGoogle', () => ({ StoreAddGoogle: (props) => { searchProps.current = props; return <section data-testid='google-search' /> } }))
vi.mock('../StoreAddZone', () => ({ StoreAddZone: (props) => { zoneProps.current = props; return <div data-testid='delivery-zone' data-allowed={String(!!props.deliveryAllowed)} /> } }))
vi.mock('../StoreAddImages', () => ({ StoreAddImages: () => <section data-testid='images' /> }))
vi.mock('../../../Shared/Product/ScheduleEditor', async (original) => ({ ...(await original()), ScheduleEditor: () => <div data-testid='schedule' /> }))

import { BusinessAdd } from '..'

const probe = { history: null }
const HistoryProbe = () => { probe.history = useHistory(); return null }

const base = (extra = {}) => ({
  form: { email: 'owner@example.com' },
  changeFields: vi.fn(),
  schedule: [],
  changeSchedule: vi.fn(),
  gallery: [],
  changeGallery: vi.fn(),
  paymethodsList: { loading: false, error: null, paymethods: [{ id: 1, gateway: 'cash', name: 'Cash' }, { id: 2, gateway: 'paypal', name: 'PayPal' }] },
  paymethodIds: [1],
  changePaymethodIds: vi.fn(),
  zone: null,
  changeZone: vi.fn(),
  cities: [],
  citiesLoading: false,
  cityId: null,
  changeCity: vi.fn(),
  problems: {},
  dirty: false,
  submitState: { status: 'editing', business: null, jobs: [], error: null },
  submit: vi.fn(async () => ({ ok: true })),
  retry: vi.fn(async () => ({ ok: true })),
  retryPaymethods: vi.fn(),
  ...extra
})

beforeEach(() => {
  infoShare.collapsed = false
  infoShare.handleMenuCollapse.mockReset()
  mockConfigs.current = {}
  controller.props = base()
  emit.mockReset()
})

describe('BusinessAdd page', () => {
  it('enables the delivery zone when delivery is an allowed order type', () => {
    mockConfigs.current = { order_types_allowed: { value: '1|2|3' } }
    renderWithProviders(<BusinessAdd />)
    expect(screen.getByTestId('delivery-zone')).toHaveAttribute('data-allowed', 'true')
  })

  it('disables the delivery zone when delivery is not an allowed order type', () => {
    mockConfigs.current = { order_types_allowed: { value: '2|3' } }
    renderWithProviders(<BusinessAdd />)
    expect(screen.getByTestId('delivery-zone')).toHaveAttribute('data-allowed', 'false')
  })

  it('disables the delivery zone when the order types config is missing', () => {
    renderWithProviders(<BusinessAdd />)
    expect(screen.getByTestId('delivery-zone')).toHaveAttribute('data-allowed', 'false')
  })

  it('draws the five groups in the onboarding order, with the payment methods as named checkboxes, the first chosen', () => {
    renderWithProviders(<BusinessAdd />)
    expect(screen.getByRole('heading', { level: 1, name: 'Add new store' })).toBeInTheDocument()
    const titles = screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)
    expect(titles.slice(0, 3)).toEqual(['Your store', 'Opening hours', 'Orders and payments'])
    expect(screen.getByTestId('location')).toBeInTheDocument()
    expect(screen.getByTestId('images')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Cash' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'PayPal' })).not.toBeChecked()
  })

  it('«Create store» with problems says them in their fields and focuses the first one (G5-20, SA-02)', async () => {
    controller.props = base({
      problems: { name: 'required', slug: 'required' },
      submit: vi.fn(async () => ({ ok: false, problems: { name: 'required', slug: 'required' } }))
    })
    renderWithProviders(<BusinessAdd />)
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Create store' })[0]) })
    expect(screen.getByText('Enter the store name')).toBeInTheDocument()
    expect(screen.getByText('Enter a slug')).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /Store name/ })))
  })

  it('a slug the API refuses is said at the slug field (G5-19)', () => {
    controller.props = base({
      form: { name: 'Pizza', slug: 'pizza', email: 'a@b.co' },
      submitState: { status: 'editing', business: null, jobs: [], error: { messages: ['The slug has already been taken.'] } }
    })
    renderWithProviders(<BusinessAdd />)
    expect(screen.getAllByText('The slug has already been taken.').length).toBeGreaterThan(0)
  })

  it('a store created with a write left over shows what failed and retries only that (SA-01, G5-23)', async () => {
    const retry = vi.fn(async () => ({ ok: true }))
    controller.props = base({
      retry,
      submitState: {
        status: 'partial',
        business: { id: 90, slug: 'pizza', name: 'Pizza' },
        jobs: [{ key: 'paymethod:1', kind: 'paymethod', id: 1, status: 'failed', error: null }, { key: 'zone', kind: 'zone', status: 'done' }],
        error: null
      },
      zone: { name: 'Downtown' }
    })
    renderWithProviders(<BusinessAdd />)
    expect(screen.getByRole('heading', { name: 'Pizza was created, but 1 thing needs another try' })).toBeInTheDocument()
    expect(screen.getByText(/Payment method «Cash»/)).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(retry).toHaveBeenCalledTimes(1)
  })

  // bugs E row 40a: after a network failure the retry adopts the store the first attempt created and applies the edits
  // made since then as a «details» write; when that write fails, its row says «Store details», not an empty delivery zone.
  it('names a failed «details» write «Store details»', () => {
    controller.props = base({
      submitState: {
        status: 'partial',
        business: { id: 90, slug: 'pizza', name: 'Pizza' },
        jobs: [{ key: 'details', kind: 'details', status: 'failed', error: null }],
        error: null
      }
    })
    renderWithProviders(<BusinessAdd />)
    expect(screen.getByText(/Store details/)).toBeInTheDocument()
    expect(screen.queryByText(/Delivery zone/)).toBeNull()
  })

  it('Cancel with changes asks before leaving (decision 4, G5-27); without changes it goes', async () => {
    controller.props = base({ dirty: true })
    renderWithProviders(<><BusinessAdd /><HistoryProbe /></>, { initialEntries: ['/stores/add'] })
    const history = probe.history
    act(() => { history.push('/stores/list') })
    expect(await screen.findByText('Leave without creating the store?')).toBeInTheDocument()
    expect(history.location.pathname).toBe('/stores/add')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Discard' })) })
    expect(history.location.pathname).toBe('/stores/list')
  })

  // main's Google business search on the redesigned add. Main's cases of its old form, on this page.
  // the field of the side form this page is replacing (PP-1)
  describe('Business description', () => {
    it('shows what the form holds and sends what is typed', () => {
      const changeFields = vi.fn()
      controller.props = base({ form: { email: 'owner@example.com', description: 'Slices' }, changeFields })
      renderWithProviders(<BusinessAdd />)
      const field = screen.getByRole('textbox', { name: 'Business description' })
      expect(field).toHaveValue('Slices')
      fireEvent.change(field, { target: { value: 'Slices and more' } })
      expect(changeFields).toHaveBeenCalledWith({ description: 'Slices and more' })
    })

    it('is locked with the rest of the form while the store is created', () => {
      controller.props = base({ submitState: { status: 'creating', business: null, jobs: [], error: null } })
      renderWithProviders(<BusinessAdd />)
      expect(screen.getByRole('textbox', { name: 'Business description' })).toBeDisabled()
    })
  })

  // «Add your first store» of the tutorial comes here and goes back to the list with the store
  describe('after creating, with the tutorial', () => {
    const lastController = () => controller.seen

    it('goes back to the list with the store when the list asked for it', () => {
      const { history } = renderWithProviders(<><HistoryProbe /><BusinessAdd continueTutorial /></>)
      expect(history === undefined || history).toBeTruthy()
      const created = { id: 9, slug: 'pizza' }
      act(() => { lastController().onCreated(created) })
      expect(probe.history.location.pathname).toBe('/stores/list')
      expect(probe.history.location.state).toEqual({ tutorialBusiness: created })
    })

    it('without the tutorial it stays main\'s: the Products of the new store', () => {
      renderWithProviders(<><HistoryProbe /><BusinessAdd /></>)
      expect(lastController().onCreated).toBeUndefined()
      act(() => { lastController().handleOpenCategory('pizza') })
      expect(probe.history.location.pathname).toBe('/stores/products/pizza')
    })

    it('«Continue» of a store with a write left over goes on with the tutorial too', async () => {
      controller.props = base({
        submitState: { status: 'partial', business: { id: 9, slug: 'pizza', name: 'Pizza' }, jobs: [{ key: 'zone', kind: 'zone', status: 'failed', error: null }], error: null },
        zone: { name: 'Downtown' }
      })
      renderWithProviders(<><HistoryProbe /><BusinessAdd continueTutorial /></>)
      await userEvent.setup().click(screen.getByRole('button', { name: /continue/i }))
      expect(probe.history.location.pathname).toBe('/stores/list')
      expect(probe.history.location.state.tutorialBusiness.id).toBe(9)
    })
  })

  describe('Google business search (main )', () => {
    it('is on the page for every project (no countries gate), with the page\'s values and defaults', () => {
      mockConfigs.current = { timezone: { value: 'America/Bogota' } }
      controller.props = base({ form: { email: 'owner@example.com', name: 'Mine' }, schedule: [{ enabled: true }] })
      renderWithProviders(<BusinessAdd />)
      expect(screen.getByTestId('google-search')).toBeInTheDocument()
      expect(searchProps.current.values).toEqual({ email: 'owner@example.com', name: 'Mine', schedule: [{ enabled: true }] })
      expect(searchProps.current.defaults.timezone).toBe('America/Bogota')
      expect(searchProps.current.defaults.schedule).toHaveLength(7)
      expect(searchProps.current.photoRoles).toEqual(['gallery', 'header', 'logo'])
      expect(searchProps.current.disabled).toBe(false)
    })

    it('loads the place from the URL', () => {
      renderWithProviders(<BusinessAdd placeId='place-2' />)
      expect(searchProps.current.initialPlaceId).toBe('place-2')
    })

    it('maps Google data to the add\'s fields', () => {
      renderWithProviders(<BusinessAdd />)
      expect(searchProps.current.getFields({
        name: 'Joe’s Pizza',
        phone: '+1 212',
        address: '7 Carmine St',
        location: { lat: 1, lng: 2 },
        zipcode: '10014',
        timezone: 'America/New_York',
        schedule: [{ enabled: false }],
        priceLevel: 2
      })).toEqual({
        name: { name: 'Joe’s Pizza', slug: 'joes_pizza' },
        phone: { cellphone: '+1 212' },
        address: { address: '7 Carmine St', location: { lat: 1, lng: 2, zipcode: '10014', zoom: 15 }, timezone: 'America/New_York' },
        schedule: { schedule: [{ enabled: false }] },
        priceLevel: { price_level: '2' }
      })
      expect(searchProps.current.getFields({ name: '', priceLevel: 0 })).toMatchObject({ name: { slug: '' }, priceLevel: { price_level: null } })
    })

    it('sends the hours to the schedule and the rest to the fields; an address redraws Location', () => {
      const changeSchedule = vi.fn()
      const changeFields = vi.fn()
      controller.props = base({ changeSchedule, changeFields })
      renderWithProviders(<BusinessAdd />)
      expect(locationProps.current.addressVersion).toBe(0)
      act(() => { searchProps.current.onChange({ schedule: [{ enabled: true }], name: 'Joe’s', address: '7 Carmine St' }) })
      expect(changeSchedule).toHaveBeenCalledWith([{ enabled: true }])
      expect(changeFields).toHaveBeenCalledWith({ name: 'Joe’s', address: '7 Carmine St' })
      expect(locationProps.current.addressVersion).toBe(1)
      changeFields.mockClear()
      act(() => { searchProps.current.onChange({ schedule: [{ enabled: false }] }) })
      expect(changeFields).not.toHaveBeenCalled()
      expect(locationProps.current.addressVersion).toBe(1)
    })

    it('adds chosen Google photos to the gallery, logo and header', () => {
      const changeGallery = vi.fn()
      const changeFields = vi.fn()
      controller.props = base({ changeGallery, changeFields })
      renderWithProviders(<BusinessAdd />)
      searchProps.current.onPhotos([
        { role: 'gallery', file: 'data:gallery' },
        { role: 'logo', file: 'data:logo' },
        { role: 'header', file: 'data:header' }
      ])
      const update = changeGallery.mock.calls[0][0]
      expect(update([{ temp_id: 'old', file: 'data:old' }])).toEqual([
        { temp_id: 'old', file: 'data:old' },
        { temp_id: expect.any(String), file: 'data:gallery' }
      ])
      expect(changeFields).toHaveBeenCalledWith({ logo: 'data:logo', header: 'data:header' })
    })

    it('is disabled while the store is being created', () => {
      controller.props = base({ submitState: { status: 'creating', business: null, jobs: [], error: null } })
      renderWithProviders(<BusinessAdd />)
      expect(searchProps.current.disabled).toBe(true)
    })
  })

  it('offers «Open menu» only with the sidebar collapsed (review 3)', () => {
    const { unmount } = renderWithProviders(<BusinessAdd />)
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    unmount()
    infoShare.collapsed = true
    renderWithProviders(<BusinessAdd />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('puts «Open menu» first in the lead block, before the back arrow and the title, and out of the actions', async () => {
    infoShare.collapsed = true
    const { container } = renderWithProviders(<BusinessAdd />)
    const opener = screen.getByRole('button', { name: 'Open menu' })
    const back = screen.getByRole('button', { name: 'Stores' })
    const lead = container.querySelector('.odc-pagehead-lead')
    expect(Array.from(lead.children).slice(0, 3)).toEqual([opener, back, screen.getByRole('heading', { level: 1, name: 'Add new store' })])
    expect(container.querySelector('.odc-pagehead-actions')?.contains(opener) ?? false).toBe(false)
    const user = userEvent.setup()
    await user.tab()
    expect(opener).toHaveFocus()
    await user.tab()
    expect(back).toHaveFocus()
  })

  it('keeps the «created, but…» panel while «Try again» runs, and drops the summary actions once the store exists (review 4, 6)', () => {
    const partial = {
      status: 'partial',
      business: { id: 90, slug: 'pizza', name: 'Pizza' },
      jobs: [{ key: 'paymethod:1', kind: 'paymethod', id: 1, status: 'failed', error: null }],
      error: null
    }
    controller.props = base({ submitState: partial })
    const { rerender } = renderWithProviders(<BusinessAdd />)
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    controller.props = base({ submitState: { ...partial, status: 'finishing', jobs: [{ ...partial.jobs[0], status: 'pending' }] } })
    rerender(<BusinessAdd />)
    expect(screen.getByRole('heading', { name: /Pizza was created/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
  })

  it('leaving while the store is being created asks too (review 5)', async () => {
    controller.props = base({ submitState: { status: 'finishing', business: { id: 1, slug: 'a' }, jobs: [], error: null } })
    renderWithProviders(<><BusinessAdd /><HistoryProbe /></>, { initialEntries: ['/stores/add'] })
    act(() => { probe.history.push('/stores/list') })
    expect(await screen.findByText('The store is being created. Leave anyway?')).toBeInTheDocument()
    expect(probe.history.location.pathname).toBe('/stores/add')
  })

  it('a typed address without a pin is not marked done in the summary (review 6)', () => {
    controller.props = base({ form: { email: 'a@b.co', address: '742 Evergreen Terrace' } })
    renderWithProviders(<BusinessAdd />)
    const row = screen.getByText('742 Evergreen Terrace').closest('li')
    expect(row).toHaveAttribute('data-state', 'note')
    expect(row).toHaveTextContent('No pin yet')
  })
})
