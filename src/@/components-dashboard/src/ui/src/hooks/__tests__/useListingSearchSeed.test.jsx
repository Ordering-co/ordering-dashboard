import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useHistory } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useListingSearchSeed } from '../useListingSearchSeed'
import { SearchBar } from '../../components/Shared/SearchBar'

let history
const Probe = ({ enabled = true }) => {
  history = useHistory()
  const seed = useListingSearchSeed({ enabled })
  return <output data-testid='seed'>{seed ? `${seed.value}|${seed.key}` : 'none'}</output>
}

const renderProbe = (entry, props) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Probe {...props} />
  </MemoryRouter>
)

describe('useListingSearchSeed', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('reads ?q= once and removes it from the address bar', () => {
    window.history.replaceState(null, '', '/orders?q=ana&status=pending')
    renderProbe('/orders?q=ana&status=pending')
    expect(screen.getByTestId('seed').textContent.startsWith('ana|')).toBe(true)
    expect(window.location.search).toBe('?status=pending')
  })

  it('gives a new key when the same text is sent again', () => {
    renderProbe('/orders?q=ana')
    const first = screen.getByTestId('seed').textContent
    act(() => { history.push('/orders?q=ana') })
    const second = screen.getByTestId('seed').textContent
    expect(second.startsWith('ana|')).toBe(true)
    expect(second).not.toBe(first)
  })

  it('stays off when disabled or without a query', () => {
    renderProbe('/orders?q=ana', { enabled: false })
    expect(screen.getByTestId('seed').textContent).toBe('none')
  })
})

describe('SearchBar with a value set from outside', () => {
  const theme = { colors: { primary: '#000', borderColor: '#eee', lightGray: '#ccc' } }
  const renderBar = (search, onSearch = vi.fn()) => render(
    <ThemeProvider theme={theme}><SearchBar search={search} onSearch={onSearch} /></ThemeProvider>
  )

  it('shows a seeded search and clears it again', () => {
    const { rerender } = renderBar('ana')
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('ana')
    rerender(<ThemeProvider theme={theme}><SearchBar search='' onSearch={vi.fn()} /></ThemeProvider>)
    expect(input).toHaveValue('')
  })

  it('never overwrites what the person is typing', () => {
    const { rerender } = renderBar('a')
    const input = screen.getByRole('textbox')
    input.focus()
    input.value = 'abc'
    rerender(<ThemeProvider theme={theme}><SearchBar search='ab' onSearch={vi.fn()} /></ThemeProvider>)
    expect(input).toHaveValue('abc')
  })
})
