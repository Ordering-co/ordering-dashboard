import React from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  Popup: ({ UIComponent, open, ...props }) => (open ? <UIComponent {...props} open={open} /> : null),
  HtmlEditor: ({ UIComponent, ...props }) => <UIComponent {...props} imageListState={{ images: [], loading: false }} insertImageState={{ loading: false, change: {} }} />
}))

import { RichHtmlEditor } from '..'

beforeAll(() => {
  Range.prototype.getClientRects = () => []
  Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 })
  document.elementFromPoint = () => null
})

const renderEditor = (value) => {
  const onChange = vi.fn()
  const view = renderWithProviders(<RichHtmlEditor label='Home content' value={value} onChange={onChange} />)
  const rerender = (next) => view.rerender(<RichHtmlEditor label='Home content' value={next} onChange={onChange} />)
  return { onChange, rerender }
}

const field = () => screen.getByRole('textbox', { name: 'Home content' })
const htmlToggle = () => screen.getByRole('button', { name: 'Edit as HTML' })

describe('RichHtmlEditor', () => {
  it('edits in the visual editor the HTML it can keep', () => {
    renderEditor('<p><b>Open</b> every day</p>')
    expect(field()).toHaveAttribute('contenteditable', 'true')
    expect(field().querySelector('strong')).toHaveTextContent('Open')
    expect(htmlToggle()).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens as HTML, and saves as it is, what the visual editor would change', () => {
    const { onChange } = renderEditor('<div class="row">Open</div>')
    expect(field()).toHaveValue('<div class="row">Open</div>')
    expect(htmlToggle()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('the visual editor can’t keep')
    fireEvent.change(field(), { target: { value: '<div class="row">Closed</div>' } })
    expect(onChange).toHaveBeenLastCalledWith('<div class="row">Closed</div>')
    fireEvent.click(htmlToggle())
    expect(field()).toHaveValue('<div class="row">Closed</div>')
  })

  it('switches to HTML and back to the visual editor', () => {
    const { onChange, rerender } = renderEditor('<p>Open</p>')
    fireEvent.click(htmlToggle())
    expect(field()).toHaveValue('<p>Open</p>')
    fireEvent.change(field(), { target: { value: '<p>Closed</p>' } })
    expect(onChange).toHaveBeenLastCalledWith('<p>Closed</p>')
    rerender('<p>Closed</p>')
    fireEvent.click(htmlToggle())
    expect(field()).toHaveAttribute('contenteditable', 'true')
    expect(field()).toHaveTextContent('Closed')
  })

  it('stays in HTML when the code has what the visual editor can’t keep', () => {
    const { rerender } = renderEditor('<p>Open</p>')
    fireEvent.click(htmlToggle())
    fireEvent.change(field(), { target: { value: '<script>track()</script>' } })
    rerender('<script>track()</script>')
    fireEvent.click(htmlToggle())
    expect(field()).toHaveValue('<script>track()</script>')
    expect(screen.getByRole('status')).toHaveTextContent('the visual editor can’t keep')
  })

  it('makes a list with the toolbar', () => {
    const { onChange } = renderEditor('<p>Open</p>')
    fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }))
    expect(onChange).toHaveBeenLastCalledWith('<ul><li>Open</li></ul>')
  })

  it('changes the text style with the toolbar', () => {
    const { onChange } = renderEditor('<p>Open</p>')
    fireEvent.change(screen.getByRole('combobox', { name: 'Text style' }), { target: { value: 'h2' } })
    expect(onChange).toHaveBeenLastCalledWith('<h2>Open</h2>')
    expect(screen.getByRole('combobox', { name: 'Text style' })).toHaveValue('h2')
  })

  it('disables the formatting while it edits as HTML', () => {
    renderEditor('<p>Open</p>')
    fireEvent.click(htmlToggle())
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled()
    expect(htmlToggle()).toBeEnabled()
  })

  it('shows a value set from outside, like a reset, without saving it', () => {
    const { onChange, rerender } = renderEditor('<div class="row">Open</div>')
    rerender('')
    expect(field()).toHaveAttribute('contenteditable', 'true')
    expect(field()).toHaveTextContent('')
    expect(screen.queryByRole('status')).toBeNull()
    rerender('<p>Reset</p>')
    expect(field()).toHaveTextContent('Reset')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('inserts a link from the link dialog', () => {
    const { onChange } = renderEditor('<p>See:</p>')
    fireEvent.click(screen.getByRole('button', { name: 'Insert link' }))
    const dialog = screen.getByRole('heading', { name: 'Insert link' }).parentElement
    const [text, url] = within(dialog).getAllByRole('textbox')
    fireEvent.change(text, { target: { value: 'the menu', name: 'text' } })
    fireEvent.change(url, { target: { value: '/menu', name: 'url' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Insert' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<a target="_blank" href="/menu">the menu</a>'))
  })
})
