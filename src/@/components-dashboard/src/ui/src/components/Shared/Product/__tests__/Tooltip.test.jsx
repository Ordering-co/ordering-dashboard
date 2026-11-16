// redesign bugs-d row 36c (W1-D-26): Product Tooltip on Base UI — a focusable trigger, opens on hover and on focus, role tooltip
// linked by aria-describedby, Escape closes, no content renders the child alone.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Tooltip } from '../Tooltip'
import * as Product from '..'

const css = readFileSync(path.join(__dirname, '..', 'tooltip.css'), 'utf8')

const setup = (props = {}, child = <span data-testid='when'>2 min ago</span>) =>
  render(<Tooltip content='Sep 15, 2026 12:00' delay={0} {...props}>{child}</Tooltip>)

describe('Tooltip: trigger', () => {
  it('is exported from the Product barrel', () => {
    expect(Product.Tooltip).toBe(Tooltip)
  })

  it('makes a non-focusable child reachable by Tab, keeping its text', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = screen.getByTestId('when')
    expect(trigger).toHaveTextContent('2 min ago')
    expect(trigger).toHaveAttribute('tabindex', '0')
    await user.tab()
    expect(trigger).toHaveFocus()
  })

  it('keeps a native focusable child as it is (no extra tab stop attribute)', () => {
    setup({}, <button type='button' data-testid='when'>Copy</button>)
    expect(screen.getByTestId('when').tagName).toBe('BUTTON')
    expect(screen.getByTestId('when')).not.toHaveAttribute('tabindex')
  })

  it('keeps the tabIndex the child already has', () => {
    setup({}, <span data-testid='when' tabIndex={-1}>x</span>)
    expect(screen.getByTestId('when')).toHaveAttribute('tabindex', '-1')
  })
})

describe('Tooltip: popup', () => {
  it('opens on focus with role tooltip, linked to the trigger by aria-describedby', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.queryByRole('tooltip')).toBeNull()
    await user.tab()
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('Sep 15, 2026 12:00')
    const trigger = screen.getByTestId('when')
    await waitFor(() => expect(trigger.getAttribute('aria-describedby')).toBeTruthy())
    expect(tip.id).toBeTruthy()
    expect(trigger.getAttribute('aria-describedby').split(' ')).toContain(tip.id)
  })

  it('opens on hover', async () => {
    const user = userEvent.setup()
    setup()
    await user.hover(screen.getByTestId('when'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Sep 15, 2026 12:00')
  })

  it('closes with Escape and leaves the focus on the trigger', async () => {
    const user = userEvent.setup()
    setup()
    await user.tab()
    await screen.findByRole('tooltip')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    expect(screen.getByTestId('when')).toHaveFocus()
  })

  it('draws in the product root with the direction of the page', async () => {
    const user = userEvent.setup()
    setup({ dir: 'rtl' })
    await user.tab()
    const tip = await screen.findByRole('tooltip')
    expect(tip.closest('.odc-root')).toHaveAttribute('dir', 'rtl')
    expect(tip).toHaveClass('odc-tooltip')
  })
})

describe('Tooltip: no content', () => {
  it.each([null, undefined, false, ''])('renders the child alone for content %p', (content) => {
    setup({ content })
    const child = screen.getByTestId('when')
    expect(child.tagName).toBe('SPAN')
    expect(child).not.toHaveAttribute('tabindex')
    expect(child).not.toHaveAttribute('aria-describedby')
  })
})

describe('Tooltip: styles', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '')
  it('uses tokens only and logical properties, and does not take the pointer', () => {
    expect(plain).not.toMatch(/#[0-9a-f]{3,8}\b|\d+px|rgb\(|rgba\(/i)
    expect(plain).not.toMatch(/(?:^|[\s;{])(?:margin|padding)-(?:left|right|top|bottom)\s*:/)
    expect(plain).toMatch(/pointer-events:\s*none/)
  })

  it('stops its motion with prefers-reduced-motion', () => {
    const at = plain.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(at).toBeGreaterThan(-1)
    expect(plain.slice(at)).toMatch(/transition:\s*none/)
  })
})
