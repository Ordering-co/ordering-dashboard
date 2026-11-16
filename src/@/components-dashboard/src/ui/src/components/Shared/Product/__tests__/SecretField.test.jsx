// redesign 2.C: Product SecretField — a hidden-by-default secret with Show / Hide and the last four characters.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SecretField, SECRET_ENDING_MIN_LENGTH } from '../SecretField'

// Real Base UI. jsdom has no layout, so sizes are the browser spec's job; these tests pin the wiring, the attributes and the values.

const css = readFileSync(path.join(__dirname, '..', 'secret-field.css'), 'utf8')

const TEXT = { showLabel: 'Show', hideLabel: 'Hide', endingLabel: ending => <>Ends in {ending}</> }
const KEY = 'sk_live_k3Fz' // 12 characters, ends in k3Fz

const field = (props = {}) => <SecretField label='Secret key' name='secret_key' {...TEXT} {...props} />

// the button is named «Show Secret key» through the same label, so the input is picked by its tag
const input = () => screen.getByLabelText('Secret key', { selector: 'input' })
// the button reads «Show Secret key»: the active word, then the field
const wordName = word => new RegExp(`^${word}( |$)`)
const toggle = word => screen.getByRole('button', { name: wordName(word) })
const endingOf = container => container.querySelector('.odc-secret-ending')

afterEach(() => vi.restoreAllMocks())

describe('SecretField: names that arrive translated', () => {
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {})

  it.each([
    ['label', { label: undefined }, 'SecretField needs a label'],
    ['showLabel', { showLabel: undefined }, 'SecretField needs a showLabel'],
    ['hideLabel', { hideLabel: undefined }, 'SecretField needs a hideLabel'],
    ['endingLabel', { endingLabel: undefined }, 'SecretField needs an endingLabel'],
    ['showLabel (null)', { showLabel: null }, 'SecretField needs a showLabel'],
    ['hideLabel (null)', { hideLabel: null }, 'SecretField needs a hideLabel'],
    ['endingLabel (null)', { endingLabel: null }, 'SecretField needs an endingLabel'],
    ['hiddenStatus when shownStatus is given', { shownStatus: 'Secret shown' }, 'SecretField needs both a shownStatus and a hiddenStatus, or neither'],
    ['shownStatus when hiddenStatus is given', { hiddenStatus: 'Secret hidden' }, 'SecretField needs both a shownStatus and a hiddenStatus, or neither']
  ])('throws without %s', (_, props, message) => {
    quiet()
    expect(() => render(field(props))).toThrow(message)
  })

  it('an aria-label names the field when there is no visible label', () => {
    render(field({ label: undefined, 'aria-label': 'Stripe key' }))
    expect(screen.getByLabelText('Stripe key', { selector: 'input' })).toBeInTheDocument()
  })

  it('an empty string is a name that paints empty, never a missing one', () => {
    render(field({ label: '', showLabel: '', hideLabel: '' }))
    expect(screen.getByRole('button')).toHaveTextContent('')
    expect(screen.getByRole('button')).toHaveAttribute('aria-controls')
  })

  it('a required field needs its requiredLabel', () => {
    quiet()
    expect(() => render(field({ required: true }))).toThrow('SecretField needs a requiredLabel')
  })

  it('exports the minimum length that shows the ending', () => {
    expect(SECRET_ENDING_MIN_LENGTH).toBe(12)
  })
})

describe('SecretField: hidden by default, Show and Hide', () => {
  it('is a password input and the button is named by showLabel', () => {
    render(field({ defaultValue: KEY }))
    expect(input()).toHaveAttribute('type', 'password')
    expect(input()).not.toHaveAttribute('data-secret-visible')
    expect(toggle('Show')).toHaveAccessibleName('Show Secret key')
    expect(toggle('Show')).toHaveAttribute('type', 'button')
  })

  it('clicking Show makes the input text and the button reads hideLabel; clicking Hide goes back', async () => {
    const user = userEvent.setup()
    const { container } = render(field({ defaultValue: KEY }))
    await user.click(toggle('Show'))
    expect(input()).toHaveAttribute('type', 'text')
    expect(input()).toHaveAttribute('data-secret-visible', '')
    expect(container.querySelector('.odc-secret')).toHaveAttribute('data-secret-visible', '')
    expect(screen.queryByRole('button', { name: wordName('Show') })).toBeNull()
    expect(toggle('Hide')).toHaveAccessibleName('Hide Secret key')
    await user.click(toggle('Hide'))
    expect(input()).toHaveAttribute('type', 'password')
    expect(input()).not.toHaveAttribute('data-secret-visible')
    expect(container.querySelector('.odc-secret')).not.toHaveAttribute('data-secret-visible')
    expect(toggle('Show')).toBeInTheDocument()
  })

  it('does not keep its state in aria-pressed (the name already changes)', async () => {
    const user = userEvent.setup()
    render(field())
    expect(toggle('Show')).not.toHaveAttribute('aria-pressed')
    await user.click(toggle('Show'))
    expect(toggle('Hide')).not.toHaveAttribute('aria-pressed')
  })

  it('the button controls the input by id', () => {
    render(field())
    expect(input().id).toBeTruthy()
    expect(toggle('Show')).toHaveAttribute('aria-controls', input().id)
  })

  it('keeps the id the consumer passes', () => {
    render(field({ id: 'stripe-secret' }))
    expect(input()).toHaveAttribute('id', 'stripe-secret')
    expect(toggle('Show')).toHaveAttribute('aria-controls', 'stripe-secret')
  })

  it('Enter and Space on the button toggle it, and the focus stays on the button', async () => {
    const user = userEvent.setup()
    render(field({ defaultValue: KEY }))
    toggle('Show').focus()
    await user.keyboard('{Enter}')
    expect(input()).toHaveAttribute('type', 'text')
    expect(toggle('Hide')).toHaveFocus()
    await user.keyboard(' ')
    expect(input()).toHaveAttribute('type', 'password')
    expect(toggle('Show')).toHaveFocus()
  })

  it('a click keeps the focus on the button', async () => {
    const user = userEvent.setup()
    render(field({ defaultValue: KEY }))
    await user.click(toggle('Show'))
    expect(toggle('Hide')).toHaveFocus()
    await user.click(toggle('Hide'))
    expect(toggle('Show')).toHaveFocus()
  })

  it('Tab reaches the input first and the button next', async () => {
    const user = userEvent.setup()
    render(field())
    await user.tab()
    expect(input()).toHaveFocus()
    await user.tab()
    expect(toggle('Show')).toHaveFocus()
  })

  it('toggling does not touch the value', async () => {
    const user = userEvent.setup()
    render(field({ defaultValue: KEY }))
    await user.click(toggle('Show'))
    expect(input()).toHaveValue(KEY)
    await user.click(toggle('Hide'))
    expect(input()).toHaveValue(KEY)
  })
})

describe('SecretField: disabled is always hidden', () => {
  it('starts hidden with both the input and the button disabled, out of the tab order', async () => {
    const user = userEvent.setup()
    render(field({ disabled: true, defaultValue: KEY }))
    expect(input()).toBeDisabled()
    expect(input()).toHaveAttribute('type', 'password')
    expect(toggle('Show')).toBeDisabled()
    await user.tab()
    expect(input()).not.toHaveFocus()
    expect(toggle('Show')).not.toHaveFocus()
  })

  it('a shown secret is hidden when the field becomes disabled and stays hidden when it is enabled again', async () => {
    const user = userEvent.setup()
    const { rerender } = render(field({ defaultValue: KEY }))
    await user.click(toggle('Show'))
    expect(input()).toHaveAttribute('type', 'text')
    rerender(field({ defaultValue: KEY, disabled: true }))
    expect(input()).toHaveAttribute('type', 'password')
    expect(input()).not.toHaveAttribute('data-secret-visible')
    expect(toggle('Show')).toBeDisabled()
    rerender(field({ defaultValue: KEY, disabled: false }))
    expect(input()).toHaveAttribute('type', 'password')
    expect(toggle('Show')).toBeEnabled()
  })
})

describe('SecretField: the last four characters', () => {
  it('shows «Ends in …k3Fz» in both states when the value has 12 characters or more', async () => {
    const user = userEvent.setup()
    const { container } = render(field({ defaultValue: KEY }))
    expect(endingOf(container)).toHaveTextContent('Ends in …k3Fz')
    await user.click(toggle('Show'))
    expect(endingOf(container)).toHaveTextContent('Ends in …k3Fz')
    await user.click(toggle('Hide'))
    expect(endingOf(container)).toHaveTextContent('Ends in …k3Fz')
  })

  it('shows it at exactly 12 characters and not at 11', () => {
    const { container, unmount } = render(field({ defaultValue: '123456789012' }))
    expect(endingOf(container).querySelector('.odc-secret-ending-figure')).toHaveTextContent('…9012')
    unmount()
    const second = render(field({ defaultValue: '12345678901' }))
    expect(endingOf(second.container)).toBeNull()
    expect(second.container.querySelector('.odc-field-hint')).toBeNull()
  })

  it('has no ending node at all for an empty or missing value', () => {
    const empty = render(field({ defaultValue: '' }))
    expect(endingOf(empty.container)).toBeNull()
    expect(empty.container.querySelector('.odc-field-hint')).toBeNull()
    empty.unmount()
    const none = render(field())
    expect(endingOf(none.container)).toBeNull()
    expect(none.container.querySelector('.odc-field-hint')).toBeNull()
  })

  it('wraps the ellipsis and the four characters in a mono figure that reads left to right', () => {
    const { container } = render(field({ defaultValue: KEY }))
    const figure = endingOf(container).querySelector('bdi')
    expect(figure).toHaveClass('odc-figure', 'odc-secret-ending-figure')
    expect(figure).toHaveAttribute('dir', 'ltr')
    expect(figure.textContent).toBe('…k3Fz')
  })

  it('keeps the ending LTR inside an RTL page', () => {
    const { container } = render(<div dir='rtl'>{field({ defaultValue: KEY })}</div>)
    expect(endingOf(container).querySelector('bdi')).toHaveAttribute('dir', 'ltr')
  })

  it('keeps the input LTR inside an RTL page, so a shown key starts with its first character (the consumer may override)', () => {
    const { container, rerender } = render(<div dir='rtl'>{field({ defaultValue: KEY })}</div>)
    expect(container.querySelector('input')).toHaveAttribute('dir', 'ltr')
    rerender(<div dir='rtl'>{field({ defaultValue: KEY, dir: 'auto' })}</div>)
    expect(container.querySelector('input')).toHaveAttribute('dir', 'auto')
  })

  it('calls endingLabel with the node and paints what it returns', () => {
    const endingLabel = vi.fn(node => <em data-testid='mine'>{node}</em>)
    render(field({ defaultValue: KEY, endingLabel }))
    expect(endingLabel).toHaveBeenCalled()
    expect(React.isValidElement(endingLabel.mock.calls[0][0])).toBe(true)
    expect(screen.getByTestId('mine')).toHaveTextContent('k3Fz')
  })

  it('does not call endingLabel while the value is short', () => {
    const endingLabel = vi.fn(() => null)
    render(field({ defaultValue: 'short', endingLabel }))
    expect(endingLabel).not.toHaveBeenCalled()
  })

  it('uncontrolled: follows typing, pasting and clearing', async () => {
    const user = userEvent.setup()
    const { container } = render(field())
    await user.click(input())
    await user.type(input(), 'abcdefghijk')
    expect(endingOf(container)).toBeNull()
    await user.type(input(), 'l')
    expect(endingOf(container).querySelector('bdi')).toHaveTextContent('…ijkl')
    await user.type(input(), 'mn')
    expect(endingOf(container).querySelector('bdi')).toHaveTextContent('…klmn')
    await user.clear(input())
    expect(endingOf(container)).toBeNull()
    await user.paste('mock_01_xxxxxzXyZ')
    expect(endingOf(container).querySelector('bdi')).toHaveTextContent('…zXyZ')
  })

  it('controlled: follows the value the parent holds', async () => {
    const user = userEvent.setup()
    const Parent = () => {
      const [value, setValue] = useState('abcdefghij')
      return field({ value, onChange: setValue })
    }
    const { container } = render(<Parent />)
    expect(endingOf(container)).toBeNull()
    await user.type(input(), 'kl')
    expect(input()).toHaveValue('abcdefghijkl')
    expect(endingOf(container).querySelector('bdi')).toHaveTextContent('…ijkl')
  })

  it('a non-string value shows no ending', () => {
    const { container } = render(field({ value: 12345678901, onChange: () => {} }))
    expect(endingOf(container)).toBeNull()
  })

  it('is linked to the input by aria-describedby through the hint', () => {
    const { container } = render(field({ defaultValue: KEY }))
    const hint = endingOf(container).closest('.odc-field-hint')
    expect(hint).not.toBeNull()
    expect(hint.id).toBeTruthy()
    expect(input().getAttribute('aria-describedby').split(' ')).toContain(hint.id)
  })

  it('composes with a hint of the consumer: both lines, one description', () => {
    const { container } = render(field({ defaultValue: KEY, hint: 'Found in the Stripe dashboard' }))
    const hint = container.querySelector('.odc-field-hint')
    expect(hint.querySelector('.odc-secret-hint')).toHaveTextContent('Found in the Stripe dashboard')
    expect(hint.querySelector('.odc-secret-ending')).toHaveTextContent('Ends in …k3Fz')
    expect(container.querySelectorAll('.odc-field-hint')).toHaveLength(1)
    expect(input().getAttribute('aria-describedby').split(' ')).toContain(hint.id)
  })

  it('a hint of the consumer stays alone while the value is short', () => {
    const { container } = render(field({ hint: 'Found in the Stripe dashboard' }))
    expect(container.querySelector('.odc-field-hint')).toHaveTextContent('Found in the Stripe dashboard')
    expect(endingOf(container)).toBeNull()
  })
})

describe('SecretField: frame', () => {
  it('the label is linked to the input', () => {
    render(field())
    expect(screen.getByText('Secret key').closest('label')).toHaveAttribute('for', input().id)
  })

  it('the error is linked, marks the input invalid and is announced', () => {
    render(field({ defaultValue: KEY, error: 'The key is not valid' }))
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('The key is not valid')
    const error = screen.getByRole('alert')
    expect(input().getAttribute('aria-describedby').split(' ')).toContain(error.id)
  })

  it('required carries aria-required and the requiredLabel', () => {
    render(field({ required: true, requiredLabel: 'Required' }))
    // the label reads «Secret key * Required», so the name is matched by its start
    expect(screen.getByLabelText(/^Secret key/, { selector: 'input' })).toHaveAttribute('aria-required', 'true')
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('the ref is the input', () => {
    const ref = React.createRef()
    render(field({ ref }))
    expect(ref.current).toBe(input())
    expect(ref.current.tagName).toBe('INPUT')
  })

  it('a function ref gets the input', () => {
    const ref = vi.fn()
    render(field({ ref }))
    expect(ref).toHaveBeenCalledWith(input())
  })

  it('the input and the row carry the SecretField classes, the input keeps the field one', () => {
    const { container } = render(field({ className: 'mine' }))
    expect(input()).toHaveClass('odc-field-input', 'odc-secret-input', 'mine')
    expect(toggle('Show')).toHaveClass('odc-secret-toggle')
    expect(container.querySelector('.odc-secret')).toContainElement(input())
    expect(container.querySelector('.odc-secret')).toContainElement(toggle('Show'))
  })

  it('the toggle is a secondary 32px button', () => {
    render(field())
    expect(toggle('Show')).toHaveAttribute('data-variant', 'secondary')
    expect(toggle('Show')).toHaveAttribute('data-size', 'md')
  })

  it('the input sits in the field box and a press on the box itself (its 44px area on a phone) focuses the input', () => {
    const { container } = render(field())
    const box = container.querySelector('.odc-secret > .odc-field-box')
    expect(box).toContainElement(input())
    expect(box).not.toContainElement(toggle('Show'))
    fireEvent.mouseDown(box)
    expect(input()).toHaveFocus()
  })

  it('a press on the button does not move the focus to the input', async () => {
    const user = userEvent.setup()
    render(field())
    await user.click(toggle('Show'))
    expect(input()).not.toHaveFocus()
  })
})

describe('SecretField: the browser does not fill it or remember it', () => {
  it('sets the autofill and spell-check defaults on the input', () => {
    render(field())
    expect(input()).toHaveAttribute('autocomplete', 'new-password')
    expect(input()).toHaveAttribute('data-1p-ignore', '')
    expect(input()).toHaveAttribute('data-lpignore', 'true')
    expect(input()).toHaveAttribute('data-bwignore', '')
    expect(input()).toHaveAttribute('data-form-type', 'other')
    expect(input()).toHaveAttribute('spellcheck', 'false')
    expect(input()).toHaveAttribute('autocapitalize', 'off')
    expect(input()).toHaveAttribute('autocorrect', 'off')
  })

  it('keeps them while the secret is shown', async () => {
    const user = userEvent.setup()
    render(field())
    await user.click(toggle('Show'))
    expect(input()).toHaveAttribute('autocomplete', 'new-password')
    expect(input()).toHaveAttribute('spellcheck', 'false')
  })

  it('each one yields to the prop the consumer passes', () => {
    render(field({
      autoComplete: 'off',
      'data-1p-ignore': 'false',
      'data-lpignore': 'false',
      'data-bwignore': 'false',
      'data-form-type': 'login',
      spellCheck: true,
      autoCapitalize: 'words',
      autoCorrect: 'on'
    }))
    expect(input()).toHaveAttribute('autocomplete', 'off')
    expect(input()).toHaveAttribute('data-1p-ignore', 'false')
    expect(input()).toHaveAttribute('data-lpignore', 'false')
    expect(input()).toHaveAttribute('data-bwignore', 'false')
    expect(input()).toHaveAttribute('data-form-type', 'login')
    expect(input()).toHaveAttribute('spellcheck', 'true')
    expect(input()).toHaveAttribute('autocapitalize', 'words')
    expect(input()).toHaveAttribute('autocorrect', 'on')
  })

  it('other input props go through', () => {
    render(field({ placeholder: 'sk_live_…', maxLength: 40, inputMode: 'text' }))
    expect(input()).toHaveAttribute('placeholder', 'sk_live_…')
    expect(input()).toHaveAttribute('maxlength', '40')
    expect(input()).toHaveAttribute('inputmode', 'text')
  })
})

describe('SecretField: value and onChange(value, event)', () => {
  it('typing delivers the string and the native change event', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(field({ onChange }))
    await user.type(input(), 'ab')
    expect(onChange).toHaveBeenCalledTimes(2)
    const [value, event] = onChange.mock.calls[1]
    expect(value).toBe('ab')
    expect(event.target).toBe(input())
    expect(event.target.value).toBe('ab')
  })

  it('pasting delivers the intact value, and the event names the field', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(field({ onChange }))
    await user.click(input())
    await user.paste('  mock_02_xxxxxxxyZ-_/+=  ')
    expect(onChange).toHaveBeenCalledTimes(1)
    const [value, event] = onChange.mock.calls[0]
    expect(value).toBe('  mock_02_xxxxxxxyZ-_/+=  ')
    expect(event.target.name).toBe('secret_key')
    expect(event.target.value).toBe('  mock_02_xxxxxxxyZ-_/+=  ')
    expect(input()).toHaveValue('  mock_02_xxxxxxxyZ-_/+=  ')
  })

  it('pasting works while the secret is shown too', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(field({ onChange }))
    await user.click(toggle('Show'))
    await user.click(input())
    await user.paste('mock_03_xxxxxx3456')
    expect(onChange).toHaveBeenLastCalledWith('mock_03_xxxxxx3456', expect.anything())
  })

  it('uncontrolled: starts from defaultValue and keeps what the user typed', async () => {
    const user = userEvent.setup()
    render(field({ defaultValue: 'abc' }))
    expect(input()).toHaveValue('abc')
    await user.type(input(), 'def')
    expect(input()).toHaveValue('abcdef')
  })

  it('controlled: shows the value it is given until the parent changes it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(field({ value: 'fixed', onChange }))
    await user.type(input(), 'x')
    expect(onChange).toHaveBeenCalledWith('fixedx', expect.anything())
    expect(input()).toHaveValue('fixed')
  })

  it('controlled by a parent that keeps the value in state', async () => {
    const user = userEvent.setup()
    const Parent = () => {
      const [value, setValue] = useState('')
      return field({ value, onChange: setValue })
    }
    render(<Parent />)
    await user.type(input(), 'sk_1')
    expect(input()).toHaveValue('sk_1')
  })

  it('emits nothing on mount, on Show or on Hide', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(field({ defaultValue: KEY, onChange }))
    await user.click(toggle('Show'))
    await user.click(toggle('Hide'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('SecretField: inside a form', () => {
  const submitted = async (props, { show = false } = {}) => {
    const user = userEvent.setup()
    let data = null
    render(
      <form onSubmit={event => { event.preventDefault(); data = new FormData(event.currentTarget) }}>
        {field(props)}
        <button type='submit'>Save</button>
      </form>
    )
    if (show) await user.click(toggle('Show'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    return data
  }

  it('sends the value under its name while hidden', async () => {
    const data = await submitted({ defaultValue: KEY })
    expect(data.get('secret_key')).toBe(KEY)
  })

  it('sends the same value while shown', async () => {
    const data = await submitted({ defaultValue: KEY }, { show: true })
    expect(data.get('secret_key')).toBe(KEY)
  })

  it('the Show button does not submit the form', async () => {
    const onSubmit = vi.fn(event => event.preventDefault())
    const user = userEvent.setup()
    render(<form onSubmit={onSubmit}>{field({ defaultValue: KEY })}</form>)
    await user.click(toggle('Show'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('a disabled secret is not sent', async () => {
    const data = await submitted({ defaultValue: KEY, disabled: true })
    expect(data.get('secret_key')).toBeNull()
  })
})

describe('SecretField: read only', () => {
  it('is hidden, can be shown and hidden again, and the value never changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = render(field({ readOnly: true, defaultValue: KEY, onChange }))
    expect(input()).toHaveAttribute('readonly')
    expect(input()).toHaveAttribute('type', 'password')
    expect(toggle('Show')).toBeEnabled()
    await user.click(toggle('Show'))
    expect(input()).toHaveAttribute('type', 'text')
    expect(input()).toHaveValue(KEY)
    expect(endingOf(container)).toHaveTextContent('Ends in …k3Fz')
    await user.type(input(), 'zzz')
    expect(input()).toHaveValue(KEY)
    expect(onChange).not.toHaveBeenCalled()
    await user.click(toggle('Hide'))
    expect(input()).toHaveAttribute('type', 'password')
  })
})

describe('SecretField: stylesheet', () => {
  const rules = text => text.replace(/\/\*[\s\S]*?\*\//g, '')

  it('the text in the input is mono', () => {
    expect(css).toMatch(/\.odc-secret-input\s*\{[^}]*font-family: var\(--od-font-mono\)/)
  })

  it('hides the native reveal and clear buttons of the browser', () => {
    expect(css).toMatch(/\.odc-secret-input::-ms-reveal,\s*\.odc-secret-input::-ms-clear\s*\{[^}]*display: none/)
  })

  it('the row is a flex line with the box growing and the button fixed', () => {
    expect(css).toMatch(/\.odc-secret\s*\{[^}]*display: flex/)
    expect(css).toMatch(/\.odc-secret\s*\{[^}]*align-items: center/)
    expect(css).toMatch(/\.odc-secret\s*\{[^}]*gap: var\(--od-space-[2-9]\)/)
    expect(css).toMatch(/\.odc-secret > \.odc-field-box\s*\{[^}]*flex: 1 1 0/)
    expect(css).toMatch(/\.odc-secret-toggle\s*\{[^}]*flex: none/)
  })

  it('both words share one grid cell and the inactive one is invisible', () => {
    expect(css).toMatch(/\.odc-secret-words\s*\{[^}]*display: inline-grid/)
    expect(css).toMatch(/\.odc-secret-word\s*\{[^}]*grid-row: 1;[^}]*grid-column: 1/)
    expect(css).toMatch(/\.odc-secret-word\[aria-hidden='true'\]\s*\{[^}]*visibility: hidden/)
  })

  it('the hint and the ending are lines of their own', () => {
    expect(css).toMatch(/\.odc-secret-hint,\s*\.odc-secret-ending\s*\{[^}]*display: block/)
  })

  it('the phone block keeps the box and the button 12px apart (the box owns the input area, the button its own)', () => {
    const phone = css.slice(css.indexOf('@media (pointer: coarse), (max-width: 767px)'))
    expect(phone).toMatch(/\.odc-secret\s*\{[^}]*gap: var\(--od-space-3\)/)
    expect(phone).not.toMatch(/::after/)
  })

  it('has no literal length outside a media prelude and no literal colour', () => {
    expect(rules(css).replace(/@media[^{]*/g, '')).not.toMatch(/\d(px|rem|em)\b/)
    expect(rules(css)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('SecretField: the button is named by its word and the field', () => {
  it('reads «Show Secret key» and «Hide Secret key» through aria-labelledby over the word and the label words', async () => {
    const user = userEvent.setup()
    const { container } = render(field())
    const button = toggle('Show')
    expect(button).toHaveAccessibleName('Show Secret key')
    const ids = button.getAttribute('aria-labelledby').split(' ')
    expect(ids[1]).toBe(container.querySelector('.odc-field-label-text').id)
    expect(container.querySelector(`[id="${ids[0]}"]`)).toHaveTextContent('Show')
    await user.click(button)
    expect(toggle('Hide')).toHaveAccessibleName('Hide Secret key')
  })

  it('a required field names the button with the label words only, without «Required»', () => {
    render(field({ required: true, requiredLabel: 'Required' }))
    expect(screen.getByRole('button')).toHaveAccessibleName('Show Secret key')
  })

  it('a label that is a node still names the button', () => {
    render(field({ label: <em>Webhook secret</em> }))
    expect(screen.getByRole('button')).toHaveAccessibleName('Show Webhook secret')
  })

  it('without a visible label, aria-label joins the word when both are text', async () => {
    const user = userEvent.setup()
    render(field({ label: undefined, 'aria-label': 'Stripe key' }))
    expect(screen.getByRole('button')).toHaveAccessibleName('Show Stripe key')
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-labelledby')
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveAccessibleName('Hide Stripe key')
  })

  it('without a visible label and with a word that is a node, the name is the word', () => {
    render(field({ label: undefined, 'aria-label': 'Stripe key', showLabel: <b>Show</b> }))
    expect(screen.getByRole('button')).toHaveAccessibleName('Show')
  })
})

describe('SecretField: no layout shift on toggle', () => {
  it('both words are in the button, only the active one is not aria-hidden', async () => {
    const user = userEvent.setup()
    const { container } = render(field())
    const words = () => Array.from(container.querySelectorAll('.odc-secret-toggle .odc-secret-word'))
    expect(words().map(word => word.textContent)).toEqual(['Show', 'Hide'])
    expect(words().map(word => word.getAttribute('aria-hidden'))).toEqual([null, 'true'])
    await user.click(toggle('Show'))
    expect(words().map(word => word.getAttribute('aria-hidden'))).toEqual(['true', null])
  })

  it('the words sit in one wrapper that stacks them', () => {
    const { container } = render(field())
    const wrapper = container.querySelector('.odc-secret-toggle > .odc-secret-words')
    expect(wrapper.querySelectorAll(':scope > .odc-secret-word')).toHaveLength(2)
  })
})

describe('SecretField: optional status for a screen reader', () => {
  const STATUS = { shownStatus: 'Secret shown', hiddenStatus: 'Secret hidden' }

  it('has no status node when the texts are not given', () => {
    render(field())
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('is empty on mount and speaks the new state after each toggle', async () => {
    const user = userEvent.setup()
    render(field(STATUS))
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveClass('odc-sr-only')
    expect(status).toHaveTextContent('')
    await user.click(toggle('Show'))
    expect(screen.getByRole('status')).toHaveTextContent('Secret shown')
    await user.click(toggle('Hide'))
    expect(screen.getByRole('status')).toHaveTextContent('Secret hidden')
  })

  it('says hidden when disabling hides a shown secret, never a stale «shown»', async () => {
    const user = userEvent.setup()
    const { rerender } = render(field(STATUS))
    await user.click(toggle('Show'))
    expect(screen.getByRole('status')).toHaveTextContent('Secret shown')
    rerender(field({ ...STATUS, disabled: true }))
    expect(screen.getByRole('status')).toHaveTextContent('Secret hidden')
  })

  it('keeps the changing name and no aria-pressed', async () => {
    const user = userEvent.setup()
    render(field(STATUS))
    await user.click(toggle('Show'))
    expect(toggle('Hide')).not.toHaveAttribute('aria-pressed')
  })
})

describe('SecretField: uncontrolled, a reset of the form', () => {
  it('puts the ending back with the input once the reset has run', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <form>
        {field({ defaultValue: 'short' })}
        <button type='reset'>Reset</button>
      </form>
    )
    await user.type(input(), '-and-a-long-tail')
    expect(endingOf(container)).toHaveTextContent('Ends in …tail')
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(endingOf(container)).toBeNull())
    expect(input()).toHaveValue('short')
  })

  it('a reset also brings an ending back when the default was long', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <form>
        {field({ defaultValue: KEY })}
        <button type='reset'>Reset</button>
      </form>
    )
    await user.clear(input())
    expect(endingOf(container)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(endingOf(container)).toHaveTextContent('Ends in …k3Fz'))
  })

  it('stops listening when it unmounts', () => {
    const { container, unmount } = render(<form>{field({ defaultValue: KEY })}</form>)
    const form = container.querySelector('form')
    const remove = vi.spyOn(form, 'removeEventListener')
    unmount()
    expect(remove).toHaveBeenCalledWith('reset', expect.any(Function))
  })
})
