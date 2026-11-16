import React from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// The controller of ContentForm is the real one; the rest of the library is a stand-in.
vi.mock('../../../../../../index', async () => {
  const { ContentForm } = await import('../../../../../../components/ContentForm')
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    ContentForm,
    Popup: ({ UIComponent, open, ...props }) => (open ? <UIComponent {...props} open={open} /> : null),
    HtmlEditor: ({ UIComponent, ...props }) => <UIComponent {...props} imageListState={{ images: [], loading: false }} insertImageState={{ loading: false, change: {} }} />
  }
})
vi.mock('../../../Shared', () => ({ Alert: () => null }))
// CodeMirror needs a real layout engine; here each language tab is a textarea that reports what is typed.
vi.mock('../../../Shared/RichHtmlEditor/CodeEditor', () => ({
  default: ({ label, value, onChange }) => <textarea aria-label={label} defaultValue={value} onChange={(event) => onChange(event.target.value)} />
}))

import { ContentForm } from '../index'

beforeAll(() => {
  Range.prototype.getClientRects = () => []
  Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 })
  document.elementFromPoint = () => null
})

const renderForm = (content) => {
  const handleChangeContent = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(
    <ContentForm title='Footer' content={content} type='footer_content' handleChangeContent={handleChangeContent} onClose={onClose} />
  )
  return { handleChangeContent, onClose }
}

const editor = () => screen.getByRole('textbox', { name: 'Footer' })

describe('ContentForm', () => {
  it('shows the HTML content and saves it as it is', async () => {
    const user = userEvent.setup()
    const { handleChangeContent, onClose } = renderForm('<p>Open <strong>daily</strong></p>')
    expect(editor().querySelector('strong')).toHaveTextContent('daily')
    expect(screen.getByRole('button', { name: 'Edit as HTML' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handleChangeContent).toHaveBeenCalledWith('footer_content', '<p>Open <strong>daily</strong></p>')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the plain text of before and saves it as it is when it is not edited', async () => {
    const user = userEvent.setup()
    const { handleChangeContent } = renderForm('Open every day')
    expect(editor()).toHaveTextContent('Open every day')
    expect(editor().querySelector('p')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handleChangeContent).toHaveBeenCalledWith('footer_content', 'Open every day')
  })

  it('saves what is written in the HTML tab of the code view, without reading the page', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(document, 'querySelector')
    const { handleChangeContent } = renderForm('<p>Open</p>')
    await user.click(screen.getByRole('button', { name: 'Edit as HTML' }))
    expect(screen.getByRole('tab', { name: 'HTML' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.change(await screen.findByRole('textbox', { name: 'Footer (HTML)' }), { target: { value: '<p>Closed</p>' } })
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handleChangeContent).toHaveBeenCalledWith('footer_content', '<p>Closed</p>')
    expect(spy.mock.calls.some(([selector]) => /note-/.test(selector))).toBe(false)
    spy.mockRestore()
  })

  it('splits the saved style from the HTML, keeps the script in the HTML tab and joins them back on save', async () => {
    const user = userEvent.setup()
    const { handleChangeContent } = renderForm('<p>Open</p><style>p { color: red; }</style><script>console.log(1)</script>')
    await user.click(screen.getByRole('button', { name: 'Edit as HTML' }))
    expect(screen.queryByRole('tab', { name: 'JS' })).toBeNull()
    expect(await screen.findByRole('textbox', { name: 'Footer (HTML)' })).toHaveValue('<p>Open</p><script>console.log(1)</script>')
    await user.click(screen.getByRole('tab', { name: 'CSS' }))
    expect(screen.getByRole('textbox', { name: 'Footer (CSS)' })).toHaveValue('p { color: red; }')
    // There is no way to opt out of scoping: CSS saved before it existed gets its wrapper once the content is edited.
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: 'Footer (CSS)' }), { target: { value: 'p { color: blue; }' } })
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    const saved = handleChangeContent.mock.calls[handleChangeContent.mock.calls.length - 1][1]
    const id = saved.match(/^<div data-od-scope="([a-z0-9]{6})">/)?.[1]
    expect(id).toBeTruthy()
    expect(saved).toBe(`<div data-od-scope="${id}">\n<p>Open</p><script>console.log(1)</script>\n</div>\n<style>\n[data-od-scope="${id}"] p { color: blue; }\n</style>`)
  })

  it('leaves CSS saved without a wrapper untouched while the content is not edited', async () => {
    const user = userEvent.setup()
    const source = '<p>Open</p><style>p { color: red; }</style>'
    const { handleChangeContent } = renderForm(source)
    await user.click(screen.getByRole('button', { name: 'Edit as HTML' }))
    await user.click(await screen.findByRole('tab', { name: 'CSS' }))
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handleChangeContent).toHaveBeenCalledWith('footer_content', source)
  })

  describe('scoped CSS', () => {
    const SCOPED = /^<div data-od-scope="([a-z0-9]{6})">\n<p>Open<\/p>\n<\/div>\n<style>\n\[data-od-scope="\1"\] p \{ color: (\w+); \}\n<\/style>$/
    const open = async (user) => {
      await user.click(screen.getByRole('button', { name: 'Edit as HTML' }))
      await user.click(await screen.findByRole('tab', { name: 'CSS' }))
    }
    const type = (css) => fireEvent.change(screen.getByRole('textbox', { name: 'Footer (CSS)' }), { target: { value: css } })
    const lastSaved = () => handleChange.mock.calls[handleChange.mock.calls.length - 1][1]
    let handleChange

    it('saves new CSS scoped, with the same id across edits', async () => {
      const user = userEvent.setup()
      handleChange = renderForm('<p>Open</p>').handleChangeContent
      await open(user)
      expect(screen.getByText(/can’t change the rest of the website/)).toBeInTheDocument()
      type('p { color: red; }')
      await user.click(screen.getByRole('button', { name: 'Accept' }))
      const first = lastSaved().match(SCOPED)
      expect(first).not.toBeNull()
      type('p { color: blue; }')
      await user.click(screen.getByRole('button', { name: 'Accept' }))
      const second = lastSaved().match(SCOPED)
      expect(second).not.toBeNull()
      expect(second[1]).toBe(first[1])
      expect(second[2]).toBe('blue')
    })

    it('drops the wrapper when the CSS is emptied', async () => {
      const user = userEvent.setup()
      handleChange = renderForm('<p>Open</p>').handleChangeContent
      await open(user)
      type('p { color: red; }')
      type('')
      await user.click(screen.getByRole('button', { name: 'Accept' }))
      expect(lastSaved()).toBe('<p>Open</p>')
    })
  })

  it('previews the saved content in a sandboxed frame', async () => {
    const user = userEvent.setup()
    renderForm('<p>Open</p><style>p { color: red; }</style>')
    await user.click(screen.getByRole('button', { name: 'Edit as HTML' }))
    await user.click(await screen.findByRole('tab', { name: 'Preview' }))
    const frame = screen.getByTitle('Footer (Preview)')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('sandbox', '')
    expect(frame.getAttribute('srcdoc')).toContain('<p>Open</p>')
    expect(frame.getAttribute('srcdoc')).toContain('p { color: red; }')
  })

  it('opens in the visual editor what it cannot keep, and saves it untouched while it is not edited', async () => {
    const user = userEvent.setup()
    const { handleChangeContent } = renderForm('<div class="row">Open</div>')
    expect(editor()).toHaveAttribute('contenteditable', 'true')
    expect(editor()).toHaveTextContent('Open')
    expect(screen.getByRole('status')).toHaveTextContent('the visual editor can’t show')
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handleChangeContent).toHaveBeenCalledWith('footer_content', '<div class="row">Open</div>')
  })

  it('saves an empty content as an empty string, and Delete too', async () => {
    const user = userEvent.setup()
    const { handleChangeContent } = renderForm(undefined)
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handleChangeContent).toHaveBeenLastCalledWith('footer_content', '')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(handleChangeContent).toHaveBeenLastCalledWith('footer_content', '')
  })
})
