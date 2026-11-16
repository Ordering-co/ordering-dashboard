import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  PageForm: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

// The rich text editor (Tiptap) has its own tests: here it is a controlled stand-in that shows what the form gives it.
// Its «Clear» button does what the editor does when the document is emptied: it emits ''.
vi.mock('../../../Shared/RichHtmlEditor', () => ({
  RichHtmlEditor: ({ label, value, onChange, placeholder }) => (
    <div>
      <textarea aria-label={label} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
      <button type='button' onClick={() => onChange('')}>Clear body</button>
    </div>
  )
}))
vi.mock('../../../MyProducts/AdvancedSettings/ImageBox', () => ({
  ImageBox: ({ photo }) => <div data-testid='seo-image' data-photo={photo ?? ''} />
}))

import { PageForm } from '../index'

const page = {
  id: 11,
  name: 'About us',
  slug: 'about-us',
  seo_title: 'About Acme',
  seo_description: 'Who we are',
  enabled: true,
  body: '<p>Hi</p>'
}

const baseProps = (overrides = {}) => ({
  isAddMode: false,
  pageState: { page, loading: false, error: null },
  formState: { loading: false, changes: {}, error: null },
  imageListState: { images: [], loading: false, error: null },
  insertImageState: { loading: false, change: {}, error: null },
  handleChangeFormState: vi.fn(),
  handleSavePage: vi.fn(),
  handleAddPage: vi.fn(),
  handleCancel: vi.fn(),
  handleInsertImage: vi.fn(),
  handleDeleteImage: vi.fn(),
  setSelectedImageUrl: vi.fn(),
  ...overrides
})

const renderForm = (overrides) => {
  const props = baseProps(overrides)
  const utils = renderWithProviders(<PageForm {...props} />)
  return { ...props, ...utils }
}

// the page editor of Website pages on the Product pieces, with the behaviour of main.
describe('Settings › Website pages › page editor on Product', () => {
  it('names the page in a section heading (h2), not a page title', () => {
    renderForm()
    expect(screen.getByRole('heading', { level: 2, name: 'About us' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('says «Add page» in add mode, with no Enable switch and no SEO image', () => {
    renderForm({ isAddMode: true, pageState: { page: {}, loading: false, error: null } })
    expect(screen.getByRole('heading', { level: 2, name: 'Add page' })).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByTestId('seo-image')).not.toBeInTheDocument()
  })

  it('shows the page values once the page loads after the editor opened', () => {
    const props = baseProps({ pageState: { page: {}, loading: false, error: null } })
    const { rerender } = renderWithProviders(<PageForm {...props} />)
    rerender(<PageForm {...props} pageState={{ page: {}, loading: true, error: null }} />)
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    rerender(<PageForm {...props} pageState={{ page, loading: false, error: null }} />)

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('About us')
    expect(screen.getByRole('textbox', { name: 'Slug' })).toHaveValue('about-us')
    expect(screen.getByRole('textbox', { name: 'SEO Title' })).toHaveValue('About Acme')
    expect(screen.getByRole('textbox', { name: 'SEO Description' })).toHaveValue('Who we are')
    expect(screen.getByRole('switch', { name: 'Enable' })).toBeChecked()
  })

  it('the fields are Product fields with the limits of main', () => {
    renderForm()
    for (const name of ['Name', 'Slug', 'SEO Title']) {
      expect(screen.getByRole('textbox', { name })).toHaveClass('odc-field-input')
    }
    expect(screen.getByRole('textbox', { name: 'SEO Title' })).toHaveAttribute('maxLength', '255')
    const description = screen.getByRole('textbox', { name: 'SEO Description' })
    expect(description.tagName).toBe('TEXTAREA')
    expect(description).toHaveClass('odc-field-textarea')
    expect(description).toHaveAttribute('maxLength', '1000')
  })

  it('writes each field to the form state', async () => {
    const user = userEvent.setup()
    const { handleChangeFormState } = renderForm()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    expect(handleChangeFormState).toHaveBeenLastCalledWith('name', 'About us!')
    await user.type(screen.getByRole('textbox', { name: 'SEO Title' }), '!')
    expect(handleChangeFormState).toHaveBeenLastCalledWith('seo_title', 'About Acme!')
    await user.type(screen.getByRole('textbox', { name: 'SEO Description' }), '!')
    expect(handleChangeFormState).toHaveBeenLastCalledWith('seo_description', 'Who we are!')
  })

  it('the slug takes no spaces: the space key does nothing and a pasted space is dropped', async () => {
    const user = userEvent.setup()
    const { handleChangeFormState } = renderForm()
    const slug = screen.getByRole('textbox', { name: 'Slug' })
    await user.type(slug, ' x')
    expect(slug).toHaveValue('about-usx')
    expect(handleChangeFormState).toHaveBeenLastCalledWith('slug', 'about-usx')

    await user.paste('a b')
    expect(handleChangeFormState).toHaveBeenLastCalledWith('slug', 'about-usxab')
    expect(handleChangeFormState.mock.calls.some(([field, value]) => field === 'slug' && /\s/.test(value))).toBe(false)
  })

  it('the Enable switch writes «enabled»', async () => {
    const user = userEvent.setup()
    const { handleChangeFormState } = renderForm()
    await user.click(screen.getByRole('switch', { name: 'Enable' }))
    expect(handleChangeFormState).toHaveBeenCalledWith('enabled', false)
  })

  it('Accept is primary and disabled until something changes; it saves the page in edit mode', async () => {
    const user = userEvent.setup()
    const { rerender, handleSavePage, handleAddPage, ...props } = renderForm()
    const accept = screen.getByRole('button', { name: 'Accept' })
    expect(accept).toHaveClass('odc-btn')
    expect(accept).toHaveAttribute('data-variant', 'primary')
    expect(accept).toBeDisabled()

    rerender(<PageForm {...props} handleSavePage={handleSavePage} handleAddPage={handleAddPage} formState={{ loading: false, changes: { name: 'X' }, error: null }} />)
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handleSavePage).toHaveBeenCalledTimes(1)
    expect(handleSavePage).toHaveBeenCalledWith()
    expect(handleAddPage).not.toHaveBeenCalled()
  })

  it('Accept adds the page in add mode', async () => {
    const user = userEvent.setup()
    const { handleAddPage, handleSavePage } = renderForm({
      isAddMode: true,
      pageState: { page: {}, loading: false, error: null },
      formState: { loading: false, changes: { name: 'New' }, error: null }
    })
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handleAddPage).toHaveBeenCalledTimes(1)
    expect(handleSavePage).not.toHaveBeenCalled()
  })

  it('Cancel is a Product button that calls handleCancel', async () => {
    const user = userEvent.setup()
    const { handleCancel } = renderForm()
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel).toHaveClass('odc-btn')
    await user.click(cancel)
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('a save error opens the Product alert with the message, titled «Business», and it closes', async () => {
    const user = userEvent.setup()
    const { rerender, ...props } = renderForm()
    rerender(<PageForm {...props} formState={{ loading: false, error: ['The slug is taken'] }} />)

    const alert = await screen.findByRole('alertdialog', { name: 'Business' })
    expect(within(alert).getByText('The slug is taken')).toBeInTheDocument()
    await user.click(within(alert).getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('shows a skeleton instead of the name while the page loads', () => {
    renderForm({ pageState: { page: {}, loading: true, error: null } })
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.querySelector('.odc-skeleton')).not.toBeNull()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('keeps the rich text editor and the SEO image', async () => {
    const user = userEvent.setup()
    const { handleChangeFormState } = renderForm()
    expect(screen.getByTestId('seo-image')).toHaveAttribute('data-photo', '')
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('<p>Hi</p>')
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveAttribute('placeholder', 'Start writing your page…')
    await user.type(screen.getByRole('textbox', { name: 'Content' }), '!')
    expect(handleChangeFormState).toHaveBeenLastCalledWith('body', '<p>Hi</p>!')
  })

  it('opening a page does not mark the form as changed', () => {
    const { handleChangeFormState } = renderForm()
    expect(handleChangeFormState).not.toHaveBeenCalled()
  })

  it('shows the body of the page that loads after the editor opened, and of the next page', () => {
    const props = baseProps({ pageState: { page: {}, loading: true, error: null } })
    const { rerender } = renderWithProviders(<PageForm {...props} />)
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('')
    rerender(<PageForm {...props} pageState={{ page, loading: false, error: null }} />)
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('<p>Hi</p>')
    rerender(<PageForm {...props} pageState={{ page: { ...page, id: 12, body: '<h2>Other</h2>' }, loading: false, error: null }} />)
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('<h2>Other</h2>')
    expect(props.handleChangeFormState).not.toHaveBeenCalled()
  })

  it('keeps what was typed after the form state changes (a save does not bring the old body back)', async () => {
    const user = userEvent.setup()
    const { rerender, ...props } = renderForm()
    await user.type(screen.getByRole('textbox', { name: 'Content' }), '!')
    rerender(<PageForm {...props} formState={{ loading: false, changes: {}, error: null }} />)
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('<p>Hi</p>!')
  })

  it('an emptied body is kept as the empty paragraph, so it is still saved (the API asks for min:1)', async () => {
    const user = userEvent.setup()
    const { handleChangeFormState } = renderForm()
    await user.click(screen.getByRole('button', { name: 'Clear body' }))
    expect(handleChangeFormState).toHaveBeenLastCalledWith('body', '<p><br></p>')
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('')
  })

  it('a page saved with the empty paragraph opens with an empty editor', () => {
    renderForm({ pageState: { page: { ...page, body: '<p><br></p>' }, loading: false, error: null } })
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('')
  })
})
