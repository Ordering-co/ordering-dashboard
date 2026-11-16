// redesign AH · overlap probe. The owner found «Save» of My products › Dashboard drawn over the next card
// («Dashboard order alerts»); no audit saw it, because measure.mjs looked for crossings only between phone touch areas.
// This probe looks for things painted on top of each other at any width: the visible boxes of text (each line of a text node
// with content), buttons, links and fields. A pair counts when the two boxes cross by more than `min` px on both axes, neither
// box contains the other, and neither element is the other's ancestor (a text node counts as its parent element).
//
// Not counted: a pair across a layer that floats on purpose (dialog, sheet, popover, menu, listbox, toast, tooltip, and a fixed
// or sticky box with an opaque background over the content it scrolls past): what such a layer covers is covered on purpose,
// but two things inside the same layer still count. Hidden nodes (display, visibility, opacity 0) and nodes out of view
// (clipped away by an ancestor whose overflow is not visible, or off the viewport sideways, like a closed drawer) are not
// items. What a scroller hides is measured by scrolling it into view (overlapScroll, below).
//
// `overlapProbe` runs INSIDE the page (page.evaluate). It must stay self-contained: no imports, no closures.
// `overlapProbeSource` is its text, for the live-session drivers (measure.mjs, overlap-sweep.mjs) and the check script.

// The controls the probe compares (measure.mjs and touch-probe.mjs use the same list).
export const OVERLAP_CONTROLS_SELECTOR = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox], [role=switch], [role=combobox]'

export function overlapProbe (opts) {
  const o = Object.assign({
    selector: 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox], [role=switch], [role=combobox]',
    // the roots of the layers that float on purpose (the innermost one an item is in is its layer)
    layers: '[role=dialog], [role=alertdialog], dialog, [aria-modal="true"], .odc-sheet, [role=menu], [role=listbox], [role=tooltip], [popover], .od-toast-container, .Toastify, [class*="-positioner"], .popover, .dropdown-menu, .tooltip',
    min: 2,
    samples: 20,
    root: null
  }, opts || {})
  const root = (o.root && document.querySelector(o.root)) || document.body
  const round = n => Math.round(n)
  const shown = el => (el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true)

  // The part of the viewport/document an element can be seen in: clipped by every ancestor whose overflow is not visible (a
  // scroller paints only its own box: what is scrolled away is measured when overlapScroll brings it into view), and the page
  // itself only clips sideways (the viewport width). An element with `display: contents` has no box and clips nothing.
  // Review of AH: an absolute box escapes the overflow of the ancestors between it and its containing block (the nearest
  // positioned ancestor), and a fixed box escapes them all; only the viewport clips it.
  const hides = v => v !== 'visible'
  const clipCache = new Map()
  const clipBy = (clip, e, s) => {
    if (s.display === 'contents' || (!hides(s.overflowX) && !hides(s.overflowY))) return clip
    const r = e.getBoundingClientRect()
    return {
      left: hides(s.overflowX) ? Math.max(clip.left, r.left) : clip.left,
      right: hides(s.overflowX) ? Math.min(clip.right, r.right) : clip.right,
      top: hides(s.overflowY) ? Math.max(clip.top, r.top) : clip.top,
      bottom: hides(s.overflowY) ? Math.min(clip.bottom, r.bottom) : clip.bottom
    }
  }
  const viewport = () => ({ left: 0, right: innerWidth, top: 0, bottom: innerHeight })
  // the clip of el's own box (its own overflow does not cut it)
  const clipOf = el => {
    if (clipCache.has(el)) return clipCache.get(el)
    let clip = { left: 0, right: innerWidth, top: -Infinity, bottom: Infinity }
    const own = getComputedStyle(el).position
    let escaping = own === 'absolute'
    if (own === 'fixed') clip = viewport()
    else {
      for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
        const s = getComputedStyle(e)
        if (escaping && s.position === 'static' && s.transform === 'none') continue
        escaping = false
        clip = clipBy(clip, e, s)
        if (s.position === 'fixed') {
          const v = viewport()
          clip = { left: Math.max(clip.left, v.left), right: Math.min(clip.right, v.right), top: Math.max(clip.top, v.top), bottom: Math.min(clip.bottom, v.bottom) }
          break
        }
        if (s.position === 'absolute') escaping = true
      }
    }
    clipCache.set(el, clip)
    return clip
  }
  // the clip of a text inside el: el's own overflow cuts it too (an ellipsis, a clamp)
  const textClipOf = el => clipBy(clipOf(el), el, getComputedStyle(el))
  const cut = (r, c) => {
    const box = { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) }
    return box.right - box.left > 0.5 && box.bottom - box.top > 0.5 ? box : null
  }

  // An opaque positioned box floats over content on purpose: fixed or sticky over whatever scrolls past it (a sticky header, a
  // save bar), absolute over the content of a scroller it does not belong to (the arrows at the ends of a chip strip, ).
  const opaque = el => {
    const bg = getComputedStyle(el).backgroundColor
    const m = bg.match(/rgba?\(([^)]+)\)/)
    if (!m) return false
    const parts = m[1].split(',').map(x => parseFloat(x))
    return parts.length < 4 || parts[3] >= 0.99
  }
  // the nearest scroller of el that does not hold box (what slides under box when it scrolls)
  const scrollsUnder = (el, box) => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      if (e.contains(box)) return false
      const s = getComputedStyle(e)
      if (/auto|scroll/.test(s.overflowX + s.overflowY)) return true
    }
    return false
  }
  // A fixed box, or a sticky one while it is stuck to its edge, floats over what scrolls past. A sticky box pushed elsewhere by
  // its containing block (the owner's «Save», sticky with top: 100%, sat at the bottom of its card) does not: it covers for good.
  const stuck = f => {
    const s = getComputedStyle(f)
    if (s.position === 'fixed') return true
    if (s.position !== 'sticky') return false
    // stuck = at its sticky position on a side whose inset is set (the scroller's box less border and padding, moved in by the
    // inset), and there either flush with the visible edge of the scroller or offset on purpose (inset other than 0: a column or
    // a header stacked next to another sticky one). A sticky box with inset 0 that stops short of the visible edge (bottom: 0 in a
    // scroller with end padding) leaves a strip where the content shows past it, so what it covers counts, as for a box pushed
    // elsewhere by its containing block (the owner's «Save», top: 100%). Each axis has its own scroller (a sticky column: x).
    const edgesOf = axis => {
      for (let e = f.parentElement; e && e !== document.body; e = e.parentElement) {
        const es = getComputedStyle(e)
        // an element with display: contents has no box (the shell's main): it is not the scroller
        if (!hides(es[axis]) || es.display === 'contents') continue
        const r = e.getBoundingClientRect()
        const n = v => parseFloat(es[v]) || 0
        const visible = { top: r.top + n('borderTopWidth'), bottom: r.bottom - n('borderBottomWidth'), left: r.left + n('borderLeftWidth'), right: r.right - n('borderRightWidth') }
        const content = { top: visible.top + n('paddingTop'), bottom: visible.bottom - n('paddingBottom'), left: visible.left + n('paddingLeft'), right: visible.right - n('paddingRight') }
        return { visible, content }
      }
      const view = { top: 0, bottom: innerHeight, left: 0, right: innerWidth }
      return { visible: view, content: view }
    }
    const r = f.getBoundingClientRect()
    const y = edgesOf('overflowY')
    const x = edgesOf('overflowX')
    const side = (inset, edge, size, sign, box) => {
      if (inset === 'auto') return false
      const n = inset.endsWith('%') ? parseFloat(inset) / 100 * size : parseFloat(inset)
      const at = Math.abs(r[edge] - (box.content[edge] + sign * n)) < 1.5
      return at && (n !== 0 || Math.abs(r[edge] - box.visible[edge]) < 1.5)
    }
    const h = y.content.bottom - y.content.top
    const w = x.content.right - x.content.left
    return side(s.top, 'top', h, 1, y) || side(s.bottom, 'bottom', h, -1, y) || side(s.left, 'left', w, 1, x) || side(s.right, 'right', w, -1, x)
  }
  // every opaque positioned box el sits in, nearest first (a save bar inside a fixed panel: both)
  const chainCache = new Map()
  const floatingChain = el => {
    if (!el || el === document.body || el === document.documentElement) return []
    if (chainCache.has(el)) return chainCache.get(el)
    const p = getComputedStyle(el).position
    const chain = [...((p === 'fixed' || p === 'sticky' || p === 'absolute') && opaque(el) ? [el] : []), ...floatingChain(el.parentElement)]
    chainCache.set(el, chain)
    return chain
  }
  // a pair is on purpose when a floating box of one side, not holding the other, is fixed or stuck, or is absolute over a
  // scroller of the other (review of AH: an opaque close button inside a fixed panel still counts against that panel, and the
  // page under a fixed panel does not count against what the panel holds)
  const onPurpose = (a, b) => {
    for (const [one, other] of [[a, b], [b, a]]) {
      for (const f of floatingChain(one)) {
        if (f.contains(other)) continue
        const p = getComputedStyle(f).position
        if (((p === 'fixed' || p === 'sticky') && stuck(f)) || (p === 'absolute' && scrollsUnder(other, f))) return true
      }
    }
    return false
  }

  const describe = el => {
    const one = e => {
      let s = e.tagName.toLowerCase()
      // generated ids (base-ui «:r1:», numbers) change between loads: not part of a stable selector
      if (e.id && !/[:]|^\d|^base-ui/.test(e.id)) return s + '#' + e.id
      // styled-components: «Button-sc-l6jzs9-0» keeps its display name only (the hash moves when the file changes), and the
      // generated class («bWdkZB») is dropped, so a pair keeps its key between builds
      const cl = (e.getAttribute('class') || '').split(/\s+/).filter(c => c && !/^sc-/.test(c) && !/^[a-zA-Z]{5,7}$/.test(c))
        .map(c => c.replace(/-sc-[a-z0-9]+-\d+$/i, '')).filter((c, i, list) => list.indexOf(c) === i).slice(0, 2)
      if (cl.length) s += '.' + cl.join('.')
      return s
    }
    const path = []
    for (let e = el; e && e !== document.body && path.length < 4; e = e.parentElement) {
      path.unshift(one(e))
      if (e.id && !/[:]|^\d|^base-ui/.test(e.id)) break
    }
    return path.join(' > ')
  }
  const textOf = el => String(el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 40)

  // Items: { el (owner), kind, box, text }. A text node gives one item per line box.
  const items = []
  const controls = [...root.querySelectorAll(o.selector)]
  for (const el of controls) {
    if (!shown(el)) continue
    const box = cut(el.getBoundingClientRect(), clipOf(el))
    if (box) items.push({ el, kind: 'control', box, text: textOf(el) })
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = node.textContent.replace(/\s+/g, ' ').trim()
    const el = node.parentElement
    if (!text || !el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(el.tagName) || !shown(el)) continue
    range.selectNodeContents(node)
    const clip = textClipOf(el)
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue
      const box = cut(r, clip)
      if (box) items.push({ el, kind: 'text', box, text: text.slice(0, 40) })
    }
  }

  const contains = (a, b) => a.left <= b.left + 1 && a.right >= b.right - 1 && a.top <= b.top + 1 && a.bottom >= b.bottom - 1
  const related = (a, b) => a === b || a.contains(b) || b.contains(a)
  const pairs = new Map()
  let floating = 0
  // sweep on the x axis: only boxes whose x ranges meet are compared
  items.sort((a, b) => a.box.left - b.box.left)
  for (let i = 0; i < items.length; i++) {
    const a = items[i]
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j]
      if (b.box.left >= a.box.right - o.min) break
      const w = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left)
      const h = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top)
      if (w <= o.min || h <= o.min) continue
      if (related(a.el, b.el) || contains(a.box, b.box) || contains(b.box, a.box)) continue
      if (a.el.closest(o.layers) !== b.el.closest(o.layers) || onPurpose(a.el, b.el)) { floating++; continue }
      const [x, y] = describe(a.el) <= describe(b.el) ? [a, b] : [b, a]
      // the key leaves the text out: counts and dates change between runs, the baseline must not
      const key = describe(x.el) + ' × ' + describe(y.el)
      const prev = pairs.get(key)
      if (prev && prev.overlap.w * prev.overlap.h >= w * h) continue
      const pick = it => ({ selector: describe(it.el), kind: it.kind, text: it.text, box: { x: round(it.box.left), y: round(it.box.top), w: round(it.box.right - it.box.left), h: round(it.box.bottom - it.box.top) } })
      pairs.set(key, { key, a: pick(x), b: pick(y), overlap: { w: round(w), h: round(h) } })
    }
  }
  const all = [...pairs.values()].sort((p, q) => q.overlap.w * q.overlap.h - p.overlap.w * p.overlap.h)
  return { items: items.length, count: all.length, floating, pairs: all.slice(0, o.samples) }
}

export const overlapProbeSource = overlapProbe.toString()

// Scrolls the page's main scroller (the visible scroller with the most hidden content, or the document) to step `step` of
// 0.8 viewport each, from the top. -> { done } once the step is past the end (the scroller is left at its end). Runs INSIDE
// the page, self-contained. The drivers probe after each step and merge the pairs (same pair key, largest overlap).
export function overlapScroll (step) {
  const scrollers = [...document.querySelectorAll('body *')].filter(el => {
    const s = getComputedStyle(el)
    return /auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 40 && el.clientHeight > innerHeight * 0.4 && el.getBoundingClientRect().width > innerWidth * 0.4
  })
  const doc = document.scrollingElement
  const main = scrollers.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0]
  const target = main && (main.scrollHeight - main.clientHeight) > (doc.scrollHeight - doc.clientHeight) ? main : doc
  const stride = Math.round(target.clientHeight * 0.8)
  const max = target.scrollHeight - target.clientHeight
  const want = step * stride
  target.scrollTop = Math.min(want, max)
  return { done: want >= max, at: target.scrollTop, max }
}

export const overlapScrollSource = overlapScroll.toString()

// The «with changes» state: marks up to `max` editable fields of the open form (the last open dialog or wide panel, else the
// page content: never the shell's sidebar, its search or the palette) with data-overlap-dirty="<n>" and returns their new values.
// A form without text fields gets one select set to another option or one switch flipped (kind select / click). The driver
// does it with Playwright (fill, selectOption, click), so React sees a real input, and never presses Save: save bars, unsaved notices
// and validation messages appear, nothing is stored (and the live session only runs with --synthetic-writes). Picks the first,
// the middle and the last field, so a page with two forms (My products › Dashboard) shows both of its Save buttons.
// Runs INSIDE the page, self-contained. -> [{ n, selector, value }]
export function overlapDirty (max) {
  const limit = max || 3
  const shown = el => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && (el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true)
  }
  // the open panel: a dialog, or a wide <aside> of the page (the store editor is an aside, not a dialog); else the page content
  const main = document.querySelector('.od-shell-main') || document.querySelector('main') || document.body
  // (a Product sheet, .odc-sheet, is a panel too)
  const panels = [...document.querySelectorAll('[role=dialog], dialog[open], [role=alertdialog], [aria-modal="true"], .odc-sheet, aside')]
    .filter(el => shown(el) && (el.tagName !== 'ASIDE' || (main.contains(el) && el.getBoundingClientRect().width > innerWidth * 0.4)))
  const scope = panels.length ? panels[panels.length - 1] : main
  // review of AH: an aria-hidden control (the hidden mirror checkbox of a base-ui row select) is not a field of the form
  const skip = 'nav, [role=search], [role=navigation], [role=banner], [class*="palette"], [class*="Palette"], [aria-hidden="true"]'
  const fields = [...scope.querySelectorAll('input, textarea')].filter(el => {
    if (el.tagName === 'INPUT' && !/^(text|email|number|url|tel|)$/.test(el.type)) return false
    if (el.disabled || el.readOnly || !shown(el) || el.closest(skip) || el.getAttribute('role') === 'combobox') return false
    const hint = (el.getAttribute('placeholder') || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.name || '')
    return !/search|buscar|filter/i.test(hint)
  })
  // a form without text fields (a schedule, a list of switches): one select set to another option, else one switch flipped
  const free = el => !el.disabled && shown(el) && !el.closest(skip)
  // a Product switch hides its native checkbox (opacity 0) inside a visible frame: the frame counts
  const freeToggle = el => !el.disabled && !el.closest(skip) && (shown(el) || (el.parentElement && shown(el.parentElement)))
  const selects = fields.length ? [] : [...scope.querySelectorAll('select')].filter(el => free(el) && el.options.length > 1)
  const toggles = fields.length || selects.length ? [] : [...scope.querySelectorAll('[role=switch], input[type=checkbox]')].filter(freeToggle)
  const pool = fields.length ? fields : selects.length ? selects.slice(0, 1) : toggles.slice(0, 1)
  const picked = pool.length <= limit ? pool : [pool[0], pool[Math.floor(pool.length / 2)], pool[pool.length - 1]].slice(0, limit)
  return picked.map((el, n) => {
    el.setAttribute('data-overlap-dirty', String(n))
    const kind = el.tagName === 'SELECT' ? 'select' : (el.getAttribute('role') === 'switch' || el.type === 'checkbox') ? 'click' : 'fill'
    const value = kind === 'select'
      ? [...el.options].find(option => option.value !== el.value && !option.disabled)?.value ?? null
      : kind === 'click' ? null : el.type === 'number' ? String((Number(el.value) || 0) + 1) : (el.value || '') + ' x'
    const label = el.getAttribute('aria-label') || el.name || el.getAttribute('placeholder') || ''
    return { n, kind, selector: el.tagName.toLowerCase() + (label ? '[' + String(label).slice(0, 30) + ']' : ''), value }
  })
}

export const overlapDirtySource = overlapDirty.toString()
