// redesign BO-B2 (a): the focus helper the users lists share (promoted from CustomersListing). Frames are driven by hand.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { focusableIn, focusTargetIn, settleFocusOn } from '../listFocus'

let queue
let frame
let outside // a control that is not in the list

// Runs the frames queued so far, one generation per call (what a callback queues waits for the next one)
const tick = (count = 1) => {
  for (let i = 0; i < count; i++) {
    const batch = queue
    queue = []
    batch.forEach(callback => callback())
  }
}

beforeEach(() => {
  queue = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => queue.push(callback))
  frame = document.createElement('div')
  frame.innerHTML = [
    '<div class="odc-table-scroll">',
    '  <div data-row-id="7"><a href="#a">Ana</a></div>',
    '  <div data-row-id="8" tabindex="0">Marco</div>',
    '</div>'
  ].join('')
  outside = document.createElement('button')
  outside.textContent = 'Outside'
  document.body.appendChild(outside)
  document.body.appendChild(frame)
})

afterEach(() => {
  vi.restoreAllMocks()
  frame.remove()
  outside.remove()
})

describe('focusableIn', () => {
  it('is the element itself with a tabindex, else its first link, button or tabindex child, else the element', () => {
    const rowWithTabindex = frame.querySelector('[data-row-id="8"]')
    const rowWithLink = frame.querySelector('[data-row-id="7"]')
    const bare = document.createElement('div')
    expect(focusableIn(rowWithTabindex)).toBe(rowWithTabindex)
    expect(focusableIn(rowWithLink)).toBe(rowWithLink.querySelector('a'))
    expect(focusableIn(bare)).toBe(bare)
    expect(focusableIn(null)).toBeNull()
  })
})

describe('focusTargetIn', () => {
  it('finds the row by data-row-id', () => {
    expect(focusTargetIn(frame, 7, false)).toBe(frame.querySelector('[data-row-id="7"] a'))
    expect(focusTargetIn(frame, '8', false)).toBe(frame.querySelector('[data-row-id="8"]'))
  })

  it('waits (null) for a row that is not there yet, and falls to the table region on the final try', () => {
    expect(focusTargetIn(frame, 99, false)).toBeNull()
    const region = focusTargetIn(frame, 99, true)
    expect(region).toBe(frame.querySelector('.odc-table-scroll'))
    expect(region).toHaveAttribute('tabindex', '-1')
  })

  it('with no id it goes to the region at once; with no frame, nowhere', () => {
    expect(focusTargetIn(frame, null, false)).toBe(frame.querySelector('.odc-table-scroll'))
    expect(focusTargetIn(null, 7, true)).toBeNull()
  })

  it('with no id, emptyTarget (redesign RA-I3) names the control; without a control, or with an id, it is ignored', () => {
    const control = document.createElement('button')
    expect(focusTargetIn(frame, null, false, () => control)).toBe(control)
    expect(focusTargetIn(frame, null, false, () => null)).toBe(frame.querySelector('.odc-table-scroll'))
    expect(focusTargetIn(frame, 7, false, () => control)).toBe(frame.querySelector('[data-row-id="7"] a'))
  })
})

describe('settleFocusOn', () => {
  it('puts the focus on the row once it renders and keeps it there until it holds', () => {
    settleFocusOn(() => frame, 7)
    tick()
    expect(document.activeElement).toBe(frame.querySelector('[data-row-id="7"] a'))
    tick(4)
    expect(queue).toHaveLength(0) // stable for three frames: it stops asking
  })

  it('tries again on the next frames while the row has not rendered, then falls to the region', () => {
    settleFocusOn(() => frame, 99)
    tick(3)
    expect(document.activeElement).toBe(document.body)
    tick()
    expect(document.activeElement).toBe(frame.querySelector('.odc-table-scroll'))
  })

  it('finds a row that renders late', () => {
    settleFocusOn(() => frame, 55)
    tick(2)
    const late = document.createElement('div')
    late.setAttribute('data-row-id', '55')
    late.setAttribute('tabindex', '0')
    frame.querySelector('.odc-table-scroll').appendChild(late)
    tick()
    expect(document.activeElement).toBe(late)
  })

  it('leaves alone a focus the person already put somewhere in the list', () => {
    frame.querySelector('[data-row-id="8"]').focus()
    settleFocusOn(() => frame, 7)
    tick()
    expect(document.activeElement).toBe(frame.querySelector('[data-row-id="8"]'))
    expect(queue).toHaveLength(0)
  })

  it('takes the focus back from something outside the list', () => {
    outside.focus()
    expect(document.activeElement).toBe(outside)
    settleFocusOn(() => frame, 7)
    tick()
    expect(document.activeElement).toBe(frame.querySelector('[data-row-id="7"] a'))
  })

  it('gives up after 30 frames when there is never a frame to look in', () => {
    settleFocusOn(() => null, 7)
    tick(40)
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(30) // the first call plus one per unanswered frame, up to the cap of 30 frames
    expect(queue).toHaveLength(0)
  })

  describe('takeover (redesign RA-I3: after a delete)', () => {
    it('replaces a focus that sits on a ROW of the list (the browser put it on the first row)', () => {
      frame.querySelector('[data-row-id="8"]').focus()
      settleFocusOn(() => frame, 7, { takeover: true })
      tick()
      expect(document.activeElement).toBe(frame.querySelector('[data-row-id="7"] a'))
    })

    it('replaces a focus on a control INSIDE a row', () => {
      const link = frame.querySelector('[data-row-id="7"] a')
      link.focus()
      settleFocusOn(() => frame, 8, { takeover: true })
      tick()
      expect(document.activeElement).toBe(frame.querySelector('[data-row-id="8"]'))
    })

    it('still leaves alone a focus on a control of the list that is not in a row', () => {
      const toolbar = document.createElement('button')
      frame.appendChild(toolbar)
      toolbar.focus()
      settleFocusOn(() => frame, 7, { takeover: true })
      tick()
      expect(document.activeElement).toBe(toolbar)
      expect(queue).toHaveLength(0)
    })

    it('without takeover a focus on a row is respected, as always (also with an empty options object)', () => {
      frame.querySelector('[data-row-id="8"]').focus()
      settleFocusOn(() => frame, 7, {})
      tick()
      expect(document.activeElement).toBe(frame.querySelector('[data-row-id="8"]'))
      expect(queue).toHaveLength(0)
    })

    it('watches for 10 stable frames instead of 3', () => {
      settleFocusOn(() => frame, 7, { takeover: true })
      tick() // focused
      tick(3)
      expect(queue).toHaveLength(1) // the plain mode would have stopped by now
      tick(7)
      expect(queue).toHaveLength(0)
    })

    it('keeps the plain 3 stable frames without options', () => {
      settleFocusOn(() => frame, 7)
      tick(4)
      expect(queue).toHaveLength(0)
    })

    it('takes the focus back from a row if it comes back after the first frames', () => {
      settleFocusOn(() => frame, 7, { takeover: true })
      tick(2)
      frame.querySelector('[data-row-id="8"]').focus() // the closing dialog hands the focus back late
      tick()
      expect(document.activeElement).toBe(frame.querySelector('[data-row-id="7"] a'))
    })

    it('with no id (no row left) focuses emptyTarget(frame)', () => {
      const newButton = document.createElement('button')
      outside.parentNode.insertBefore(newButton, outside)
      const emptyTarget = vi.fn(() => newButton)
      frame.querySelector('[data-row-id="8"]').focus()
      settleFocusOn(() => frame, null, { takeover: true, emptyTarget })
      tick()
      expect(emptyTarget).toHaveBeenCalledWith(frame)
      expect(document.activeElement).toBe(newButton)
      newButton.remove()
    })

    it('with no id and no emptyTarget control, falls to the region', () => {
      settleFocusOn(() => frame, null, { takeover: true, emptyTarget: () => null })
      tick()
      expect(document.activeElement).toBe(frame.querySelector('.odc-table-scroll'))
    })

    it('does not use emptyTarget when there is an id', () => {
      const emptyTarget = vi.fn(() => outside)
      settleFocusOn(() => frame, 7, { takeover: true, emptyTarget })
      tick()
      expect(emptyTarget).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(frame.querySelector('[data-row-id="7"] a'))
    })
  })
})
