import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  captureSidebarDismissal,
  isTopPaintedSidebar,
  ownsCapturedSidebarDismissal,
  registerSidebar
} from './sidebar-layer'

const mounted = id => {
  const element = document.createElement('div')
  element.id = id
  element.getBoundingClientRect = () => ({ left: 800, right: 1200, top: 0, bottom: 800, width: 400, height: 800 })
  document.body.appendChild(element)
  return element
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('nonmodal sidebar paint order', () => {
  it('uses the deepest registered ancestor from the painted hit instead of registration order', () => {
    const parent = mounted('parent')
    const child = document.createElement('div')
    const leaf = document.createElement('span')
    child.id = 'child'
    child.getBoundingClientRect = parent.getBoundingClientRect
    child.appendChild(leaf)
    parent.appendChild(child)
    const childRef = { current: child }
    const parentRef = { current: parent }
    const unregisterChild = registerSidebar(childRef)
    const unregisterParent = registerSidebar(parentRef)
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: vi.fn(() => [leaf, child, parent]) })

    expect(isTopPaintedSidebar(childRef)).toBe(true)
    expect(isTopPaintedSidebar(parentRef)).toBe(false)

    unregisterParent()
    unregisterChild()
  })

  it('falls back to connected DOM order for equal-z siblings', () => {
    const first = mounted('first')
    const second = mounted('second')
    first.getBoundingClientRect = () => ({ width: 0, height: 0 })
    second.getBoundingClientRect = first.getBoundingClientRect
    const firstRef = { current: first }
    const secondRef = { current: second }
    const unregisterSecond = registerSidebar(secondRef)
    const unregisterFirst = registerSidebar(firstRef)

    expect(isTopPaintedSidebar(secondRef)).toBe(true)
    expect(isTopPaintedSidebar(firstRef)).toBe(false)

    unregisterFirst()
    unregisterSecond()
  })

  it('keeps one event owner after the painted sidebar unmounts and preserves modal blocking', () => {
    const first = mounted('snapshot-first')
    const second = mounted('snapshot-second')
    first.getBoundingClientRect = () => ({ width: 0, height: 0 })
    second.getBoundingClientRect = first.getBoundingClientRect
    const firstRef = { current: first }
    const secondRef = { current: second }
    const unregisterFirst = registerSidebar(firstRef)
    const unregisterSecond = registerSidebar(secondRef)
    const event = new KeyboardEvent('keydown', { code: 'Escape' })

    captureSidebarDismissal(event, false)
    expect(ownsCapturedSidebarDismissal(event, secondRef)).toBe(true)
    unregisterSecond()
    second.remove()
    expect(ownsCapturedSidebarDismissal(event, firstRef)).toBe(false)

    const modalEvent = new Event('click')
    captureSidebarDismissal(modalEvent, true)
    expect(ownsCapturedSidebarDismissal(modalEvent, firstRef)).toBe(false)

    unregisterFirst()
  })

  it('avoids layout reads for typing and modal-blocked events while retaining Escape ownership', () => {
    const panel = mounted('typing-panel')
    const ref = { current: panel }
    const unregister = registerSidebar(ref)
    const geometry = vi.spyOn(panel, 'getBoundingClientRect')
    const hitTest = vi.fn(() => [panel])
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: hitTest })
    for (let index = 0; index < 20; index++) {
      captureSidebarDismissal(new KeyboardEvent('keydown', { code: 'KeyA' }), false)
    }
    captureSidebarDismissal(new KeyboardEvent('keydown', { code: 'Escape' }), true)
    expect(geometry).not.toHaveBeenCalled()
    expect(hitTest).not.toHaveBeenCalled()
    const escape = new KeyboardEvent('keydown', { code: 'Escape' })
    captureSidebarDismissal(escape, false)
    expect(geometry).toHaveBeenCalledTimes(1)
    expect(hitTest).toHaveBeenCalledTimes(1)
    expect(ownsCapturedSidebarDismissal(escape, ref)).toBe(true)
    unregister()
  })
})
