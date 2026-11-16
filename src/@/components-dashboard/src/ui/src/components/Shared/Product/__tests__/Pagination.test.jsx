// redesign W0-7 (T0-23): the Pagination wrapper.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from '../Pagination'

const range = (from, to, total) => total == null ? `Showing ${from}–${to}` : `Showing ${from}–${to} of ${total}`
const pageOf = totalPages => `of ${totalPages}`

const NAMES = {
  label: 'Orders pages',
  previousLabel: 'Previous page',
  nextLabel: 'Next page',
  pageSizeLabel: 'Items per page',
  pageLabel: 'Page',
  rangeLabel: range,
  pageStatusLabel: (page, totalPages) => totalPages == null ? `Page ${page}` : `Page ${page} of ${totalPages}`
}

const setup = (props = {}) => {
  const onPageChange = vi.fn()
  const onPageSizeChange = vi.fn()
  const ui = extra => (
    <Pagination
      page={1}
      pageSize={10}
      total={123}
      pageSizeOptions={[10, 25, 50]}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      {...NAMES}
      {...props}
      {...extra}
    />
  )
  const view = render(ui())
  return { onPageChange, onPageSizeChange, rerenderWith: extra => view.rerender(ui(extra)), ...view }
}

const previous = () => screen.getByRole('button', { name: 'Previous page' })
const next = () => screen.getByRole('button', { name: 'Next page' })

describe('Product Pagination', () => {
  it('is a nav region with the name it is given and two named buttons', () => {
    setup()
    const nav = screen.getByRole('navigation', { name: 'Orders pages' })
    expect(within(nav).getByRole('button', { name: 'Previous page' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Next page' })).toBeInTheDocument()
  })

  it('disables previous on the first page and calls onPageChange(page + 1) from next', async () => {
    const user = userEvent.setup()
    const { onPageChange } = setup()
    expect(previous()).toBeDisabled()
    expect(next()).toBeEnabled()
    await user.click(next())
    expect(onPageChange).toHaveBeenCalledTimes(1)
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange(page - 1) from previous and disables next on the last page', async () => {
    const user = userEvent.setup()
    const { onPageChange } = setup({ page: 13 })
    expect(next()).toBeDisabled()
    await user.click(previous())
    expect(onPageChange).toHaveBeenCalledWith(12)
  })

  it('computes the range: first page, a middle page, and a last page that is not full', () => {
    const { rerenderWith } = setup()
    expect(screen.getByText('Showing 1–10 of 123')).toBeInTheDocument()
    rerenderWith({ page: 2, pageSize: 25 })
    expect(screen.getByText('Showing 26–50 of 123')).toBeInTheDocument()
    rerenderWith({ page: 13, pageSize: 10 })
    expect(screen.getByText('Showing 121–123 of 123')).toBeInTheDocument()
  })

  it('hands the label the figures wrapped in .odc-figure nodes, and a plain string stays one string', () => {
    const { container, rerenderWith } = setup({
      rangeLabel: (from, to, total, figure) => <>Showing {figure(from)}–{figure(to)} of {figure(total)}</>
    })
    expect([...container.querySelectorAll('.odc-figure')].map(node => node.textContent)).toEqual(['1', '10', '123'])
    rerenderWith({ rangeLabel: range })
    expect(container.querySelector('.odc-pagination-range').children).toHaveLength(0)
  })

  it('offers the page sizes, marks the current one and reports a choice with the page that keeps the first item', async () => {
    const user = userEvent.setup()
    const { onPageSizeChange } = setup({ page: 3, pageSize: 10 })
    const trigger = screen.getByRole('button', { name: 'Items per page 10' })
    await user.click(trigger)
    expect(await screen.findByRole('menuitemradio', { name: '10' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('menuitemradio', { name: '25' }))
    // the first item of page 3 at 10 per page is the 21st: at 25 per page it is on page 1
    expect(onPageSizeChange).toHaveBeenCalledWith(25, 1)
  })

  it('adds the current size to the options when the options do not include it', async () => {
    const user = userEvent.setup()
    setup({ pageSize: 20 })
    await user.click(screen.getByRole('button', { name: 'Items per page 20' }))
    await screen.findByRole('menu')
    expect(screen.getAllByRole('menuitemradio').map(item => item.textContent)).toEqual(['10', '20', '25', '50'])
  })

  it('has no size selector without options or without onPageSizeChange', () => {
    const { rerenderWith } = setup({ pageSizeOptions: undefined })
    expect(screen.queryByText('Items per page')).not.toBeInTheDocument()
    rerenderWith({ pageSizeOptions: [10, 25], onPageSizeChange: undefined })
    expect(screen.queryByText('Items per page')).not.toBeInTheDocument()
  })

  describe('page field', () => {
    it('is absent unless showPageInput is on and there is more than one page', () => {
      const { rerenderWith } = setup()
      expect(screen.queryByRole('textbox', { name: 'Page' })).not.toBeInTheDocument()
      rerenderWith({ showPageInput: true, total: 5 })
      expect(screen.queryByRole('textbox', { name: 'Page' })).not.toBeInTheDocument()
    })

    it('jumps on Enter, clamps a page out of range and ignores letters', async () => {
      const user = userEvent.setup()
      const { onPageChange } = setup({ showPageInput: true, pageOfLabel: pageOf })
      const field = screen.getByRole('textbox', { name: 'Page' })
      expect(field).toHaveValue('1')
      expect(screen.getByText('of 13')).toBeInTheDocument()
      await user.clear(field)
      await user.type(field, '7x{Enter}')
      expect(onPageChange).toHaveBeenLastCalledWith(7)
      await user.clear(field)
      await user.type(field, '99{Enter}')
      expect(onPageChange).toHaveBeenLastCalledWith(13)
    })

    it('Escape puts the current page back without jumping', async () => {
      const user = userEvent.setup()
      const { onPageChange } = setup({ showPageInput: true })
      const field = screen.getByRole('textbox', { name: 'Page' })
      await user.clear(field)
      await user.type(field, '4{Escape}')
      expect(field).toHaveValue('1')
      expect(onPageChange).not.toHaveBeenCalled()
    })
  })

  describe('without a known total (hasMore)', () => {
    it('enables next only while there is more, and ends the range where the items end', async () => {
      const user = userEvent.setup()
      const { onPageChange, rerenderWith } = setup({ total: undefined, hasMore: true, page: 2 })
      expect(screen.getByText('Showing 11–20')).toBeInTheDocument()
      await user.click(next())
      expect(onPageChange).toHaveBeenCalledWith(3)
      rerenderWith({ hasMore: false, itemCount: 4 })
      expect(next()).toBeDisabled()
      expect(screen.getByText('Showing 11–14')).toBeInTheDocument()
    })

    it('paints nothing for an empty first page and keeps the foot on a page past the end', () => {
      const { container, rerenderWith } = setup({ total: undefined, itemCount: 0, page: 1 })
      expect(container).toBeEmptyDOMElement()
      rerenderWith({ page: 3 })
      expect(screen.getByRole('navigation', { name: 'Orders pages' })).toBeInTheDocument()
    })
  })

  it('paints nothing when there are no results', () => {
    const { container } = setup({ total: 0 })
    expect(container).toBeEmptyDOMElement()
  })

  describe('busy', () => {
    it('marks the region busy and keeps the buttons enabled but inert', async () => {
      const user = userEvent.setup()
      const { onPageChange } = setup({ page: 2, busy: true })
      const nav = screen.getByRole('navigation', { name: 'Orders pages' })
      expect(nav).toHaveAttribute('aria-busy', 'true')
      expect(nav).toHaveAttribute('data-busy', 'true')
      expect(next()).toBeEnabled()
      await user.click(next())
      expect(onPageChange).not.toHaveBeenCalled()
    })
  })

  it('hands the focus to the other button when the pressed one reaches its edge', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = setup({ page: 12 })
    next().focus()
    await user.click(next())
    rerenderWith({ page: 13 })
    expect(next()).toBeDisabled()
    expect(previous()).toHaveFocus()
  })

  it('reaches the buttons and the size menu with the keyboard, in reading order', async () => {
    const user = userEvent.setup()
    setup({ page: 2 })
    await user.tab()
    expect(screen.getByRole('button', { name: 'Items per page 10' })).toHaveFocus()
    await user.tab()
    expect(previous()).toHaveFocus()
    await user.tab()
    expect(next()).toHaveFocus()
    await user.keyboard('{Enter}')
  })

  it('flips the chevrons in RTL', () => {
    setup()
    for (const button of [previous(), next()]) expect(button.querySelector('.odc-icon-flip')).toBeInTheDocument()
  })

  describe('names', () => {
    it.each([
      ['label', 'Pagination needs a label'],
      ['previousLabel', 'Pagination needs a previousLabel'],
      ['nextLabel', 'Pagination needs a nextLabel'],
      ['rangeLabel', 'Pagination needs a rangeLabel']
    ])('throws without %s, also when it is null', (prop, message) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      for (const value of [undefined, null]) {
        expect(() => setup({ [prop]: value })).toThrow(message)
      }
      error.mockRestore()
    })

    it('throws without pageSizeLabel when the selector is there, and without pageLabel when the page field is', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => setup({ pageSizeLabel: undefined })).toThrow('Pagination needs a pageSizeLabel')
      expect(() => setup({ showPageInput: true, pageLabel: undefined })).toThrow('Pagination needs a pageLabel')
      error.mockRestore()
    })

    it('does not ask for the names of parts it does not draw', () => {
      setup({ pageSizeOptions: undefined, pageSizeLabel: undefined, pageLabel: undefined })
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it("paints an empty label as empty: '' is a name, only a missing one throws", () => {
      setup({ label: '', previousLabel: '', nextLabel: '' })
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', '')
      expect(screen.getAllByRole('button')[1]).toHaveAttribute('aria-label', '')
    })
  })

  describe('phone targets (decision 12)', () => {
    const css = readFileSync(resolve(__dirname, '..', 'pagination.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const phone = css.slice(css.indexOf('@media (pointer: coarse), (max-width: 767px)'))

    it('makes the buttons and the page field 44px visible below 768px or with a coarse pointer', () => {
      expect(phone).toMatch(/\.odc-pagination \.odc-btn\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
      expect(phone).toMatch(/\[data-icon-only\]\s*\{[^}]*min-inline-size:\s*var\(--od-x-target-coarse\)/)
      expect(phone).toMatch(/\.odc-pagination-input\s*\{\s*block-size:\s*var\(--od-x-target-coarse\)/)
    })
  })
})
