// redesign W0-7 (T0-22): Product RadioGroup — named radiogroup, arrows/Home/End, one Tab stop, unknown value falls to the first.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RadioGroup } from '../RadioGroup'

const css = readFileSync(path.join(__dirname, '..', 'radio-group.css'), 'utf8')

const OPTIONS = [
  { value: 'now', label: 'As soon as possible' },
  { value: 'later', label: 'Schedule', description: 'Pick a date and time' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'dine', label: 'Dine in' }
]

afterEach(() => vi.restoreAllMocks())

// The group keeps its own state when `value` is not given; this host makes it controlled like a consumer does.
const Controlled = ({ initial = 'now', onValueChange, ...props }) => {
  const [value, setValue] = React.useState(initial)
  return (
    <RadioGroup
      label='Delivery time'
      options={OPTIONS}
      value={value}
      onValueChange={next => { setValue(next); onValueChange?.(next) }}
      {...props}
    />
  )
}

const radios = () => screen.getAllByRole('radio')
const checkedOf = () => radios().map(radio => radio.getAttribute('aria-checked'))
const tabindexes = () => radios().map(radio => radio.getAttribute('tabindex'))

describe('Product RadioGroup (W0-7)', () => {
  it('is a radiogroup named by its visible title, with one role=radio per option', () => {
    render(<Controlled />)
    const group = screen.getByRole('radiogroup', { name: 'Delivery time' })
    expect(group).toHaveAttribute('aria-labelledby')
    expect(group).not.toHaveAttribute('aria-label')
    expect(within(group).getByText('Delivery time')).toBeVisible()
    expect(radios().map(radio => radio.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON'])
    expect(radios().map(radio => radio.getAttribute('aria-labelledby'))).toHaveLength(4)
    expect(radios().map(radio => radio.textContent)).toEqual([
      'As soon as possible', 'SchedulePick a date and time', 'Pickup', 'Dine in'
    ])
  })

  it('names the group with aria-label when the title is hidden', () => {
    render(<Controlled hideLabel />)
    const group = screen.getByRole('radiogroup', { name: 'Delivery time' })
    expect(group).toHaveAttribute('aria-label', 'Delivery time')
    expect(group).not.toHaveAttribute('aria-labelledby')
    expect(screen.queryByText('Delivery time')).toBeNull()
  })

  it('wraps only its title and its radios', () => {
    render(<Controlled />)
    const group = screen.getByRole('radiogroup')
    expect(group).toHaveTextContent(/^Delivery timeAs soon as possibleSchedulePick a date and timePickupDine in$/)
    // nothing interactive but the radios (the hidden inputs are aria-hidden and out of the tab order)
    expect(within(group).queryAllByRole('button')).toHaveLength(0)
    expect(within(group).queryAllByRole('textbox')).toHaveLength(0)
    expect(group.querySelectorAll('input:not([aria-hidden="true"])')).toHaveLength(0)
  })

  it('exposes the choice with aria-checked and data-checked', () => {
    render(<Controlled initial='pickup' />)
    expect(checkedOf()).toEqual(['false', 'false', 'true', 'false'])
    expect(radios()[2]).toHaveAttribute('data-checked')
    expect(radios()[0]).not.toHaveAttribute('data-checked')
  })

  it('describes an option with its description, and names it by its label alone', () => {
    render(<Controlled />)
    const later = screen.getByRole('radio', { name: 'Schedule' })
    expect(later).toHaveAccessibleDescription('Pick a date and time')
    expect(screen.getByRole('radio', { name: 'Pickup' })).not.toHaveAttribute('aria-describedby')
  })

  it('reports the value on click', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Controlled onValueChange={onValueChange} />)
    await user.click(screen.getByRole('radio', { name: 'Pickup' }))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenLastCalledWith('pickup')
    expect(checkedOf()).toEqual(['false', 'false', 'true', 'false'])
  })

  describe('one Tab stop (roving tabindex)', () => {
    it('puts the stop on the chosen radio and the others out of the tab order', () => {
      render(<Controlled initial='pickup' />)
      expect(tabindexes()).toEqual(['-1', '-1', '0', '-1'])
    })

    it('falls back to the first radio when the value matches no option', () => {
      render(<Controlled initial='zzz' />)
      expect(checkedOf()).toEqual(['false', 'false', 'false', 'false'])
      expect(tabindexes()).toEqual(['0', '-1', '-1', '-1'])
    })

    it('falls back to the first radio when there is no value', () => {
      render(<RadioGroup label='Delivery time' options={OPTIONS} onValueChange={() => {}} />)
      expect(tabindexes()).toEqual(['0', '-1', '-1', '-1'])
    })

    it('enters on the stop, and the next Tab leaves the group', async () => {
      const user = userEvent.setup()
      render(<><button type='button'>before</button><Controlled initial='pickup' /><button type='button'>after</button></>)
      await user.tab()
      await user.tab()
      expect(screen.getByRole('radio', { name: 'Pickup' })).toHaveFocus()
      await user.tab()
      expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
      await user.tab({ shift: true })
      expect(screen.getByRole('radio', { name: 'Pickup' })).toHaveFocus()
      await user.tab({ shift: true })
      expect(screen.getByRole('button', { name: 'before' })).toHaveFocus()
    })

    // redesign stores 5.18 (from 5.15b): Base UI gives the stop to the chosen radio; a chosen radio that is disabled is
    // not focusable, so the whole group fell out of the Tab order. The stop goes to the first enabled radio instead.
    it('keeps a stop on the first enabled radio when the chosen one is disabled', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      const options = OPTIONS.map(option => (option.value === 'later' ? { ...option, disabled: true } : option))
      render(<><button type='button'>before</button><Controlled initial='later' options={options} onValueChange={onValueChange} /><button type='button'>after</button></>)
      expect(checkedOf()).toEqual(['false', 'true', 'false', 'false'])
      // one stop among the radios that can take the focus (a disabled native button never does, whatever its tabindex)
      expect(radios().filter(radio => !radio.disabled && radio.getAttribute('tabindex') === '0')).toHaveLength(1)
      await user.tab()
      await user.tab()
      expect(screen.getByRole('radio', { name: 'As soon as possible' })).toHaveFocus()
      // the focus alone chooses nothing; the arrows still choose, past the disabled radio
      expect(onValueChange).not.toHaveBeenCalled()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByRole('radio', { name: 'Pickup' })).toHaveFocus()
      expect(onValueChange).toHaveBeenLastCalledWith('pickup')
      await user.tab()
      expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
    })

    it('moves the stop with the choice', async () => {
      const user = userEvent.setup()
      render(<Controlled />)
      await user.tab()
      await user.keyboard('{ArrowDown}{ArrowDown}')
      expect(tabindexes()).toEqual(['-1', '-1', '0', '-1'])
    })
  })

  describe('keyboard', () => {
    it('moves focus and the choice with the arrows, wrapping at the ends', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(<Controlled onValueChange={onValueChange} />)
      await user.tab()
      expect(radios()[0]).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(radios()[1]).toHaveFocus()
      expect(onValueChange).toHaveBeenLastCalledWith('later')
      expect(checkedOf()).toEqual(['false', 'true', 'false', 'false'])
      await user.keyboard('{ArrowRight}')
      expect(radios()[2]).toHaveFocus()
      expect(onValueChange).toHaveBeenLastCalledWith('pickup')
      await user.keyboard('{ArrowUp}')
      expect(radios()[1]).toHaveFocus()
      await user.keyboard('{ArrowLeft}')
      expect(radios()[0]).toHaveFocus()
      expect(onValueChange).toHaveBeenLastCalledWith('now')
    })

    it('goes to the first and the last radio with Home and End and chooses them', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(<Controlled initial='later' onValueChange={onValueChange} />)
      await user.tab()
      expect(radios()[1]).toHaveFocus()
      await user.keyboard('{End}')
      expect(radios()[3]).toHaveFocus()
      expect(onValueChange).toHaveBeenLastCalledWith('dine')
      expect(checkedOf()).toEqual(['false', 'false', 'false', 'true'])
      await user.keyboard('{Home}')
      expect(radios()[0]).toHaveFocus()
      expect(onValueChange).toHaveBeenLastCalledWith('now')
      expect(checkedOf()).toEqual(['true', 'false', 'false', 'false'])
    })

    it('chooses the focused radio with Space', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(<Controlled initial='zzz' onValueChange={onValueChange} />)
      await user.tab()
      expect(radios()[0]).toHaveFocus()
      await user.keyboard(' ')
      expect(onValueChange).toHaveBeenLastCalledWith('now')
    })

    it('skips disabled options with the arrows, Home and End', async () => {
      const user = userEvent.setup()
      const options = OPTIONS.map(option => (option.value === 'now' || option.value === 'dine') ? { ...option, disabled: true } : option)
      render(<Controlled initial='later' options={options} />)
      await user.tab()
      expect(radios()[1]).toHaveFocus()
      await user.keyboard('{End}')
      expect(radios()[2]).toHaveFocus()
      await user.keyboard('{Home}')
      expect(radios()[1]).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(radios()[2]).toHaveFocus()
      expect(radios()[0]).toHaveAttribute('data-disabled')
      expect(radios()[0]).toBeDisabled()
    })

    it('puts the tab stop on the first enabled radio when the first is disabled and the value is unknown', () => {
      const options = OPTIONS.map(option => option.value === 'now' ? { ...option, disabled: true } : option)
      render(<Controlled initial='zzz' options={options} />)
      expect(tabindexes()).toEqual(['-1', '0', '-1', '-1'])
    })

    it('inverts the left and right arrows in RTL', async () => {
      const user = userEvent.setup()
      render(<ThemeProvider theme={{ rtl: true }}><div dir='rtl'><Controlled orientation='horizontal' /></div></ThemeProvider>)
      await user.tab()
      expect(radios()[0]).toHaveFocus()
      await user.keyboard('{ArrowLeft}')
      expect(radios()[1]).toHaveFocus()
      await user.keyboard('{ArrowRight}')
      expect(radios()[0]).toHaveFocus()
    })
  })

  it('ignores presses on the whole group when disabled', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Controlled disabled onValueChange={onValueChange} />)
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('radio', { name: 'Pickup' }))
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('is vertical by default and horizontal on request, as a data attribute', () => {
    const { rerender } = render(<Controlled />)
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-orientation', 'vertical')
    rerender(<Controlled orientation='horizontal' />)
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-orientation', 'horizontal')
  })

  describe('name', () => {
    it('throws without a label', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => render(<RadioGroup options={OPTIONS} value='now' />)).toThrow('RadioGroup needs a label')
      expect(() => render(<RadioGroup label={null} options={OPTIONS} value='now' />)).toThrow('RadioGroup needs a label')
    })

    it('paints an empty label instead of throwing', () => {
      const { container } = render(<RadioGroup label='' options={OPTIONS} value='now' onValueChange={() => {}} />)
      expect(container.querySelector('.odc-radiogroup-title')).toBeInTheDocument()
      expect(container.querySelector('.odc-radiogroup-title')).toBeEmptyDOMElement()
      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
      expect(radios()).toHaveLength(4)
    })

    it('paints an option with an empty label and keeps its description', () => {
      render(<RadioGroup label='Time' options={[{ value: 'a', label: '', description: 'Only a note' }, { value: 'b', label: 'B' }]} value='a' onValueChange={() => {}} />)
      expect(radios()).toHaveLength(2)
      expect(radios()[0]).toHaveAccessibleDescription('Only a note')
    })
  })

  describe('targets (decision 12)', () => {
    const phone = css.slice(css.indexOf('@media (pointer: coarse), (max-width: 767px)'))
    it('keeps rows at the control height with a fine pointer', () => {
      expect(css).toMatch(/\.odc-radio \{[^}]*min-block-size: var\(--od-x-control-height\)/s)
    })

    // redesign tramo B r2 (W0-QB1-06): the stacked rows are < 12px apart, so two pseudo-element areas overlapped; 44 visible instead
    it('is 44px visible on a phone or with a coarse pointer, with no pseudo-element area to overlap the neighbour', () => {
      expect(phone).toMatch(/\.odc-radio \{[^}]*min-block-size: var\(--od-x-target-coarse\)/s)
      expect(phone).not.toMatch(/::after/)
    })
  })
  // redesign stores 5.15b (G5-15): OPT-IN cards. The same radiogroup, each option a card with a decorative preview.
  describe('cards (opt-in)', () => {
    const CARDS = [
      { value: 'food', label: 'Food', description: 'Categories and products side by side', media: <span data-testid='food-preview' /> },
      { value: 'groceries', label: 'Groceries', media: <span data-testid='groceries-preview' /> }
    ]

    it('draws each option as a card with its preview hidden from assistive tech, still one radiogroup', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      const { container } = render(<RadioGroup label='Layout' variant='cards' options={CARDS} value='food' onValueChange={onValueChange} />)
      const group = screen.getByRole('radiogroup', { name: 'Layout' })
      expect(group).toHaveAttribute('data-variant', 'cards')
      expect(radios()).toHaveLength(2)
      expect(radios()[0]).toHaveAccessibleName('Food')
      expect(radios()[0]).toHaveAccessibleDescription('Categories and products side by side')
      const media = within(radios()[0]).getByTestId('food-preview').closest('.odc-radio-media')
      expect(media).toHaveAttribute('aria-hidden', 'true')
      expect(container.querySelectorAll('.odc-radio-media')).toHaveLength(2)
      radios()[0].focus()
      await user.keyboard('{ArrowDown}')
      expect(onValueChange).toHaveBeenLastCalledWith('groceries')
    })

    it('ignores media without the variant: the list is drawn exactly as before', () => {
      const { container } = render(<RadioGroup label='Layout' options={CARDS} value='food' onValueChange={() => {}} />)
      expect(screen.getByRole('radiogroup', { name: 'Layout' })).not.toHaveAttribute('data-variant')
      expect(container.querySelector('.odc-radio-media')).toBeNull()
    })

    it('lays the cards out in a grid with a visible frame and a stronger frame when chosen', () => {
      expect(css).toMatch(/\.odc-radiogroup\[data-variant='cards'\] \.odc-radiogroup-options \{[^}]*display: grid/s)
      expect(css).toMatch(/\.odc-radiogroup\[data-variant='cards'\] \.odc-radio \{[^}]*border: var\(--od-x-hairline\) solid var\(--od-border\)/s)
      expect(css).toMatch(/\.odc-radiogroup\[data-variant='cards'\] \.odc-radio\[data-checked\] \{[^}]*box-shadow: 0 0 0 var\(--od-x-hairline\) var\(--od-action\)/s)
    })
  })

  // redesign bugs F row 38: opt-in required mark, the same markup Field draws for its asterisk
  describe('required (opt-in)', () => {
    it('draws the asterisk (aria-hidden) and the screen-reader text in the title, and marks the group aria-required', () => {
      const { container } = render(<Controlled required requiredLabel='required' />)
      const title = container.querySelector('.odc-radiogroup-title')
      expect(title.querySelector('.odc-field-required')).toHaveAttribute('aria-hidden', 'true')
      expect(title.querySelector('.odc-field-required')).toHaveTextContent('*')
      expect(title.querySelector('.odc-sr-only')).toHaveTextContent('required')
      expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-required', 'true')
    })

    it('draws neither without the prop', () => {
      const { container } = render(<Controlled />)
      expect(container.querySelector('.odc-field-required')).toBeNull()
      expect(container.querySelector('.odc-sr-only')).toBeNull()
      expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-required')
    })

    it('`required` alone draws no mark of its own (a consumer may paint it inside `label`)', () => {
      const { container } = render(<Controlled required />)
      expect(container.querySelector('.odc-radiogroup-title .odc-field-required')).toBeNull()
      expect(container.querySelector('.odc-radiogroup-title .odc-sr-only')).toBeNull()
    })

    it('a consumer\'s own aria-required still reaches the group when `required` is not used (BannerImageDialog)', () => {
      render(<Controlled aria-required='true' />)
      expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-required', 'true')
    })

    it('with hideLabel the group is still aria-required and the name is untouched', () => {
      render(<Controlled hideLabel required requiredLabel='required' />)
      expect(screen.getByRole('radiogroup', { name: 'Delivery time' })).toHaveAttribute('aria-required', 'true')
    })
  })
})
