import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, test, vi } from 'vitest'

const popperMock = vi.hoisted(() => ({
  update: vi.fn(),
  usePopper: vi.fn()
}))

vi.mock('../../../../index', () => ({
  useSession: () => [{}],
  useLanguage: () => [{}, (_, fallback) => fallback]
}))

vi.mock('react-popper', () => ({
  usePopper: (...args) => {
    popperMock.usePopper(...args)
    return {
      styles: { popper: { position: 'absolute', left: '4px', transform: 'translate3d(4px, 12px, 0px)' } },
      attributes: { popper: { 'data-popper-placement': 'bottom' } },
      update: popperMock.update
    }
  }
}))

import { Select } from './index'
import { HeaderItem, PopoverBody } from './styles'
import { Pagination } from '../../components/Shared/Pagination'

const theme = {
  colors: {
    backgroundPage: '#FFFFFF',
    borderColor: '#DEE0E3',
    headingColor: '#0B0C0D',
    primary: '#266DF0',
    secundary: '#F6F7F7'
  }
}

const renderWithTheme = (ui) => render(
  <ThemeProvider theme={theme}>
    {ui}
  </ThemeProvider>
)

const rerenderWithTheme = (rerender, ui) => rerender(
  <ThemeProvider theme={theme}>
    {ui}
  </ThemeProvider>
)

const openList = (container) => {
  fireEvent.click(container.querySelector('.select'))
  return container.querySelector('.list')
}

const optionAt = (list, index) => list.querySelectorAll('.option')[index]

describe('Select keyboard dismissal', () => {
  test('keeps HeaderItem and PopoverBody useful as standalone styled exports', () => {
    const ExtendedHeader = styled(HeaderItem)`
      min-height: 61px;
      border-color: rgb(255, 0, 0);
    `
    render(
      <ThemeProvider theme={theme}>
        <>
          <ExtendedHeader data-testid='standalone-header'>Header</ExtendedHeader>
          <PopoverBody data-testid='standalone-popover'>Popup</PopoverBody>
        </>
      </ThemeProvider>
    )
    expect(screen.getByTestId('standalone-header')).toHaveStyle({ minHeight: '61px', borderColor: 'rgb(255, 0, 0)' })
    expect(screen.getByTestId('standalone-popover')).toHaveStyle({ zIndex: 'calc(var(--od-x-layer-chrome) + 1)' }) // O-7: the 1001 on the chrome role
  })

  test('keeps the real panel mounted and restores the public react-popper contract', () => {
    popperMock.usePopper.mockClear()
    popperMock.update.mockClear()
    render(
      <ThemeProvider theme={theme}>
        <Select placeholder='Positioned' options={[{ value: 1, content: 'One' }]} onChange={vi.fn()} />
      </ThemeProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Positioned' })
    const root = trigger.closest('[data-slot="legacy-select-root"]')
    const panel = root.querySelector('.list')
    expect(panel.parentElement).toBe(root)
    expect(panel).toHaveStyle({ display: 'none', position: 'absolute', left: '4px', transform: 'translate3d(0px, 0px, 0px)' })
    expect(panel).toHaveAttribute('data-popper-placement', 'bottom')
    expect(panel).toHaveAttribute('hidden')

    const config = popperMock.usePopper.mock.calls.at(-1)[2]
    expect(config).toMatchObject({
      placement: 'bottom',
      modifiers: [
        { name: 'arrow', options: { element: undefined } },
        { name: 'offset', options: { offset: [0, 12] } }
      ]
    })

    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(root.querySelector('.list')).toBe(panel)
    expect(panel).not.toHaveAttribute('hidden')
    expect(panel).toHaveStyle({ display: 'block', transform: 'translate3d(4px, 12px, 0px)' })
    expect(popperMock.update).toHaveBeenCalled()
    expect(popperMock.usePopper.mock.calls.some(([reference, popper]) => reference === trigger && popper === panel)).toBe(true)

    fireEvent.keyDown(window, { key: 'Escape', keyCode: 27 })
    expect(root.querySelector('.list')).toBe(panel)
    expect(panel).toHaveAttribute('hidden')
    expect(panel).toHaveStyle({ display: 'none' })
  })

  test('preserves native bidirectional Tab entry and exit while remaining open', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider theme={theme}>
        <>
          <Select
            placeholder='Tab path'
            options={[
              { value: 'alpha', content: 'Alpha' },
              { value: 'beta', content: 'Beta' }
            ]}
            onChange={vi.fn()}
          />
          <button type='button'>After select</button>
        </>
      </ThemeProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Tab path' })
    const alpha = screen.getByRole('option', { name: 'Alpha', hidden: true })
    const beta = screen.getByRole('option', { name: 'Beta', hidden: true })
    trigger.focus()
    await user.keyboard('{Enter}')
    await user.tab()
    expect(alpha).toHaveFocus()
    await user.tab({ shift: true })
    expect(trigger).toHaveFocus()
    await user.tab()
    expect(alpha).toHaveFocus()
    await user.tab()
    expect(beta).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'After select' })).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.tab({ shift: true })
    expect(beta).toHaveFocus()
  })

  test('opens and selects through the same Enter and Space handlers', () => {
    const onChange = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Choose'
          options={[
            { value: 1, content: 'One' },
            { value: 2, content: 'Two', disabled: true }
          ]}
          onChange={onChange}
        />
      </ThemeProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Choose' })
    const root = trigger.closest('[data-slot="legacy-select-root"]')
    expect(root).toContainElement(root.querySelector('.list'))
    expect(root.querySelector('.list')).toHaveStyle({ display: 'none' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(trigger, { key: ' ' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyUp(trigger, { key: ' ' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(window, { key: 'Escape', keyCode: 27 })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const one = screen.getByRole('option', { name: 'One' })
    const two = screen.getByRole('option', { name: 'Two', hidden: true })
    expect(two).toHaveAttribute('aria-disabled', 'true')
    expect(two).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(one, { key: ' ' })
    expect(onChange).toHaveBeenCalledWith(1)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  test('keeps legacy keyboard navigation free of Base roving and typeahead', () => {
    const onChange = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select
          defaultValue='alpha'
          options={[
            { value: 'alpha', content: 'Alpha' },
            { value: 'beta', content: 'Beta' },
            { value: 'disabled', content: 'Disabled', disabled: true }
          ]}
          onChange={onChange}
        />
      </ThemeProvider>
    )
    const trigger = screen.getByRole('button', { name: 'Alpha' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'b' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveFocus()
    const alpha = screen.getByRole('option', { name: 'Alpha' })
    const beta = screen.getByRole('option', { name: 'Beta' })
    const disabled = screen.getByRole('option', { name: 'Disabled', hidden: true })
    expect(alpha).toHaveAttribute('tabindex', '0')
    expect(beta).toHaveAttribute('tabindex', '0')
    expect(disabled).toHaveAttribute('tabindex', '-1')

    act(() => alpha.focus())
    fireEvent.keyDown(alpha, { key: 'ArrowDown' })
    fireEvent.keyDown(alpha, { key: 'b' })
    expect(alpha).toHaveFocus()
    expect(trigger).toHaveAccessibleName('Alpha')
    expect(onChange).not.toHaveBeenCalled()

    act(() => trigger.focus())
    act(() => fireEvent.pointerMove(beta, { pointerType: 'mouse' }))
    expect(trigger).toHaveFocus()
    expect(beta).not.toHaveAttribute('data-highlighted')

    fireEvent.keyDown(beta, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('beta')
  })

  test('keeps printable keys inside an option editor from selecting another option', () => {
    const onChange = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select
          defaultValue='custom'
          options={[
            { value: 'html', content: 'Html' },
            { value: 'custom', content: <input aria-label='Custom editor' defaultValue='' />, showOnSelected: 'Custom' }
          ]}
          onChange={onChange}
        />
      </ThemeProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Custom' })
    fireEvent.click(trigger)
    const editor = screen.getByRole('textbox', { name: 'Custom editor' })
    act(() => editor.focus())
    fireEvent.keyDown(editor, { key: 'h' })
    fireEvent.change(editor, { target: { value: 'h' } })
    expect(editor).toHaveFocus()
    expect(editor).toHaveValue('h')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAccessibleName('Custom')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('keeps noSelected callback behavior without replacing the displayed value', () => {
    const onChange = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select placeholder='Keep placeholder' noSelected options={[{ value: 'next', content: 'Next' }]} onChange={onChange} />
      </ThemeProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Keep placeholder' })
    fireEvent.keyDown(trigger, { key: ' ' })
    fireEvent.keyDown(screen.getByRole('option', { name: 'Next' }), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('next')
    expect(screen.getByRole('button', { name: 'Keep placeholder' })).toBeInTheDocument()
  })

  test('updates the displayed object and marks duplicate scalar values like legacy Select', () => {
    const onChange = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select
          defaultValue='shared'
          options={[
            { value: 'shared', content: 'Builtin', showOnSelected: 'Builtin selected' },
            { value: 'shared', content: 'Custom', showOnSelected: 'Custom selected' }
          ]}
          onChange={onChange}
        />
      </ThemeProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Builtin selected' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: 'Custom' }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('shared')
    expect(trigger).toHaveAccessibleName('Custom selected')

    expect(screen.getByRole('option', { name: 'Builtin', hidden: true })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Custom', hidden: true })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Builtin', hidden: true })).toHaveAttribute('data-selected')
    expect(screen.getByRole('option', { name: 'Custom', hidden: true })).toHaveAttribute('data-selected')
  })

  test('emits exactly once for repeated mouse and keyboard activation', () => {
    const onChange = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select defaultValue={1} options={[{ value: 1, content: 'One' }]} onChange={onChange} />
      </ThemeProvider>
    )
    const trigger = screen.getByRole('button', { name: 'One' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: 'One' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('option', { name: 'One' }), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(trigger).toHaveFocus()
  })

  test('keeps notAsync display state when a new default value arrives', () => {
    const options = [{ value: 1, content: 'One' }, { value: 2, content: 'Two' }]
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <Select defaultValue={1} notAsync options={options} onChange={vi.fn()} />
      </ThemeProvider>
    )

    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument()
    rerender(
      <ThemeProvider theme={theme}>
        <Select defaultValue={2} notAsync options={options} onChange={vi.fn()} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument()
  })

  test('preserves strict equality for legacy option matching', () => {
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <Select placeholder='No NaN match' defaultValue={Number.NaN} options={[{ value: Number.NaN, content: 'NaN option' }]} onChange={vi.fn()} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'No NaN match' })).toBeInTheDocument()
    rerender(
      <ThemeProvider theme={theme}>
        <Select placeholder='Zero match' defaultValue={-0} options={[{ value: 0, content: 'Zero option' }]} onChange={vi.fn()} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'Zero option' })).toBeInTheDocument()
  })

  test('handles Escape inside the open select before a parent dialog sees it', async () => {
    const parentEscape = vi.fn()
    window.addEventListener('keydown', parentEscape)
    const { unmount } = render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Choose'
          options={[{ value: 1, content: 'One' }]}
          onChange={vi.fn()}
        />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByText('Choose'))
    const event = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true })
    act(() => window.dispatchEvent(event))

    expect(event.defaultPrevented).toBe(true)
    expect(parentEscape).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Choose' })).toHaveFocus()
    await waitFor(() => expect(screen.getByText('One').closest('.list')).toHaveStyle({ display: 'none' }))
    window.removeEventListener('keydown', parentEscape)
    unmount()
  })

  test('composes immediate and debounced search with legacy close side effects', () => {
    const immediateSearch = vi.fn()
    const { unmount } = render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Search immediate'
          options={[{ value: 1, content: 'One' }]}
          onChange={vi.fn()}
          isShowSearchBar
          searchBarIsNotLazyLoad
          searchBarPlaceholder='Search options'
          handleChangeSearch={immediateSearch}
        />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Search immediate' }))
    fireEvent.change(screen.getByPlaceholderText('Search options'), { target: { value: 'one' } })
    expect(immediateSearch).toHaveBeenLastCalledWith('one')
    const stopBubble = event => event.stopPropagation()
    document.addEventListener('mouseup', stopBubble)
    fireEvent.mouseUp(document.body)
    document.removeEventListener('mouseup', stopBubble)
    expect(immediateSearch).toHaveBeenLastCalledWith('one')
    expect(screen.getByRole('button', { name: 'Search immediate' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.mouseUp(document.body)
    expect(immediateSearch).toHaveBeenLastCalledWith('')
    expect(screen.getByRole('button', { name: 'Search immediate' })).toHaveAttribute('aria-expanded', 'false')
    unmount()

    vi.useFakeTimers()
    const debouncedSearch = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Search delayed'
          options={[{ value: 1, content: 'One' }]}
          onChange={vi.fn()}
          isShowSearchBar
          searchBarPlaceholder='Delayed options'
          handleChangeSearch={debouncedSearch}
        />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Search delayed' }))
    fireEvent.change(screen.getByPlaceholderText('Delayed options'), { target: { value: 'delayed' } })
    expect(debouncedSearch).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(749))
    expect(debouncedSearch).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(debouncedSearch).toHaveBeenCalledWith('delayed')
    vi.useRealTimers()
  })

  test('keeps a pending search mounted across Escape and clears it only on outside close', () => {
    vi.useFakeTimers()
    const searchEvents = vi.fn()
    const Harness = () => {
      const [search, setSearch] = React.useState('')
      return (
        <Select
          placeholder='Persistent search'
          options={[{ value: 1, content: 'One' }]}
          onChange={vi.fn()}
          isShowSearchBar
          searchValue={search}
          searchBarPlaceholder='Persistent options'
          handleChangeSearch={value => {
            searchEvents(value)
            setSearch(value)
          }}
        />
      )
    }
    render(<ThemeProvider theme={theme}><Harness /></ThemeProvider>)

    const trigger = screen.getByRole('button', { name: 'Persistent search' })
    fireEvent.click(trigger)
    const input = screen.getByPlaceholderText('Persistent options')
    fireEvent.change(input, { target: { value: 'draft' } })
    act(() => vi.advanceTimersByTime(300))
    const escape = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true })
    act(() => window.dispatchEvent(escape))
    expect(searchEvents).not.toHaveBeenCalled()
    expect(input).toHaveValue('draft')
    expect(input.closest('.list')).toHaveStyle({ display: 'none' })

    fireEvent.click(trigger)
    expect(screen.getByPlaceholderText('Persistent options')).toBe(input)
    expect(input).toHaveValue('draft')
    act(() => vi.advanceTimersByTime(450))
    expect(searchEvents).toHaveBeenCalledWith('draft')

    fireEvent.mouseUp(document.body)
    expect(searchEvents).toHaveBeenLastCalledWith('')
    expect(input).toHaveValue('')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    vi.useRealTimers()
  })

  // (main): the outside close reads the current search callback, no longer the one of the opening render
  test('uses the latest search callback for outside close', () => {
    const openingSearch = vi.fn()
    const latestSearch = vi.fn()
    const options = [{ value: 1, content: 'One' }]
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Opening callback'
          options={options}
          onChange={vi.fn()}
          isShowSearchBar
          searchValue=''
          handleChangeSearch={openingSearch}
        />
      </ThemeProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Opening callback' })
    fireEvent.click(trigger)
    rerender(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Opening callback'
          options={[...options]}
          onChange={vi.fn()}
          isShowSearchBar
          searchValue='active'
          handleChangeSearch={latestSearch}
        />
      </ThemeProvider>
    )

    fireEvent.mouseUp(document.body)
    expect(latestSearch).toHaveBeenCalledOnce()
    expect(latestSearch).toHaveBeenCalledWith('')
    expect(openingSearch).not.toHaveBeenCalled()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  test('keeps Escape separate from outside search clearing and preserves open-disabled triggers', () => {
    const search = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder={<span><span className='open-disabled'>Locked</span> Search</span>}
          options={[{ value: 1, content: 'One' }]}
          onChange={vi.fn()}
          isShowSearchBar
          searchBarIsNotLazyLoad
          searchBarPlaceholder='Search without clear'
          handleChangeSearch={search}
        />
      </ThemeProvider>
    )
    const trigger = screen.getByRole('button', { name: 'Locked Search' })
    fireEvent.click(screen.getByText('Locked'))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByText('Locked'))
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.change(screen.getByPlaceholderText('Search without clear'), { target: { value: 'one' } })
    search.mockClear()
    const event = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true })
    act(() => window.dispatchEvent(event))
    expect(search).not.toHaveBeenCalled()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  test('keeps search-active selection state and resumes default synchronization when cleared', () => {
    const options = [{ value: 1, content: 'One' }, { value: 2, content: 'Two' }]
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <Select defaultValue={1} options={options} searchValue='' onChange={vi.fn()} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument()

    rerender(
      <ThemeProvider theme={theme}>
        <Select defaultValue={2} options={options} isShowSearchBar searchValue='active' handleChangeSearch={vi.fn()} onChange={vi.fn()} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument()

    rerender(
      <ThemeProvider theme={theme}>
        <Select defaultValue={2} options={options} isShowSearchBar searchValue='' handleChangeSearch={vi.fn()} onChange={vi.fn()} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'Two' })).toBeInTheDocument()
  })

  test('keeps local pagination, remote lazy pages and page callbacks separate', () => {
    const options = [1, 2, 3, 4].map(value => ({ value, content: `Option ${value}` }))
    const changePage = vi.fn()
    const changePageSize = vi.fn()
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Paged'
          options={options}
          onChange={vi.fn()}
          pagination={{ currentPage: 1, totalPages: 2, pageSize: 2 }}
          handleChangePage={changePage}
          handleChangePageSize={changePageSize}
          isHidePagecontrol
        />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Paged' }))
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Option 3' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(changePage).toHaveBeenCalledWith(2)
    expect(screen.getByRole('button', { name: 'Paged' })).toHaveAttribute('aria-expanded', 'true')

    rerender(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Paged'
          options={options}
          onChange={vi.fn()}
          pagination={{ currentPage: 2, totalPages: 2, pageSize: 2 }}
          handleChangePage={changePage}
          handleChangePageSize={changePageSize}
          isHidePagecontrol
        />
      </ThemeProvider>
    )
    expect(screen.getByRole('option', { name: 'Option 3' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Option 1' })).not.toBeInTheDocument()

    rerender(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Paged'
          options={options}
          onChange={vi.fn()}
          pagination={{ currentPage: 2, totalPages: 2, pageSize: 2 }}
          handleChangePage={changePage}
          handleChangePageSize={changePageSize}
          useLazyPagination
          isHidePagecontrol
        />
      </ThemeProvider>
    )
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Option 4' })).toBeInTheDocument()
  })

  test('retains the selected label when a lazy remote page omits its option', () => {
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <Select
          defaultValue={1}
          options={[{ value: 1, content: 'One' }]}
          onChange={vi.fn()}
          useLazyPagination
          pagination={{ currentPage: 1, totalPages: 2, pageSize: 1 }}
        />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument()
    rerender(
      <ThemeProvider theme={theme}>
        <Select
          defaultValue={1}
          options={[{ value: 2, content: 'Two' }]}
          onChange={vi.fn()}
          useLazyPagination
          pagination={{ currentPage: 2, totalPages: 2, pageSize: 1 }}
        />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument()
  })

  test('forwards page-size changes from the nested pagination control', () => {
    const changePageSize = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Page size host'
          options={[{ value: 1, content: 'One' }]}
          onChange={vi.fn()}
          pagination={{ currentPage: 1, totalPages: 2, pageSize: 10 }}
          handleChangePage={vi.fn()}
          handleChangePageSize={changePageSize}
        />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Page size host' }))
    fireEvent.click(screen.getByRole('button', { name: '10' }))
    const pageSize = screen.getByRole('option', { name: '25' })
    fireEvent.pointerDown(pageSize)
    fireEvent.click(pageSize)
    expect(changePageSize).toHaveBeenCalledWith(25)
  })

  test('keeps disabled, null and custom option close behavior distinct', () => {
    const onChange = vi.fn()
    const custom = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Special options'
          options={[
            { value: 'disabled', content: 'Disabled', disabled: true },
            { value: null, content: 'Disabled unavailable', disabled: true },
            { value: null, content: 'Unavailable' }
          ]}
          onChange={onChange}
          isShowCustomOption
          customOptionTitle='Create option'
          handleCustomOptionClick={custom}
        />
      </ThemeProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Special options' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: 'Disabled', hidden: true }))
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const disabledNull = screen.getByRole('option', { name: 'Disabled unavailable', hidden: true })
    expect(disabledNull).toHaveClass('disabled')
    expect(disabledNull).toHaveAttribute('data-disabled')
    fireEvent.click(disabledNull)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('option', { name: 'Unavailable' }))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: 'Create option' }))
    expect(custom).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('option', { name: 'Create option' }), { key: 'Enter' })
    expect(custom).toHaveBeenCalledTimes(2)
    expect(onChange).not.toHaveBeenCalled()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  test('keeps the literal disabled DOM guard before mouse and keyboard toggles', () => {
    const childChange = vi.fn()
    const { unmount } = render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Child guard'
          options={[{ value: 'child', content: <span className='disabled'>Guarded child</span> }]}
          onChange={childChange}
        />
      </ThemeProvider>
    )
    const childTrigger = screen.getByRole('button', { name: 'Child guard' })
    fireEvent.click(childTrigger)
    fireEvent.click(screen.getByText('Guarded child'))
    expect(childChange).toHaveBeenCalledOnce()
    expect(childChange).toHaveBeenCalledWith('child')
    expect(childTrigger).toHaveAttribute('aria-expanded', 'true')
    unmount()

    const ancestorChange = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select
          className='disabled'
          placeholder='Ancestor guard'
          options={[{ value: 'ancestor', content: 'Guarded ancestor' }]}
          onChange={ancestorChange}
        />
      </ThemeProvider>
    )
    const ancestorTrigger = screen.getByRole('button', { name: 'Ancestor guard' })
    fireEvent.keyDown(ancestorTrigger, { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('option', { name: 'Guarded ancestor' }), { key: 'Enter' })
    expect(ancestorChange).toHaveBeenCalledOnce()
    expect(ancestorChange).toHaveBeenCalledWith('ancestor')
    expect(ancestorTrigger).toHaveAttribute('aria-expanded', 'true')
    expect(ancestorTrigger).toHaveFocus()
  })

  test('marks null options selected by strict equality without changing their click behavior', () => {
    const onChange = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <Select
          defaultValue={null}
          options={[
            { value: null, content: 'Unavailable' },
            { value: null, content: 'Disabled unavailable', disabled: true }
          ]}
          onChange={onChange}
        />
      </ThemeProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Unavailable' })
    fireEvent.click(trigger)
    const unavailable = screen.getByRole('option', { name: 'Unavailable' })
    const disabled = screen.getByRole('option', { name: 'Disabled unavailable', hidden: true })
    expect(unavailable).toHaveAttribute('aria-selected', 'true')
    expect(unavailable).toHaveAttribute('data-selected')
    expect(disabled).toHaveAttribute('aria-selected', 'true')
    expect(disabled).toHaveAttribute('data-selected')

    fireEvent.click(disabled)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(unavailable)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(onChange).not.toHaveBeenCalled()
  })

  // (main): the memo comparator that ignored onChange is gone, so a callback-only rerender takes the new callback
  test('takes the new onChange on a callback-only rerender', () => {
    const first = vi.fn()
    const second = vi.fn()
    const options = [{ value: 1, content: 'One' }]
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <Select placeholder='Memo' options={options} onChange={first} />
      </ThemeProvider>
    )
    rerender(
      <ThemeProvider theme={theme}>
        <Select placeholder='Memo' options={options} onChange={second} />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Memo' }))
    fireEvent.click(screen.getByRole('option', { name: 'One' }))
    expect(second).toHaveBeenCalledWith(1)
    expect(first).not.toHaveBeenCalled()
  })
})

describe('Select option selection', () => {
  const options = [
    { value: 1, content: 'One' },
    { value: 2, content: 'Two' }
  ]

  test('calls the latest onChange when only the callback changes between renders', () => {
    const firstChange = vi.fn()
    const latestChange = vi.fn()
    const { container, rerender } = renderWithTheme(
      <Select placeholder='Choose' options={options} defaultValue={1} onChange={firstChange} />
    )
    rerenderWithTheme(rerender,
      <Select placeholder='Choose' options={options} defaultValue={1} onChange={latestChange} />
    )

    const list = openList(container)
    fireEvent.click(optionAt(list, 1))

    expect(latestChange).toHaveBeenCalledWith(2)
    expect(firstChange).not.toHaveBeenCalled()
  })

  test('displays the locally selected option and reports its value', () => {
    const onChange = vi.fn()
    const { container } = renderWithTheme(
      <Select placeholder='Choose' options={options} defaultValue={1} onChange={onChange} />
    )
    expect(container.querySelector('.select')).toHaveTextContent('One')

    const list = openList(container)
    fireEvent.click(optionAt(list, 1))

    expect(onChange).toHaveBeenCalledWith(2)
    expect(container.querySelector('.select')).toHaveTextContent('Two')
  })

  test('noSelected keeps the controlled defaultValue visible instead of the rejected selection', () => {
    const onChange = vi.fn()
    const { container, rerender } = renderWithTheme(
      <Select noSelected placeholder='Choose' options={options} defaultValue={1} onChange={onChange} />
    )

    const list = openList(container)
    fireEvent.click(optionAt(list, 1))

    expect(onChange).toHaveBeenCalledWith(2)
    expect(container.querySelector('.select')).toHaveTextContent('One')
    expect(container.querySelector('.select')).not.toHaveTextContent('Two')

    rerenderWithTheme(rerender,
      <Select noSelected placeholder='Choose' options={options} defaultValue={2} onChange={onChange} />
    )
    expect(container.querySelector('.select')).toHaveTextContent('Two')
  })

  test('follows externally updated options and defaultValue', () => {
    const { container, rerender } = renderWithTheme(
      <Select placeholder='Choose' options={options} defaultValue={1} onChange={vi.fn()} />
    )
    expect(container.querySelector('.select')).toHaveTextContent('One')

    const nextOptions = [
      { value: 1, content: 'One' },
      { value: 2, content: 'Two' },
      { value: 3, content: 'Three' }
    ]
    rerenderWithTheme(rerender,
      <Select placeholder='Choose' options={nextOptions} defaultValue={3} onChange={vi.fn()} />
    )

    expect(container.querySelector('.select')).toHaveTextContent('Three')
  })

  test('renders the placeholder when options are empty', () => {
    const { container } = renderWithTheme(
      <Select placeholder='Empty' options={[]} onChange={vi.fn()} />
    )
    expect(container.querySelector('.select')).toHaveTextContent('Empty')

    const list = openList(container)
    expect(list.querySelectorAll('.option')).toHaveLength(0)
  })

  test('ignores clicks on disabled options', () => {
    const onChange = vi.fn()
    const disabledOptions = [
      { value: 1, content: 'One' },
      { value: 2, content: 'Two', disabled: true }
    ]
    const { container } = renderWithTheme(
      <Select placeholder='Choose' options={disabledOptions} defaultValue={1} onChange={onChange} />
    )

    const list = openList(container)
    fireEvent.click(optionAt(list, 1))

    expect(onChange).not.toHaveBeenCalled()
    expect(container.querySelector('.select')).toHaveTextContent('One')
  })

  test('notAsync keeps the locally chosen value when defaultValue changes', () => {
    const asyncOptions = [
      { value: 1, content: 'One' },
      { value: 2, content: 'Two' },
      { value: 3, content: 'Three' }
    ]
    const { container, rerender } = renderWithTheme(
      <Select notAsync placeholder='Choose' options={asyncOptions} defaultValue={1} onChange={vi.fn()} />
    )

    const list = openList(container)
    fireEvent.click(optionAt(list, 1))
    expect(container.querySelector('.select')).toHaveTextContent('Two')

    rerenderWithTheme(rerender,
      <Select notAsync placeholder='Choose' options={asyncOptions} defaultValue={3} onChange={vi.fn()} />
    )
    expect(container.querySelector('.select')).toHaveTextContent('Two')
  })
})

describe('Select inside the Pagination consumer', () => {
  test('uses the latest handleChangePageSize and keeps page navigation working', async () => {
    const firstPageSize = vi.fn()
    const latestPageSize = vi.fn()
    const changePage = vi.fn()
    const baseProps = {
      currentPage: 1,
      totalPages: 10,
      defaultPageSize: 25,
      handleChangePage: changePage
    }
    const { container, rerender } = renderWithTheme(
      <Pagination {...baseProps} handleChangePageSize={firstPageSize} />
    )
    rerenderWithTheme(rerender,
      <Pagination {...baseProps} handleChangePageSize={latestPageSize} />
    )

    const select = container.querySelector('.select')
    expect(select).toHaveTextContent('25')
    fireEvent.click(select)
    const list = container.querySelector('.list')
    const sizeOption = Array.from(list.querySelectorAll('.option')).find(option => option.textContent === '50')
    fireEvent.click(sizeOption)

    expect(latestPageSize).toHaveBeenCalledWith(50)
    expect(firstPageSize).not.toHaveBeenCalled()
    await waitFor(() => expect(select).toHaveTextContent('50'))

    fireEvent.click(screen.getByText('2', { exact: true }))
    expect(changePage).toHaveBeenCalledWith(2)

    fireEvent.click(screen.getByText('1', { exact: true }))
    expect(changePage).toHaveBeenCalledWith(1)
  })
})

describe('Select outside-click listener freshness', () => {
  const searchOptions = [
    { value: 1, content: 'One' },
    { value: 2, content: 'Two' }
  ]

  test('calls the latest handleChangeSearch on outside click while open', async () => {
    const firstSearch = vi.fn()
    const latestSearch = vi.fn()
    const base = {
      placeholder: 'Choose',
      options: searchOptions,
      defaultValue: 1,
      onChange: vi.fn(),
      isShowSearchBar: true
    }
    const { container, rerender } = renderWithTheme(
      <Select {...base} handleChangeSearch={firstSearch} />
    )

    const list = openList(container)
    rerenderWithTheme(rerender,
      <Select {...base} handleChangeSearch={latestSearch} />
    )

    fireEvent.mouseUp(document.body)

    expect(latestSearch).toHaveBeenCalledWith('')
    expect(firstSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(list).toHaveStyle({ display: 'none' }))
  })

  test('honors the current isShowSearchBar flag while open', async () => {
    const firstSearch = vi.fn()
    const latestSearch = vi.fn()
    const base = {
      placeholder: 'Choose',
      options: searchOptions,
      defaultValue: 1,
      onChange: vi.fn()
    }
    const { container, rerender } = renderWithTheme(
      <Select {...base} isShowSearchBar handleChangeSearch={firstSearch} />
    )

    const list = openList(container)
    rerenderWithTheme(rerender,
      <Select {...base} isShowSearchBar={false} handleChangeSearch={firstSearch} />
    )
    fireEvent.mouseUp(document.body)

    expect(firstSearch).not.toHaveBeenCalled()
    expect(latestSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(list).toHaveStyle({ display: 'none' }))

    fireEvent.click(container.querySelector('.select'))
    rerenderWithTheme(rerender,
      <Select {...base} isShowSearchBar handleChangeSearch={latestSearch} />
    )
    fireEvent.mouseUp(document.body)

    expect(latestSearch).toHaveBeenCalledWith('')
    expect(firstSearch).not.toHaveBeenCalled()
  })
})
