// redesign stores 5.15a (G5-04): Product CopyButton — copies, says «Copied» for two seconds, says a failure.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CopyButton, COPIED_FOR_MS } from '../CopyButton'

const css = readFileSync(path.join(__dirname, '..', 'copy-button.css'), 'utf8')

const WORDS = { copyLabel: 'Copy', copiedLabel: 'Copied', failedLabel: 'Couldn\'t copy. Select the text and copy it.' }
const button = (props = {}) => <CopyButton text='<script>hi</script>' label='Copy popup script' {...WORDS} {...props} />

const click = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy popup script' })) })
}

let writeText
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete navigator.clipboard
  delete document.execCommand
})

describe('CopyButton: names that arrive translated', () => {
  it.each(['label', 'copyLabel', 'copiedLabel', 'failedLabel'])('throws without %s', (name) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(button({ [name]: undefined }))).toThrow(`CopyButton needs a ${name}`)
  })

  it('is a native button named by what it copies, which starts with the visible word', () => {
    render(button())
    const node = screen.getByRole('button', { name: 'Copy popup script' })
    expect(node.tagName).toBe('BUTTON')
    expect(node).toHaveAttribute('type', 'button')
    expect(node.getAttribute('aria-label').startsWith('Copy')).toBe(true)
  })
})

describe('CopyButton: copying', () => {
  it('copies the text and says «Copied» for two seconds through a live region', async () => {
    vi.useFakeTimers()
    render(button())
    await click()
    expect(writeText).toHaveBeenCalledWith('<script>hi</script>')
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
    expect(screen.getByRole('button', { name: 'Copy popup script' })).toHaveAttribute('data-copied', 'true')
    await act(async () => { vi.advanceTimersByTime(COPIED_FOR_MS) })
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.getByRole('button', { name: 'Copy popup script' })).not.toHaveAttribute('data-copied')
  })

  it('says the failure beside the button when the clipboard refuses and there is no fallback', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    const onCopy = vi.fn()
    render(button({ onCopy }))
    await click()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Couldn\'t copy. Select the text and copy it.')
    expect(status).toHaveClass('odc-copy-failed')
    expect(onCopy).not.toHaveBeenCalled()
  })

  it('copies through a selected textarea where the Clipboard API is missing (http)', async () => {
    delete navigator.clipboard
    let copied = null
    document.execCommand = vi.fn(() => {
      copied = document.activeElement?.value ?? null
      return true
    })
    render(button())
    await click()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(copied).toBe('<script>hi</script>')
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
  })

  it('is disabled while there is nothing to copy', () => {
    render(button({ text: '' }))
    expect(screen.getByRole('button', { name: 'Copy popup script' })).toBeDisabled()
  })

  it('a new text drops what was said about the old one', async () => {
    const { rerender } = render(button())
    await click()
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
    rerender(button({ text: 'other' }))
    expect(screen.getByRole('status')).toHaveTextContent('')
  })
})

describe('CopyButton: styles', () => {
  it('keeps both words in one cell and uses tokens only', () => {
    expect(css).toMatch(/\.odc-copy-word\s*\{[^}]*grid-row: 1;[^}]*grid-column: 1;/)
    expect(css).toMatch(/\.odc-copy-word\[aria-hidden='true'\] \{ visibility: hidden; \}/)
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-f]{3,6}\b|\b\d+px\b/i)
  })
})

// redesign stores 5.18: OPT-IN `iconOnly`, for the copy beside a value (a customer's email, a URL of the sync detail): the
// ghost icon button they drew, named by `label`, whose glyph turns into a check while «Copied» is announced; the failure is said in
// words. `copyLabel` is not drawn, so it is not needed.
describe('CopyButton: iconOnly (stores 5.18)', () => {
  const icon = (props = {}) => (
    <CopyButton iconOnly text='ana@example.com' label='Copy email' copiedLabel='Copied' failedLabel="Couldn't copy." {...props} />
  )

  it('is an icon button named by label, with no visible word, ghost and small by default size', () => {
    render(icon({ size: 'sm' }))
    const node = screen.getByRole('button', { name: 'Copy email' })
    expect(node).toHaveAttribute('data-icon-only')
    expect(node).toHaveAttribute('data-variant', 'ghost')
    expect(node).toHaveAttribute('data-size', 'sm')
    expect(node).toHaveTextContent('')
  })

  it('copies, turns its glyph into a check and announces «Copied» for two seconds', async () => {
    vi.useFakeTimers()
    render(icon())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy email' })) })
    expect(writeText).toHaveBeenCalledWith('ana@example.com')
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
    expect(screen.getByRole('button', { name: 'Copy email' })).toHaveAttribute('data-copied', 'true')
    await act(async () => { vi.advanceTimersByTime(COPIED_FOR_MS) })
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('says the failure in words', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(icon())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy email' })) })
    expect(screen.getByRole('status')).toHaveTextContent('Couldn\'t copy.')
  })
})

// review F2 (stores 5.18): OPT-IN `announce={false}` + `onResult(state)`, for a host that says the result itself in one line under its
// block (the customer overview, the sync detail): beside an icon button the failure squeezed the value it copies.
describe('CopyButton: the host says the result (stores 5.18)', () => {
  it('reports «copied» and «failed» and draws no status of its own', async () => {
    const onResult = vi.fn()
    render(<CopyButton iconOnly announce={false} onResult={onResult} text='ana@example.com' label='Copy email' copiedLabel='Copied' failedLabel="Couldn't copy." />)
    expect(screen.queryByRole('status')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy email' })) })
    expect(onResult).toHaveBeenLastCalledWith('copied')
    expect(screen.getByRole('button', { name: 'Copy email' })).toHaveAttribute('data-copied', 'true')
    writeText.mockRejectedValue(new Error('denied'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy email' })) })
    expect(onResult).toHaveBeenLastCalledWith('failed')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
