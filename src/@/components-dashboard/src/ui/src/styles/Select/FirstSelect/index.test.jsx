/* eslint-disable import/first */
import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { Select } from '.'

const renderSelect = props => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <Select {...props} />
  </ThemeProvider>
)

describe('FirstSelect interaction contracts', () => {
  it('keeps the direct legacy topology and lets className replace select', () => {
    const rendered = renderSelect({ placeholder: 'Topology', position: 'RIGHT', options: [{ value: 1, content: 'One' }], onChange: vi.fn() })
    const root = rendered.container.querySelector('[data-slot="first-select"]')
    expect(root).toHaveClass('select')
    fireEvent.keyDown(screen.getByRole('button', { name: 'Topology' }), { key: 'Enter' })
    const trigger = screen.getByRole('button', { name: 'Topology' })
    const list = screen.getByRole('listbox')
    expect(list.parentElement).toBe(root)
    expect(list).toHaveClass('list')
    expect(list).toHaveAttribute('data-position', 'right')
    expect(trigger).not.toHaveAttribute('aria-controls')
    expect(list.querySelector('.list-wrapper')?.parentElement).toBe(list)
    rendered.unmount()

    const custom = renderSelect({ className: 'driver-select', placeholder: 'Custom class', options: [], onChange: vi.fn() })
    const customRoot = custom.container.querySelector('[data-slot="first-select"]')
    expect(customRoot).toHaveClass('driver-select')
    expect(customRoot).not.toHaveClass('select')
  })

  it('keeps edit and delete actions isolated from keyboard selection', () => {
    const onChange = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderSelect({
      defaultValue: 'alpha',
      options: [
        { value: 'alpha', content: 'Alpha' },
        { value: 'beta', content: 'Beta editable', editFunctionality: true, deleteFunctionality: true }
      ],
      onChange,
      onEdit,
      onDelete
    })

    const trigger = screen.getByRole('button', { name: /Alpha/ })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    const beta = screen.getByRole('option', { name: /Beta editable/ })
    const deleteButton = within(beta).getByRole('button', { name: 'Delete' })
    const editButton = within(beta).getByRole('button', { name: 'Edit' })
    expect(editButton).not.toHaveAttribute('type')
    fireEvent.keyDown(deleteButton, { key: 'Enter' })
    fireEvent.click(deleteButton)
    expect(onDelete).toHaveBeenCalledWith('beta')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('button', { name: /Alpha/ }), { key: 'Enter' })
    const reopenedBeta = screen.getByRole('option', { name: /Beta editable/ })
    const reopenedEditButton = within(reopenedBeta).getByRole('button', { name: 'Edit' })
    fireEvent.keyDown(reopenedEditButton, { key: ' ' })
    fireEvent.click(reopenedEditButton)
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ value: 'beta' }), 1)
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('button', { name: /Alpha/ }), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('option', { name: /Beta editable/ }), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('beta')
    expect(screen.getByRole('button', { name: /Beta editable/ })).toHaveFocus()
  })

  it('keeps the disabled trigger out of the tab sequence and inert', () => {
    renderSelect({
      isDisabled: true,
      placeholder: 'Disabled select',
      options: [{ value: 1, content: 'One' }],
      onChange: vi.fn()
    })

    const trigger = screen.getByRole('button', { name: 'Disabled select' })
    expect(trigger).toHaveAttribute('aria-disabled', 'true')
    expect(trigger).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('option', { name: 'One' })).toBeInTheDocument()
  })

  it('closes an open list with Escape without emitting a value', () => {
    const onChange = vi.fn()
    renderSelect({ placeholder: 'Choose', options: [{ value: 1, content: 'One' }], onChange })

    const trigger = screen.getByRole('button', { name: 'Choose' })
    fireEvent.keyDown(trigger, { key: ' ' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyUp(trigger, { key: ' ' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const option = screen.getByRole('option', { name: 'One' })
    option.focus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('option', { name: 'One' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps notAsync display state across default-value updates', () => {
    const options = [{ value: 1, content: 'One' }, { value: 2, content: 'Two' }]
    const rendered = renderSelect({ defaultValue: 1, notAsync: true, options, onChange: vi.fn() })

    expect(screen.getByRole('button', { name: /One/ })).toBeInTheDocument()
    rendered.rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <Select defaultValue={2} notAsync options={options} onChange={vi.fn()} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: /One/ })).toBeInTheDocument()
  })

  it('preserves strict matching, repeated values and noSelected callbacks', () => {
    const onChange = vi.fn()
    const rendered = renderSelect({
      defaultValue: 'shared',
      options: [
        { value: 'shared', content: 'Builtin', showOnSelected: 'Builtin selected' },
        { value: 'shared', content: 'Custom', showOnSelected: 'Custom selected' }
      ],
      onChange
    })
    const trigger = screen.getByRole('button', { name: 'Builtin selected' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: 'Custom' }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('shared')
    expect(trigger).toHaveAccessibleName('Custom selected')
    rendered.unmount()

    const noSelectedChange = vi.fn()
    renderSelect({
      noSelected: true,
      placeholder: 'Keep placeholder',
      options: [{ value: 1, content: 'One' }],
      onChange: noSelectedChange
    })
    const noSelectedTrigger = screen.getByRole('button', { name: 'Keep placeholder' })
    fireEvent.click(noSelectedTrigger)
    fireEvent.click(screen.getByRole('option', { name: 'One' }))
    expect(noSelectedChange).toHaveBeenCalledWith(1)
    expect(noSelectedTrigger).toHaveAccessibleName('Keep placeholder')
  })

  it('uses strict equality for NaN and signed zero defaults', () => {
    const options = [{ value: Number.NaN, content: 'NaN option' }]
    const rendered = renderSelect({ placeholder: 'No NaN match', defaultValue: Number.NaN, options, onChange: vi.fn() })
    expect(screen.getByRole('button', { name: 'No NaN match' })).toBeInTheDocument()
    rendered.rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <Select placeholder='Zero' defaultValue={-0} options={[{ value: 0, content: 'Zero option' }]} onChange={vi.fn()} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'Zero option' })).toBeInTheDocument()
  })

  it('keeps disabled, null and hidden options behavior distinct', () => {
    const onChange = vi.fn()
    renderSelect({
      placeholder: 'Special',
      options: [
        { value: 'disabled', content: 'Disabled', disabled: true },
        { value: null, content: 'Unavailable' },
        { value: 'hidden', content: 'Hidden', showDisable: true }
      ],
      onChange
    })
    const trigger = screen.getByRole('button', { name: 'Special' })
    fireEvent.click(trigger)
    const disabled = screen.getByRole('option', { name: 'Disabled', hidden: true })
    expect(disabled).toHaveAttribute('tabindex', '-1')
    fireEvent.click(disabled)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('option', { name: 'Hidden' })).toHaveClass('od-option-hidden')
    fireEvent.click(screen.getByRole('option', { name: 'Unavailable' }))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('unmounts search on close, preserves Escape search and clears on outside click', () => {
    const searchEvents = vi.fn()
    const Harness = () => {
      const [search, setSearch] = React.useState('')
      return (
        <>
          <span data-testid='parent-search'>{search}</span>
          <Select
            placeholder='Search host'
            options={[{ value: 1, content: 'One' }]}
            onChange={vi.fn()}
            isShowSearchBar
            searchBarIsNotLazyLoad
            searchValue={search}
            searchBarPlaceholder='Find option'
            handleChangeSearch={value => {
              searchEvents(value)
              setSearch(value)
            }}
          />
        </>
      )
    }
    render(<ThemeProvider theme={createDashboardTheme(theme)}><Harness /></ThemeProvider>)
    const trigger = screen.getByRole('button', { name: 'Search host' })
    fireEvent.click(trigger)
    const input = screen.getByPlaceholderText('Find option')
    fireEvent.change(input, { target: { value: 'draft' } })
    expect(screen.getByTestId('parent-search')).toHaveTextContent('draft')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(searchEvents).toHaveBeenLastCalledWith('draft')
    expect(screen.queryByPlaceholderText('Find option')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    // SearchBar now shows a search held by the parent on mount (main, 804768e2), so the preserved draft reappears.
    expect(screen.getByPlaceholderText('Find option')).toHaveValue('draft')
    expect(screen.getByTestId('parent-search')).toHaveTextContent('draft')
    fireEvent.click(document.body)
    expect(searchEvents).toHaveBeenLastCalledWith('')
    expect(screen.queryByPlaceholderText('Find option')).not.toBeInTheDocument()
  })

  it('keeps the opening-time outside callback snapshot while open', () => {
    const firstSearch = vi.fn()
    const secondSearch = vi.fn()
    const rendered = renderSelect({
      placeholder: 'Snapshot search',
      options: [{ value: 1, content: 'One' }],
      onChange: vi.fn(),
      isShowSearchBar: true,
      searchBarIsNotLazyLoad: true,
      searchBarPlaceholder: 'Snapshot input',
      handleChangeSearch: firstSearch
    })
    const trigger = screen.getByRole('button', { name: 'Snapshot search' })
    fireEvent.click(trigger)
    rendered.rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <Select
          placeholder='Snapshot search'
          options={[{ value: 1, content: 'One' }]}
          onChange={vi.fn()}
          isShowSearchBar
          searchBarIsNotLazyLoad
          searchBarPlaceholder='Snapshot input'
          handleChangeSearch={secondSearch}
        />
      </ThemeProvider>
    )
    fireEvent.click(document.body)
    expect(firstSearch).toHaveBeenCalledWith('')
    expect(secondSearch).not.toHaveBeenCalled()
  })

  it('does not add roving focus or typeahead to legacy trigger and options', () => {
    const onChange = vi.fn()
    renderSelect({
      defaultValue: 'alpha',
      options: [
        { value: 'alpha', content: 'Alpha' },
        { value: 'beta', content: <input aria-label='Beta editor' defaultValue='' />, showOnSelected: 'Beta' }
      ],
      onChange
    })
    const trigger = screen.getByRole('button', { name: 'Alpha' })
    act(() => trigger.focus())
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'b' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(trigger).toHaveFocus()
    const alpha = screen.getByRole('option', { name: 'Alpha' })
    const editor = screen.getByRole('textbox', { name: 'Beta editor' })
    const beta = editor.closest('[role="option"]')
    expect(alpha).toHaveAttribute('tabindex', '0')
    expect(beta).toHaveAttribute('tabindex', '0')
    act(() => alpha.focus())
    fireEvent.keyDown(alpha, { key: 'ArrowDown' })
    expect(alpha).toHaveFocus()
    act(() => editor.focus())
    fireEvent.keyDown(editor, { key: 'b' })
    fireEvent.change(editor, { target: { value: 'b' } })
    expect(editor).toHaveFocus()
    expect(trigger).toHaveAccessibleName('Alpha')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('restores native option tab stops when an open list is re-entered', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <>
          <Select placeholder='Re-entry' options={[{ value: 1, content: 'One' }, { value: 2, content: 'Two' }]} onChange={vi.fn()} />
          <button type='button'>After</button>
        </>
      </ThemeProvider>
    )
    const trigger = screen.getByRole('button', { name: 'Re-entry' })
    trigger.focus()
    await user.keyboard('{Enter}')
    await user.tab()
    const firstOption = screen.getByRole('option', { name: 'One' })
    expect(firstOption).toHaveFocus()
    await user.tab({ shift: true })
    expect(trigger).toHaveFocus()
    await user.tab()
    expect(firstOption).toHaveFocus()
    expect(firstOption).toHaveAttribute('tabindex', '0')
    await user.tab()
    expect(screen.getByRole('option', { name: 'Two' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('option', { name: 'Two' })).toHaveFocus()
  })

  it('tabs into search before options when search is present', async () => {
    const user = userEvent.setup()
    renderSelect({
      placeholder: 'Search tab order',
      options: [{ value: 1, content: 'One' }],
      onChange: vi.fn(),
      isShowSearchBar: true,
      searchBarIsNotLazyLoad: true,
      searchBarPlaceholder: 'Search first',
      handleChangeSearch: vi.fn()
    })
    const trigger = screen.getByRole('button', { name: 'Search tab order' })
    trigger.focus()
    await user.keyboard('{Enter}')
    await user.tab()
    expect(screen.getByPlaceholderText('Search first')).toHaveFocus()
  })

  it('renders remote options unsliced and keeps pagination interactions open', () => {
    const handleChangePage = vi.fn()
    renderSelect({
      placeholder: 'Paged',
      options: [1, 2, 3].map(value => ({ value, content: `Option ${value}` })),
      onChange: vi.fn(),
      pagination: { currentPage: 1, totalPages: 2, pageSize: 2 },
      handleChangePage
    })
    const trigger = screen.getByRole('button', { name: 'Paged' })
    fireEvent.click(trigger)
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Option 3' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(handleChangePage).toHaveBeenCalledWith(2)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('preserves loading row count and skeleton height', () => {
    const rendered = renderSelect({
      placeholder: 'Loading',
      options: [],
      onChange: vi.fn(),
      isLoading: true,
      optionSkeletonHeight: 31,
      pagination: { currentPage: 1, totalPages: 1, pageSize: 3 }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Loading' }))
    const skeletons = rendered.container.querySelectorAll('.react-loading-skeleton')
    expect(skeletons).toHaveLength(3)
    skeletons.forEach(skeleton => expect(skeleton).toHaveStyle({ height: '31px' }))
  })

  it('keeps datepicker trigger descendants from toggling', () => {
    renderSelect({
      placeholder: <span className='react-datepicker-wrapper'>Date picker</span>,
      options: [{ value: 1, content: 'One' }],
      onChange: vi.fn()
    })
    const trigger = screen.getByRole('button', { name: 'Date picker' })
    fireEvent.click(screen.getByText('Date picker'))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByText('Date picker'))
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps omitted options lazy while the legacy list is closed or opened', () => {
    renderSelect({ placeholder: 'No options', onChange: vi.fn() })
    const trigger = screen.getByRole('button', { name: 'No options' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
