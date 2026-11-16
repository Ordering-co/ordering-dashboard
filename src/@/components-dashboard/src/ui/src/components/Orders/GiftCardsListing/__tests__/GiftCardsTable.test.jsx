/* eslint-disable import/first */
// redesign GC-B (| GC-01…GC-04, GC-14 | D2, D3, D10, audit F3, F4): the gift cards list as a Product DataTable (and RecordCards
// under 768px). The dates and the amounts go through functions that imitate the project's format (`MM/DD/YYYY hh:mm A`, `$ 25.00`),
// never the ISO the API sends; only the environment (language, the phone flag, the width of the table) is simulated. The Product
// wrappers are real.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ phone: false }))

// «2026-10-03 14:05:00» (what the API sends) → «10/03/2026 02:05 PM» (the project's format)
const projectDate = (value) => {
  const [day, time] = String(value).split(' ')
  const [year, month, date] = day.split('-')
  const [hours, minutes] = time.split(':')
  const hour = Number(hours)
  return `${month}/${date}/${year} ${String(hour % 12 || 12).padStart(2, '0')}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`
}
const projectPrice = (value) => `$ ${Number(value).toFixed(2)}`

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{ parseDate: projectDate, parsePrice: projectPrice }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { GiftCardsTable } from '../GiftCardsTable'

const ana = { id: 7, name: 'Ana', lastname: 'Pérez', cellphone: '555 0101', email: 'ana@example.com', photo: null }
const diego = { id: 8, name: 'Diego', lastname: '', cellphone: null, email: 'diego@example.com', photo: 'https://example.com/diego.png' }
const elena = { id: 9, name: 'Elena', lastname: 'Haas', cellphone: '555 0188', email: 'elena@example.com', photo: null }

// the code and the PIN come in the row: the code is drawn masked (row 42, P-1), the PIN never
const pending = {
  id: 101,
  amount: 25,
  status: 'pending',
  code: 'J418-AAAA-BBBB-FFHU',
  password: '482913',
  user_name: 'Bruno Rossi',
  user_email: 'bruno@example.com',
  created_at: '2026-10-03 14:05:00',
  activated_at: null,
  author: ana,
  activater: null,
  order_product: { order_id: 4521 }
}
const sent = {
  id: 102,
  amount: '50.5',
  status: 'sent',
  code: 'K999-CCCC-DDDD-GGHU',
  password: '771204',
  user_name: null,
  user_email: 'carla@example.com',
  created_at: '2026-10-04 09:30:00',
  activated_at: null,
  author: diego,
  activater: null,
  order_product: null
}
const redeemed = {
  id: 103,
  amount: 10,
  status: 'activated',
  code: 'L111-EEEE-FFFF-HHHU',
  password: '009911',
  user_name: 'Fabio',
  user_email: null,
  created_at: '2026-09-20 18:00:00',
  activated_at: '2026-10-05 09:30:00',
  author: ana,
  activater: elena,
  order_product: { order_id: 4600 }
}
const bare = { id: 104, amount: 5, status: 'expired', user_name: null, user_email: null, created_at: null, activated_at: null, author: null, activater: null, order_product: null }

let current
const draw = (props = {}) => {
  current = {
    cards: [pending, sent],
    loading: false,
    error: null,
    status: 'pending',
    searchValue: '',
    pageSize: 10,
    onClearSearch: vi.fn(),
    onLookIn: vi.fn(),
    onRetry: vi.fn(),
    ...props
  }
  return render(<MemoryRouter><GiftCardsTable {...current} /></MemoryRouter>)
}

// jsdom has no layout: the width of the table's scroller is simulated (DataTable hides the columns whose `hideBelow` is above it)
let observers = []
class FakeResizeObserver {
  constructor (callback) { this.callback = callback }
  observe () { observers.push(this) }
  unobserve () {}
  disconnect () { observers = observers.filter(observer => observer !== this) }
}
const resizeTo = (width) => act(() => { observers.forEach(observer => observer.callback([{ contentRect: { width } }])) })

const rowOf = (container, id) => container.querySelector(`tr[data-row-id="${id}"]`)
const cardOf = (container, id) => container.querySelector(`li[data-row-id="${id}"]`)
const codeInput = (id) => screen.getByLabelText(`Gift card code #${id}`, { selector: 'input' })
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent).filter(Boolean)

const PENDING_COLUMNS = ['Gift card', 'Amount', 'Status', 'Purchased by', 'Recipient', 'Purchased date']
const REDEEMED_COLUMNS = [...PENDING_COLUMNS, 'Redeemed by', 'Redeemed date']

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  mocks.phone = false
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GiftCardsTable columns (D2, D3)', () => {
  it('Pending: Gift card, Amount, Status, Purchased by, Recipient and Purchased date, in a table named «Gift Cards»', () => {
    draw()
    expect(headers()).toEqual(PENDING_COLUMNS)
    expect(screen.getByRole('table', { name: 'Gift Cards' })).toBeInTheDocument()
  })

  it('Redeemed adds «Redeemed by» and «Redeemed date», even when no row has the data', () => {
    draw({ status: 'activated', cards: [pending] })
    expect(headers()).toEqual(REDEEMED_COLUMNS)
  })

  it('Pending shows them only when a row of the page has a redeemer or a redeem date (audit F3)', () => {
    const { rerender } = draw({ cards: [pending, sent] })
    expect(headers()).toEqual(PENDING_COLUMNS)
    rerender(<MemoryRouter><GiftCardsTable {...current} cards={[pending, redeemed]} /></MemoryRouter>)
    expect(headers()).toEqual(REDEEMED_COLUMNS)
  })

  it('the Gift card cell is the row header: «#id» as a figure', () => {
    const { container } = draw()
    const header = within(rowOf(container, 101)).getByRole('rowheader')
    const id = within(header).getByText('#101')
    expect(id).toHaveClass('odc-figure')
    expect(id.tagName).toBe('BDI')
    expect(id).toHaveAttribute('dir', 'ltr')
  })

  // redesign (row 42, P-1): the code of the card is drawn masked, with P/SecretField; the PIN (`password`) is never drawn
  it('never draws the PIN of a card, and the code only inside a masked field, not as text', () => {
    const { container } = draw({ cards: [pending, sent, redeemed], status: 'activated' })
    for (const card of [pending, sent, redeemed]) {
      expect(container).not.toHaveTextContent(card.code)
      expect(container).not.toHaveTextContent(card.password)
      expect(codeInput(card.id)).toHaveValue(card.code)
      expect([...container.querySelectorAll('input')].some(input => input.value === card.password)).toBe(false)
    }
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('the code of each card is a masked field in the Gift card cell, named by the card (P-1)', () => {
    const { container } = draw()
    const cell = within(rowOf(container, 101)).getByRole('rowheader')
    const input = codeInput(101)
    expect(cell).toContainElement(input)
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('readonly')
    expect(within(cell).getByRole('button', { name: 'Show Gift card code #101' })).toHaveTextContent('Show')
    // each row has its own, with its own code
    expect(codeInput(102)).toHaveValue(sent.code)
    expect(within(rowOf(container, 102)).getByRole('button', { name: 'Show Gift card code #102' })).toBeInTheDocument()
  })

  it('Show reveals that code only, Hide masks it again', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(screen.getByRole('button', { name: 'Show Gift card code #101' }))
    expect(codeInput(101)).toHaveAttribute('type', 'text')
    expect(codeInput(102)).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Hide Gift card code #101' }))
    expect(codeInput(101)).toHaveAttribute('type', 'password')
  })

  it('shows how the code ends, as every secret field does', () => {
    const { container } = draw({ cards: [pending] })
    expect(rowOf(container, 101)).toHaveTextContent('Ends in …FFHU')
  })

  it('the code is not editable: typing changes nothing', async () => {
    const user = userEvent.setup()
    draw({ cards: [pending] })
    await user.type(codeInput(101), 'zz')
    expect(codeInput(101)).toHaveValue(pending.code)
  })

  it('a card with no code says «—» in the cell and has no field (empty, blank or missing)', () => {
    const { container } = draw({ cards: [{ ...pending, code: '' }, { ...sent, code: '   ' }, { ...redeemed, code: null }, bare], status: 'activated' })
    expect(container.querySelectorAll('input')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /^Show Gift card code/ })).toBeNull()
    for (const id of [101, 102, 103, 104]) {
      expect(within(rowOf(container, id)).getByRole('rowheader').querySelector('.odc-gc-none')).toHaveTextContent('—')
    }
  })

  it('the rows are plain: no checkbox, no row that opens (there is no detail)', () => {
    const { container } = draw()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(rowOf(container, 101)).not.toHaveAttribute('data-interactive')
    expect(rowOf(container, 101)).not.toHaveAttribute('tabindex')
  })
})

// redesign AC-D (G4): the rows were 98px at 1440 because the Gift card cell stacked «#id», «Order #n», the secret field
// and its «Ends in …» line, one under the other. The cell keeps all of it, in two lines: «#id · Order #n», and the field with its
// ending beside it (the ending wraps under the field only when the column is too narrow). The CSS is scoped to this table.
describe('GiftCardsTable compact Gift card cell (G4)', () => {
  const css = readFileSync(resolve(__dirname, '../gift-cards.css'), 'utf8')
  const rules = (selector) => {
    const declarations = {}
    for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!selectors.split(',').map(item => item.trim().replace(/\s+/g, ' ')).includes(selector)) continue
      body.split(';').map(item => item.trim()).filter(Boolean).forEach(item => {
        const index = item.indexOf(':')
        declarations[item.slice(0, index).trim()] = item.slice(index + 1).trim()
      })
    }
    return declarations
  }

  it('«#id» and «Order #n» share one line, and the secret field comes after it, in the same cell', () => {
    const { container } = draw({ cards: [pending] })
    const cell = within(rowOf(container, 101)).getByRole('rowheader')
    const head = cell.querySelector('.odc-gc-card-head')
    expect(head).not.toBeNull()
    expect(head).toContainElement(within(cell).getByText('#101'))
    expect(head).toContainElement(within(cell).getByRole('link', { name: /Order #4521/ }))
    expect(head).not.toContainElement(codeInput(101))
    expect(cell.querySelector('.odc-field')).toContainElement(codeInput(101))
    expect(head.compareDocumentPosition(codeInput(101)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a card without an order still draws its «#id» line, and nothing of the field is lost (Show, Ends in)', () => {
    const { container } = draw({ cards: [sent] })
    const cell = within(rowOf(container, 102)).getByRole('rowheader')
    expect(cell.querySelector('.odc-gc-card-head')).toHaveTextContent('#102')
    expect(within(cell).getByRole('button', { name: 'Show Gift card code #102' })).toBeInTheDocument()
    expect(cell).toHaveTextContent('Ends in …GGHU')
  })

  it('the field and its «Ends in» line sit in one row of the cell (the line wraps only when the column is narrow)', () => {
    const field = rules('.odc-gc-card .odc-field')
    expect(field.display).toBe('flex')
    expect(field['flex-wrap']).toBe('wrap')
    expect(field['align-items']).toBe('center')
    expect(rules('.odc-gc-card .odc-field-hint')['white-space']).toBe('nowrap')
    const head = rules('.odc-gc-card-head')
    expect(head.display).toBe('flex')
    expect(head['align-items']).toBe('center')
  })

  it('the compact layout is scoped to this table: no rule changes the field family or the phone cards', () => {
    expect(css).not.toMatch(/(^|\n)\s*\.odc-field\b/)
    expect(css).not.toMatch(/(^|\n)\s*\.odc-secret\b/)
    expect(css).not.toMatch(/\.odc-gc-card-actions[^{]*\.odc-field/)
  })
})

describe('GiftCardsTable cells', () => {
  // redesign in a narrow column (German at 1440) the recipient's email was cut anywhere («bruno@example.c / om»)
  it('an email offers its soft breaks after «@» and before each «.», and reads the same', () => {
    const { container } = draw()
    const email = within(rowOf(container, 101)).getByTitle('bruno@example.com')
    expect(email).toHaveTextContent('bruno@example.com')
    expect(email.innerHTML).toBe('bruno@<wbr>example<wbr>.com')
    // a phone stays as it is
    expect(within(rowOf(container, 101)).getByTitle('555 0101').innerHTML).toBe('555 0101')
  })

  it('«Order #n» is a link to that order (T5); a card with no order_product draws none and does not throw', () => {
    const { container } = draw()
    const link = within(rowOf(container, 101)).getByRole('link', { name: 'Order #4521' })
    expect(link).toHaveAttribute('href', '/orders?id=4521')
    expect(within(rowOf(container, 102)).queryByRole('link')).toBeNull()
  })

  it('the amount goes through the project’s price format, in a figure', () => {
    const { container } = draw()
    const amount = within(rowOf(container, 101)).getByText('$ 25.00')
    expect(amount).toHaveClass('odc-figure')
    expect(within(rowOf(container, 102)).getByText('$ 50.50')).toBeInTheDocument()
  })

  it('the dates go through the project’s date format, never ISO (GC-01)', () => {
    const { container } = draw({ status: 'activated', cards: [redeemed] })
    const row = rowOf(container, 103)
    expect(within(row).getByText('09/20/2026 06:00 PM')).toBeInTheDocument()
    expect(within(row).getByText('10/05/2026 09:30 AM')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('a missing date draws nothing (Purchased date) or a dash (Redeemed date); never «invalid format»', () => {
    const { container } = draw({ status: 'activated', cards: [bare] })
    expect(container.textContent).not.toMatch(/invalid/i)
    const cells = Array.from(rowOf(container, 104).querySelectorAll('td'))
    expect(cells[cells.length - 1]).toHaveTextContent('—')
  })

  it('the status: Pending, Sent and Redeemed each in its family; any other value in pending with its own text', () => {
    const { container } = draw({ cards: [pending, sent, redeemed, bare], status: 'activated' })
    const statusOf = (id) => rowOf(container, id).querySelector('.odc-status')
    expect(statusOf(101)).toHaveAttribute('data-family', 'pending')
    expect(statusOf(101)).toHaveTextContent('Pending')
    expect(statusOf(102)).toHaveAttribute('data-family', 'progress')
    expect(statusOf(102)).toHaveTextContent('Sent')
    expect(statusOf(103)).toHaveAttribute('data-family', 'done')
    expect(statusOf(103)).toHaveTextContent('Redeemed')
    expect(statusOf(104)).toHaveAttribute('data-family', 'pending')
    expect(statusOf(104)).toHaveTextContent('expired')
  })

  it('Purchased by: the name with initials when there is no photo (GC-04), and under it the phone', () => {
    const { container } = draw()
    const row = rowOf(container, 101)
    const avatar = row.querySelector('.odc-avatar')
    expect(avatar).toHaveAttribute('data-kind', 'person')
    expect(avatar.querySelector('img')).toBeNull()
    expect(avatar).toHaveTextContent('AP')
    const name = within(row).getByText('Ana Pérez')
    expect(name.tagName).toBe('BDI')
    expect(name).toHaveAttribute('dir', 'auto')
    expect(within(row).getByText('555 0101')).toBeInTheDocument()
  })

  it('Purchased by: the photo when there is one, and the email when there is no phone', () => {
    const { container } = draw()
    const row = rowOf(container, 102)
    expect(row.querySelector('.odc-avatar img')).toHaveAttribute('src', 'https://example.com/diego.png')
    expect(within(row).getByText('Diego')).toBeInTheDocument()
    expect(within(row).getByText('diego@example.com')).toBeInTheDocument()
  })

  it('Purchased by with no author says «—», and draws no empty avatar box', () => {
    const { container } = draw({ cards: [bare] })
    const cells = Array.from(rowOf(container, 104).querySelectorAll('td'))
    expect(cells[2]).toHaveTextContent('—') // Purchased by (the Gift card cell is the row header)
    expect(rowOf(container, 104).querySelector('.odc-avatar')).toBeNull()
  })

  it('Recipient: the name and under it the email; only one of them is drawn alone; none says «—»', () => {
    const { container } = draw({ cards: [pending, sent, bare] })
    const first = rowOf(container, 101)
    expect(within(first).getByText('Bruno Rossi')).toBeInTheDocument()
    expect(within(first).getByText('bruno@example.com')).toBeInTheDocument()
    const second = rowOf(container, 102)
    expect(within(second).getByText('carla@example.com')).toBeInTheDocument()
    const cells = Array.from(rowOf(container, 104).querySelectorAll('td'))
    expect(cells[3]).toHaveTextContent('—') // Recipient
  })

  it('Redeemed by: the redeemer with initials and phone, as the buyer; none says «—»', () => {
    const { container } = draw({ status: 'activated', cards: [redeemed, { ...redeemed, id: 105, activater: null, activated_at: null }] })
    const row = rowOf(container, 103)
    expect(within(row).getByText('Elena Haas')).toBeInTheDocument()
    expect(within(row).getByText('555 0188')).toBeInTheDocument()
    expect(Array.from(row.querySelectorAll('.odc-avatar')).map(avatar => avatar.textContent)).toContain('EH')
    const cells = Array.from(rowOf(container, 105).querySelectorAll('td'))
    expect(cells[cells.length - 2]).toHaveTextContent('—')
  })
})

describe('GiftCardsTable width priority (audit F4): nothing is lost when a column steps aside', () => {
  // everything the Pending row says, whichever place it is drawn in
  const expectEveryDatumOfPending = (row) => {
    for (const text of ['#101', '$ 25.00', 'Pending', 'Ana Pérez', '555 0101', 'Bruno Rossi', 'bruno@example.com', '10/03/2026 02:05 PM']) {
      expect(row).toHaveTextContent(text)
    }
    expect(within(row).getByRole('link', { name: 'Order #4521' })).toBeInTheDocument()
  }

  it('wide: all six columns, the recipient and the date in their own', () => {
    const { container } = draw()
    resizeTo(1280)
    expect(headers()).toEqual(PENDING_COLUMNS)
    expectEveryDatumOfPending(rowOf(container, 101))
  })

  // redesign GC-B (live 1024): the widths are the ones measured live (dates carry the time), so at 728px Purchased date steps
  // aside too; both move to the Gift card cell
  it('at 900px of table Recipient steps aside first and moves to the Gift card cell', () => {
    const { container } = draw()
    resizeTo(900)
    expect(headers()).toEqual(['Gift card', 'Amount', 'Status', 'Purchased by', 'Purchased date'])
    const row = rowOf(container, 101)
    expect(within(row.querySelector('th')).getByText('Bruno Rossi')).toBeInTheDocument()
    expect(within(row.querySelector('th')).getByText('bruno@example.com')).toBeInTheDocument()
    expectEveryDatumOfPending(row)
  })

  it('at 1024 (about 728px of table beside the menu): Recipient and Purchased date move to the Gift card cell', () => {
    const { container } = draw()
    resizeTo(728)
    expect(headers()).toEqual(['Gift card', 'Amount', 'Status', 'Purchased by'])
    const row = rowOf(container, 101)
    expect(within(row.querySelector('th')).getByText('Bruno Rossi')).toBeInTheDocument()
    expect(within(row.querySelector('th')).getByText('10/03/2026 02:05 PM')).toBeInTheDocument()
    expectEveryDatumOfPending(row)
  })

  it('narrower: Purchased date goes next and the Gift card cell takes it too', () => {
    const { container } = draw()
    resizeTo(600)
    expect(headers()).toEqual(['Gift card', 'Amount', 'Status', 'Purchased by'])
    const row = rowOf(container, 101)
    expect(within(row.querySelector('th')).getByText('10/03/2026 02:05 PM')).toBeInTheDocument()
    expectEveryDatumOfPending(row)
  })

  it('Redeemed at 1024 keeps every datum too: Redeemed by in its column, Redeemed date in the Gift card cell', () => {
    const { container } = draw({ status: 'activated', cards: [redeemed] })
    resizeTo(728)
    const row = rowOf(container, 103)
    expect(headers()).toEqual(['Gift card', 'Amount', 'Status', 'Purchased by', 'Redeemed by'])
    expect(row.querySelector('th')).toHaveTextContent('10/05/2026 09:30 AM')
    for (const text of ['#103', '$ 10.00', 'Redeemed', 'Ana Pérez', 'Fabio', '09/20/2026 06:00 PM', 'Elena Haas', '555 0188', '10/05/2026 09:30 AM']) {
      expect(row).toHaveTextContent(text)
    }
    expect(within(row).getByRole('link', { name: 'Order #4600' })).toBeInTheDocument()
  })
})

describe('GiftCardsTable states (GC-02, GC-03, D10)', () => {
  it('loading: `pageSize` skeleton rows, the table busy, and the label read once', () => {
    const { container } = draw({ loading: true, cards: [], pageSize: 7 })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(7)
    expect(screen.getByRole('table', { name: 'Gift Cards' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading gift cards')).toBeInTheDocument()
  })

  it('error: replaces the list with the message and «Retry», which asks again', async () => {
    draw({ error: ['Internal error'], cards: [] })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load the gift cards.")
    expect(alert).toHaveTextContent('Internal error')
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
  })

  it('an empty list of errors is not an error', () => {
    draw({ error: [], cards: [] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table', { name: 'Gift Cards' })).toBeInTheDocument()
  })

  it('error without a message of the API says only the generic line', () => {
    draw({ error: true, cards: [] })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the gift cards.")
    expect(screen.getByRole('alert').querySelector('.odc-state-text')).toBeNull()
  })

  it('empty Pending, empty Redeemed and any other status each say what is missing', () => {
    const { rerender } = draw({ cards: [], status: 'pending' })
    expect(screen.getByText('No pending gift cards')).toBeInTheDocument()
    rerender(<MemoryRouter><GiftCardsTable {...current} cards={[]} status='activated' /></MemoryRouter>)
    expect(screen.getByText('No redeemed gift cards')).toBeInTheDocument()
    rerender(<MemoryRouter><GiftCardsTable {...current} cards={[]} status='sent' /></MemoryRouter>)
    expect(screen.getByText('No gift cards')).toBeInTheDocument()
  })

  it('no match in Pending: «Clear search» and «Look in Redeemed», which switches the tab', async () => {
    draw({ cards: [], status: 'pending', searchValue: 'zzz' })
    expect(screen.getByText('No gift cards match')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(current.onClearSearch).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Look in Redeemed' }))
    expect(current.onLookIn).toHaveBeenCalledWith('activated')
  })

  it('no match in Redeemed offers «Look in Pending»', async () => {
    draw({ cards: [], status: 'activated', searchValue: 'zzz' })
    expect(screen.queryByRole('button', { name: 'Look in Redeemed' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Look in Pending' }))
    expect(current.onLookIn).toHaveBeenCalledWith('pending')
  })

  it('a search of only spaces is not a search: the plain empty state', () => {
    draw({ cards: [], status: 'pending', searchValue: '   ' })
    expect(screen.getByText('No pending gift cards')).toBeInTheDocument()
    expect(screen.queryByText('No gift cards match')).toBeNull()
  })
})

describe('GiftCardsTable on a phone (audit F4): one card per row with every datum', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards, not a table, named «Gift Cards», with no checkbox', () => {
    const { container } = draw({ cards: [pending, sent] })
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('list', { name: 'Gift Cards' })).toBeInTheDocument()
    expect(container.querySelectorAll('li[data-row-id]')).toHaveLength(2)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('a Pending card: the id, the status, the amount, the buyer with phone, the recipient, the purchase date and the order link', () => {
    const { container } = draw({ cards: [pending] })
    const card = cardOf(container, 101)
    expect(within(card).getByText('#101')).toHaveClass('odc-figure')
    expect(card.querySelector('.odc-status')).toHaveAttribute('data-family', 'pending')
    expect(within(card).getByText('$ 25.00')).toHaveClass('odc-figure')
    expect(card.querySelector('.odc-order-card-people')).toHaveTextContent('Ana Pérez')
    expect(card.querySelector('.odc-order-card-people')).toHaveTextContent('555 0101')
    expect(card.querySelector('.odc-order-card-people')).toHaveTextContent('Bruno Rossi')
    expect(card.querySelector('.odc-order-card-people')).toHaveTextContent('bruno@example.com')
    expect(card.querySelector('.odc-order-card-when')).toHaveTextContent('Purchased 10/03/2026 02:05 PM')
    expect(within(card).getByRole('link', { name: 'Order #4521' })).toHaveAttribute('href', '/orders?id=4521')
  })

  it('a Redeemed card adds «Redeemed _date_ by _name_» with the redeemer’s phone', () => {
    const { container } = draw({ cards: [redeemed], status: 'activated' })
    const when = cardOf(container, 103).querySelector('.odc-order-card-when')
    expect(when).toHaveTextContent('Purchased 09/20/2026 06:00 PM')
    expect(when).toHaveTextContent('Redeemed 10/05/2026 09:30 AM by Elena Haas · 555 0188')
  })

  it('a card without recipient, order or dates still draws (no throw, no empty link)', () => {
    const { container } = draw({ cards: [bare] })
    const card = cardOf(container, 104)
    expect(card).toHaveTextContent('#104')
    expect(card).toHaveTextContent('expired')
    expect(card).toHaveTextContent('—')
    expect(within(card).queryByRole('link', { name: /^Order/ })).toBeNull()
    expect(container.textContent).not.toMatch(/invalid/i)
  })

  // redesign (row 42, P-1): the phone cards carry the same masked code
  it('a card has its code masked in the actions area, with Show, and no code as text', async () => {
    const user = userEvent.setup()
    const { container } = draw({ cards: [pending, bare] })
    const card = cardOf(container, 101)
    const input = within(card).getByLabelText('Gift card code #101', { selector: 'input' })
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveValue(pending.code)
    expect(input.closest('[data-card-actions]')).not.toBeNull()
    expect(card).not.toHaveTextContent(pending.code)
    expect(card).not.toHaveTextContent(pending.password)
    await user.click(within(card).getByRole('button', { name: 'Show Gift card code #101' }))
    expect(input).toHaveAttribute('type', 'text')
  })

  it('a card with no code says «—» for it and draws no field', () => {
    const { container } = draw({ cards: [bare] })
    expect(container.querySelectorAll('input')).toHaveLength(0)
    expect(cardOf(container, 104).querySelector('[data-card-actions] .odc-gc-none')).toHaveTextContent('—')
  })

  it('the order link sits in the actions area, above the card’s overlay', () => {
    const { container } = draw({ cards: [pending] })
    const link = within(cardOf(container, 101)).getByRole('link', { name: 'Order #4521' })
    expect(link.closest('[data-card-actions]')).not.toBeNull()
  })

  // redesign (row 69): a gift card has no detail URL, so its title is not an <a> without href
  it('a card is not a link: no anchor without href, the title is plain text', () => {
    const { container } = draw({ cards: [pending, bare] })
    expect(container.querySelectorAll('a:not([href])')).toHaveLength(0)
    const card = cardOf(container, 101)
    expect(card.querySelector('.odc-order-card-title')).toHaveTextContent('#101')
    expect(within(card).getByRole('link', { name: 'Order #4521' })).toHaveAttribute('href', '/orders?id=4521')
  })

  it('loading draws `pageSize` skeleton cards; empty and error use the same states as the table', async () => {
    const { container, unmount } = draw({ loading: true, cards: [], pageSize: 4 })
    expect(container.querySelectorAll('li[data-skeleton]')).toHaveLength(4)
    unmount()
    const second = draw({ cards: [], status: 'activated' })
    expect(screen.getByText('No redeemed gift cards')).toBeInTheDocument()
    second.unmount()
    draw({ cards: [], error: ['Internal error'] })
    expect(screen.getByRole('alert')).toHaveTextContent('Internal error')
  })
})

// (T10): a deleted user's phone comes from the API as «7443172700_deleted_SzbeHbPZkk»: the table shows the phone clean and says in text that the user was deleted
describe('GiftCardsTable deleted users', () => {
  const gone = { id: 31, name: 'Ana', lastname: 'Pérez', cellphone: '7443172700_deleted_SzbeHbPZkk', email: 'ana@example.com', photo: null }
  const goneToo = { ...elena, cellphone: '5550188_deleted_QwErTy' }
  const deletedCard = { ...redeemed, id: 105, author: gone, activater: goneToo }

  it('the Purchased by and Redeemed by cells show the clean phone and «User deleted», never «_deleted_»', () => {
    const { container } = draw({ status: 'activated', cards: [deletedCard, redeemed] })
    const row = rowOf(container, 105)
    expect(row.textContent).not.toContain('_deleted_')
    expect(row.textContent).not.toContain('SzbeHbPZkk')
    expect(within(row).getAllByText('User deleted')).toHaveLength(2)
    expect(within(row).getByText('7443172700')).toBeInTheDocument()
    expect(within(row).getByText('5550188')).toBeInTheDocument()
    // a user who is not deleted carries no such line
    expect(within(rowOf(container, 103)).queryByText('User deleted')).toBeNull()
  })

  it('on a phone the card shows it too, and the «Redeemed by» line is clean', () => {
    mocks.phone = true
    const nameless = { ...goneToo, name: '', lastname: '' }
    const { container } = draw({ status: 'activated', cards: [{ ...deletedCard, activated_at: null, activater: nameless }] })
    const card = cardOf(container, 105)
    expect(card.textContent).not.toContain('_deleted_')
    expect(within(card).getAllByText('User deleted').length).toBeGreaterThanOrEqual(1)
    expect(card).toHaveTextContent('Redeemed by 5550188')
  })

  // (review): the phone card has no Redeemed by cell, so the «Redeemed … by» line says it of the redeemer itself
  it('on a phone the «Redeemed» line says «User deleted» when only the redeemer is deleted', () => {
    mocks.phone = true
    const { container } = draw({ status: 'activated', cards: [{ ...redeemed, id: 106, activater: goneToo }] })
    const card = cardOf(container, 106)
    expect(card.textContent).not.toContain('_deleted_')
    expect(card).toHaveTextContent(/5550188 · User deleted/)
  })
})
