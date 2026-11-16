// redesign W0-7 (T0-22): Product Switch — role=switch with aria-checked, named, busy, 44px hit area on a phone.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Switch } from '../Switch'

const css = readFileSync(path.join(__dirname, '..', 'switch.css'), 'utf8')

afterEach(() => vi.restoreAllMocks())

const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {})

describe('Product Switch (W0-7)', () => {
  it('is a button with role=switch and aria-checked, named by label', () => {
    render(<Switch label='Busy' checked={false} onCheckedChange={() => {}} />)
    const control = screen.getByRole('switch', { name: 'Busy' })
    expect(control.tagName).toBe('BUTTON')
    expect(control).toHaveAttribute('type', 'button')
    expect(control).toHaveAttribute('aria-checked', 'false')
    expect(control).not.toHaveAttribute('data-checked')
  })

  it('reports aria-checked true and data-checked when on', () => {
    render(<Switch label='Busy' checked onCheckedChange={() => {}} />)
    const control = screen.getByRole('switch', { name: 'Busy' })
    expect(control).toHaveAttribute('aria-checked', 'true')
    expect(control).toHaveAttribute('data-checked')
  })

  it('reports the next value on click, Space and Enter without changing a controlled switch', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch label='Busy' checked={false} onCheckedChange={onCheckedChange} />)
    const control = screen.getByRole('switch')
    await user.click(control)
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything())
    await user.keyboard(' ')
    expect(onCheckedChange).toHaveBeenCalledTimes(2)
    await user.keyboard('{Enter}')
    expect(onCheckedChange).toHaveBeenCalledTimes(3)
    expect(control).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles by itself when uncontrolled (defaultChecked)', async () => {
    const user = userEvent.setup()
    render(<Switch label='Available' defaultChecked />)
    const control = screen.getByRole('switch')
    expect(control).toHaveAttribute('aria-checked', 'true')
    await user.click(control)
    expect(control).toHaveAttribute('aria-checked', 'false')
  })

  it('is one Tab stop and takes focus from the keyboard', async () => {
    const user = userEvent.setup()
    render(<><button type='button'>before</button><Switch label='Busy' checked={false} /></>)
    await user.tab()
    await user.tab()
    expect(screen.getByRole('switch')).toHaveFocus()
  })

  it('takes its name from the visible text and the whole row toggles', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch checked={false} onCheckedChange={onCheckedChange}>Enable driver</Switch>)
    const control = screen.getByRole('switch', { name: 'Enable driver' })
    expect(control).not.toHaveAttribute('aria-label')
    await user.click(screen.getByText('Enable driver'))
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything())
  })

  it('moves the thumb: the track holds a thumb whose state follows the value (shape, not only colour)', () => {
    const { rerender } = render(<Switch label='Busy' checked={false} onCheckedChange={() => {}} />)
    const thumb = () => screen.getByRole('switch').querySelector('.odc-switch-thumb')
    expect(thumb()).not.toHaveAttribute('data-checked')
    rerender(<Switch label='Busy' checked onCheckedChange={() => {}} />)
    expect(thumb()).toHaveAttribute('data-checked')
    // the CSS puts the thumb at the end when checked
    expect(css).toMatch(/\.odc-switch\[data-checked\] \.odc-switch-thumb \{[^}]*inset-inline-start: calc\(100%/)
  })

  it('ignores presses when disabled', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch label='Busy' disabled checked={false} onCheckedChange={onCheckedChange} />)
    const control = screen.getByRole('switch')
    expect(control).toBeDisabled()
    expect(control).toHaveAttribute('data-disabled')
    await user.click(control)
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  describe('busy', () => {
    it('sets aria-busy and data-busy, and stays focusable', async () => {
      const user = userEvent.setup()
      render(<><button type='button'>before</button><Switch label='Busy' busy checked={false} /></>)
      const control = screen.getByRole('switch')
      expect(control).toHaveAttribute('aria-busy', 'true')
      expect(control).toHaveAttribute('data-busy')
      expect(control).not.toBeDisabled()
      await user.tab()
      await user.tab()
      expect(control).toHaveFocus()
    })

    it('blocks repeats while saving and works again after', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()
      const { rerender } = render(<Switch label='Busy' busy checked={false} onCheckedChange={onCheckedChange} />)
      const control = screen.getByRole('switch')
      await user.click(control)
      await user.click(control)
      await user.keyboard(' ')
      expect(onCheckedChange).not.toHaveBeenCalled()
      expect(control).toHaveAttribute('aria-checked', 'false')
      rerender(<Switch label='Busy' checked={false} onCheckedChange={onCheckedChange} />)
      expect(control).not.toHaveAttribute('aria-busy')
      await user.click(control)
      expect(onCheckedChange).toHaveBeenCalledTimes(1)
    })

    it('does not flip an uncontrolled switch while saving', async () => {
      const user = userEvent.setup()
      render(<Switch label='Busy' busy defaultChecked={false} />)
      await user.click(screen.getByRole('switch'))
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    })
  })

  describe('name', () => {
    it('throws without a label or children', () => {
      quiet()
      expect(() => render(<Switch checked={false} />)).toThrow('Switch needs a label')
      expect(() => render(<Switch label={null} checked={false} />)).toThrow('Switch needs a label')
    })

    it('paints an empty label instead of throwing', () => {
      render(<Switch label='' checked={false} />)
      expect(screen.getByRole('switch')).toHaveAttribute('aria-label', '')
    })

    it('paints empty children instead of throwing', () => {
      const { container } = render(<Switch checked={false}>{''}</Switch>)
      expect(container.querySelector('.odc-switch-text')).toBeInTheDocument()
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })
  })

  it('passes name and other attributes through to the control', () => {
    render(<Switch label='Busy' data-testid='x' name='busy' checked={false} />)
    expect(screen.getByTestId('x')).toBe(screen.getByRole('switch'))
  })

  // redesign stores 3.B: `tone='neutral'` is for a second switch in the same row that must not compete with the
  // primary one. Without it nothing changes: no attribute, no rule.
  describe('tone (stores 3.B)', () => {
    it('has no data-tone by default', () => {
      render(<Switch label='Featured' checked onCheckedChange={() => {}} />)
      expect(screen.getByRole('switch')).not.toHaveAttribute('data-tone')
    })

    it('sets data-tone=neutral on the root with tone=neutral', () => {
      render(<Switch label='Featured' tone='neutral' checked onCheckedChange={() => {}} />)
      expect(screen.getByRole('switch')).toHaveAttribute('data-tone', 'neutral')
    })

    it('ignores any other tone (no attribute)', () => {
      render(<Switch label='Featured' tone='danger' checked onCheckedChange={() => {}} />)
      expect(screen.getByRole('switch')).not.toHaveAttribute('data-tone')
    })

    it('paints the checked neutral track and thumb with ink tokens, and its labelled hover with the muted ink', () => {
      expect(css).toMatch(/\.odc-switch\[data-tone='neutral'\]\[data-checked\] \.odc-switch-track \{[^}]*border-color: var\(--od-text-muted\);[^}]*background: var\(--od-text-muted\);/s)
      expect(css).toMatch(/\.odc-switch\[data-tone='neutral'\]\[data-checked\] \.odc-switch-thumb \{[^}]*background: var\(--od-bg\);/s)
      expect(css).toMatch(/\.odc-switch-labelled\[data-tone='neutral'\]\[data-checked\]:hover \.odc-switch-track \{[^}]*border-color: var\(--od-text\);[^}]*background: var\(--od-text\);/s)
    })
  })

  describe('targets (decision 12)', () => {
    const phone = css.slice(css.indexOf('@media (pointer: coarse), (max-width: 767px)'))
    it('keeps the track at the switch tokens and the button at 24px with a fine pointer', () => {
      expect(css).toMatch(/\.odc-switch-track \{[^}]*inline-size: var\(--od-x-switch-width\)[^}]*block-size: var\(--od-x-switch-height\)/s)
      expect(css).toMatch(/\.odc-switch \{[^}]*min-block-size: var\(--od-x-target-fine\)/s)
    })

    it('reaches 44px on a phone or with a coarse pointer by a pseudo-element, not by growing the box', () => {
      expect(phone).toMatch(/\.odc-switch::after \{[^}]*content: ''[^}]*inset: var\(--od-x-target-inset\)/s)
      expect(phone).not.toMatch(/\.odc-switch-track[^{]*\{[^}]*(inline-size|block-size)/)
    })

    // (O-10): the track is taller on touch, through the same three tokens set locally on .odc-switch (never :root);
    // the thumb offsets are token-relative, so the checked position (100% - thumb - 2px) still lands on the end
    it('draws a 40x24 track with a 20px thumb on a phone or with a coarse pointer, set on .odc-switch only', () => {
      expect(phone).toMatch(/\.odc-switch \{[^}]*--od-x-switch-height: var\(--od-space-5\);/s)
      expect(phone).toMatch(/\.odc-switch \{[^}]*--od-x-switch-width: calc\(var\(--od-space-6\) \+ var\(--od-space-2\)\);/s)
      expect(phone).toMatch(/\.odc-switch \{[^}]*--od-x-switch-thumb: calc\(var\(--od-space-4\) \+ var\(--od-space-1\)\);/s)
      expect(phone).not.toMatch(/:root/)
      expect(css.slice(0, css.indexOf('@media (pointer: coarse)'))).not.toMatch(/--od-x-switch-(width|height|thumb):/)
      expect(css).toMatch(/\.odc-switch-thumb \{[^}]*inline-size: var\(--od-x-switch-thumb\)[^}]*block-size: var\(--od-x-switch-thumb\)/s)
      expect(css).toMatch(/\.odc-switch\[data-checked\] \.odc-switch-thumb \{[^}]*inset-inline-start: calc\(100% - var\(--od-x-switch-thumb\) - var\(--od-x-space-half\)\)/s)
    })

    // bugs H (W0-E-13, decision 12): the switch box is SEEN at 32px on touch
    it('makes the switch box 32px on a phone or with a coarse pointer', () => {
      expect(phone).toMatch(/\.odc-switch \{[^}]*min-block-size: var\(--od-x-control-height\)/s)
    })
  })
})
