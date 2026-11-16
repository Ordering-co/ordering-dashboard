// batch O, row 11: Product details > Information, at phone width (max-width: 767px). The form was the legacy one
// with 32px inputs, a 32px textarea, 25x14 switches and 42px Cancel/Save, because the shared 44px rules only open for
// `pointer: coarse`. Under `(max-width: 767px)` every control of THIS form reaches 44px (var(--od-x-target-coarse)); the switch
// keeps its 25x14 drawing inside a 44x44 box; nothing moves or hides, and above 767px nothing changes.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url, parsePrice: (value) => `$${value}` }],
  DragAndDrop: ({ children }) => <div>{children}</div>,
  ExamineClick: ({ children }) => <div>{children}</div>
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Modal: () => null,
  ImageCrop: () => null,
  ColorPicker: () => null
}))

import { ProductDetatilsInformation } from '../index'

const TARGET = 'var(--od-x-target-coarse)'
const PHONE = '@media(max-width:767px)'

const PRODUCT = {
  id: 7,
  name: 'Cheese Burger',
  slug: 'cheese_burger',
  price: 10,
  in_offer: true,
  offer_price: 12,
  inventoried: true,
  quantity: 4,
  ribbon: { enabled: true, text: 'New', color: '#ff0000', shape: 'rectangle_round' }
}

const draw = () => renderWithProviders(
  <ProductDetatilsInformation
    product={PRODUCT}
    business={{ id: 3 }}
    onCancel={vi.fn()}
    formState={{ loading: false, changes: { name: 'x' }, result: { error: false } }}
    handleChangeInput={vi.fn()}
    handleChangeFormState={vi.fn()}
    handleChangeRibbon={vi.fn()}
    handlechangeImage={vi.fn()}
    handleButtonUpdateClick={vi.fn()}
  />
)

// Splits the minified stylesheet into top-level rules; `media` is the prelude of the @media block a rule lives in ('' for none).
const parseRules = (css) => {
  const rules = []
  const walk = (text, media) => {
    let i = 0
    while (i < text.length) {
      const open = text.indexOf('{', i)
      if (open === -1) break
      let depth = 1
      let j = open + 1
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
        j++
      }
      const prelude = text.slice(i, open).trim()
      const body = text.slice(open + 1, j - 1)
      if (prelude.startsWith('@media')) walk(body, prelude.replace(/\s+/g, ''))
      else if (!prelude.startsWith('@')) rules.push({ selectors: prelude.split(','), body: body.replace(/\s+/g, ''), media })
      i = j
    }
  }
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), '')
  return rules
}

const matches = (element, selector) => {
  try {
    return element.matches(selector.trim())
  } catch (e) {
    return false
  }
}

// The declarations that reach `element` from the injected styled-components CSS, inside (media) or outside ('') the phone block.
const declarationsFor = (element, media) => {
  const css = [...document.querySelectorAll('style')].map(style => style.textContent).join('\n')
  return parseRules(css)
    .filter(rule => rule.media === media && rule.selectors.some(selector => matches(element, selector)))
    .map(rule => rule.body)
    .join('')
}

describe('Information form · 44px controls at phone width (row 11)', () => {
  it('opens a phone block that reaches the form (the rules live under max-width: 767px)', () => {
    draw()

    expect(declarationsFor(screen.getByRole('button', { name: 'Save' }), PHONE)).not.toBe('')
  })

  it.each(['name', 'price', 'offer_price', 'quantity', 'text'])('input %s is at least 44px tall at phone width', (name) => {
    const { container } = draw()
    const input = container.querySelector(`input[name="${name}"]`)

    expect(input).not.toBeNull()
    expect(declarationsFor(input, PHONE)).toContain(`min-height:${TARGET}`)
  })

  it('the description textarea is at least 44px tall at phone width', () => {
    const { container } = draw()

    expect(declarationsFor(container.querySelector('textarea[name="description"]'), PHONE)).toContain(`min-height:${TARGET}`)
  })

  it('the three switches get a 44x44 box and keep their 25x14 drawing centred in it', () => {
    const { container } = draw()
    const boxes = [...container.querySelectorAll('label.od-switch')]

    expect(boxes).toHaveLength(3)
    boxes.forEach(box => {
      const phoneBox = declarationsFor(box, PHONE)
      expect(phoneBox).toContain(`width:${TARGET}`)
      expect(phoneBox).toContain(`height:${TARGET}`)

      const thumb = declarationsFor(box.querySelector('.od-switch-thumb'), PHONE)
      expect(thumb).toContain('width:25px')
      expect(thumb).toContain('height:14px')
      expect(thumb).toContain('top:50%')
      expect(thumb).toContain('left:50%')
      expect(thumb).toContain('transform:translate(-50%,-50%)')
    })
  })

  it('Cancel and Save are at least 44px tall at phone width', () => {
    draw()

    for (const name of ['Cancel', 'Save']) {
      expect(declarationsFor(screen.getByRole('button', { name }), PHONE)).toContain(`min-height:${TARGET}`)
    }
  })

  it('does not change anything above phone width: the 44px token appears only inside the phone block', () => {
    const { container } = draw()
    const controls = [
      container.querySelector('input[name="name"]'),
      container.querySelector('textarea[name="description"]'),
      container.querySelector('label.od-switch'),
      screen.getByRole('button', { name: 'Save' })
    ]

    controls.forEach(control => {
      expect(declarationsFor(control, '')).not.toContain(TARGET)
    })
    // the reader does see rules outside the phone block: the legacy 42px height is still there for wider viewports
    expect(declarationsFor(controls[3], '')).toContain('height:42px')
  })
})
