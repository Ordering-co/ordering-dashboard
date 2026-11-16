/* eslint-disable import/first */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { MultiSelect } from '.'
import { CheckBox, PaginationWrapper, TextFormatted } from './styles'

const renderMultiSelect = (props, wrapper) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    {wrapper ? wrapper(<MultiSelect {...props} />) : <MultiSelect {...props} />}
  </ThemeProvider>
)

describe('MultiSelect interaction contracts', () => {
  it('keeps styled exports standalone and the legacy root class replacement', () => {
    const ExtendedPagination = styled(PaginationWrapper)`
      margin-top: 37px;
    `
    const rendered = render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <>
          <ExtendedPagination data-testid='pagination-wrapper' />
          <CheckBox data-testid='checkbox-style' />
          <TextFormatted data-testid='text-style' primary>Text</TextFormatted>
          <MultiSelect className='custom-multi' placeholder='Custom root' defaultValue={[]} options={[]} onChange={vi.fn()} />
        </>
      </ThemeProvider>
    )
    expect(screen.getByTestId('pagination-wrapper')).toHaveStyle({ marginTop: '37px' })
    expect(screen.getByTestId('checkbox-style')).toHaveStyle({ marginRight: '10px' })
    expect(getComputedStyle(screen.getByTestId('text-style')).color).toBe('rgb(31, 95, 209)')
    const root = rendered.container.querySelector('[data-slot="multi-select"]')
    expect(root).toHaveClass('custom-multi')
    expect(root).not.toHaveClass('multi-select')
  })

  it('toggles through keyboard while keeping the scalar callback payload', async () => {
    const onChange = vi.fn()
    renderMultiSelect({
      placeholder: 'Choose values',
      defaultValue: [],
      options: [
        { value: 'default', content: 'Choose values' },
        { value: 'alpha', content: 'Alpha' }
      ],
      onChange
    })

    const trigger = screen.getByRole('button', { name: /Choose values/ })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    const option = screen.getByRole('option', { name: 'Alpha' })
    fireEvent.keyDown(option, { key: ' ' })
    expect(onChange).toHaveBeenCalledWith('alpha')
    expect(await screen.findByRole('button', { name: 'Remove Alpha' })).toHaveAttribute('type', 'reset')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('preserves the chip reset button and prevents its keyboard event from toggling the header', async () => {
    const onChange = vi.fn()
    const onSubmit = vi.fn(event => event.preventDefault())
    renderMultiSelect({
      defaultValue: ['beta'],
      options: [{ value: 'beta', content: <span>Beta option</span> }],
      onChange
    }, component => <form onSubmit={onSubmit}>{component}</form>)

    const remove = await screen.findByRole('button', { name: 'Remove beta' })
    const trigger = screen.getByRole('button', { name: /Beta option/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(remove, { key: 'Enter' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(remove)
    expect(onChange).toHaveBeenCalledWith('beta')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps an open list stable during nested chip removal', async () => {
    const onChange = vi.fn()
    renderMultiSelect({
      defaultValue: ['beta'],
      options: [{ value: 'beta', content: 'Beta' }, { value: 'gamma', content: 'Gamma' }],
      onChange
    }, component => <form>{component}</form>)
    const trigger = document.querySelector('.od-multi-select-trigger')
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.keyUp(trigger, { key: 'Enter' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Beta' }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('beta')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('keeps text summary formatting and Escape closes without selection', async () => {
    const onChange = vi.fn()
    renderMultiSelect({
      defaultValue: ['a', 'b', 'c', 'd'],
      options: [
        { value: 'a', content: 'Alpha' },
        { value: 'b', content: 'Beta' },
        { value: 'c', content: 'Gamma' },
        { value: 'd', content: 'Delta' }
      ],
      useTextStyle: true,
      andText: 'Plus',
      onChange
    })

    const trigger = (await screen.findAllByRole('button'))[0]
    expect(trigger).toHaveTextContent('Alpha, Beta, Gamma, Plus 1 +')
    fireEvent.keyDown(trigger, { key: 'Enter' })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(4)
    options[0].focus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('preserves full native Tab exit and re-entry while selection leaves the list open', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <>
          <MultiSelect
            placeholder='Tab host'
            defaultValue={[]}
            options={[{ value: 'alpha', content: 'Alpha' }, { value: 'beta', content: 'Beta' }]}
            onChange={onChange}
          />
          <button type='button'>After</button>
        </>
      </ThemeProvider>
    )
    const trigger = screen.getByRole('button', { name: 'Tab host' })
    trigger.focus()
    await user.keyboard('{Enter}')
    await user.tab()
    const alpha = screen.getByRole('option', { name: 'Alpha' })
    const beta = screen.getByRole('option', { name: 'Beta' })
    expect(alpha).toHaveFocus()
    await user.tab()
    expect(beta).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(beta).toHaveFocus()
    await user.tab({ shift: true })
    expect(alpha).toHaveFocus()
    await user.tab({ shift: true })
    expect(trigger).toHaveFocus()
    await user.tab()
    expect(alpha).toHaveFocus()
    fireEvent.keyDown(alpha, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('alpha')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps default and null sentinels inert while ignoring option.disabled', () => {
    const onChange = vi.fn()
    renderMultiSelect({
      placeholder: 'Sentinels',
      defaultValue: [],
      options: [
        { value: 'default', content: 'Default row', disabled: true },
        { value: null, content: 'Null row', disabled: true },
        { value: 'enabled-by-history', content: 'Historically enabled', disabled: true }
      ],
      onChange
    })
    const trigger = screen.getByRole('button', { name: 'Sentinels' })
    fireEvent.click(trigger)
    const defaultRow = screen.getByRole('option', { name: 'Default row', hidden: true })
    const nullRow = screen.getByRole('option', { name: 'Null row', hidden: true })
    expect(defaultRow).toHaveAttribute('tabindex', '-1')
    expect(nullRow).toHaveAttribute('tabindex', '-1')
    fireEvent.click(defaultRow)
    fireEvent.click(nullRow)
    expect(onChange).not.toHaveBeenCalled()
    const historical = screen.getByRole('option', { name: 'Historically enabled' })
    expect(historical).toHaveAttribute('tabindex', '0')
    expect(historical).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(historical)
    expect(onChange).toHaveBeenCalledWith('enabled-by-history')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('clears search initially and twice on outside close, but once on Escape', () => {
    const handleChangeSearch = vi.fn()
    renderMultiSelect({
      placeholder: 'Search clear',
      defaultValue: [],
      options: [{ value: 1, content: 'One' }],
      onChange: vi.fn(),
      isShowSearchBar: true,
      searchBarIsNotLazyLoad: true,
      searchBarPlaceholder: 'Search options',
      handleChangeSearch
    })
    const trigger = screen.getByRole('button', { name: 'Search clear' })
    expect(handleChangeSearch).toHaveBeenCalledOnce()
    expect(handleChangeSearch).toHaveBeenLastCalledWith('')
    fireEvent.click(trigger)
    handleChangeSearch.mockClear()
    fireEvent.mouseUp(document.body)
    expect(handleChangeSearch).toHaveBeenCalledTimes(2)
    expect(handleChangeSearch).toHaveBeenNthCalledWith(1, '')
    expect(handleChangeSearch).toHaveBeenNthCalledWith(2, '')

    fireEvent.click(trigger)
    handleChangeSearch.mockClear()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleChangeSearch).toHaveBeenCalledOnce()
    expect(handleChangeSearch).toHaveBeenCalledWith('')
    expect(trigger).toHaveFocus()
  })

  it('blocks outside and Escape while loading but still lets the trigger close', () => {
    const handleChangeSearch = vi.fn()
    renderMultiSelect({
      placeholder: 'Loading close',
      defaultValue: 'alpha',
      options: [{ value: 'alpha', content: 'Alpha' }],
      onChange: vi.fn(),
      isShowSearchBar: true,
      handleChangeSearch,
      isLoading: true
    })
    const trigger = document.querySelector('.od-multi-select-trigger')
    fireEvent.click(trigger)
    handleChangeSearch.mockClear()
    fireEvent.mouseUp(document.body)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(handleChangeSearch).not.toHaveBeenCalled()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(handleChangeSearch).toHaveBeenCalledOnce()
    expect(handleChangeSearch).toHaveBeenCalledWith('')
  })

  it('keeps local and lazy pagination distinct and retains a lazy selected label', () => {
    const options = [1, 2, 3, 4].map(value => ({ value, content: `Option ${value}` }))
    const handleChangePage = vi.fn()
    const handleChangePageSize = vi.fn()
    const rendered = renderMultiSelect({
      defaultValue: [1],
      options,
      onChange: vi.fn(),
      pagination: { currentPage: 2, totalPages: 2, pageSize: 2 },
      handleChangePage,
      handleChangePageSize,
      isHidePagecontrol: true
    })
    const trigger = document.querySelector('.od-multi-select-trigger')
    fireEvent.click(trigger)
    expect(screen.queryByRole('option', { name: 'Option 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Option 3' })).toBeInTheDocument()

    rendered.rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <MultiSelect
          defaultValue={[1]}
          options={[{ value: 3, content: 'Option 3' }, { value: 4, content: 'Option 4' }]}
          onChange={vi.fn()}
          pagination={{ currentPage: 2, totalPages: 2, pageSize: 2 }}
          handleChangePage={handleChangePage}
          handleChangePageSize={handleChangePageSize}
          useLazyPagination
          isHidePagecontrol
        />
      </ThemeProvider>
    )
    expect(trigger).toHaveAccessibleName(/Option 1/)
    expect(screen.getByRole('option', { name: 'Option 3' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Option 4' })).toBeInTheDocument()
  })

  it('preserves the string default branch and hides the chevron when requested', async () => {
    const rendered = renderMultiSelect({
      defaultValue: 'ab',
      options: [{ value: 'a', content: 'A' }, { value: 'ab', content: 'AB' }, { value: 'b', content: 'B' }],
      onChange: vi.fn(),
      hideChevronIcon: true,
      isLoading: true
    })
    const trigger = (await screen.findAllByRole('button'))[0]
    expect(trigger).toHaveTextContent('A')
    expect(trigger).toHaveTextContent('AB')
    expect(trigger).toHaveTextContent('B')
    expect(rendered.container.querySelector('.od-multi-select-chevron')).not.toBeInTheDocument()
  })
})
