import React, { createRef, forwardRef, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { SearchBar } from '.'
import { SearchContainer } from './styles'
import { SearchContainer as SharedSearchContainer } from '../UI/SearchBar'

const renderSearch = content => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>{content}</ThemeProvider>
)

afterEach(() => vi.useRealTimers())

describe('SearchBar contracts', () => {
  it('forwards immediate input and clears through a native keyboard control', () => {
    const onSearch = vi.fn()
    const submit = vi.fn(event => event.preventDefault())
    const Harness = () => {
      const [search, setSearch] = useState('')
      return (
        <form aria-label='Search form' onSubmit={submit}>
          <SearchBar
            search={search}
            placeholder='Search records'
            onSearch={value => {
              onSearch(value)
              setSearch(value)
            }}
          />
        </form>
      )
    }
    renderSearch(<Harness />)

    const input = screen.getByPlaceholderText('Search records')
    expect(screen.getByRole('form', { name: 'Search form' }).querySelectorAll('input')).toHaveLength(1)
    expect(input.tagName).toBe('INPUT')
    expect(input.type).toBe('text')
    expect(input).toHaveAttribute('name', 'search')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).not.toHaveAttribute('id')
    expect(input).not.toHaveAttribute('value')
    fireEvent.change(input, { target: { value: 'pizza' } })
    expect(onSearch).toHaveBeenCalledWith('pizza')

    const clear = screen.getByRole('button', { name: 'Clear search' })
    expect(clear).toHaveAttribute('type', 'button')
    fireEvent.blur(input)
    fireEvent.click(clear)
    expect(onSearch).toHaveBeenLastCalledWith('')
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(submit).not.toHaveBeenCalled()
  })

  it('preserves the 750ms lazy callback boundary', () => {
    vi.useFakeTimers()
    const onSearch = vi.fn()
    renderSearch(<SearchBar lazyLoad placeholder='Lazy search' onSearch={onSearch} />)

    fireEvent.change(screen.getByPlaceholderText('Lazy search'), { target: { value: 'delayed' } })
    expect(onSearch).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(749))
    expect(onSearch).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onSearch).toHaveBeenCalledWith('delayed')
  })

  it('debounces repeated input and leaves clear and unmount timers pending', () => {
    vi.useFakeTimers()
    const onSearch = vi.fn()
    const rendered = renderSearch(<SearchBar lazyLoad search='' placeholder='Pending search' onSearch={onSearch} />)
    const input = screen.getByPlaceholderText('Pending search')

    fireEvent.change(input, { target: { value: 'first' } })
    act(() => vi.advanceTimersByTime(400))
    fireEvent.change(input, { target: { value: 'second' } })
    act(() => vi.advanceTimersByTime(749))
    expect(onSearch).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenLastCalledWith('second')

    onSearch.mockClear()
    fireEvent.change(input, { target: { value: 'survives' } })
    rendered.rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <SearchBar lazyLoad search='external' placeholder='Pending search' onSearch={onSearch} />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledWith('')
    rendered.unmount()
    act(() => vi.advanceTimersByTime(750))
    expect(onSearch).toHaveBeenLastCalledWith('survives')
    expect(onSearch).toHaveBeenCalledTimes(2)
  })

  it('shows an external search in the uncontrolled input unless the user is typing', () => {
    const onSearch = vi.fn()
    const rendered = renderSearch(<SearchBar search='server-value' placeholder='Uncontrolled search' onSearch={onSearch} />)
    const input = screen.getByPlaceholderText('Uncontrolled search')
    expect(input).toHaveValue('server-value')
    expect(input).not.toHaveAttribute('value')

    const rerenderWith = search => rendered.rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <SearchBar search={search} placeholder='Uncontrolled search' onSearch={onSearch} />
      </ThemeProvider>
    )
    rerenderWith('another-server-value')
    expect(input).toHaveValue('another-server-value')

    act(() => { input.focus(); input.value = 'local draft' })
    rerenderWith('typed-over-server-value')
    expect(input).toHaveValue('local draft')
    rerenderWith('')
    expect(input).toHaveValue('')
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('forwards the native input contract to CustomInput and honors the hidden icon branch', () => {
    let receivedProps
    const ignoredChange = vi.fn()
    const onSearch = vi.fn()
    const CustomInput = forwardRef(function FixtureInput (props, ref) {
      receivedProps = props
      return <input ref={ref} aria-label='Custom search' {...props} />
    })
    const { container } = renderSearch(
      <SearchBar
        CustomInput={CustomInput}
        hideSearchIcon
        placeholder='Custom'
        onSearch={onSearch}
        customClass='custom-container'
        className='ignored-class'
        defaultValue='ignored-default'
        id='ignored-id'
        isCustomInput={false}
        isCustomLayout
        onChange={ignoredChange}
        value='ignored-value'
        data-extra='ignored-extra'
      />
    )

    const input = screen.getByLabelText('Custom search')
    const searchContainer = container.querySelector('[data-slot="search-bar"]')
    expect(input.type).toBe('text')
    expect(input.name).toBe('search')
    expect(input).not.toHaveAttribute('id')
    expect(input).not.toHaveAttribute('value')
    expect(input).not.toHaveAttribute('data-extra')
    expect(Object.keys(receivedProps).sort()).toEqual(['autoComplete', 'name', 'onChange', 'placeholder', 'type'])
    expect(searchContainer).toHaveClass('custom-container', 'od-ui', 'od-search-bar')
    expect(searchContainer).not.toHaveClass('ignored-class')
    fireEvent.change(input, { target: { value: 'custom-value' } })
    expect(onSearch).toHaveBeenCalledWith('custom-value')
    expect(ignoredChange).not.toHaveBeenCalled()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('reexports the real styled container and resolves final theme attrs and caller variables', () => {
    const ref = createRef()
    const tenantTheme = {
      ...createDashboardTheme(theme, { mode: 'dark' }),
      rtl: true,
      fonts: {
        ...theme.fonts,
        primary: { name: 'Search Tenant', family: '"Search Tenant", system-ui', local: true, weights: [400] }
      }
    }
    const ThemedContainer = styled(SearchContainer).attrs({ theme: tenantTheme, as: 'section', isCustomInput: true })`
      margin-left: 9px;
      > button.close {
        right: 8px;
      }
    `
    const DefaultContainer = styled(SearchContainer).attrs({ theme: tenantTheme, isCustomInput: false })``
    renderSearch(
      <>
        <ThemedContainer
          ref={ref}
          data-testid='themed-search-container'
          isCustomInput={false}
          style={{ '--od-search-surface': '#123456', paddingTop: '7px' }}
        >
          <input data-testid='late-custom-input' />
          <button type='button' className='close' data-testid='rtl-clear'>Clear</button>
        </ThemedContainer>
        <DefaultContainer data-testid='default-search-container' isCustomInput>
          <input data-testid='late-default-input' />
        </DefaultContainer>
      </>
    )

    const element = screen.getByTestId('themed-search-container')
    expect(SearchContainer).toBe(SharedSearchContainer)
    expect(typeof SearchContainer.styledComponentId).toBe('string')
    expect(ref.current).toBe(element)
    expect(element.tagName).toBe('SECTION')
    expect(element).toHaveClass('od-ui', 'od-search-bar')
    expect(element).toHaveStyle({ marginLeft: '9px', paddingTop: '7px' })
    expect(getComputedStyle(element).getPropertyValue('--od-search-font')).toBe('"Search Tenant",system-ui')
    expect(getComputedStyle(element).getPropertyValue('--od-search-surface')).toBe('#123456')
    expect(getComputedStyle(screen.getByTestId('late-custom-input')).minHeight).toBe('')
    expect(screen.getByTestId('rtl-clear')).toHaveStyle({ left: '15px', right: '8px' })
    expect(getComputedStyle(screen.getByTestId('late-default-input')).minHeight).toBe('var(--od-search-compact-height)')
    expect(getComputedStyle(screen.getByTestId('late-default-input')).fontFamily).toBe('var(--od-search-font)')
    expect(getComputedStyle(screen.getByTestId('default-search-container')).getPropertyValue('--od-search-compact-height')).toBe('32px')
    expect(getComputedStyle(screen.getByTestId('default-search-container')).getPropertyValue('--od-search-font')).toBe('"Search Tenant",system-ui')
  })
})
