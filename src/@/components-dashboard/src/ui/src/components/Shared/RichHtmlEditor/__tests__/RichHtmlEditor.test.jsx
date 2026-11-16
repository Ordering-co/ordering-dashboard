import React from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  Popup: ({ UIComponent, open, ...props }) => (open ? <UIComponent {...props} open={open} /> : null),
  HtmlEditor: ({ UIComponent, ...props }) => <UIComponent {...props} imageListState={{ images: [], loading: false }} insertImageState={{ loading: false, change: {} }} />
}))

// CodeMirror needs a real layout engine; here each code tab is a textarea.
vi.mock('../CodeEditor', () => ({
  default: ({ label, value, onChange }) => <textarea aria-label={label} defaultValue={value} onChange={(event) => onChange(event.target.value)} />
}))

import { RichHtmlEditor } from '..'

beforeAll(() => {
  Range.prototype.getClientRects = () => []
  Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 })
  document.elementFromPoint = () => null
})

const renderEditor = (value, extra = {}) => {
  const onChange = vi.fn()
  const view = renderWithProviders(<RichHtmlEditor label='Home content' value={value} onChange={onChange} {...extra} />)
  const rerender = (next) => view.rerender(<RichHtmlEditor label='Home content' value={next} onChange={onChange} {...extra} />)
  return { onChange, rerender, unmount: view.unmount }
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

  it('opens in the visual editor what it can’t keep, says so, and saves nothing by looking', () => {
    const { onChange } = renderEditor('<div class="row"><p>Open</p></div>')
    expect(field()).toHaveAttribute('contenteditable', 'true')
    expect(field()).toHaveTextContent('Open')
    expect(htmlToggle()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('status')).toHaveTextContent('the visual editor can’t show')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps that code whole under «Edit as HTML», where it is saved as it is', () => {
    const { onChange } = renderEditor('<div class="row">Open</div>')
    fireEvent.click(htmlToggle())
    expect(field()).toHaveValue('<div class="row">Open</div>')
    expect(screen.getByRole('status')).toHaveTextContent('it’s saved as it is')
    fireEvent.change(field(), { target: { value: '<div class="row">Closed</div>' } })
    expect(onChange).toHaveBeenLastCalledWith('<div class="row">Closed</div>')
    fireEvent.click(htmlToggle())
    expect(field()).toHaveAttribute('contenteditable', 'true')
    expect(field()).toHaveTextContent('Closed')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('drops the code it can’t keep once the content is edited in the visual editor, and the notice with it', () => {
    const { onChange } = renderEditor('<div class="row"><p>Open</p></div>')
    fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }))
    expect(onChange).toHaveBeenLastCalledWith('<ul><li>Open</li></ul>')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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

  it('goes back to the visual editor with code it can’t keep, and says so', () => {
    const { onChange, rerender } = renderEditor('<p>Open</p>')
    fireEvent.click(htmlToggle())
    fireEvent.change(field(), { target: { value: '<p>Open</p><script>track()</script>' } })
    rerender('<p>Open</p><script>track()</script>')
    expect(screen.getByRole('status')).toHaveTextContent('it’s saved as it is')
    fireEvent.click(htmlToggle())
    expect(field()).toHaveAttribute('contenteditable', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('the visual editor can’t show')
    expect(onChange).toHaveBeenCalledTimes(1)
    fireEvent.click(htmlToggle())
    expect(field()).toHaveValue('<p>Open</p><script>track()</script>')
  })

  it('tells the visual editor of an error that comes after it mounted', () => {
    const onChange = vi.fn()
    const view = renderWithProviders(<RichHtmlEditor label='Home content' value='<p>Open</p>' onChange={onChange} />)
    expect(field()).not.toHaveAttribute('aria-invalid')
    view.rerender(<RichHtmlEditor label='Home content' value='<p>Open</p>' onChange={onChange} invalid describedBy='body-error' />)
    expect(field()).toHaveAttribute('contenteditable', 'true')
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field()).toHaveAttribute('aria-describedby', 'body-error')
    view.rerender(<RichHtmlEditor label='Home content' value='<p>Open</p>' onChange={onChange} />)
    expect(field()).not.toHaveAttribute('aria-invalid')
    expect(field()).not.toHaveAttribute('aria-describedby')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('makes a list with the toolbar', () => {
    const { onChange } = renderEditor('<p>Open</p>')
    fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }))
    expect(onChange).toHaveBeenLastCalledWith('<ul><li>Open</li></ul>')
  })

  it('indents and outdents a paragraph by the step Summernote used', () => {
    const { onChange } = renderEditor('<p>Open</p>')
    fireEvent.click(screen.getByRole('button', { name: 'Increase indent' }))
    expect(onChange).toHaveBeenLastCalledWith('<p style="margin-left: 25px;">Open</p>')
    fireEvent.click(screen.getByRole('button', { name: 'Increase indent' }))
    expect(onChange).toHaveBeenLastCalledWith('<p style="margin-left: 50px;">Open</p>')
    fireEvent.click(screen.getByRole('button', { name: 'Decrease indent' }))
    fireEvent.click(screen.getByRole('button', { name: 'Decrease indent' }))
    expect(onChange).toHaveBeenLastCalledWith('<p>Open</p>')
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

  it('opens in the visual editor the markup Summernote wrote', () => {
    renderEditor('<p><font color="#ff0000">Red</font> <b>bold</b></p><p style="margin-left: 25px;">Indented</p>')
    expect(field()).toHaveAttribute('contenteditable', 'true')
    expect(field().querySelector('span')).toHaveStyle({ color: 'rgb(255, 0, 0)' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the placeholder while it is empty', () => {
    renderEditor('', { placeholder: 'Write your email' })
    expect(field()).toHaveAttribute('aria-placeholder', 'Write your email')
    expect(field().querySelector('p')).toHaveAttribute('data-placeholder', 'Write your email')
  })

  it('hides the placeholder once there is content', () => {
    renderEditor('<p>Hi</p>', { placeholder: 'Write your email' })
    expect(field().querySelector('[data-placeholder]')).toBeNull()
  })

  it('has no placeholder unless it is given', () => {
    renderEditor('')
    expect(field()).not.toHaveAttribute('aria-placeholder')
    expect(field().querySelector('[data-placeholder]')).toBeNull()
  })

  it('inserts the link dialog’s link as a button when linkAsButton is set', () => {
    const { onChange } = renderEditor('<p>See:</p>', { linkAsButton: true })
    fireEvent.click(screen.getByRole('button', { name: 'Insert link' }))
    const dialog = screen.getByRole('heading', { name: 'Insert link' }).parentElement
    const [text, url] = within(dialog).getAllByRole('textbox')
    fireEvent.change(text, { target: { value: 'Order now', name: 'text' } })
    fireEvent.change(url, { target: { value: '/menu', name: 'url' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Insert' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.stringMatching(/<a target="_blank" href="\/menu"><button style="[^"]*background: (#2C7BE5|rgb\(44, 123, 229\))[^"]*">Order now<\/button><\/a>/))
  })

  it('inserts a plain link when linkAsButton is not set', () => {
    const { onChange } = renderEditor('<p>See:</p>')
    fireEvent.click(screen.getByRole('button', { name: 'Insert link' }))
    const dialog = screen.getByRole('heading', { name: 'Insert link' }).parentElement
    const [text, url] = within(dialog).getAllByRole('textbox')
    fireEvent.change(text, { target: { value: 'Menu', name: 'text' } })
    fireEvent.change(url, { target: { value: '/menu', name: 'url' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Insert' }))
    expect(onChange.mock.lastCall[0]).not.toContain('<button')
  })

  it('shows the video button unless video is false', () => {
    const first = renderEditor('<p>Hi</p>')
    expect(screen.getByRole('button', { name: 'Insert video' })).toBeInTheDocument()
    first.unmount()
    renderEditor('<p>Hi</p>', { video: false })
    expect(screen.queryByRole('button', { name: 'Insert video' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Insert image' })).toBeInTheDocument()
  })

  it('shows in the code tabs a value that changes from outside while the code view is open', async () => {
    const { rerender } = renderEditor('<p>Open</p><style>p { color: red; }</style>', { codeTabs: true })
    fireEvent.click(htmlToggle())
    expect(await screen.findByRole('textbox', { name: 'Home content (HTML)' })).toHaveValue('<p>Open</p>')
    rerender('<p>Closed</p><style>p { color: blue; }</style>')
    expect(await screen.findByRole('textbox', { name: 'Home content (HTML)' })).toHaveValue('<p>Closed</p>')
    fireEvent.click(screen.getByRole('tab', { name: 'CSS' }))
    expect(screen.getByRole('textbox', { name: 'Home content (CSS)' })).toHaveValue('p { color: blue; }')
  })
})
