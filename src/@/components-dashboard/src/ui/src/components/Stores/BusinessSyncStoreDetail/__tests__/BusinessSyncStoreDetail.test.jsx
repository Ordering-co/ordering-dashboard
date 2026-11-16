/* eslint-disable import/first */
// redesign stores 3.D, encargo 2.2: the detail of a store in the integration-sync panel, as a Product block. It keeps
// the five rows and the five URLs of today (they are fictitious placeholders; removing them is the owner's call, G1-21) and the
// <a href>; the copy button becomes a named IconButton and the copy is announced in a status region (2 s), and so is a failure.
import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import themeJson from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))

import { BusinessSyncStoreDetail } from '../index'

const URLS = {
  'Receive order status updates': 'https://integrator.com/orderstatusUpdate',
  'Receive menus': 'https://integrator.com/menuUpdate',
  'Snooze or unsnooze': 'https://integrator.com/snoozeUnsnooze',
  'Enable or Disable busy mode': 'https://integrator.com/busyMode',
  'Update preparation time': 'https://integrator.com/updatePrepTimeURL'
}

const renderDetail = () => render(
  <ThemeProvider theme={themeJson}>
    <BusinessSyncStoreDetail business={{ id: 7, name: 'Fast Bite' }} />
  </ThemeProvider>
)

let writeText

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BusinessSyncStoreDetail', () => {
  it('names the store in an h3 (the panel already has its title)', () => {
    renderDetail()
    expect(screen.getByRole('heading', { level: 3, name: 'Fast Bite' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
  })

  it('keeps the five rows with exactly the five URLs of today, each as a link', () => {
    renderDetail()
    Object.entries(URLS).forEach(([name, url]) => {
      const link = screen.getByRole('link', { name: url })
      expect(link).toHaveAttribute('href', url)
      expect(screen.getByText(name)).toBeInTheDocument()
    })
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })

  it('names each copy button after its row', () => {
    renderDetail()
    Object.keys(URLS).forEach(name => {
      expect(screen.getByRole('button', { name: `Copy URL: ${name}` })).toBeInTheDocument()
    })
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('copies the URL of the row and says «Copied» in a status region, for 2 s', async () => {
    vi.useFakeTimers()
    renderDetail()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy URL: Receive menus' })) })
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('https://integrator.com/menuUpdate')
    expect(within(screen.getByRole('status')).getByText('Copied')).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(2100) })
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('says so when the clipboard fails', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    renderDetail()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy URL: Snooze or unsnooze' })) })
    expect(screen.getByRole('status')).toHaveTextContent("We couldn't copy. Select the text and copy it.")
    expect(screen.queryByText('Copied')).toBeNull()
  })

  it('says so when there is no clipboard at all', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = undefined // and no fallback either
    renderDetail()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy URL: Receive menus' })) })
    expect(screen.getByRole('status')).toHaveTextContent("We couldn't copy")
    delete document.execCommand
  })

  // redesign stores 5.18: the copy is P/CopyButton, which copies through a selected text where there is no clipboard (http)
  it('copies through a selected text where there is no clipboard (http)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => true)
    renderDetail()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy URL: Receive menus' })) })
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
    delete document.execCommand
  })
})
