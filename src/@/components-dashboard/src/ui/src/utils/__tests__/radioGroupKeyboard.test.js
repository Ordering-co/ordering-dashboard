import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { radioGroupKeyDown, radioTabIndex } from '../radioGroupKeyboard'

// <div role=radiogroup>
//   a  b  (nested radiogroup: n1 n2)  c(disabled)  d(aria-disabled)  e
// </div>
const buildGroup = () => {
  const root = document.createElement('div')
  root.innerHTML = `
    <div role="radiogroup" id="outer">
      <button type="button" role="radio" aria-checked="true" id="a"></button>
      <button type="button" role="radio" aria-checked="false" id="b"></button>
      <div role="radiogroup" id="inner">
        <button type="button" role="radio" aria-checked="true" id="n1"></button>
        <button type="button" role="radio" aria-checked="false" id="n2"></button>
      </div>
      <button type="button" role="radio" aria-checked="false" id="c" disabled></button>
      <button type="button" role="radio" aria-checked="false" id="d" aria-disabled="true"></button>
      <button type="button" role="radio" aria-checked="false" id="e"></button>
    </div>
  `
  document.body.appendChild(root)
  const clicks = []
  root.querySelectorAll('[role=radio]').forEach(radio => {
    radio.addEventListener('keydown', radioGroupKeyDown)
    radio.addEventListener('click', () => clicks.push(radio.id))
  })
  return { root, clicks, get: (id) => root.querySelector(`#${id}`) }
}

const press = (element, key) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  element.dispatchEvent(event)
  return event
}

describe('radioTabIndex', () => {
  it('is 0 for the checked radio and -1 for the rest', () => {
    expect(radioTabIndex(true, false, true)).toBe(0)
    expect(radioTabIndex(false, true, true)).toBe(-1)
    expect(radioTabIndex(false, false, true)).toBe(-1)
  })

  it('falls back to the first radio when none is checked', () => {
    expect(radioTabIndex(false, true, false)).toBe(0)
    expect(radioTabIndex(false, false, false)).toBe(-1)
  })
})

describe('radioGroupKeyDown', () => {
  let group
  beforeEach(() => { group = buildGroup() })
  afterEach(() => { group.root.remove() })

  it('ArrowRight and ArrowDown click and focus the next radio of the same group, skipping nested and disabled ones', () => {
    const { get, clicks } = group
    const event = press(get('a'), 'ArrowRight')
    expect(event.defaultPrevented).toBe(true)
    expect(clicks).toEqual(['b'])
    expect(get('b')).toBe(document.activeElement)

    // b -> e: the nested n1/n2, the disabled c and the aria-disabled d are jumped over.
    press(get('b'), 'ArrowDown')
    expect(clicks).toEqual(['b', 'e'])
    expect(get('e')).toBe(document.activeElement)
  })

  it('wraps around from the last radio to the first', () => {
    const { get, clicks } = group
    get('e').setAttribute('aria-checked', 'true')
    get('a').setAttribute('aria-checked', 'false')
    press(get('e'), 'ArrowRight')
    expect(clicks).toEqual(['a'])
    expect(get('a')).toBe(document.activeElement)
  })

  it('ArrowLeft and ArrowUp click and focus the previous radio, wrapping and skipping nested and disabled ones', () => {
    const { get, clicks } = group
    press(get('e'), 'ArrowLeft')
    expect(clicks).toEqual(['b'])
    expect(get('b')).toBe(document.activeElement)

    get('a').setAttribute('aria-checked', 'false')
    press(get('a'), 'ArrowUp')
    expect(clicks).toEqual(['b', 'e'])
    expect(get('e')).toBe(document.activeElement)
  })

  it('Home and End go to the first and last enabled radio of the group', () => {
    const { get, clicks } = group
    press(get('b'), 'End')
    expect(clicks).toEqual(['e'])
    expect(get('e')).toBe(document.activeElement)

    press(get('e'), 'Home')
    expect(clicks).toEqual(['e', 'a'])
    expect(get('a')).toBe(document.activeElement)
  })

  it('works inside the nested group without leaking to the outer one', () => {
    const { get, clicks } = group
    press(get('n1'), 'ArrowRight')
    expect(clicks).toEqual(['n2'])
    expect(get('n2')).toBe(document.activeElement)
    press(get('n2'), 'ArrowDown')
    expect(get('n1')).toBe(document.activeElement)
    press(get('n2'), 'End')
    expect(clicks).toEqual(['n2', 'n1', 'n2'])
  })

  it('does nothing for keys that do not apply', () => {
    const { get, clicks } = group
    get('a').focus()
    for (const key of ['Tab', 'Enter', ' ', 'a', 'PageDown']) {
      const event = press(get('a'), key)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(clicks).toEqual([])
    expect(get('a')).toBe(document.activeElement)
  })

  it('does nothing outside a radiogroup or from a disabled radio', () => {
    const lone = document.createElement('button')
    lone.setAttribute('role', 'radio')
    lone.addEventListener('keydown', radioGroupKeyDown)
    document.body.appendChild(lone)
    const spy = vi.fn()
    lone.addEventListener('click', spy)
    expect(press(lone, 'ArrowRight').defaultPrevented).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    lone.remove()

    const { get, clicks } = group
    get('c').addEventListener('keydown', radioGroupKeyDown)
    expect(press(get('c'), 'ArrowRight').defaultPrevented).toBe(false)
    expect(clicks).toEqual([])
  })
})
