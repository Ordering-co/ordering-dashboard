/* eslint-disable import/first */
// redesign AB-B2 (decision 1; defects M-AB06, M-AB13 list, M-AB15, M-AB16, M-AB21, M-AB26): the page header and the grouped list of
// banners (Web / App x three positions, rows with the switch). The Product wrappers are real; the environment (language, utils,
// the session level, the phone flag) is simulated. The controllers are not involved: the list gets `banners` and a `toggle`.
import React, { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ phone: false, level: 0 }))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
  useUtils: () => [{ optimizeImage: (url, options) => `${url}?${options}` }],
  useSession: () => [{ user: { level: mocks.level } }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { BannersHeader } from '../BannersHeader'
import { BannersSections } from '../BannersSections'

const image = (id, url = `https://img.test/${id}.png`) => ({ id, type: 'image', url })

const burger = { id: 1, name: 'Burger week', position: 'web_business_listing', enabled: true, items: [image(11), image(12), { id: 13, type: 'video', url: 'https://img.test/13.mp4' }], business: [] }
const pizza = { id: 2, name: 'Pizza night', position: 'web_business_listing', enabled: false, items: [image(21)], business: [] }
const free = { id: 3, name: 'Free delivery', position: 'web_business_page', enabled: false, items: [image(31)], business: [{ id: 5 }, { id: 6 }] }
const summer = { id: 4, name: 'Summer', position: 'web_home_page', enabled: false } // no items, no business (M-AB21)
const nameless = { id: 5, position: 'app_business_page', enabled: true, items: [] } // no name, no business (M-AB21)
const BANNERS = [burger, pizza, free, summer, nameless]

const TITLES = ['Web home', 'Web business listing', 'Web business page', 'App home page', 'App business listing', 'App business page']
const HOME = 'Add a banner to your home page and inform everyone about the latest news in your marketplace.'
const LISTING = 'Add a banner inside your business listing to let everyone know about your latest promotions inside your businesses listed.'
const PAGE = 'Add a banner inside the business page, and inform news and promotions specifically of the stores customers are ordering from.'

let current
const draw = (props = {}) => {
  current = {
    banners: BANNERS,
    loading: false,
    error: null,
    onRetry: vi.fn(),
    search: '',
    onSearch: vi.fn(),
    activeId: undefined,
    onOpen: vi.fn(),
    onAdd: vi.fn(),
    toggle: { pendingIds: [], setEnabled: vi.fn().mockResolvedValue({ ok: true, error: null }), alert: null },
    focusPosition: null,
    ...props
  }
  const view = render(<BannersSections {...current} />)
  return { ...view, ...current, rerenderWith: (extra) => { current = { ...current, ...extra }; view.rerender(<BannersSections {...current} />) } }
}

const sectionOf = (title) => screen.getByRole('region', { name: title })
const rowOf = (container, id) => container.querySelector(`tr[data-row-id="${id}"]`)
const namesIn = (section) => within(section).queryAllByRole('rowheader').map(cell => cell.textContent)

beforeEach(() => {
  mocks.phone = false
  mocks.level = 0
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('the six positions: order, groups, sizes and descriptions', () => {
  it('shows Web then App, each as home, business listing and business page, with the position title as a level 2 heading', () => {
    draw()
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(TITLES)
    const web = screen.getByRole('group', { name: 'Web' })
    const app = screen.getByRole('group', { name: 'App' })
    expect(within(web).getAllByRole('region').map(section => section.getAttribute('aria-labelledby')))
      .toEqual(['odc-banners-position-web_home_page', 'odc-banners-position-web_business_listing', 'odc-banners-position-web_business_page'])
    expect(within(app).getAllByRole('region').map(section => section.getAttribute('aria-labelledby')))
      .toEqual(['odc-banners-position-app_home_page', 'odc-banners-position-app_business_listing', 'odc-banners-position-app_business_page'])
  })

  it('the heading carries the id the section is named by and can take focus by script', () => {
    draw()
    const heading = screen.getByRole('heading', { name: 'App business page' })
    expect(heading).toHaveAttribute('id', 'odc-banners-position-app_business_page')
    expect(heading).toHaveAttribute('tabindex', '-1')
  })

  it.each([
    ['Web home', '1440 x 300', HOME],
    ['Web business listing', '1440 x 300', LISTING],
    ['Web business page', '1440 x 300', PAGE],
    ['App home page', '300 x 300', HOME],
    ['App business listing', '300 x 300', LISTING],
    ['App business page', '300 x 300', PAGE]
  ])('%s shows its recommended size (%s) and its description in the page, not in a tooltip', (title, size, description) => {
    draw()
    const section = sectionOf(title)
    expect(section).toHaveTextContent(`Recommended size ${size}`)
    expect(section).toHaveTextContent(description)
    expect(section.querySelector('.odc-figure')).toHaveTextContent(size)
    expect(section.querySelector('[role="tooltip"]')).toBeNull()
    // the description is text of the section, not the title attribute of something
    expect(within(section).getByText(description)).toBeVisible()
  })

  it('each position has its own «Add banner», named with the position, that calls onAdd with the key', async () => {
    const user = userEvent.setup()
    const { onAdd } = draw()
    for (const [title, key] of [['Web home', 'web_home_page'], ['App business listing', 'app_business_listing'], ['App home page', 'app_home_page']]) {
      const button = within(sectionOf(title)).getByRole('button', { name: `Add banner to ${title}` })
      expect(button).toHaveTextContent('Add banner')
      await user.click(button)
      expect(onAdd).toHaveBeenLastCalledWith(key)
    }
    expect(onAdd).toHaveBeenCalledTimes(3)
    expect(screen.getAllByRole('button', { name: /^Add banner to / })).toHaveLength(6)
  })
})

describe('the rows of a position', () => {
  it('lists the banners of each position in API order, with the name as the row header', () => {
    draw({ banners: [pizza, burger, free, summer] })
    expect(namesIn(sectionOf('Web business listing'))).toEqual(['Pizza night', 'Burger week'])
    expect(namesIn(sectionOf('Web business page'))).toEqual(['Free delivery'])
    expect(namesIn(sectionOf('Web home'))).toEqual(['Summer'])
  })

  it('has the columns image, name, images and status, plus businesses only in the «Business page» positions', () => {
    draw()
    const headers = (title) => within(sectionOf(title)).queryAllByRole('columnheader').map(header => header.textContent)
    expect(headers('Web business listing')).toEqual(['Preview', 'Name', 'Images', 'Status'])
    expect(headers('Web business page')).toEqual(['Preview', 'Name', 'Images', 'Businesses', 'Status'])
    expect(headers('App business page')).toEqual(['Preview', 'Name', 'Images', 'Businesses', 'Status'])
    expect(headers('App home page')).toEqual([]) // no banners: no table at all
  })

  it('says «N images» counting only images (a video is shown nowhere today) and «N businesses», each count as a figure', () => {
    const { container } = draw()
    const listing = rowOf(container, 1)
    expect(within(listing).getByText('2').closest('.odc-figure')).not.toBeNull()
    expect(listing).toHaveTextContent('2 images')
    expect(rowOf(container, 2)).toHaveTextContent('1 image')
    expect(rowOf(container, 2)).not.toHaveTextContent('1 images')
    expect(rowOf(container, 3)).toHaveTextContent('2 businesses')
    expect(rowOf(container, 3)).toHaveTextContent('1 image')
  })

  it('a banner with no items, no business and no name does not break the list (M-AB21)', () => {
    const { container } = draw()
    expect(rowOf(container, 4)).toHaveTextContent('0 images')
    const bare = rowOf(container, 5)
    expect(bare).toHaveTextContent('0 images')
    expect(bare).toHaveTextContent('0 businesses')
    expect(within(bare).getByRole('rowheader')).toHaveTextContent('')
  })

  it('draws the first image as a decorative thumbnail through optimizeImage, 48x10 for the web and square for the app', () => {
    const { container } = draw()
    const web = rowOf(container, 1).querySelector('img')
    expect(web).toHaveAttribute('src', 'https://img.test/11.png?h_40,c_limit')
    expect(web).toHaveAttribute('alt', '')
    expect(rowOf(container, 1).querySelector('.odc-banners-thumb')).toHaveAttribute('data-shape', 'wide')
    expect(rowOf(container, 5).querySelector('.odc-banners-thumb')).toHaveAttribute('data-shape', 'square')
  })

  it('draws a neutral box, with no image, when the banner has none', () => {
    const { container } = draw()
    const box = rowOf(container, 4).querySelector('.odc-banners-thumb')
    expect(box).not.toBeNull()
    expect(box.querySelector('img')).toBeNull()
    expect(rowOf(container, 5).querySelector('img')).toBeNull()
  })

  it('draws the neutral box when the image fails to load', () => {
    const { container } = draw()
    const img = rowOf(container, 3).querySelector('img')
    fireEvent.error(img)
    expect(rowOf(container, 3).querySelector('img')).toBeNull()
    expect(rowOf(container, 3).querySelector('.odc-banners-thumb')).not.toBeNull()
  })

  it('takes the first IMAGE as the thumbnail, never a video', () => {
    const { container } = draw({ banners: [{ ...burger, items: [{ id: 1, type: 'video', url: 'https://img.test/v.mp4' }, image(2, 'https://img.test/second.png')] }] })
    expect(rowOf(container, 1).querySelector('img')).toHaveAttribute('src', 'https://img.test/second.png?h_40,c_limit')
  })

  it('opens the banner with a click on the row, and with Enter', async () => {
    const user = userEvent.setup()
    const { container, onOpen } = draw()
    await user.click(within(rowOf(container, 2)).getByRole('rowheader'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenLastCalledWith(pizza)
    act(() => rowOf(container, 3).focus())
    await user.keyboard('{Enter}')
    expect(onOpen).toHaveBeenLastCalledWith(free)
  })

  it('marks the open banner (activeId may be the string of the URL)', () => {
    const { container } = draw({ activeId: '2' })
    expect(rowOf(container, 2)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 1)).not.toHaveAttribute('aria-current')
  })

  it('a position that is none of the six goes to a last «Other» section with its raw key in mono, its rows and no «Add banner»', () => {
    const odd = { id: 9, name: 'Legacy slot', position: 'legacy_position', enabled: true, items: [image(91)] }
    const { container } = draw({ banners: [...BANNERS, odd] })
    const headings = screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)
    expect(headings).toEqual([...TITLES, 'Other'])
    const other = sectionOf('Other')
    expect(within(other).getByRole('rowheader')).toHaveTextContent('Legacy slot')
    const key = within(other).getByText('legacy_position')
    expect(key).toHaveClass('odc-mono')
    expect(within(other).queryByRole('button', { name: /Add banner/ })).toBeNull()
    expect(rowOf(container, 9).querySelector('[role="switch"]')).not.toBeNull()
    // every banner is in exactly one section: the header count adds up
    expect(container.querySelectorAll('tbody tr[data-row-id]')).toHaveLength(BANNERS.length + 1)
  })

  it('has no «Other» section when every banner is in one of the six', () => {
    draw()
    expect(screen.queryByRole('region', { name: 'Other' })).toBeNull()
  })
})

describe('the switch of a row', () => {
  it('says On or Off in words, and is named with the banner: «On, Burger week»', () => {
    const { container } = draw()
    const on = within(rowOf(container, 1)).getByRole('switch', { name: 'On, Burger week' })
    expect(on).toBeChecked()
    expect(on).toHaveTextContent('On')
    const off = within(rowOf(container, 2)).getByRole('switch', { name: 'Off, Pizza night' })
    expect(off).not.toBeChecked()
    expect(off).toHaveTextContent('Off')
  })

  it('calls toggle.setEnabled with the banner and the new value, and does not open the row', async () => {
    const user = userEvent.setup()
    const { container, toggle, onOpen } = draw()
    await user.click(within(rowOf(container, 2)).getByRole('switch'))
    expect(toggle.setEnabled).toHaveBeenCalledTimes(1)
    expect(toggle.setEnabled).toHaveBeenCalledWith(pizza, true)
    expect(onOpen).not.toHaveBeenCalled()
    await user.click(within(rowOf(container, 1)).getByRole('switch'))
    expect(toggle.setEnabled).toHaveBeenLastCalledWith(burger, false)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('a failed change keeps the old value and says why in the row (the switch is controlled by banner.enabled)', async () => {
    const user = userEvent.setup()
    const setEnabled = vi.fn().mockResolvedValue({ ok: false, error: ['Not allowed'] })
    const { container } = draw({ toggle: { pendingIds: [], setEnabled, alert: null } })
    const control = within(rowOf(container, 2)).getByRole('switch')
    await user.click(control)
    expect(setEnabled).toHaveBeenCalledWith(pizza, true)
    expect(await within(rowOf(container, 2)).findByRole('alert')).toHaveTextContent('Not allowed')
    expect(control).not.toBeChecked()
  })

  it('a failure with no text says «We couldn\'t change the banner»', async () => {
    const user = userEvent.setup()
    const setEnabled = vi.fn().mockResolvedValue({ ok: false, error: null })
    const { container } = draw({ toggle: { pendingIds: [], setEnabled, alert: null } })
    await user.click(within(rowOf(container, 2)).getByRole('switch'))
    expect(await within(rowOf(container, 2)).findByRole('alert')).toHaveTextContent("We couldn't change the banner")
  })

  it('marks the switch of a banner in flight as busy (toggle.pendingIds) and no other row', () => {
    const { container } = draw({ toggle: { pendingIds: [1], setEnabled: vi.fn(), alert: null } })
    expect(within(rowOf(container, 1)).getByRole('switch')).toHaveAttribute('aria-busy', 'true')
    expect(within(rowOf(container, 2)).getByRole('switch')).not.toHaveAttribute('aria-busy', 'true')
  })

  it('works without a toggle (nothing to call, nothing breaks)', async () => {
    const user = userEvent.setup()
    const { container } = draw({ toggle: undefined })
    await user.click(within(rowOf(container, 2)).getByRole('switch'))
    expect(within(rowOf(container, 2)).getByRole('switch')).not.toBeChecked()
  })
})

describe('search', () => {
  const searchbox = () => screen.getByRole('searchbox', { name: 'Search banners' })

  it('is a «Search banners» field above the sections', () => {
    draw()
    expect(searchbox().compareDocumentPosition(screen.getByRole('heading', { name: 'Web home' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('reports what is typed', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    const Controlled = () => {
      const [search, setSearch] = useState('')
      return (
        <BannersSections
          banners={BANNERS}
          loading={false}
          error={null}
          search={search}
          onSearch={(text) => { onSearch(text); setSearch(text) }}
          onOpen={vi.fn()}
          onAdd={vi.fn()}
        />
      )
    }
    render(<Controlled />)
    await user.type(searchbox(), 'piz')
    expect(onSearch).toHaveBeenLastCalledWith('piz')
    expect(searchbox()).toHaveValue('piz')
    expect(within(sectionOf('Web business listing')).getAllByRole('rowheader').map(cell => cell.textContent)).toEqual(['Pizza night'])
  })

  it('filters by name in ALL positions, not only the two «Business page» ones, ignoring case', () => {
    const { container } = draw({ search: 'SUMMER' })
    expect(namesIn(sectionOf('Web home'))).toEqual(['Summer'])
    expect(rowOf(container, 1)).toBeNull()
    expect(rowOf(container, 3)).toBeNull()
    cleanup()
    draw({ search: 'pizza' })
    expect(screen.getAllByRole('rowheader').map(cell => cell.textContent)).toEqual(['Pizza night'])
  })

  it('a position where nothing matches keeps its heading and says so with the search', () => {
    draw({ search: 'pizza' })
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(TITLES)
    expect(within(sectionOf('Web business listing')).getAllByRole('rowheader').map(cell => cell.textContent)).toEqual(['Pizza night'])
    expect(within(sectionOf('Web home')).getByText('No banners match "pizza".')).toBeInTheDocument()
    expect(within(sectionOf('Web business page')).getByText('No banners match "pizza".')).toBeInTheDocument()
    // a position with no banners at all keeps saying it is empty
    expect(within(sectionOf('App home page')).getByText('No banners here yet.')).toBeInTheDocument()
    // and its «Add banner» is still there
    expect(within(sectionOf('Web home')).getByRole('button', { name: 'Add banner to Web home' })).toBeInTheDocument()
  })

  it('a banner with no name counts as an empty name: it matches nothing, and does not throw', () => {
    expect(() => draw({ search: 'x' })).not.toThrow()
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0)
  })

  it('with no match anywhere says so above the sections, with «Clear search»', async () => {
    const user = userEvent.setup()
    const { onSearch } = draw({ search: 'zzz' })
    const empty = screen.getByText('No banners match "zzz"').closest('.odc-state')
    expect(empty).not.toBeNull()
    expect(empty.compareDocumentPosition(screen.getByRole('heading', { name: 'Web home' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(within(empty).getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledWith('')
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6)
  })

  // redesign AB-R1 (review r1 #7): the notice above says it once; the sections do not repeat it six times
  it('with no match anywhere the sections do not repeat «No banners match»', () => {
    draw({ search: 'zzz' })
    expect(screen.queryByText('No banners match "zzz".')).toBeNull()
    expect(screen.getAllByText(/No banners match/)).toHaveLength(1)
  })

  it('a search while there are no banners at all does not claim «no match»', () => {
    draw({ banners: [], search: 'zzz' })
    expect(screen.queryByText('No banners match "zzz"')).toBeNull()
    expect(screen.getAllByText('No banners here yet.')).toHaveLength(6)
  })

  it('no search shows no «no match» line anywhere', () => {
    draw()
    expect(screen.queryByText(/No banners match/)).toBeNull()
  })
})

describe('empty, loading and error', () => {
  it('an empty position says «No banners here yet.» in one muted line and draws no table', () => {
    draw({ banners: [] })
    expect(screen.getAllByText('No banners here yet.')).toHaveLength(6)
    expect(screen.queryAllByRole('table')).toHaveLength(0)
    expect(within(sectionOf('App home page')).getByRole('button', { name: 'Add banner to App home page' })).toBeInTheDocument()
  })

  it('draws only the positions with banners as tables', () => {
    draw()
    expect(screen.getAllByRole('table').map(table => table.getAttribute('aria-label'))).toEqual([
      'Web home', 'Web business listing', 'Web business page', 'App business page'
    ])
  })

  it('while loading every position keeps its heading and shows two skeleton rows', () => {
    const { container } = draw({ banners: [], loading: true })
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(TITLES)
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(12)
    expect(screen.queryByText('No banners here yet.')).toBeNull()
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0)
  })

  it('while loading «Add banner» waits (it would be created into a list that is being replaced)', () => {
    draw({ banners: [], loading: true })
    screen.getAllByRole('button', { name: /^Add banner to / }).forEach(button => expect(button).toBeDisabled())
  })

  it('a failed load takes the place of the sections: the message of the API and «Retry» (M-AB13)', async () => {
    const user = userEvent.setup()
    const { onRetry } = draw({ banners: [], error: ['Not allowed'] })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load the banners.")
    expect(alert).toHaveTextContent('Not allowed')
    expect(screen.queryByRole('region')).toBeNull()
    expect(screen.queryByRole('searchbox')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('an error that is a plain string, or an empty list, are handled: the string is shown, the empty list is no error', () => {
    draw({ banners: [], error: 'Server down' })
    expect(screen.getByRole('alert')).toHaveTextContent('Server down')
    cleanup()
    draw({ error: [] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6)
  })

  it('while a reload is running the error is not shown over the skeleton', () => {
    draw({ banners: [], error: ['Not allowed'], loading: true })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6)
  })
})

describe('phone: one card per banner', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws a list of cards per position and no table', () => {
    draw()
    expect(screen.queryAllByRole('table')).toHaveLength(0)
    const cards = within(sectionOf('Web business listing')).getByRole('list', { name: 'Web business listing' })
    expect(within(cards).getAllByRole('listitem')).toHaveLength(2)
    expect(within(cards).getByRole('link', { name: 'Open Burger week' })).toBeInTheDocument()
  })

  it('a card has the name, the images (and businesses) count, the thumbnail and the same switch', () => {
    const { container } = draw()
    const burgerCard = container.querySelector('li[data-row-id="1"]')
    expect(burgerCard).toHaveTextContent('Burger week')
    expect(burgerCard).toHaveTextContent('2 images')
    expect(burgerCard.querySelector('img')).toHaveAttribute('src', 'https://img.test/11.png?h_40,c_limit')
    expect(within(burgerCard).getByRole('switch', { name: 'On, Burger week' })).toBeChecked()
    const freeCard = container.querySelector('li[data-row-id="3"]')
    expect(freeCard).toHaveTextContent('1 image')
    expect(freeCard).toHaveTextContent('2 businesses')
    expect(container.querySelector('li[data-row-id="5"]')).toHaveTextContent('0 businesses')
  })

  it('the switch of a card calls setEnabled and does not open the card; the card opens on its own', async () => {
    const user = userEvent.setup()
    const { container, toggle, onOpen } = draw()
    await user.click(within(container.querySelector('li[data-row-id="2"]')).getByRole('switch'))
    expect(toggle.setEnabled).toHaveBeenCalledWith(pizza, true)
    expect(onOpen).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: 'Open Pizza night' }))
    expect(onOpen).toHaveBeenCalledWith(pizza)
  })

  it('a failed change in a card keeps the old value and says why', async () => {
    const user = userEvent.setup()
    const setEnabled = vi.fn().mockResolvedValue({ ok: false, error: ['Not allowed'] })
    const { container } = draw({ toggle: { pendingIds: [], setEnabled, alert: null } })
    const card = container.querySelector('li[data-row-id="2"]')
    await user.click(within(card).getByRole('switch'))
    expect(await within(card).findByRole('alert')).toHaveTextContent('Not allowed')
    expect(within(card).getByRole('switch')).not.toBeChecked()
  })

  it('marks the open banner and loads with skeleton cards', () => {
    const { container } = draw({ activeId: 1 })
    expect(container.querySelector('li[data-row-id="1"]')).toHaveAttribute('aria-current', 'true')
    cleanup()
    const loading = draw({ banners: [], loading: true })
    expect(loading.container.querySelectorAll('li[data-skeleton]')).toHaveLength(12)
  })

  it('keeps the empty line and the per-position «no match» line', () => {
    draw({ search: 'pizza' })
    expect(within(sectionOf('Web home')).getByText('No banners match "pizza".')).toBeInTheDocument()
    expect(within(sectionOf('App home page')).getByText('No banners here yet.')).toBeInTheDocument()
  })
})

describe('focusPosition (?position= from ⌘K while the page is open)', () => {
  let scrollIntoView
  beforeEach(() => {
    scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
  })
  afterEach(() => { delete Element.prototype.scrollIntoView })

  const heading = (title) => screen.getByRole('heading', { name: title })

  it('scrolls to the section and focuses its heading when it changes to a key, once per change', () => {
    const { rerenderWith } = draw()
    expect(scrollIntoView).not.toHaveBeenCalled()
    rerenderWith({ focusPosition: 'app_home_page' })
    expect(heading('App home page')).toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    // the same key again, or any other render, does not take the focus back
    screen.getByRole('searchbox').focus()
    rerenderWith({ focusPosition: 'app_home_page', search: '' })
    expect(screen.getByRole('searchbox')).toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    // a new key does
    rerenderWith({ focusPosition: 'web_business_page' })
    expect(heading('Web business page')).toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('does it on the first render when the page opens with a position', () => {
    draw({ focusPosition: 'web_business_listing' })
    expect(heading('Web business listing')).toHaveFocus()
  })

  it('waits for the list to load, so the rows do not push the section away after the scroll', () => {
    const { rerenderWith } = draw({ banners: [], loading: true, focusPosition: 'app_business_page' })
    expect(heading('App business page')).not.toHaveFocus()
    expect(scrollIntoView).not.toHaveBeenCalled()
    rerenderWith({ banners: BANNERS, loading: false })
    expect(heading('App business page')).toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('waits behind a failed load and does it after «Retry» brings the sections back', () => {
    const { rerenderWith } = draw({ banners: [], error: ['Down'], focusPosition: 'web_home_page' })
    expect(scrollIntoView).not.toHaveBeenCalled()
    rerenderWith({ banners: BANNERS, error: null })
    expect(heading('Web home')).toHaveFocus()
  })

  it('ignores a key that is not a position, and a null', () => {
    const { rerenderWith } = draw({ focusPosition: 'nowhere' })
    expect(scrollIntoView).not.toHaveBeenCalled()
    rerenderWith({ focusPosition: null })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('focuses without scrolling being impossible (a browser with no scrollIntoView)', () => {
    delete Element.prototype.scrollIntoView
    draw({ focusPosition: 'app_home_page' })
    expect(heading('App home page')).toHaveFocus()
  })
})

describe('BannersHeader', () => {
  const setup = (props = {}) => render(<BannersHeader count={12} onCount={3} {...props} />)

  it('has the page title «Ad banners» as the only h1', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Ad banners' })).toBeInTheDocument()
  })

  it('names the count for a screen reader: «12 banners», «1 banner», «0 banners»', () => {
    const { container, rerender } = setup()
    expect(screen.getByText('12 banners')).toBeInTheDocument()
    expect(container.querySelector('.odc-pagehead-count')).toHaveTextContent('12')
    rerender(<BannersHeader count={1} onCount={0} />)
    expect(screen.getByText('1 banner')).toBeInTheDocument()
    rerender(<BannersHeader count={0} onCount={0} />)
    expect(screen.getByText('0 banners')).toBeInTheDocument()
  })

  it.each([[undefined], [null], [NaN]])('draws no count while it is unknown (%j)', (count) => {
    const { container } = setup({ count })
    expect(container.querySelector('.odc-pagehead-count')).toBeNull()
    expect(screen.queryByText(/^(\d+|NaN|null|undefined) banners?$/)).toBeNull()
  })

  it('says how many are on, as a figure, in the status slot: «3 on»', () => {
    const { container } = setup()
    const status = container.querySelector('.odc-pagehead-status')
    expect(status).toHaveTextContent('3 on')
    expect(status.querySelector('.odc-figure')).toHaveTextContent('3')
  })

  it('keeps «0 on» (zero is a number) and says nothing while the figure is unknown', () => {
    const { container, rerender } = setup({ onCount: 0 })
    expect(container.querySelector('.odc-pagehead-status')).toHaveTextContent('0 on')
    rerender(<BannersHeader count={12} />)
    expect(container.querySelector('.odc-pagehead-status')).toHaveTextContent('')
    expect(container.querySelector('.odc-pagehead-status')).toHaveAttribute('data-empty')
  })

  it('has the Learn menu of the page (level 0 only, as LearnDropDown decides), and no primary action', () => {
    const { container } = setup()
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    expect(container.querySelector('[data-variant="primary"]')).toBeNull()
    cleanup()
    mocks.level = 1
    setup()
    expect(screen.queryByRole('button', { name: 'Learn' })).toBeNull()
  })

  it('draws «Open menu» before the title only when the host gives onOpenMenu, and calls it', async () => {
    const user = userEvent.setup()
    const onOpenMenu = vi.fn()
    setup({ onOpenMenu })
    const menu = screen.getByRole('button', { name: 'Open menu' })
    expect(menu.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // the opener is PageHeader's `leading`: first child of the lead block, and the page's class is on the PageHeader itself
    expect(menu.closest('.odc-pagehead-lead')?.firstElementChild).toBe(menu)
    expect(menu.closest('.odc-pagehead')).toHaveClass('odc-banners-head')
    await user.click(menu)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
  })

  it('has no menu button by default', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })
})
