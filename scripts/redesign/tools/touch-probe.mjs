// redesign W0-8e (T0-34) · phone touch-target probe (owner decision 12, skill product.md > Touch targets).
// Compact controls look 32px on a phone and reach 44px through a centered pseudo-element. Published check:
// elementFromPoint 21px from the center on each side lands inside the control (itself or a descendant, or the frame
// that focuses it),
// the visible box does not change, and neighbouring hit areas do not cross.
//
// `touchProbe` runs INSIDE the page (page.evaluate). It must stay self-contained: no imports, no closures.
// `touchProbeSource` is its text, for the live-session driver (measure.mjs) and the check script.

// Same control selector measure.mjs uses for `controls` (touch-probe.check.mjs asserts they match).
export const TOUCH_CONTROLS_SELECTOR = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox], [role=switch], [role=combobox]'

export function touchProbe (opts) {
  const o = Object.assign({
    selector: 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox], [role=switch], [role=combobox]',
    reach: 21,
    target: 44,
    samples: 8,
    items: false,
    // fila 47 (N-1): a framed control owns its 44px area through its frame (a pseudo-element of
    // the frame, so the press lands on the frame), and `focusFrameControl` (Shared/Product/Field.jsx) focuses the
    // control. A touch on a frame counts for the control the frame focuses: [frame selector, its control selector].
    // touchProbeFrames.test.js fails when a call site of focusFrameControl is not listed here.
    frames: [
      ['.odc-field-control, .odc-field-box, .odc-dp-input-frame', 'input:not([type="hidden"]), select, textarea'],
      ['.odc-time-field-part, .odc-sched-time, .odc-campaign-time, .isp-select-part', 'select'],
      // PhoneField only: the older phone inputs (.PhoneInput without the P/ wrapper) have no frame handler
      ['.odc-phone-field-control .PhoneInput', 'input.PhoneInputInput']
    ]
  }, opts || {})
  // The control a press on `el` focuses when `el` is a frame (only a press on the frame itself, as focusFrameControl)
  const frameControl = el => {
    for (const [frame, control] of o.frames) {
      if (el.matches(frame)) return el.querySelector(control)
    }
    return null
  }
  const round = n => Math.round(n * 10) / 10
  const vis = el => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight * 3
  }
  const label = el => {
    let s = el.tagName.toLowerCase()
    if (el.id) s += '#' + el.id
    else {
      const cl = (el.getAttribute('class') || '').split(' ').filter(Boolean).slice(0, 2)
      if (cl.length) s += '.' + cl.join('.')
    }
    const t = String(el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 20)
    return t ? s + '[' + t + ']' : s
  }
  const controls = [...document.querySelectorAll(o.selector)].filter(vis)
  const order = new Map(controls.map((c, i) => [c, i]))
  const visibleBox = { below32: 0, at32: 0, between32and44: 0, atLeast44: 0 }
  const reach44 = { ok: 0, fail: 0, failSamples: [] }
  const crossings = { count: 0, samples: [] }
  const pairs = new Set()
  const items = []
  let notProbed = 0
  for (const c of controls) {
    const r = c.getBoundingClientRect()
    const w = round(r.width)
    const h = round(r.height)
    const m = Math.min(w, h)
    if (m < 31.5) visibleBox.below32++
    else if (m <= 32.5) visibleBox.at32++
    else if (m < 43.95) visibleBox.between32and44++
    else visibleBox.atLeast44++
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    // A box already >= target on an axis reaches by itself on that axis (reach criterion only).
    const selfV = r.height >= o.target - 0.05
    const selfH = r.width >= o.target - 0.05
    const sides = [
      ['up', cx, cy - o.reach, selfV],
      ['down', cx, cy + o.reach, selfV],
      ['left', cx - o.reach, cy, selfH],
      ['right', cx + o.reach, cy, selfH]
    ]
    const failed = []
    const crossed = []
    let probed = 0
    for (const [side, x, y, self] of sides) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue // outside the viewport: elementFromPoint is null
      probed++
      const hit = document.elementFromPoint(x, y)
      const framed = hit ? frameControl(hit) : null
      const inside = !!hit && (hit === c || c.contains(hit) || framed === c)
      if (!inside && !self) failed.push(side)
      if (hit && !inside) {
        const other = framed || hit.closest(o.selector)
        if (other && other !== c && !other.contains(c)) {
          const a = order.has(c) ? order.get(c) : -1
          const b = order.has(other) ? order.get(other) : -1 - controls.indexOf(other)
          const key = Math.min(a, b) + ':' + Math.max(a, b)
          if (!pairs.has(key)) {
            pairs.add(key)
            crossings.count++
            if (crossings.samples.length < o.samples) crossings.samples.push({ selector: label(c), side, with: label(other) })
          }
          crossed.push({ side, with: label(other) })
        }
      }
    }
    if (!probed) { notProbed++; if (o.items) items.push({ selector: label(c), w, h, probed: false }); continue }
    if (failed.length) {
      reach44.fail++
      if (reach44.failSamples.length < o.samples) reach44.failSamples.push({ selector: label(c), side: failed.join('+'), box: w + 'x' + h })
    } else reach44.ok++
    if (o.items) items.push({ selector: label(c), w, h, probed: true, failedSides: failed, crossed })
  }
  const out = { controls: controls.length, notProbed, visibleBox, reach44, crossings }
  if (o.items) out.items = items
  return out
}

export const touchProbeSource = touchProbe.toString()
