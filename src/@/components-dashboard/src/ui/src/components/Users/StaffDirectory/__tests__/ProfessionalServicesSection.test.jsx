/* eslint-disable import/first */
// redesign (B1a): the Business & Services section of a professional's record. The UIComponent is mounted with the props
// K/ProfessionalBusinessService gives it (faked); the Product wrappers (SearchField, Pagination, Button, Avatar, EmptyState) are the
// real ones, and main's ProfessionalServices (the services of one store, its own controller) is a stub that records its props.
// NOTHING here reaches a server.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  controllerProps: null,
  services: null
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{ optimizeImage: (url) => `${url}?optimized` }],
  ProfessionalBusinessService: (props) => {
    mocks.controllerProps = props
    return <div data-testid='controller' />
  }
}))
vi.mock('../../ProfessionalServices', () => ({
  ProfessionalServices: (props) => {
    mocks.services = props
    return <div data-testid='professional-services' data-business={props.businessId} />
  }
}))

import { ProfessionalServicesSection, ProfessionalServicesSectionUI } from '../ProfessionalServicesSection'

const shops = [
  { id: 1, name: 'Shop A', logo: 'https://img.test/a.png' },
  { id: 2, name: 'Shop B', logo: null },
  { id: 3, name: 'Shop C' }
]
// Shop A has three services, Shop B one, Shop C none (and one belongs to a store that is not listed)
const services = [
  { id: 11, business_id: 1 },
  { id: 12, business_id: 1 },
  { id: 13, business_id: 1 },
  { id: 21, business_id: 2 },
  { id: 99, business_id: 77 }
]
const manyStores = (count) => Array.from({ length: count }, (_, index) => ({ id: index + 1, name: `Store ${String(index + 1).padStart(2, '0')}` }))

const baseProps = () => ({
  user: { id: 41, name: 'Dana' },
  searchValue: null,
  onSearch: vi.fn(),
  businessList: { loading: false, businesses: shops, result: { error: null } },
  userServiceList: { loading: false, services, result: { error: null } },
  handleUpdateServices: vi.fn(),
  handleRemoveBusinessServices: vi.fn(async () => ({ removed: 0, failed: 0 }))
})

const setup = (extra = {}) => {
  const props = { ...baseProps(), ...extra }
  const view = render(<ProfessionalServicesSectionUI {...props} />)
  return {
    props,
    ...view,
    update: (next) => view.rerender(<ProfessionalServicesSectionUI {...props} {...next} />)
  }
}

const row = (name) => screen.getByRole('button', { name: new RegExp(`^${name}\\b`) })
const searchBox = () => screen.getByRole('searchbox', { name: 'Search stores' })
const rows = () => within(screen.getByRole('list')).getAllByRole('button')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mocks.controllerProps = null
  mocks.services = null
})
beforeEach(() => {
  mocks.services = null
})

describe('the list of stores', () => {
  it('has one native button per store, with its name and its number of services', () => {
    setup()
    expect(rows()).toHaveLength(3)
    expect(row('Shop A')).toHaveAccessibleName('Shop A 3 services')
    expect(row('Shop B')).toHaveAccessibleName('Shop B 1 service')
    expect(row('Shop C')).toHaveAccessibleName('Shop C No services')
    expect(rows().every(button => button.tagName === 'BUTTON' && button.type === 'button')).toBe(true)
  })

  it('counts only the services of that store, never all of the professional\'s', () => {
    setup()
    const text = (name) => within(row(name)).getByText(/service/).textContent
    expect([text('Shop A'), text('Shop B'), text('Shop C')]).toEqual(['3 services', '1 service', 'No services'])
  })

  it('paints the logo as decoration (the name is next to it) and falls back to initials', () => {
    setup()
    const logo = row('Shop A').querySelector('img')
    expect(logo).toHaveAttribute('src', 'https://img.test/a.png?optimized')
    expect(logo).toHaveAttribute('alt', '')
    expect(row('Shop B').querySelector('img')).toBeNull()
    expect(row('Shop B').querySelector('.odc-avatar')).toHaveAttribute('aria-hidden', 'true')
  })

  it('has no checkboxes, no «Select all» or «Select none» and no notice about selecting a business', () => {
    setup()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByText(/select all/i)).toBeNull()
    expect(screen.queryByText(/select none/i)).toBeNull()
    expect(screen.queryByText('You need to select a business')).toBeNull()
  })

  it('the count follows the services the controller holds', () => {
    const { update } = setup()
    update({ userServiceList: { loading: false, services: [...services, { id: 14, business_id: 3 }], result: { error: null } } })
    expect(row('Shop C')).toHaveAccessibleName('Shop C 1 service')
  })

  it('does not say «No services» while the services are still loading', () => {
    setup({ userServiceList: { loading: true, services: [], result: { error: null } } })
    expect(rows()).toHaveLength(3)
    expect(screen.queryByText('No services')).toBeNull()
    expect(row('Shop A')).toHaveAccessibleName('Shop A')
  })

  it('shows skeletons in a busy status region while the stores load', () => {
    setup({ businessList: { loading: true, businesses: [], result: { error: null } } })
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(within(status).getByText('Loading')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('says so when no store matches', () => {
    const { update } = setup({ businessList: { loading: true, businesses: [], result: { error: null } } })
    update({ businessList: { loading: false, businesses: [], result: { error: null } } })
    expect(screen.getByText('No stores match this search')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('says it when the stores could not be loaded', () => {
    const { update } = setup({ businessList: { loading: true, businesses: [], result: { error: null } } })
    update({ businessList: { loading: false, businesses: [], error: ['Not allowed'] } })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the stores.")
    expect(screen.queryByText('No stores match this search')).toBeNull()
  })
})

describe('the search', () => {
  it('is named «Search stores» and sends the text to the controller on Enter', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    await user.type(searchBox(), 'shop b{Enter}')
    expect(props.onSearch).toHaveBeenCalledTimes(1)
    expect(props.onSearch).toHaveBeenCalledWith('shop b')
  })

  it('sends the text by itself after a short wait, once', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    await user.type(searchBox(), 'bar')
    expect(props.onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(props.onSearch).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(props.onSearch).toHaveBeenCalledWith('bar')
  })

  it('clearing the search sends an empty text at once', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    await user.type(searchBox(), 'bar{Enter}')
    props.onSearch.mockClear()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(props.onSearch).toHaveBeenCalledTimes(1)
    expect(props.onSearch).toHaveBeenCalledWith('')
    expect(searchBox()).toHaveValue('')
  })

  it('a new search goes back to the first page', async () => {
    const user = userEvent.setup()
    setup({ businessList: { loading: false, businesses: manyStores(25), result: { error: null } } })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(rows()[0]).toHaveAccessibleName(/^Store 11\b/)
    await user.type(searchBox(), 'x{Enter}')
    expect(rows()[0]).toHaveAccessibleName(/^Store 01\b/)
  })
})

describe('the pages', () => {
  const pagination = () => screen.getByRole('navigation', { name: 'Pagination' })

  it('shows ten stores at a time and says which', async () => {
    const user = userEvent.setup()
    setup({ businessList: { loading: false, businesses: manyStores(25), result: { error: null } } })
    expect(rows()).toHaveLength(10)
    expect(pagination().textContent).toContain('Showing 1–10 of 25')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(rows()).toHaveLength(10)
    expect(rows()[0]).toHaveAccessibleName(/^Store 11\b/)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(rows()).toHaveLength(5)
    expect(pagination().textContent).toContain('Showing 21–25 of 25')
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  // review r1 #3: main's list of stores offered 10 / 25 / 50 per page; the selector stays
  it('keeps main\'s rows-per-page selector (10, 25, 50)', async () => {
    const user = userEvent.setup()
    setup({ businessList: { loading: false, businesses: manyStores(30), result: { error: null } } })
    expect(screen.getByText('Items per page')).toBeInTheDocument()
    await user.click(within(pagination()).getByRole('button', { name: /10/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(rows()).toHaveLength(25)
  })
})

describe('the services of one store', () => {
  it('a click on a store opens its services inside the section, with its name and a way back', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    await user.click(row('Shop B'))
    expect(screen.getByTestId('professional-services')).toHaveAttribute('data-business', '2')
    expect(mocks.services.businessId).toBe(2)
    expect(mocks.services.services).toBe(props.userServiceList.services)
    expect(mocks.services.userId).toBe(41)
    expect(mocks.services.handleUpdateServices).toBe(props.handleUpdateServices)
    expect(screen.getByRole('heading', { level: 3, name: 'Shop B' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to stores' })).toBeInTheDocument()
    // the list and its search are not there while the services are
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the focus goes to the way back when the services open', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(row('Shop A'))
    expect(screen.getByRole('button', { name: 'Back to stores' })).toHaveFocus()
  })

  it('going back shows the list again with the focus on that store\'s button', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(row('Shop B'))
    await user.click(screen.getByRole('button', { name: 'Back to stores' }))
    expect(screen.queryByTestId('professional-services')).toBeNull()
    expect(rows()).toHaveLength(3)
    expect(row('Shop B')).toHaveFocus()
  })

  it('going back keeps the search and the page of the list', async () => {
    const user = userEvent.setup()
    setup({ businessList: { loading: false, businesses: manyStores(25), result: { error: null } } })
    await user.type(searchBox(), 'store{Enter}')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await user.click(rows()[2])
    await user.click(screen.getByRole('button', { name: 'Back to stores' }))
    expect(searchBox()).toHaveValue('store')
    expect(rows()[0]).toHaveAccessibleName(/^Store 11\b/)
    expect(rows()[2]).toHaveFocus()
    expect(screen.getByRole('navigation', { name: 'Pagination' }).textContent).toContain('Showing 11–20 of 25')
  })

  it('the number of services on the list is the one the controller holds after the services changed', async () => {
    const user = userEvent.setup()
    const { update } = setup()
    await user.click(row('Shop C'))
    update({ userServiceList: { loading: false, services: [...services, { id: 31, business_id: 3 }, { id: 32, business_id: 3 }], result: { error: null } } })
    await user.click(screen.getByRole('button', { name: 'Back to stores' }))
    expect(row('Shop C')).toHaveAccessibleName('Shop C 2 services')
  })
})

// apply-list row 22 (users-professionals P-1): «Remove from store» takes a professional out of one store in one go
describe('remove from store', () => {
  const removeButton = () => screen.queryByRole('button', { name: 'Remove from store' })
  const openDialog = async (user, name = 'Shop A') => {
    await user.click(row(name))
    await user.click(removeButton())
    return screen.findByRole('alertdialog')
  }

  it('is hidden when the professional has no service at the open store', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(row('Shop C'))
    expect(screen.getByRole('button', { name: 'Back to stores' })).toBeInTheDocument()
    expect(removeButton()).toBeNull()
  })

  it('is on the head of the open store when there is at least one service', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(row('Shop B'))
    expect(removeButton()).toBeInTheDocument()
    expect(removeButton().tagName).toBe('BUTTON')
    expect(removeButton().closest('.psv-detail-head')).not.toBeNull()
  })

  it('is not on the list of stores', () => {
    setup()
    expect(removeButton()).toBeNull()
  })

  it('asks first, saying who, from which store and how many services (many)', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    const dialog = await openDialog(user)
    expect(within(dialog).getByRole('heading', { name: 'Remove Dana from Shop A?' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('This removes 3 services from this professional at this store.')
    expect(within(dialog).getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(props.handleRemoveBusinessServices).not.toHaveBeenCalled()
  })

  it('says «1 service» when there is one', async () => {
    const user = userEvent.setup()
    setup()
    const dialog = await openDialog(user, 'Shop B')
    expect(dialog).toHaveTextContent('This removes 1 service from this professional at this store.')
  })

  it('Cancel closes the question and removes nothing', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(props.handleRemoveBusinessServices).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 3, name: 'Shop A' })).toBeInTheDocument()
  })

  it('Remove asks the controller once for that store; the confirm is busy meanwhile and cannot be sent twice', async () => {
    const user = userEvent.setup()
    let finish
    const handleRemoveBusinessServices = vi.fn(() => new Promise(resolve => { finish = resolve }))
    setup({ handleRemoveBusinessServices })
    const dialog = await openDialog(user)
    const confirm = within(dialog).getByRole('button', { name: 'Remove' })
    await user.click(confirm)
    await user.click(confirm)
    expect(handleRemoveBusinessServices).toHaveBeenCalledTimes(1)
    expect(handleRemoveBusinessServices).toHaveBeenCalledWith(1)
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    finish({ removed: 3, failed: 0 })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('after everything was removed it goes back to the stores with the focus on that store\'s button', async () => {
    const user = userEvent.setup()
    const handleRemoveBusinessServices = vi.fn(async () => ({ removed: 3, failed: 0 }))
    setup({ handleRemoveBusinessServices })
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(rows()).toHaveLength(3))
    expect(screen.queryByTestId('professional-services')).toBeNull()
    await waitFor(() => expect(row('Shop A')).toHaveFocus())
  })

  it('when some could not be removed it stays on the store, with the question closed and the button for what is left', async () => {
    const user = userEvent.setup()
    const handleRemoveBusinessServices = vi.fn(async () => ({ removed: 2, failed: 1 }))
    const { update } = setup({ handleRemoveBusinessServices })
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    // the controller keeps the failed one in the list
    update({ userServiceList: { loading: false, services: services.filter(service => service.id !== 11 && service.id !== 12), result: { error: null } } })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('heading', { level: 3, name: 'Shop A' })).toBeInTheDocument()
    expect(screen.getByTestId('professional-services')).toBeInTheDocument()
    expect(removeButton()).toBeInTheDocument()
    await user.click(removeButton())
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('This removes 1 service from this professional at this store.')
  })
})

describe('ProfessionalServicesSection', () => {
  it('mounts the controller as main did (name search, three fields), with this UI and the professional', () => {
    const user = { id: 41, name: 'Dana' }
    render(<ProfessionalServicesSection user={user} />)
    expect(screen.getByTestId('controller')).toBeInTheDocument()
    expect(mocks.controllerProps.UIComponent).toBe(ProfessionalServicesSectionUI)
    expect(mocks.controllerProps.propsToFetch).toEqual(['id', 'name', 'logo'])
    expect(mocks.controllerProps.isSearchByName).toBe(true)
    expect(mocks.controllerProps.user).toBe(user)
  })
})

describe('the styles', () => {
  // the rules, not the comments (a comment may name the value it explains)
  const css = readFileSync(resolve(__dirname, '../professional-services.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  it('only take colors and sizes from the tokens', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\brgba?\(/)
    // the breakpoint of a media query is the one literal the guard allows
    expect(css.replace(/@media[^{]*/g, '')).not.toMatch(/:\s*-?\d*\.?\d+(px|rem|em)\b/)
  })

  it('use logical properties only', () => {
    expect(css).not.toMatch(/\b(margin|padding)-(left|right|top|bottom)\b/)
    expect(css).not.toMatch(/(^|[\s{;])(left|right|width|height)\s*:/)
  })

  it('give each store row the touch area of a phone and a visible focus', () => {
    expect(css).toMatch(/max-width: 767px/)
    expect(css).toMatch(/var\(--od-x-target-coarse\)/)
    expect(css).toMatch(/\.psv-row:focus-visible/)
    expect(css).toMatch(/var\(--od-focus-ring-width\)/)
  })
})
