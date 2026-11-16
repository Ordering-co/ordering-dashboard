/* eslint-disable import/first */
// redesign reviews FC (D1, D4, D5, D8, D9; RV-02, RV-04, RV-09, RV-13, RV-14, RV-16): the three panels of /intelligence/reviews
// (business, user, product) on one shell, and the pieces they share (the note, one review). The controllers are stand-ins that
// record what the wrapper gives them; the UIs are the real ones and get the props the real controllers give them. The Product
// wrappers (RecordPanel, AsyncSwitch, Avatar, EmptyState) and SatisfactionScores are the real ones.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const runtime = vi.hoisted(() => ({ controllers: {} }))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  const controller = name => function Controller ({ UIComponent, ...rest }) {
    runtime.controllers[name] = { ...rest, UIComponent }
    return react.createElement('div', { 'data-testid': name })
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils: () => [{
      parseNumber: (value, options) => Number(value).toFixed(options?.decimal ?? 2),
      // the project's format, visible in the test: the date it was given and the option that says it is local time
      parseDate: (date, options = {}) => `fmt(${date}|utc:${options.utc})`,
      optimizeImage: (url, params) => (url ? `${url}?${params}` : url)
    }],
    BusinessReviews: controller('BusinessReviews'),
    UserReviewDetails: controller('UserReviewDetails'),
    ProductReviews: controller('ProductReviews')
  }
})

import { ReviewRating } from '../ReviewRating'
import { ReviewItem } from '../ReviewItem'
import { ReviewPanel } from '../ReviewPanel'
import { BusinessReviewDetails, BusinessReviewDetailsUI } from '../../BusinessReviewDetails'
import { UserReviewDetails, UserReviewDetailsUI } from '../../UserReviewDetails'
import { ProductReviewDetails, ProductReviewDetailsUI } from '../../ProductReviewDetails'

const figures = node => [...node.querySelectorAll('.odc-figure')].map(figure => figure.textContent)

afterEach(cleanup)

describe('ReviewRating', () => {
  it('paints 4.94 as 4.9 in a figure, with the name «4.9 out of 5» and five stars, all filled', () => {
    const { container } = render(<ReviewRating value={4.94} />)
    expect(screen.getByText('4.9').closest('.odc-figure')).not.toBeNull()
    const image = screen.getByRole('img', { name: '4.9 out of 5' })
    const stars = container.querySelectorAll('.odc-rv-star')
    expect(stars).toHaveLength(5)
    expect([...stars].map(star => star.getAttribute('data-filled'))).toEqual(['true', 'true', 'true', 'true', 'true'])
    expect(container.querySelector('.odc-rv-stars').getAttribute('aria-hidden')).toBe('true')
    expect(image.contains(stars[0])).toBe(true)
  })

  it('takes two decimals when asked (the header of a business, as its list)', () => {
    render(<ReviewRating value={4.94} decimals={2} size='lg' />)
    expect(screen.getByText('4.94').closest('.odc-figure')).not.toBeNull()
    expect(screen.getByRole('img', { name: '4.94 out of 5' }).getAttribute('data-size')).toBe('lg')
  })

  it('rounds the stars to the nearest whole, never up (3.2 paints 3)', () => {
    const { container } = render(<ReviewRating value={3.2} />)
    expect([...container.querySelectorAll('.odc-rv-star')].map(star => star.getAttribute('data-filled')))
      .toEqual(['true', 'true', 'true', 'false', 'false'])
  })

  it('paints a dash with a text for assistive technology when there is no note', () => {
    const { container } = render(<ReviewRating value={null} />)
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('No data').className).toContain('odc-sr-only')
    expect(container.querySelectorAll('.odc-rv-star')).toHaveLength(0)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('never paints a 0 (RV-03): 0, «0» and NaN are no note', () => {
    for (const value of [0, '0', NaN, undefined, '']) {
      const { container, unmount } = render(<ReviewRating value={value} />)
      expect(container.textContent).not.toContain('0')
      expect(container.textContent).toContain('—')
      unmount()
    }
  })
})

describe('ReviewItem', () => {
  const review = { id: 1, order_id: 77, created_at: '2026-10-01 10:00:00', comment: 'Lovely', total: 4 }

  it('is one article with the date by parseDate in local time, the order number in a figure and the note', () => {
    render(<ReviewItem review={review} rating={4} />)
    const article = screen.getByRole('article')
    expect(within(article).getByText('fmt(2026-10-01 10:00:00|utc:false)')).toBeTruthy()
    expect(within(article).getByText('Order number').parentElement.querySelector('.odc-figure').textContent).toBe('77')
    expect(within(article).getByRole('img', { name: '4.0 out of 5' })).toBeTruthy()
    expect(within(article).getByText('Lovely')).toBeTruthy()
  })

  it('has no order line without an order, and no date without a date', () => {
    render(<ReviewItem review={{ id: 2, comment: 'Hi' }} rating={3} />)
    expect(screen.queryByText('Order number')).toBeNull()
    expect(screen.queryByText(/fmt\(/)).toBeNull()
  })

  it('says «No comment», dimmed, when the comment is empty or only spaces (RV-16)', () => {
    for (const comment of ['', '   \n ', null, undefined]) {
      const { unmount } = render(<ReviewItem review={{ id: 3, comment }} rating={5} />)
      const text = screen.getByText('No comment')
      expect(text.getAttribute('data-empty')).toBe('true')
      unmount()
    }
  })

  it('shows the author with the optimized photo (RV-14) and the name', () => {
    const { container } = render(<ReviewItem review={review} rating={4} author={{ name: 'Ann', lastname: 'Lee', photo: 'https://img/ann.png' }} />)
    expect(screen.getByText('Ann Lee')).toBeTruthy()
    expect(container.querySelector('.odc-avatar img').getAttribute('src')).toBe('https://img/ann.png?w_64,c_limit')
    expect(container.querySelector('.odc-avatar').getAttribute('data-size')).toBe('lg')
  })

  it('has no author block without an author', () => {
    const { container } = render(<ReviewItem review={review} rating={4} />)
    expect(container.querySelector('.odc-avatar')).toBeNull()
  })

  it('lists the breakdown that is there, with the figures in figures, and leaves the empty ones out', () => {
    const { container } = render(<ReviewItem review={{ ...review, quality: 5, delivery: 4, service: 0, package: null }} rating={4} showBreakdown />)
    const list = container.querySelector('.odc-rv-breakdown')
    expect(list.textContent).toContain('Quality')
    expect(list.textContent).toContain('Delivery')
    expect(list.textContent).not.toContain('Service')
    expect(list.textContent).not.toContain('Package')
    expect(figures(list)).toEqual(['5', '4'])
  })

  it('has no breakdown unless asked', () => {
    const { container } = render(<ReviewItem review={{ ...review, quality: 5 }} rating={4} />)
    expect(container.querySelector('.odc-rv-breakdown')).toBeNull()
  })

  it('takes a verdict in place of the note, and an action at the end of the header', () => {
    render(<ReviewItem review={review} verdict={<span>Liked</span>} action={<button type='button'>Do it</button>} />)
    expect(screen.getByText('Liked')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    const header = screen.getByRole('article').querySelector('header')
    expect(within(header).getByRole('button', { name: 'Do it' })).toBeTruthy()
  })
})

describe('ReviewPanel', () => {
  it('needs nothing from the host to stand alone: title, close and its body', async () => {
    const onClose = vi.fn()
    render(<ReviewPanel title='Panel' onClose={onClose}><p>Body</p></ReviewPanel>)
    expect(screen.getByRole('heading', { name: 'Panel' })).toBeTruthy()
    expect(screen.getByText('Body')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('puts the actions it is given before «Open as page», which toggles expanded', async () => {
    const onExpandedChange = vi.fn()
    const { rerender } = render(
      <ReviewPanel title='Panel' headerActions={<button type='button'>Mine</button>} onExpandedChange={onExpandedChange}>x</ReviewPanel>
    )
    const buttons = screen.getAllByRole('button').map(button => button.getAttribute('aria-label') || button.textContent)
    expect(buttons.indexOf('Mine')).toBeLessThan(buttons.indexOf('Open as page'))
    await userEvent.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(true)
    rerender(<ReviewPanel title='Panel' expanded onExpandedChange={onExpandedChange}>x</ReviewPanel>)
    await userEvent.click(screen.getByRole('button', { name: 'Back to split view' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(false)
  })

  it('has no «Open as page» when the host does not give onExpandedChange', () => {
    render(<ReviewPanel title='Panel'>x</ReviewPanel>)
    expect(screen.queryByRole('button', { name: 'Open as page' })).toBeNull()
  })

  it('counts with the number in a figure, singular and plural', () => {
    const { container, rerender } = render(<ReviewPanel title='Panel' count={1}>x</ReviewPanel>)
    expect(container.querySelector('.odc-rv-count').textContent).toBe('1 review')
    expect(container.querySelector('.odc-rv-count .odc-figure').textContent).toBe('1')
    rerender(<ReviewPanel title='Panel' count={63}>x</ReviewPanel>)
    expect(container.querySelector('.odc-rv-count').textContent).toBe('63 reviews')
    rerender(<ReviewPanel title='Panel' count={null}>x</ReviewPanel>)
    expect(container.querySelector('.odc-rv-count')).toBeNull()
  })

  it('shows three skeleton blocks while loading, and neither the empty state nor the list', () => {
    const { container } = render(<ReviewPanel title='Panel' loading count={5}><p>Items</p></ReviewPanel>)
    const status = screen.getByRole('status', { name: 'Loading' })
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.querySelectorAll('.odc-rv-skeleton-item')).toHaveLength(3)
    expect(screen.queryByText('Items')).toBeNull()
    expect(screen.queryByText('No reviews yet')).toBeNull()
    expect(container.querySelector('.odc-rv-count')).toBeNull()
  })

  it('says it could not load and offers «Try again» (RV-08); an error wins over an empty list', async () => {
    const onRetry = vi.fn()
    render(<ReviewPanel title='Panel' error empty onRetry={onRetry}>x</ReviewPanel>)
    expect(screen.getByRole('alert').textContent).toContain("We couldn't load the reviews.")
    expect(screen.queryByText('No reviews yet')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('says there are no reviews yet (RV-09)', () => {
    render(<ReviewPanel title='Panel' empty>x</ReviewPanel>)
    expect(screen.getByText('No reviews yet')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the note only when it is given: a null is a dash, undefined is nothing', () => {
    const avatar = { kind: 'person', name: 'Ann' }
    const { container, rerender } = render(<ReviewPanel title='Panel' avatar={avatar} rating={null}>x</ReviewPanel>)
    expect(container.querySelector('.odc-rv-head').textContent).toContain('—')
    rerender(<ReviewPanel title='Panel' avatar={avatar}>x</ReviewPanel>)
    expect(container.querySelector('.odc-rv-head').textContent).not.toContain('—')
    expect(container.querySelector('.odc-rv-head [data-size]:not(.odc-avatar)')).toBeNull()
  })
})

// ── Business ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const reviewsOf = (count) => [
  {
    id: 1,
    order_id: 1234,
    quality: 5,
    delivery: 4,
    service: 5,
    package: 5,
    total: 4.75,
    comment: 'Arrived hot',
    enabled: true,
    created_at: '2026-10-01 10:00:00',
    user: { name: 'Ann', lastname: 'Lee', photo: 'https://img/ann.png' }
  },
  {
    id: 2,
    quality: 3,
    delivery: 3,
    service: 3,
    package: 3,
    total: 3,
    comment: '   ',
    enabled: false,
    created_at: '2026-09-30 09:00:00',
    user: { name: 'Bob', lastname: '', photo: null }
  },
  ...Array.from({ length: count - 2 }, (_, index) => ({
    id: 10 + index,
    order_id: 5000 + index,
    quality: 4,
    delivery: 4,
    service: 4,
    package: 4,
    total: 4,
    comment: `Comment ${index}`,
    enabled: true,
    created_at: '2026-09-01 08:00:00',
    user: { name: `User${index}`, lastname: 'X', photo: null }
  }))
]

const BUSINESS = {
  id: 7,
  name: 'Casa Mar',
  logo: 'https://img/logo.png',
  reviews: { total: 4.94, quality: 5, delivery: 4.8, service: 5, package: 5, reviews_count: 63, reviews: [] }
}

describe('BusinessReviewDetails', () => {
  let props

  beforeEach(() => {
    props = {
      business: BUSINESS,
      businessId: 7,
      businessState: { business: BUSINESS, loading: false, error: null },
      reviewsList: { reviews: reviewsOf(63), loading: false, error: null },
      handleChangeReviewEnabled: vi.fn(async () => ({ ok: true })),
      reloadReviews: vi.fn(),
      onClose: vi.fn(),
      onOpenProducts: vi.fn()
    }
  })

  it('keeps the controller wrapper: it asks for the reviews from the API', () => {
    render(<BusinessReviewDetails businessId={7} onClose={() => {}} />)
    expect(runtime.controllers.BusinessReviews.fetchReviewsFromApi).toBe(true)
    expect(runtime.controllers.BusinessReviews.businessId).toBe(7)
    expect(runtime.controllers.BusinessReviews.UIComponent).toBe(BusinessReviewDetailsUI)
  })

  it('titles the panel with the business, with its average (two decimals), its count and its scores', () => {
    const { container } = render(<BusinessReviewDetailsUI {...props} />)
    expect(screen.getByRole('heading', { name: 'Casa Mar' })).toBeTruthy()
    const head = container.querySelector('.odc-rv-head')
    expect(within(head).getByRole('img', { name: '4.94 out of 5' })).toBeTruthy()
    expect(head.querySelector('.odc-rv-count').textContent).toBe('63 reviews')
    // SatisfactionScores
    const scores = container.querySelector('.odc-bi-scores')
    expect(within(scores).getByText('Delivery')).toBeTruthy()
    expect(head.querySelector('.odc-avatar').getAttribute('data-kind')).toBe('business')
  })

  // redesign reviews R1 (Q1-8): the average is `total`, and it is already in the head with two decimals (4.94); the «General» row
  // of the scores repeated the same datum with one (4.9), a few pixels away
  it('has no «General» row in the scores: the average is only in the head, with two decimals (Q1-8)', () => {
    const { container } = render(<BusinessReviewDetailsUI {...props} />)
    const scores = container.querySelector('.odc-bi-scores')
    expect(within(scores).queryByText('General')).toBeNull()
    expect([...scores.querySelectorAll('.odc-bi-score-name')].map(name => name.textContent))
      .toEqual(['Quality', 'Delivery', 'Service', 'Package'])
    // the head keeps the average, and 4.9 is not painted anywhere
    expect(within(container.querySelector('.odc-rv-head')).getByRole('img', { name: '4.94 out of 5' })).toBeTruthy()
    expect(within(scores).queryByRole('img', { name: '4.9 out of 5' })).toBeNull()
  })

  it('still paints the scores when only «General» was there before: nothing else, no list (Q1-8)', () => {
    const onlyTotal = { ...BUSINESS, reviews: { total: 4.94, reviews: [] } }
    const { container } = render(
      <BusinessReviewDetailsUI {...props} business={onlyTotal} businessState={{ business: onlyTotal, loading: false, error: null }} />
    )
    expect(container.querySelector('.odc-bi-scores')).toBeNull()
    expect(within(container.querySelector('.odc-rv-head')).getByRole('img', { name: '4.94 out of 5' })).toBeTruthy()
  })

  it('paints every review as an article with its date, order number, breakdown and comment', () => {
    render(<BusinessReviewDetailsUI {...props} />)
    const articles = screen.getAllByRole('article')
    expect(articles).toHaveLength(63)
    const first = articles[0]
    expect(within(first).getByText('Ann Lee')).toBeTruthy()
    expect(within(first).getByText('fmt(2026-10-01 10:00:00|utc:false)')).toBeTruthy()
    expect(within(first).getByText('Order number').parentElement.querySelector('.odc-figure').textContent).toBe('1234')
    expect(within(first).getByText('Arrived hot')).toBeTruthy()
    const breakdown = first.querySelector('.odc-rv-breakdown')
    expect(breakdown.textContent).toContain('Quality')
    expect(breakdown.textContent).toContain('Package')
    expect(figures(breakdown)).toEqual(['5', '4', '5', '5'])
    // the second has no order and a comment of spaces
    expect(within(articles[1]).queryByText('Order number')).toBeNull()
    expect(within(articles[1]).getByText('No comment')).toBeTruthy()
  })

  it('names each switch by its review and keeps «Visible» as the visible text', () => {
    render(<BusinessReviewDetailsUI {...props} />)
    const articles = screen.getAllByRole('article')
    const first = within(articles[0]).getByRole('switch', { name: 'Visible: review of order 1234 by Ann Lee' })
    expect(first.getAttribute('aria-checked')).toBe('true')
    expect(first.textContent).toBe('Visible')
    // no order: the shorter name
    const second = within(articles[1]).getByRole('switch', { name: 'Visible: review by Bob' })
    expect(second.getAttribute('aria-checked')).toBe('false')
  })

  // redesign reviews (live check): the API's business reviews carry no `user`; the name never invents an author
  it('names a switch without an author by its order, or by its date when there is no order either', () => {
    props.reviewsList = {
      loading: false,
      error: null,
      reviews: [
        { id: 1, order_id: 14059, quality: 5, enabled: true, created_at: '2026-10-09 17:45:00', comment: 'Ok' },
        { id: 2, order_id: null, quality: 4, enabled: true, created_at: '2026-10-08 10:00:00', comment: '' }
      ]
    }
    render(<BusinessReviewDetailsUI {...props} />)
    expect(screen.getByRole('switch', { name: 'Visible: review of order 14059' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Visible: review of fmt(2026-10-08 10:00:00|utc:false)' })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: /Customer/ })).toBeNull()
  })

  it('turns a review off through the controller, with its id and the next value (RV-04)', async () => {
    render(<BusinessReviewDetailsUI {...props} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Visible: review of order 1234 by Ann Lee' }))
    expect(props.handleChangeReviewEnabled).toHaveBeenCalledWith(1, false)
  })

  it('goes back to «on» and says so when the save fails', async () => {
    props.handleChangeReviewEnabled = vi.fn(async () => ({ ok: false, error: ['Nope'] }))
    render(<BusinessReviewDetailsUI {...props} />)
    const toggle = screen.getByRole('switch', { name: 'Visible: review of order 1234 by Ann Lee' })
    await userEvent.click(toggle)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Nope'))
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('says «The review wasn\'t updated.» when the error has no text', async () => {
    props.handleChangeReviewEnabled = vi.fn(async () => ({ ok: false }))
    render(<BusinessReviewDetailsUI {...props} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Visible: review of order 1234 by Ann Lee' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain("The review wasn't updated."))
  })

  // redesign reviews R1 (Q1-7): the controller answers `error: null` for a network failure, and the switch says its own text
  it('says «The review wasn\'t updated.» for the answer of a network failure ({ ok: false, error: null }) (Q1-7)', async () => {
    props.handleChangeReviewEnabled = vi.fn(async () => ({ ok: false, error: null }))
    render(<BusinessReviewDetailsUI {...props} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Visible: review of order 1234 by Ann Lee' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain("The review wasn't updated."))
    expect(screen.getByRole('alert').textContent).not.toContain('Failed to fetch')
  })

  // redesign reviews R1 (Q1-6): when the save fails the notice stays in the action slot of the header, which keeps its place in the
  // header (the siblings are the same nodes, in the same order); where it is painted is the CSS (see «the CSS of the panels»)
  it('keeps the notice of a failed save inside the action slot, and the header with the same children in the same order (Q1-6)', async () => {
    props.handleChangeReviewEnabled = vi.fn(async () => ({ ok: false, error: ['Nope'] }))
    render(<BusinessReviewDetailsUI {...props} />)
    const first = screen.getAllByRole('article')[0]
    const header = first.querySelector('header')
    const childrenBefore = [...header.children]
    const toggle = within(first).getByRole('switch')

    await userEvent.click(toggle)
    const alert = await within(first).findByRole('alert')

    const slot = first.querySelector('.odc-rv-item-action')
    expect(slot.contains(alert)).toBe(true)
    expect(slot.contains(toggle)).toBe(true)
    expect(header.children).toHaveLength(childrenBefore.length)
    childrenBefore.forEach((child, index) => expect(header.children[index]).toBe(child))
    expect(header.children).toHaveLength(2)
    expect(header.firstElementChild.className).toBe('odc-rv-item-who')
    expect(header.lastElementChild).toBe(slot)
    // the switch is the same node, still in the slot before the notice
    expect(within(first).getByRole('switch')).toBe(toggle)
    expect(toggle.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('opens the products of the business shown with «Product reviews»', async () => {
    render(<BusinessReviewDetailsUI {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Product reviews' }))
    expect(props.onOpenProducts).toHaveBeenCalledWith(BUSINESS)
  })

  it('shows the fetched business when the row of the list is another one', async () => {
    const fetched = { ...BUSINESS, id: 8, name: 'Fetched', reviews: { ...BUSINESS.reviews } }
    render(<BusinessReviewDetailsUI {...props} businessId={8} businessState={{ business: fetched, loading: false, error: null }} />)
    expect(screen.getByRole('heading', { name: 'Fetched' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Product reviews' }))
    expect(props.onOpenProducts).toHaveBeenCalledWith(fetched)
  })

  it('shows a skeleton for the name and disables «Product reviews» until there is a business', () => {
    const { container } = render(
      <BusinessReviewDetailsUI
        {...props}
        business={undefined}
        businessState={{ business: null, loading: true, error: null }}
        reviewsList={{ reviews: [], loading: true, error: null }}
      />
    )
    expect(container.querySelector('.odc-record-title .odc-skeleton')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Product reviews' }).disabled).toBe(true)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()
  })

  it('alternates «Open as page» and «Back to split view» through onExpandedChange', async () => {
    const onExpandedChange = vi.fn()
    const { rerender } = render(<BusinessReviewDetailsUI {...props} expanded={false} onExpandedChange={onExpandedChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(true)
    rerender(<BusinessReviewDetailsUI {...props} expanded onExpandedChange={onExpandedChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Back to split view' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(false)
  })

  it('closes through onClose', async () => {
    render(<BusinessReviewDetailsUI {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('says there are no reviews yet, and paints a dash when the business has no note (RV-03, RV-09)', () => {
    const empty = { ...BUSINESS, reviews: { total: 0, reviews: [] } }
    const { container } = render(
      <BusinessReviewDetailsUI
        {...props}
        business={empty}
        businessState={{ business: empty, loading: false, error: null }}
        reviewsList={{ reviews: [], loading: false, error: null }}
      />
    )
    expect(screen.getByText('No reviews yet')).toBeTruthy()
    expect(container.querySelector('.odc-rv-head').textContent).toContain('—')
    expect(container.querySelector('.odc-bi-scores')).toBeNull()
    expect(screen.queryByText('The review does not exist.')).toBeNull()
  })

  it('says it could not load when the list comes with an error (an array too) and «Try again» reloads (RV-08)', async () => {
    for (const error of [['Boom'], true, 'Boom']) {
      props.reloadReviews.mockClear()
      const { unmount } = render(<BusinessReviewDetailsUI {...props} reviewsList={{ reviews: [], loading: false, error }} />)
      expect(screen.getByRole('alert').textContent).toContain("We couldn't load the reviews.")
      expect(screen.queryByText('No reviews yet')).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(props.reloadReviews).toHaveBeenCalledTimes(1)
      unmount()
    }
  })
})

// ── User ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('UserReviewDetails', () => {
  const USER = { id: 5, name: 'Sam', lastname: 'Cole', photo: 'https://img/sam.png', qualification: 5 }
  const REVIEWS = [
    { id: 1, order_id: 900, qualification: 5, comment: 'Great driver', created_at: '2026-10-02 12:00:00', type: 1, reviewer_id: 3 },
    { id: 2, order_id: 901, qualification: 3, comment: '', created_at: '2026-10-01 12:00:00', type: 1, reviewer_id: 4 }
  ]
  let props

  beforeEach(() => {
    props = {
      userId: 5,
      user: USER,
      userState: { user: USER, loading: false, error: null },
      userReviewState: { reviews: REVIEWS, loading: false, error: null },
      reloadReviews: vi.fn(),
      onClose: vi.fn()
    }
  })

  // redesign reviews R1 (Q1-8): the list says 5.00 / 4.50 for the same datum, so the head of the panel does too (two decimals);
  // the note of each review stays on one decimal
  it('titles the panel with the name and surname and paints the average of the row as 5.00, two decimals as its list (Q1-8)', () => {
    const { container } = render(<UserReviewDetailsUI {...props} />)
    expect(screen.getByRole('heading', { name: 'Sam Cole' })).toBeTruthy()
    const head = container.querySelector('.odc-rv-head')
    expect(within(head).getByRole('img', { name: '5.00 out of 5' })).toBeTruthy()
    expect(within(head).getByText('5.00').closest('.odc-figure')).not.toBeNull()
    expect(within(head).queryByText('5.0')).toBeNull()
    expect(head.querySelector('.odc-avatar').getAttribute('data-kind')).toBe('person')
    expect(head.querySelector('.odc-rv-count').textContent).toBe('2 reviews')
  })

  it('paints an average of 4.5 as 4.50 in the head and the notes of the reviews on one decimal (Q1-8)', () => {
    const user = { ...USER, qualification: 4.5 }
    const { container } = render(<UserReviewDetailsUI {...props} user={user} userState={{ user, loading: false, error: null }} />)
    const head = container.querySelector('.odc-rv-head')
    expect(within(head).getByRole('img', { name: '4.50 out of 5' })).toBeTruthy()
    const articles = screen.getAllByRole('article')
    expect(within(articles[0]).getByRole('img', { name: '5.0 out of 5' })).toBeTruthy()
  })

  it('paints each review with its qualification as the note, the date and the order, and no author when the review carries none', () => {
    render(<UserReviewDetailsUI {...props} />)
    const articles = screen.getAllByRole('article')
    expect(articles).toHaveLength(2)
    expect(within(articles[0]).getByRole('img', { name: '5.0 out of 5' })).toBeTruthy()
    expect(within(articles[1]).getByRole('img', { name: '3.0 out of 5' })).toBeTruthy()
    expect(within(articles[0]).getByText('fmt(2026-10-02 12:00:00|utc:false)')).toBeTruthy()
    expect(within(articles[0]).getByText('Order number').parentElement.querySelector('.odc-figure').textContent).toBe('900')
    expect(within(articles[0]).getByText('Great driver')).toBeTruthy()
    expect(within(articles[1]).getByText('No comment')).toBeTruthy()
    for (const article of articles) {
      expect(article.querySelector('.odc-avatar')).toBeNull()
      expect(article.querySelector('.odc-rv-breakdown')).toBeNull()
      expect(within(article).queryByRole('switch')).toBeNull()
    }
  })

  // with `params=reviewer` api-core sends `reviewer` (name, lastname, photo) or `reviewer: null`
  it('shows the author (name, lastname and photo) when the review carries a reviewer', () => {
    props.userReviewState = {
      reviews: [{ ...REVIEWS[0], reviewer: { id: 3, name: 'Ivy', lastname: 'Reed', photo: 'https://img/ivy.png' } }],
      loading: false,
      error: null
    }
    render(<UserReviewDetailsUI {...props} />)
    const article = screen.getByRole('article')
    expect(within(article).getByText('Ivy Reed')).toBeTruthy()
    expect(article.querySelector('.odc-avatar img').getAttribute('src')).toBe('https://img/ivy.png?w_64,c_limit')
  })

  it('has no author block when the reviewer was deleted (reviewer: null) or the key is absent, without an error', () => {
    props.userReviewState = {
      reviews: [{ ...REVIEWS[0], reviewer: null }, { ...REVIEWS[1] }],
      loading: false,
      error: null
    }
    render(<UserReviewDetailsUI {...props} />)
    const articles = screen.getAllByRole('article')
    expect(articles).toHaveLength(2)
    for (const article of articles) expect(article.querySelector('.odc-avatar')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('has no average when the row has no qualification, and only the count', () => {
    const user = { ...USER, qualification: null }
    const { container } = render(<UserReviewDetailsUI {...props} user={user} userState={{ user, loading: false, error: null }} />)
    const head = container.querySelector('.odc-rv-head')
    expect(within(head).queryByRole('img')).toBeNull()
    expect(head.textContent).not.toContain('—')
    expect(head.querySelector('.odc-rv-count').textContent).toBe('2 reviews')
  })

  it('reads the name from the fetched user when the page gave no row', () => {
    render(<UserReviewDetailsUI {...props} user={undefined} userState={{ user: { id: 5, name: 'Fetched', lastname: 'Person' }, loading: false, error: null }} />)
    expect(screen.getByRole('heading', { name: 'Fetched Person' })).toBeTruthy()
  })

  it('says there are no reviews yet, and the error with «Try again»', async () => {
    const { unmount } = render(<UserReviewDetailsUI {...props} userReviewState={{ reviews: [], loading: false, error: null }} />)
    expect(screen.getByText('No reviews yet')).toBeTruthy()
    unmount()
    render(<UserReviewDetailsUI {...props} userReviewState={{ reviews: [], loading: false, error: ['Boom'] }} />)
    expect(screen.getByRole('alert').textContent).toContain("We couldn't load the reviews.")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.reloadReviews).toHaveBeenCalledTimes(1)
  })

  it('shows skeletons while loading', () => {
    render(<UserReviewDetailsUI {...props} userReviewState={{ reviews: [], loading: true, error: null }} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('offers «Open as page» when the page gives onExpandedChange', async () => {
    const onExpandedChange = vi.fn()
    render(<UserReviewDetailsUI {...props} expanded={false} onExpandedChange={onExpandedChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(onExpandedChange).toHaveBeenCalledWith(true)
  })

  it('keeps the controller wrapper with the new UI', () => {
    render(<UserReviewDetails userId={5} />)
    expect(runtime.controllers.UserReviewDetails.userId).toBe(5)
    expect(runtime.controllers.UserReviewDetails.UIComponent).toBe(UserReviewDetailsUI)
  })
})

// ── Product ────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('ProductReviewDetails', () => {
  const PRODUCT = { id: 3, name: 'Margherita', images: 'https://img/pizza.png', category: { id: 2 }, reviews: { total: 4.5 } }
  const REVIEWS = [
    { id: 1, qualification: 5, comment: 'Delicious' },
    { id: 2, qualification: 4, comment: '' }
  ]
  let props

  beforeEach(() => {
    props = {
      businessId: 7,
      productId: 3,
      categoryId: 2,
      product: PRODUCT,
      productState: { product: PRODUCT, loading: false, error: null },
      productReviewList: { reviews: REVIEWS, loading: false, error: null },
      reloadReviews: vi.fn(),
      onClose: vi.fn()
    }
  })

  it('titles the panel with the product, a business avatar with its image and the count', () => {
    const { container } = render(<ProductReviewDetailsUI {...props} />)
    expect(screen.getByRole('heading', { name: 'Margherita' })).toBeTruthy()
    const head = container.querySelector('.odc-rv-head')
    expect(head.querySelector('.odc-avatar').getAttribute('data-kind')).toBe('business')
    expect(head.querySelector('.odc-avatar img').getAttribute('src')).toBe('https://img/pizza.png?h_120,c_limit')
    expect(head.querySelector('.odc-rv-count').textContent).toBe('2 reviews')
  })

  it('says «Liked» for a 5 and «Not liked» for the rest, with a decorative thumb and no note (RV-13)', () => {
    render(<ProductReviewDetailsUI {...props} />)
    const articles = screen.getAllByRole('article')
    expect(within(articles[0]).getByText('Liked')).toBeTruthy()
    expect(within(articles[0]).getByText('Delicious')).toBeTruthy()
    expect(within(articles[1]).getByText('Not liked')).toBeTruthy()
    expect(within(articles[1]).getByText('No comment')).toBeTruthy()
    for (const article of articles) {
      expect(within(article).queryByRole('img')).toBeNull()
      const thumb = article.querySelector('svg')
      expect(thumb.getAttribute('aria-hidden')).toBe('true')
      expect(article.querySelector('.odc-rv-breakdown')).toBeNull()
    }
    expect(articles[0].querySelector('svg').getAttribute('class')).toContain('lucide-thumbs-up')
    expect(articles[1].querySelector('svg').getAttribute('class')).toContain('lucide-thumbs-down')
  })

  it('keeps the controller wrapper with the new UI', () => {
    render(<ProductReviewDetails businessId={7} productId={3} categoryId={2} />)
    expect(runtime.controllers.ProductReviews.productId).toBe(3)
    expect(runtime.controllers.ProductReviews.UIComponent).toBe(ProductReviewDetailsUI)
  })

  it('has no «Open as page», as main', () => {
    render(<ProductReviewDetailsUI {...props} onExpandedChange={vi.fn()} expanded />)
    expect(screen.queryByRole('button', { name: 'Open as page' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back to split view' })).toBeNull()
  })

  it('says there are no reviews yet, and the error (it comes as `true`) with «Try again»', async () => {
    const { unmount } = render(<ProductReviewDetailsUI {...props} productReviewList={{ reviews: [], loading: false, error: null }} />)
    expect(screen.getByText('No reviews yet')).toBeTruthy()
    unmount()
    render(<ProductReviewDetailsUI {...props} productReviewList={{ reviews: [], loading: false, error: true }} />)
    expect(screen.getByRole('alert').textContent).toContain("We couldn't load the reviews.")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.reloadReviews).toHaveBeenCalledTimes(1)
  })

  it('shows skeletons while loading, and a skeleton for the name while there is no product', () => {
    const { container } = render(
      <ProductReviewDetailsUI
        {...props}
        product={undefined}
        productState={{ product: undefined, loading: true, error: null }}
        productReviewList={{ reviews: [], loading: true, error: null }}
      />
    )
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()
    expect(container.querySelector('.odc-record-title .odc-skeleton')).not.toBeNull()
  })
})

describe('the CSS of the panels', () => {
  const file = path.join(__dirname, '..', 'reviews-panel.css')
  const read = () => readFileSync(file, 'utf8')
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('has no literal color, size, weight, duration or z-index', () => {
    expect(scanSource(read(), file)).toEqual([])
  })

  it('has no literal in the components that use it, and none of them imports the old styles.js', () => {
    const base = path.join(__dirname, '..', '..')
    const sources = [
      'ReviewsDirectory/ReviewPanel.jsx',
      'ReviewsDirectory/ReviewRating.jsx',
      'ReviewsDirectory/ReviewItem.jsx',
      'BusinessReviewDetails/index.js',
      'UserReviewDetails/index.js',
      'ProductReviewDetails/index.js'
    ]
    for (const name of sources) {
      const source = readFileSync(path.join(base, name), 'utf8')
      expect(scanSource(source, name), name).toEqual([])
      expect(source, name).not.toMatch(/from '\.\/styles'/)
    }
  })

  it('has no physical direction property (RTL)', () => {
    expect(strip(read()).match(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right|top|bottom)\s*:|(?:^|[\s;{])(?:left|right|top|bottom|(?:min-|max-)?width|(?:min-|max-)?height)\s*:|text-align\s*:\s*(?:left|right)/gm) ?? []).toEqual([])
  })

  it('only uses the odc-rv prefix for its own classes', () => {
    // the Product pieces it dresses inside a review (the switch and the notice of a failed save) are not its own classes
    const own = (strip(read()).match(/\.[a-z][\w-]*/g) ?? []).filter(name => !name.startsWith('.odc-rv-') && !/^\.odc-(avatar|figure|state|record|switch|async-switch)/.test(name))
    expect(own).toEqual([])
  })

  // redesign reviews R1 (Q1-6): where the notice of a failed save is painted. jsdom has no layout, so the rules are read: the header of
  // a review is a grid of two columns (the author and the switch) and the notice is a second row across the whole header, at the end.
  // The switch is the same grid item before and after the notice, so it cannot jump to the next line, to the start.
  describe('the header of a review and the notice of a failed save (Q1-6)', () => {
    const PHONE = '@media (pointer: coarse), (max-width: 767px)'
    // the declarations of the rule(s) whose selector list has `selector`, as { property: value } (a later rule wins)
    const declarations = (css, selector) => {
      const found = {}
      let matched = false
      for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!selectors.split(',').map(item => item.trim()).includes(selector)) continue
        matched = true
        for (const line of body.split(';').map(item => item.trim()).filter(Boolean)) {
          const at = line.indexOf(':')
          found[line.slice(0, at).trim()] = line.slice(at + 1).trim()
        }
      }
      return matched ? found : null
    }
    // the CSS split in what is outside any @media and the body of the phone @media (braces matched)
    const split = () => {
      const css = strip(read())
      const start = css.indexOf(PHONE)
      expect(start, 'the phone @media block').toBeGreaterThan(-1)
      let depth = 0
      let end = -1
      for (let index = css.indexOf('{', start); index < css.length; index++) {
        if (css[index] === '{') depth++
        if (css[index] === '}' && --depth === 0) { end = index; break }
      }
      expect(end, 'the phone @media block closes').toBeGreaterThan(start)
      return { base: css.slice(0, start) + css.slice(end + 1), phone: css.slice(css.indexOf('{', start) + 1, end) }
    }

    it('makes the header a grid of the author and the switch, which never wraps the switch to the next line', () => {
      const { base } = split()
      const head = declarations(base, '.odc-rv-item-head')
      expect(head.display).toBe('grid')
      expect(head['grid-template-columns']).toBe('minmax(0, 1fr) auto')
      expect(head).not.toHaveProperty('flex-wrap')
      expect(declarations(base, '.odc-rv-item-who')).toMatchObject({ 'grid-column': '1', 'grid-row': '1' })
    })

    it('keeps the action slot in the DOM but lets its children be grid items of the header (the switch is never moved by its notice)', () => {
      const { base } = split()
      expect(declarations(base, '.odc-rv-item-action').display).toBe('contents')
      expect(declarations(base, '.odc-rv-item-action .odc-async-switch').display).toBe('contents')
      // the switch: always the end of the first row, whatever the notice does
      expect(declarations(base, '.odc-rv-item-action .odc-switch')).toMatchObject({
        'grid-column': '2',
        'grid-row': '1',
        'justify-self': 'end'
      })
    })

    it('paints the notice in the row below, across the header, at the end, inside the width of the panel and without the margins of the Product notice', () => {
      const { base } = split()
      const notice = declarations(base, '.odc-rv-item-action .odc-async-switch-notice')
      expect(notice).toMatchObject({
        'grid-column': '1 / -1',
        'grid-row': '2',
        'justify-self': 'end',
        margin: '0'
      })
      // at most the width of a popover and never wider than the header
      expect(notice['max-inline-size']).toBe('min(var(--od-x-popover), 100%)')
    })

    it('keeps the phone rule: the switch is as tall as its 44 px area (so the first row is), and only on a phone', () => {
      const { phone, base } = split()
      // it was the slot that was 44 px tall; the slot has no box now, so the switch is (its track and text stay centred in it)
      expect(declarations(phone, '.odc-rv-item-action .odc-switch')['min-block-size']).toBe('var(--od-x-target-coarse)')
      expect(declarations(phone, '.odc-rv-item-action')).toBeNull()
      expect(declarations(base, '.odc-rv-item-action .odc-switch')).not.toHaveProperty('min-block-size')
      // the switch is not stretched or centred in the row: it keeps the start of it, as before
      expect(declarations(base, '.odc-rv-item-head')['align-items']).toBe('start')
      expect(declarations(phone, '.odc-rv-item-action .odc-switch')).not.toHaveProperty('align-self')
    })

    it('uses no physical direction in the new rules (RTL) and only logical keywords for the alignment', () => {
      const { base, phone } = split()
      const text = `${base}\n${phone}`
      expect(text).not.toMatch(/justify-self\s*:\s*(?:left|right)/)
      expect(text).not.toMatch(/(?:^|[\s;{])(?:margin|padding)-(?:left|right)\s*:/m)
    })
  })
})
