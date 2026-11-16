import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SectionNav } from '../SectionNav'

// redesign UC-B1 (decision 35, B1-1): opt-in `wideMinWidth`, the container alone decides.
const ITEMS = [
  { id: 'basic', label: 'Basic info' },
  { id: 'hours', label: 'Opening hours' },
  { id: 'taxes', label: 'Taxes' }
]

// jsdom has no layout: the root width comes from clientWidth, the viewport from matchMedia.
const layout = { width: 0, viewportWide: false, targetWidth: 0 }
const observers = new Set()

class FakeResizeObserver {
  constructor (callback) {
    this.callback = callback
    this.observed = []
    observers.add(this)
  }

  observe (element) { this.observed.push(element) }
  unobserve () {}
  disconnect () { observers.delete(this) }
}

const resize = async (next) => {
  Object.assign(layout, next)
  await act(async () => {
    for (const observer of observers) observer.callback([], observer)
  })
}

beforeEach(() => {
  layout.width = 0
  layout.viewportWide = false
  layout.targetWidth = 0
  observers.clear()
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('matchMedia', query => ({
    get matches () { return layout.viewportWide && /min-width/.test(query) },
    addEventListener: () => {},
    removeEventListener: () => {}
  }))
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
    if (this.classList.contains('odc-sectionnav')) return layout.width
    return this.classList.contains('measured') ? layout.targetWidth : 0
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const setup = (props = {}) => render(
  <SectionNav label='Sections' compactLabel='Section' items={ITEMS} value='hours' onValueChange={vi.fn()} {...props} />
)

const isList = () => screen.getAllByRole('button').length === ITEMS.length
const isSelector = () => {
  const buttons = screen.getAllByRole('button')
  return buttons.length === 1 && buttons[0].getAttribute('aria-haspopup') === 'menu'
}

describe('SectionNav wideMinWidth (UC-B1)', () => {
  it('with wideMinWidth=640, a 520px container at a 1440 viewport renders the selector', () => {
    layout.width = 520
    layout.viewportWide = true
    const { container } = setup({ wideMinWidth: 640 })
    expect(isSelector()).toBe(true)
    expect(container.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'selector')
  })

  it('with wideMinWidth=640, a 700px container renders the list', () => {
    layout.width = 700
    layout.viewportWide = true
    const { container } = setup({ wideMinWidth: 640 })
    expect(isList()).toBe(true)
    expect(container.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'list')
  })

  it('with wideMinWidth, exactly the threshold is wide, and a resize flips it both ways', async () => {
    layout.width = 640
    setup({ wideMinWidth: 640 })
    expect(isList()).toBe(true)
    await resize({ width: 639 })
    expect(isSelector()).toBe(true)
    await resize({ width: 800 })
    expect(isList()).toBe(true)
  })

  it('with wideMinWidth, nothing laid out (width 0) keeps the list', () => {
    layout.width = 0
    layout.viewportWide = false
    setup({ wideMinWidth: 640 })
    expect(isList()).toBe(true)
  })

  it('with wideMinWidth, a narrow viewport does not turn a wide container into the selector', () => {
    layout.width = 700
    layout.viewportWide = false
    setup({ wideMinWidth: 640 })
    expect(isList()).toBe(true)
  })

  it('without the prop, 520px at a 1440 viewport keeps the list (today)', () => {
    layout.width = 520
    layout.viewportWide = true
    setup()
    expect(isList()).toBe(true)
  })

  it('without the prop, 520px at a narrow viewport is still the selector (today)', () => {
    layout.width = 520
    layout.viewportWide = false
    setup()
    expect(isSelector()).toBe(true)
  })

  it('without the prop, 600px wins over a narrow viewport (today)', () => {
    layout.width = 600
    layout.viewportWide = false
    setup()
    expect(isList()).toBe(true)
  })
})

// redesign UC-R2 (Q-02): `measureTarget`, used only together with `wideMinWidth`. Inside a wide RecordPanel the nav's own root is
// a ~175px column that never reaches the threshold; the width that decides is the panel's.
const setupMeasured = (props = {}) => render(
  <div className='measured' data-testid='target'>
    <SectionNav
      label='Sections'
      compactLabel='Section'
      items={ITEMS}
      value='hours'
      onValueChange={vi.fn()}
      wideMinWidth={640}
      measureTarget={root => root.closest('.measured')}
      {...props}
    />
  </div>
)

describe('SectionNav measureTarget (UC-R2 Q-02)', () => {
  it('a 175px column inside a 720px target is the list: the target decides, not the root', () => {
    layout.width = 175
    layout.targetWidth = 720
    const { container } = setupMeasured()
    expect(isList()).toBe(true)
    expect(container.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'list')
  })

  it('a full-row root inside a 520px target is the selector', () => {
    layout.width = 520
    layout.targetWidth = 520
    setupMeasured()
    expect(isSelector()).toBe(true)
  })

  it('a root wider than the threshold inside a narrower target is still the selector (the target decides)', () => {
    layout.width = 900
    layout.targetWidth = 500
    setupMeasured()
    expect(isSelector()).toBe(true)
  })

  it('exactly the threshold on the target is wide, and a resize of the target flips it both ways', async () => {
    layout.width = 175
    layout.targetWidth = 640
    setupMeasured()
    expect(isList()).toBe(true)
    await resize({ targetWidth: 639 })
    expect(isSelector()).toBe(true)
    await resize({ targetWidth: 720 })
    expect(isList()).toBe(true)
    await resize({ targetWidth: 520 })
    expect(isSelector()).toBe(true)
  })

  it('observes the target, not the root', () => {
    layout.targetWidth = 720
    setupMeasured()
    const observed = [...observers].flatMap(observer => observer.observed)
    expect(observed).toHaveLength(1)
    expect(observed[0]).toBe(screen.getByTestId('target'))
  })

  it('a target that is not laid out (width 0) keeps the list', () => {
    layout.width = 175
    layout.targetWidth = 0
    setupMeasured()
    expect(isList()).toBe(true)
  })

  it('a measureTarget that finds nothing falls back to the root', () => {
    layout.width = 520
    layout.targetWidth = 900
    setupMeasured({ measureTarget: () => null })
    expect(isSelector()).toBe(true)
  })

  it('without wideMinWidth the measureTarget is ignored: the 600px / 768px rule applies to the root (today)', () => {
    layout.width = 520
    layout.targetWidth = 900
    layout.viewportWide = false
    setupMeasured({ wideMinWidth: undefined })
    expect(isSelector()).toBe(true)
    const observed = [...observers].flatMap(observer => observer.observed)
    expect(observed.every(element => element.classList.contains('odc-sectionnav'))).toBe(true)
  })

  it('without measureTarget the root is measured and observed (default unchanged)', () => {
    layout.width = 700
    layout.targetWidth = 100
    setupMeasured({ measureTarget: undefined })
    expect(isList()).toBe(true)
    const observed = [...observers].flatMap(observer => observer.observed)
    expect(observed).toHaveLength(1)
    expect(observed[0].classList.contains('odc-sectionnav')).toBe(true)
  })
})
