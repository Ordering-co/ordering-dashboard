// redesign W0 T0-45 (W0-E-01, W0-E-08; decision 12): the touch-target bar of the e2e specs of the harness and of the app.
// On a phone or with a coarse pointer a control is 32px VISIBLE and its 44×44 area is a pseudo-element
// (`::after { inset: var(--od-x-target-inset) }`); an <input>/<select> carries it on its frame. The bar did not go down: the
// area is measured with `elementFromPoint` at the four corners (±21px of the centre), and the controls W0-D-08 lists as
// keeping 44px visible still have to be 44×44 by their own box (`keepsVisible: true`); a control drawn 44×44 passes by its box.
import { expect } from '@playwright/test'

// redesign the frame a component draws around ONE native select (P/TimeField's part, P/ScheduleEditor's time) owns
// that select's area too. Like every frame it must be an ancestor of the control (`closest`), and it counts only while it holds
// exactly one control: around two or more it lends no area. behaviour.spec.js (C3) applies the same rule inline: keep both alike.
export const ONE_CONTROL_FRAME = '.odc-time-field-part, .odc-sched-time'
// X-SC8: a U/FirstSelect trigger (a div role=button, 2px inside the root's border) is drawn by its root, as an input by its frame
export const TARGET_FRAME = `.odc-field-control, .odc-field-box, .PhoneInput, .odc-dp-input-frame, .od-first-select-root, ${ONE_CONTROL_FRAME}`

// What is wrong with the target of `locator`: its drawn size and the corners of its 44×44 area that another element answers.
export async function touchTargetProblems (locator, { keepsVisible = false, frame = TARGET_FRAME } = {}) {
  return locator.evaluate((node, { keepsVisible: keeps, frame: frameSelector, oneControl }) => {
    node.scrollIntoView({ block: 'center', inline: 'center' })
    const frameOf = node.matches('input, select, .od-first-select-trigger') ? node.closest(frameSelector) : null
    const owner = frameOf && frameOf.matches(oneControl) && frameOf.querySelectorAll('input, select, textarea').length !== 1 ? null : frameOf
    const box = (owner ?? node).getBoundingClientRect()
    const problems = []
    // A control drawn 44×44 (the ones W0-D-08 lists) reaches the area by its own box.
    if (Math.round(box.width) >= 44 && Math.round(box.height) >= 44) return problems
    const floor = keeps ? 44 : 32
    if (Math.round(box.width) < floor) problems.push(`drawn ${Math.round(box.width)}px wide, under ${floor}`)
    if (Math.round(box.height) < floor) problems.push(`drawn ${Math.round(box.height)}px high, under ${floor}`)
    if (keeps) return problems
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const missed = [[-21, -21], [21, -21], [-21, 21], [21, 21]].filter(([dx, dy]) => {
      const hit = document.elementFromPoint(x + dx, y + dy)
      return !(hit && (hit === node || node.contains(hit) || (owner && owner.contains(hit))))
    })
    if (missed.length) problems.push(`the 44×44 area does not hold at ${missed.map(point => point.join(',')).join(' | ')}`)
    return problems
  }, { keepsVisible, frame, oneControl: ONE_CONTROL_FRAME })
}

export async function expectTouchTarget (locator, { label = 'target', ...options } = {}) {
  expect(await touchTargetProblems(locator, options), `${label}: 32px visible with a 44×44 area (decision 12)`).toEqual([])
}
