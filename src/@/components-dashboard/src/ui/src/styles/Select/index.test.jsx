import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, test, vi } from 'vitest'

vi.mock('../../../../index', () => ({
  useSession: () => [{}],
  useLanguage: () => [undefined, (key, fallback) => fallback]
}))

vi.mock('react-popper', () => ({
  usePopper: () => ({ styles: {}, attributes: {}, update: vi.fn() })
}))

import { Select } from './index'
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
    await waitFor(() => expect(screen.getByText('One').closest('.list')).toHaveStyle({ display: 'none' }))
    window.removeEventListener('keydown', parentEscape)
    unmount()
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
