import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { Input as InputPrimitive } from '@base-ui/react/input'

import { Search, X } from '../Icon'
import { Button, IconButton } from './Button'
import { Menu } from './Menu'
import { cx } from './classNames'
import { useOverflowEdges } from './useOverflowEdges'
import './product.css'
import './filter-bar.css'

// The bar is always ONE row (redesign F1b, D-06): search · as many pills as fit · «+N» · «more» · «clear» ·
// tools. A pill that does not fit leaves the row (it stays mounted, invisible, so its popover keeps working)
// and is listed in the «+N» menu. Opening an order narrows the list, and the bar must not change height.
// Taking a pill back needs HYSTERESIS px of room on top (a page scrollbar is about that wide), so the change
// in width that one pill brings can never flip the bar back and forth.
const HYSTERESIS = 24
// A pill is hidden a little before the row is full: browsers round the widths of the flex items they
// shrink, and a pill must never be left 1-2px short of its room.
const MARGIN = 4
// redesign cierre W0 (W0-QA4-02): how long the width of a bar with no filters must stay the same to be placed as on load (see `settle`)
const SETTLE_MS = 500

const px = value => Number.parseFloat(value) || 0
const widthOf = node => (node ? node.getBoundingClientRect().width : 0)
const PRESS_TARGET = 'button, [role="button"]'
// A statement in the tools (the sort order, redesign F6c-2, Q2-06) that is only text: it gives way to an icon
// before any pill is parked. `data-filterbar-collapsible` is the mark for new ones; `.odc-orders-sort` is the one
// the orders list draws today.
const COLLAPSIBLE = '[data-filterbar-collapsible], .odc-orders-sort'

// The nodes of the pills slot that are pills: a popover open next to a pill leaves its focus guards and an
// `aria-owns` marker there (fixed, 1px), which are neither pills nor part of the row.
const pillUnits = filters => Array.from(filters.children).filter(node => getComputedStyle(node).position !== 'fixed')

// The button of a pill unit: the unit itself (a bare `FilterPill`) or the one inside it (a pill wrapped in its
// popover's anchor span).
const pressTarget = unit => (unit.matches(PRESS_TARGET) ? unit : unit.querySelector(PRESS_TARGET))

// What «+N» shows for a pill that left the row: its name, its value and whether it is on.
const readPill = (unit, index) => {
  const target = pressTarget(unit)
  const label = unit.querySelector('.odc-pill-label')?.textContent ?? target?.textContent ?? unit.textContent ?? ''
  const value = unit.querySelector('.odc-pill-value')?.textContent ?? ''
  return {
    key: String(index),
    label: label.trim(),
    value: value.trim(),
    active: unit.matches('[data-active]') || Boolean(unit.querySelector('[data-active]'))
  }
}

// A pill's popover is open: the one the user is working in, which never leaves the row.
const isPinned = unit => unit.matches('[aria-expanded="true"]') || Boolean(unit.querySelector('[aria-expanded="true"]'))
const isActive = unit => unit.matches('[data-active]') || Boolean(unit.querySelector('[data-active]'))

// redesign tramo A r3 (W0-QA1-06): the pill whose popover is open keeps the width it had when the popover opened. A value
// makes a pill wider («Status» -> «Status · Completed by admin»), the search gave that width up and the pill, and the
// popover anchored to it, moved under the pointer of the person ticking (1440: 38px) or the pill was parked in «+N» (1024).
// The width is held on the pill button (`data-hold`, `--odc-pill-hold`, filter-bar.css) until the popover closes; the
// value is cut with its ellipsis while it is held, and the pill takes its natural width (and the row is measured again)
// when it closes.
const holdButton = unit => unit.matches('.odc-pill') ? unit : unit.querySelector('.odc-pill')
const holdWidth = (unit, width) => {
  const button = holdButton(unit)
  if (!button) return
  button.setAttribute('data-hold', '')
  button.style.setProperty('--odc-pill-hold', `${width}px`)
  // redesign tramo A r4 (W0-PA2-05, W0-QA2-06): a pill held WITHOUT a value has no room for the one it takes while it is open (the
  // label fills it): the value used to be left at 0px and the pill read «Status ·». Measured: holding the room of a minimum value on top
  // (+70px at 1440) squeezed the search and moved the pill, and the popover with it, 71px under the pointer; so the room is not given.
  // The separator and the value are taken out of the paint instead (`data-hold-bare`, filter-bar.css) and stay in the accessible name,
  // and they come back, whole, when the popover closes and the pill takes its width.
  if (button.querySelector('.odc-pill-value')) button.removeAttribute('data-hold-bare')
  else button.setAttribute('data-hold-bare', '')
}
const releaseWidth = unit => {
  const button = unit.isConnected ? holdButton(unit) : null
  button?.removeAttribute('data-hold')
  button?.removeAttribute('data-hold-bare')
  button?.style.removeProperty('--odc-pill-hold')
}

// redesign tramo A r4 (W0-QA2-07): the first pill (open, or with a value) is never parked by its own value. When the value makes it
// wider than the room that is left once «Clear filters» is in «+N», the value is cut with its ellipsis (`data-cut`, --odc-pill-cut,
// filter-bar.css) down to that room; it is let go while the bar measures and taken again after.
// redesign bugs H (W0-D-12): when not even that room is there, the value is cut all the way (`data-cut-bare`, filter-bar.css): the pill
// paints its label alone and the value stays in its accessible name. `bareGives` is what the pill gives up that way, measured.
const cutWidth = (unit, width, bare = false) => {
  const button = holdButton(unit)
  if (!button) return
  button.setAttribute('data-cut', '')
  if (bare) button.setAttribute('data-cut-bare', '')
  else button.removeAttribute('data-cut-bare')
  button.style.setProperty('--odc-pill-cut', `${width}px`)
}
const uncutWidth = unit => {
  const button = holdButton(unit)
  button?.removeAttribute('data-cut')
  button?.removeAttribute('data-cut-bare')
  button?.style.removeProperty('--odc-pill-cut')
}
const bareGives = unit => {
  const button = holdButton(unit)
  if (!button) return 0
  const whole = widthOf(button)
  button.setAttribute('data-cut-bare', '')
  const bare = widthOf(button)
  button.removeAttribute('data-cut-bare')
  return Math.max(0, whole - bare)
}

// The order in which the pills get a place in the row (redesign F6c-2, Q2-06): the one with a popover open, then
// the ones with a value, then the rest, each group in the bar's order. «+N» takes from the end of this list, so the
// pills the user is using are the last to go. The row itself always keeps the bar's order.
const priorityOrder = units => units
  .map((unit, index) => ({ index, rank: isPinned(unit) ? 0 : isActive(unit) ? 1 : 2 }))
  .sort((a, b) => a.rank - b.rank || a.index - b.index)
  .map(entry => entry.index)

// The rank of each pill, as one string (e2e stage close): when it is the same as at the last layout, only the width
// of the bar changed, and the row moves one way (see `fittingSet`).
const rankKey = units => units.map(unit => (isPinned(unit) ? 0 : isActive(unit) ? 1 : 2)).join('')

// The width of a row made of `widths` (the pills that are in it), the always-there parts (`others`), «+N» when
// `plusNeeded` and the tools. Natural widths only: none of them depends on the layout the bar is in.
const requiredWidth = ({ widths, plus, others, tools, gaps }, plusNeeded) => {
  const parts = [...others]
  if (widths.length > 0) parts.push(widths.reduce((sum, width) => sum + width, 0) + gaps.pills * (widths.length - 1))
  if (plusNeeded) parts.push(plus)
  return parts.reduce((sum, width) => sum + width, 0) +
    gaps.start * Math.max(0, parts.length - 1) +
    (tools > 0 ? tools + gaps.main : 0)
}

// Which of the pills are in the row (redesign F6e-1, Q4-01): best fit, not a prefix cut. `pills` are `{ index,
// width }` in priority order; each one takes a place if it fits with the ones already placed, and a pill that does
// not fit never stops a smaller one after it. `margin` replaces the usual MARGIN (the hysteresis to open the tools
// again). `previous` (the indexes that were in the row) gives hysteresis: a pill that was out needs HYSTERESIS px of
// room on top to come back, one that was in stays while it fits. `parked` are the pills kept out of the row on
// purpose (see `layoutOverflow`): «+N» is there whatever the count.
// `oneWay` (e2e stage close, the F1b guard «it does not flip back and forth»): only the width of the bar changed since
// `previous` (the same pills, the same values), so «+N» moves one way. Narrowing keeps the pills that were in, in
// priority order, while they fit, and brings none back: the room a wide pill leaves is not handed to the ones already
// in «+N». Growing keeps the pills that were in the row and adds the ones that were out where they fit, in priority
// order: no pill that is in the row leaves while the bar grows (redesign W0-4b, D-26: placing the row again in priority
// order swapped a pill for another with the same count, and it came in and out as the bar was widened a few px at a
// time).
const fittingSet = ({ pills, previous, oneWay = false, grew = true, margin = MARGIN, parked = 0, room, ...layout }) => {
  const total = pills.length
  const fill = (candidates, placed = []) => {
    candidates.forEach(pill => {
      const next = [...placed, pill]
      const extra = !previous || previous.has(pill.index) ? margin : HYSTERESIS
      if (requiredWidth({ ...layout, widths: next.map(entry => entry.width) }, next.length < total || parked > 0) + extra <= room) placed.push(pill)
    })
    return placed
  }
  const indexes = placed => new Set(placed.map(pill => pill.index))
  const fresh = () => indexes(fill(pills))
  if (!oneWay || !previous) return fresh()
  const wasIn = pills.filter(pill => previous.has(pill.index))
  const kept = fill(wasIn)
  if (!grew || kept.length < wasIn.length) return indexes(kept)
  // redesign W0-4b (D-26)
  return indexes(fill(pills.filter(pill => !previous.has(pill.index)), kept))
}

// The width of «+N» with the longest label it can have («+N · N active»), measured on a copy that is never seen
// (F6e-1): the real one grows when a parked pill takes a value, and that growth must never change how many pills
// fit. The copy has no `data-filterbar-overflow` mark, so nothing mistakes it for the trigger.
const measureLongest = (wrapper, plus, text) => {
  if (!text) return 0
  const probe = plus.cloneNode(true)
  const label = Array.from(probe.childNodes).find(node => node.nodeType === 3 && node.nodeValue.trim())
  if (!label) return 0
  label.nodeValue = text
  ;[probe, ...probe.querySelectorAll('[id]')].forEach(node => node.removeAttribute('id'))
  probe.removeAttribute('data-filterbar-overflow')
  probe.setAttribute('data-filterbar-probe', '')
  probe.setAttribute('data-active', '')
  probe.setAttribute('aria-hidden', 'true')
  probe.setAttribute('tabindex', '-1')
  wrapper.appendChild(probe)
  try {
    return widthOf(probe)
  } finally {
    probe.remove()
  }
}

// redesign F6f-1 (Q5-01, Q5-02): the first filter makes «Filters N» and «Clear filters» appear, and the row must
// not notice. Their widths are measured on copies that are never seen (the same idea as the longest «+N»): the
// longest count on a copy of «Filters», and «Clear filters» (written and as an icon) on a copy of that same button
// dressed as a ghost one, for the bar whose owner has not drawn it yet.
const hideProbe = (probe, source) => {
  ;[probe, ...probe.querySelectorAll('[id]')].forEach(node => node.removeAttribute('id'))
  probe.removeAttribute('name')
  probe.removeAttribute('aria-expanded')
  probe.removeAttribute('title')
  probe.setAttribute('data-filterbar-probe', '')
  probe.setAttribute('aria-hidden', 'true')
  probe.setAttribute('tabindex', '-1')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  source.parentElement.appendChild(probe)
}

const measureProbe = (probe, source) => {
  hideProbe(probe, source)
  try {
    return widthOf(probe)
  } finally {
    probe.remove()
  }
}

// «Filters» with its longest count: the copy of the button with the count written (in the node marked
// `data-filterbar-count`, or after the words when there is none yet).
const measureMoreLongest = (more, count) => {
  if (!more || !count) return 0
  const probe = more.cloneNode(true)
  const mark = probe.querySelector('[data-filterbar-count]')
  if (mark) mark.textContent = count
  else {
    probe.appendChild(document.createTextNode(' '))
    const span = document.createElement('span')
    span.className = 'odc-num'
    span.textContent = count
    probe.appendChild(span)
  }
  return measureProbe(probe, more)
}

// «Clear filters» that the owner has not drawn: a copy of the button of «Filters» with only its own words.
const measureClearProbe = (more, text) => {
  if (!more || !text) return 0
  const probe = more.cloneNode(false)
  probe.setAttribute('data-variant', 'ghost')
  probe.textContent = text
  return measureProbe(probe, more)
}

// redesign W0-4b (T0-14, decision 18): the levels of the minimal row (every pill in «+N»), when not even that fits the
// bar: 0 as drawn, 1 «Clear filters» leaves the row and is one more entry of «+N». The search never goes below its
// floor (200px): «Clear filters» gives way first. A level is taken back only with HYSTERESIS px of room on top.
const MAX_LEVEL = 1
const pickLevel = (fits, previous = 0) => {
  for (let level = 0; level < MAX_LEVEL; level++) {
    if (fits(level, level < previous ? HYSTERESIS : MARGIN)) return level
  }
  return MAX_LEVEL
}

/**
 * Measures the bar and marks the pills that do not fit with `data-overflowed` (straight on the nodes, so the
 * layout is right before the browser paints). While measuring, every pill is back in the row. A pill that
 * left the row is parked, invisible, on top of the «+N» button (CSS custom properties), so a popover anchored
 * to it opens under «+N». Returns the pills in «+N», or `null` when the bar has no width.
 *
 * `longestLabel(total)` is the longest text «+N» can show (F6e-1, Q4-01): its width is what the row reserves.
 * While a pill's popover is open the layout is frozen (F6e-1): the same pills stay in the row and in «+N», and
 * nothing is placed again until it closes, as long as that layout still fits the bar.
 *
 * redesign F6f-1 (Q5-01, Q5-02): the row reserves the room of «Filters» with its longest count and of «Clear
 * filters» (`reserve.more` is the count, `reserve.clear` the words) whether they are there or not, so the first
 * filter never changes what fits. The tools are part of the row: when not even every pill in «+N» leaves room for
 * the words of «Clear filters», it leaves the row and becomes one more entry of «+N» (redesign W0-4b, T0-14,
 * decision 18), before anything is laid over anything else and without the search ever going below its floor
 * (`previous.level` gives the hysteresis). While the layout is frozen the search keeps the width it had
 * (`previous.pinned`), as long as the row can take it.
 */
const layoutOverflow = (root, last = {}, longestLabel, reserve = {}) => {
  const filters = root.querySelector('.odc-filterbar-filters')
  const wrapper = root.querySelector('.odc-filterbar-overflow')
  const main = root.querySelector('.odc-filterbar-main')
  const start = root.querySelector('.odc-filterbar-start')
  // The trigger by its own mark: an open menu leaves its focus guards (1px, fixed) beside it in the wrapper.
  const plus = wrapper?.querySelector('[data-filterbar-overflow]')
  if (!filters || !wrapper || !main || !start || !plus) return { count: 0, items: [], shown: 0 }
  // A bar nobody can see (an ancestor with `display: none`, e.g. the list behind the full-screen order of a phone)
  // has no width to measure: keep the layout it had.
  if (!main.clientWidth) return null
  const units = pillUnits(filters)
  const ranks = rankKey(units)
  // redesign tramo A r5 (W0-QA3-05): when the last filter goes (the ranks change into «nobody has a value, nobody is open») the bar is
  // placed as it was the last time nobody had a value (`last.rest`: its row, level and tools), as if the filter had never been
  // applied: the hysteresis of the layout it had WITH filters made «Clear filters» leave the bar at 1100px with the search 67px wider
  // and one pill less in the row. With no rest (the bar never was like that) it is placed as on load. The hold of an open popover is kept.
  const settled = last.ranks !== undefined && last.ranks !== ranks && !/[01]/.test(ranks)
  const previous = settled ? { ...(last.rest?.ranks === ranks ? last.rest : {}), hold: last.hold } : last
  const phone = getComputedStyle(wrapper).display === 'none'
  const toolsNode = root.querySelector('.odc-filterbar-tools')
  const collapsibles = toolsNode ? Array.from(toolsNode.querySelectorAll(COLLAPSIBLE)) : []
  const searchNode = root.querySelector('.odc-filterbar-search > *')
  const moreNode = root.querySelector('.odc-filterbar-more > *')
  const clearNode = root.querySelector('.odc-filterbar-clear > *')
  const holder = root.querySelector('.odc-filterbar-clear-reserve')
  const spare = root.querySelector('.odc-filterbar-plus-reserve')
  // redesign F6d-1 (Q3-02): a pill that was parked when its popover opened stays parked while it is open, even if
  // it has a value by now and would earn a place in the row: its popover is anchored to it, and moving the pill
  // 500px away would take the popover with it. It takes its place when the popover closes (the bar measures again).
  const locked = new Set(phone ? [] : units.map((unit, index) => index).filter(index => isPinned(units[index]) && units[index].hasAttribute('data-overflowed')))
  const order = priorityOrder(units).filter(index => !locked.has(index))
  // redesign tramo A r3 (W0-QA1-06): the width the pill with the open popover had when it opened (see `holdWidth`). A parked
  // pill is not in the row, so it has nothing to hold.
  const holdUnit = phone ? undefined : units.find(unit => isPinned(unit) && !unit.hasAttribute('data-overflowed'))
  let hold = previous.hold
  if (hold && hold.unit !== holdUnit) {
    releaseWidth(hold.unit)
    hold = undefined
  }
  const holdIndex = holdUnit ? units.indexOf(holdUnit) : -1
  const holdValue = holdUnit ? holdButton(holdUnit)?.querySelector('.odc-pill-value') : null
  // What the last layout left in the row (the marks it put on the nodes), once there was one.
  const before = previous.visible
    ? new Set(previous.visible)
    : previous.shown === undefined
      ? undefined
      : new Set(units.map((unit, index) => index).filter(index => !units[index].hasAttribute('data-overflowed')))
  const frozen = Boolean(before) && !phone && units.some(isPinned)
  const oneWay = Boolean(before) && previous.ranks === ranks
  let visible = new Set(order)
  let collapsed = false
  let level = 0
  let pinned
  let leadOnly = false
  let cut // { index, width, bare? }: the pill whose value is cut to the room there is (`bare`: down to its label alone)
  let held = { clear: 0, more: 0, plus: 0 }
  let room
  // The width the search has now, before the measure puts every pill back in the row (and squeezes it).
  const searchNow = searchNode ? widthOf(searchNode) : 0
  // read before anything is changed: a control that turns invisible loses the focus
  const clearHadFocus = Boolean(clearNode) && document.activeElement === clearNode
  root.setAttribute('data-measuring', '')
  units.forEach(uncutWidth)
  try {
    if (!phone && order.length > 0) {
      const mainStyle = getComputedStyle(main)
      // The search is measured free: a width it was pinned to is let go for the measure (and taken again below).
      if (searchNode) searchNode.removeAttribute('data-pinned')
      // Its floor, the bar's own: redesign W0-4b (T0-14, decision 18) the search never goes below it.
      const searchMin = searchNode ? px(getComputedStyle(searchNode).getPropertyValue('--od-x-search-min')) : 0
      // Natural widths of the tools with their statement written out and as an icon.
      root.removeAttribute('data-tools-collapsed')
      const written = widthOf(toolsNode)
      let iconOnly = written
      if (collapsibles.length > 0) {
        root.setAttribute('data-tools-collapsed', '')
        iconOnly = widthOf(toolsNode)
        root.removeAttribute('data-tools-collapsed')
      }
      const widths = units.map(widthOf)
      if (holdUnit && !hold) {
        hold = { unit: holdUnit, width: widths[units.indexOf(holdUnit)] }
        holdWidth(holdUnit, hold.width)
      }
      // «Filters» with its longest count and «Clear filters» (F6f-1): the ones that are there are measured, the one the
      // owner has not drawn yet on a copy. While the bar measures every part is back in the row (CSS).
      const moreNow = widthOf(moreNode)
      const moreLongest = Math.max(moreNow, measureMoreLongest(moreNode, reserve.more))
      const clearWidth = clearNode ? widthOf(clearNode) : measureClearProbe(moreNode, reserve.clear)
      // redesign W0-4b (T0-14, decision 18): at level 1 «Clear filters» is not in the row: it is an entry of «+N», which
      // is then always counted in the row, so the first filter (or the clear going away) never changes what fits.
      const othersAt = (at, searchWidth = searchMin) => [
        searchWidth,
        moreLongest,
        at >= 1 ? 0 : clearWidth
      ].filter(width => width > 0)
      const plusAt = at => at >= 1 && clearWidth > 0
      const layout = {
        // «+N» may hold «Clear filters» too: one more entry for the longest label
        plus: Math.max(widthOf(plus), measureLongest(wrapper, plus, longestLabel?.(units.length + 1))),
        // The search's floor comes from its token, not from its computed min-width.
        others: othersAt(0),
        gaps: {
          pills: px(getComputedStyle(filters).columnGap),
          start: px(getComputedStyle(start).columnGap),
          main: px(mainStyle.columnGap)
        },
        room: main.clientWidth - px(mainStyle.paddingLeft) - px(mainStyle.paddingRight)
      }
      room = layout.room
      // Not even every pill in «+N» may leave room for the words of «Clear filters» (F6f-1, Q5-01): it goes to «+N», and
      // the search never goes below its floor (W0-4b, decision 18). Only the minimal row decides, so the first filter (or
      // a pill taking a value) never does. The pills keep budgeting the words even then (`layout.others` is level 0):
      // when the minimal row does not fit no pill does, and the bar never gives a pill the room of the words just to take
      // it back a few px later, so widening never moves a pill out of the row (D-26).
      const minimal = at => requiredWidth({ ...layout, others: othersAt(at), tools: iconOnly, widths: [] }, true)
      level = clearWidth > 0
        ? pickLevel((at, extra) => minimal(at) + extra <= layout.room, previous.level)
        : 0
      // redesign tramo A r4 (W0-QA2-07): the pill that goes first, when it is the open one or has a value, is never parked by its own
      // value. A value makes it wider, and when it does not fit the row beside the words of «Clear filters» (1024-1279 without the panel:
      // «Status · Completed by admin» is 240px) it used to go to «+N» itself. Now «Clear filters» leaves the row for «+N» (level 1) and the
      // row holds that pill alone; if it still does not fit, its value is cut with the ellipsis (down to 5em) to the room there is. The
      // other pills keep waiting for the room of the words (D-26): none of them is in the row at that level, so none leaves when the
      // bar widens and the level goes back to 0.
      const lead = order[0]
      const leadValue = lead !== undefined && clearWidth > 0 && rankKey([units[lead]]) !== '2'
        ? holdButton(units[lead])?.querySelector('.odc-pill-value')
        : null
      const leadGives = leadValue ? Math.max(0, widthOf(leadValue) - 5 * px(getComputedStyle(leadValue).fontSize)) : 0
      const leadRow = (at, gives = 0) => requiredWidth({
        ...layout, others: othersAt(at), tools: iconOnly, widths: [widths[lead] - gives]
      }, order.length > 1 || locked.size > 0 || plusAt(at))
      // redesign tramo A r5 (W0-PA3-01): the level the first pill asks for is decided with its own thresholds (hysteresis included)
      // whether or not it fits the row alone: «Clear filters» is not taken back while that pill, with its value, does not fit beside
      // it. The threshold used to be the minimal row's (the row with no pill) while the pill came in by another gate (it fits the row
      // with «Clear filters» parked): widening, «Clear filters» came back, left again when the pill came in, and came back once more.
      // Now it is one threshold: parked while the pill does not fit beside it, back when it does, and it goes nowhere in between.
      let leadLevel = 0
      let leadFits = false
      if (leadValue) {
        leadLevel = pickLevel((at, extra) => leadRow(at) + extra <= layout.room, previous.level)
        leadFits = leadRow(1, leadGives) + MARGIN <= layout.room
        if (leadLevel >= 1 && leadFits && leadRow(1) + MARGIN > layout.room) cut = { index: lead, width: layout.room - MARGIN - leadRow(1) + widths[lead] }
        // redesign bugs H (W0-D-12): in the band where «Clear filters» is in «+N» and not even the pill with its value cut to 5em fits, the
        // row used to be empty with the search at its largest. The pill is cut one step more, to its bare label (the value stays in its
        // name). It decides nothing else: the level of «Clear filters» was taken above (W0-PA3-01), and a pill that is in the row stays
        // while the bar widens, as each step (bare, 5em, whole) is wider than the one before (D-26).
        if (leadLevel >= 1 && !leadFits) {
          const gives = bareGives(units[lead])
          if (gives > leadGives && leadRow(1, gives) + MARGIN <= layout.room) {
            leadFits = true
            cut = { index: lead, width: widths[lead] - gives, bare: true }
          }
        }
      }
      level = Math.max(level, leadLevel)
      leadOnly = leadLevel >= 1 && leadFits
      held = {
        clear: level >= 1 ? 0 : clearWidth,
        more: Math.max(0, moreLongest - moreNow),
        // what «+N» gains when a parked pill takes a value (its longest label), held after the row's buttons
        plus: Math.max(0, layout.plus - widthOf(plus))
      }
      const measure = (tools, extra) => fittingSet({
        ...layout,
        tools,
        pills: (leadOnly ? order.slice(0, 1) : order).map(index => ({ index, width: widths[index] })),
        parked: locked.size + (leadOnly ? order.length - 1 : 0),
        ...(leadOnly ? { others: othersAt(1) } : {}),
        previous: before,
        oneWay,
        grew: previous.room === undefined || room > previous.room,
        ...extra
      })
      // A popover is open: the layout stays, unless it no longer fits the bar (the pill that is open took a value
      // and grew past the room there was): then it is placed again, with the open pill first.
      // redesign tramo A r5 (W0-QA3-01): the layout that is kept is counted as it was drawn: the pill whose value was cut at its cut
      // width, and «Clear filters» where it was (parked or not). The row it had when the popover opened fitted the bar; counting the
      // whole pill and the words of «Clear filters» again made it not fit, the pill left the row, and the popover jumped with it.
      // (and it is the level the layout had, not the one measured now: nothing moves while the popover is open)
      const keptLevel = previous.level ?? 0
      const keptWidth = index => previous.cut && previous.cut.index === index ? Math.min(widths[index], previous.cut.width) : widths[index]
      const keptRow = (searchWidth, at = keptLevel) => requiredWidth({
        ...layout,
        others: othersAt(at, searchWidth),
        tools: previous.collapsed ? iconOnly : written,
        widths: [...before].map(keptWidth)
      }, before.size < units.length || plusAt(at))
      const stays = frozen && keptRow(searchMin) <= layout.room
      if (stays) {
        level = keptLevel
        visible = before
        // the value that was cut stays cut (the row was not placed again)
        if (previous.cut && before.has(previous.cut.index)) cut = previous.cut
        collapsed = Boolean(previous.collapsed)
        // Nothing moves while the popover is open: the search keeps the width it had (F6f-1, Q5-02), as long as the
        // row, with the pills that are in it, can take it. When the pill that is open grew, «Clear filters», at the
        // right of it, goes to «+N» before the search gives way (W0-4b); else the search gives way, as the row's flex does.
        const width = previous.pinned ?? searchNow
        if (width > 0) {
          if (keptRow(width) <= layout.room) pinned = width
          else if (level < 1 && clearWidth > 0 && keptRow(width, 1) <= layout.room) {
            pinned = width
            level = 1
          }
        }
      } else if (holdIndex >= 0 && before) {
        // redesign tramo A r5 (W0-QA3-01): the layout no longer fits (the window got narrower, or the open pill grew) and a popover is
        // open: the pill it belongs to stays in the row, at the place it has, whatever happens to the rest. The pills that were after it
        // in the row give way first (the last in the priority order first), then «Clear filters» goes to «+N» and the tools to an icon,
        // and the value of the pill is cut (down to 5em) to the room there is. The row is placed again when the popover closes.
        const keep = new Set([...before, holdIndex])
        const gives = holdValue ? Math.max(0, widthOf(holdValue) - 5 * px(getComputedStyle(holdValue).fontSize)) : 0
        const rowOf = (set, at, hw) => requiredWidth({
          ...layout, others: othersAt(at), tools: iconOnly, widths: [...set].sort((a, b) => a - b).map(index => index === holdIndex ? hw : widths[index])
        }, set.size < units.length || plusAt(at))
        const at = previous.level >= 1 || clearWidth <= 0 ? 1 : (rowOf(keep, 0, widths[holdIndex] - gives) + MARGIN <= layout.room ? 0 : 1)
        level = Math.max(level, at)
        const byPriority = priorityOrder(units).filter(index => keep.has(index) && index !== holdIndex).reverse()
        while (byPriority.length > 0 && rowOf(keep, at, widths[holdIndex] - gives) + MARGIN > layout.room) keep.delete(byPriority.shift())
        visible = keep
        if (rowOf(keep, at, widths[holdIndex]) + MARGIN > layout.room) {
          cut = { index: holdIndex, width: Math.max(widths[holdIndex] - gives, layout.room - MARGIN - rowOf(keep, at, widths[holdIndex]) + widths[holdIndex]) }
        }
        if (collapsibles.length > 0) collapsed = true
      } else if (cut || leadOnly) {
        // the first pill, with its value cut or whole, is the only one in the row, and the statement of the tools is an icon when it
        // does not fit written (the room was counted so). redesign tramo A r5 (W0-PA3-02): it is placed here, not handed to
        // `fittingSet`, which asks a pill that was not in the row for HYSTERESIS px on top: in the 20px between the two gates the
        // row was empty and «Clear filters» was parked with the search at its largest.
        visible = new Set([lead])
        if (collapsibles.length > 0) {
          const writtenRow = requiredWidth({ ...layout, others: othersAt(1), tools: written, widths: [widths[lead]] }, order.length > 1 || locked.size > 0 || plusAt(1))
          collapsed = Boolean(cut) || writtenRow + (previous.collapsed ? HYSTERESIS : MARGIN) > layout.room
        }
      } else {
        visible = measure(written)
        // Before a pill is parked the statement gives way (once collapsed it opens again only with room to spare).
        if (collapsibles.length > 0) {
          const fitsWritten = previous.collapsed
            ? measure(written, { margin: HYSTERESIS, previous: undefined }).size === (leadOnly ? 1 : order.length)
            : visible.size === (leadOnly ? 1 : order.length)
          if (!fitsWritten) {
            collapsed = true
            visible = measure(iconOnly)
          }
        }
      }
      // the room held for «Clear filters» follows the level the layout ended with (a kept or held row may have parked it)
      held.clear = level >= 1 ? 0 : clearWidth
    }
  } finally {
    root.removeAttribute('data-measuring')
  }
  if (collapsed) root.setAttribute('data-tools-collapsed', '')
  else root.removeAttribute('data-tools-collapsed')
  // redesign W0-4b (T0-14, decision 18): «Clear filters» leaves the row for «+N» when the minimal row needs it. It stays mounted
  // (parked, invisible, like a pill) and the entry of «+N» presses it.
  const clearParked = level >= 1 && Boolean(clearNode)
  if (level >= 1) root.setAttribute('data-clear-parked', '')
  else root.removeAttribute('data-clear-parked')
  // The room held for what is not there yet: «Clear filters» (the box that stands for it) and the count of «Filters».
  holder?.style.setProperty('--odc-clear-reserve', `${held.clear}px`)
  if (moreNode) {
    if (held.more > 0) moreNode.style.setProperty('--odc-more-reserve', `${held.more}px`)
    else moreNode.style.removeProperty('--odc-more-reserve')
  }
  if (searchNode) {
    if (pinned) {
      searchNode.setAttribute('data-pinned', '')
      searchNode.style.setProperty('--odc-search-pin', `${pinned}px`)
    } else {
      searchNode.removeAttribute('data-pinned')
      searchNode.style.removeProperty('--odc-search-pin')
    }
  }
  // The icon needs its words as a tooltip; the ones the bar adds it takes back.
  collapsibles.map(node => [node, collapsed]).forEach(([node, asIcon]) => {
    if (asIcon && !node.hasAttribute('title')) {
      node.setAttribute('title', node.textContent.trim())
      node.setAttribute('data-filterbar-title', '')
    } else if (!asIcon && node.hasAttribute('data-filterbar-title')) {
      node.removeAttribute('title')
      node.removeAttribute('data-filterbar-title')
    }
  })
  const hidden = units.filter((_, index) => !visible.has(index))
  spare?.style.setProperty('--odc-plus-reserve', `${hidden.length > 0 || clearParked ? held.plus : 0}px`)
  units.forEach((unit, index) => {
    if (visible.has(index)) {
      unit.removeAttribute('data-overflowed')
      unit.style.removeProperty('--odc-overflow-x')
      unit.style.removeProperty('--odc-overflow-y')
    } else {
      unit.setAttribute('data-overflowed', '')
    }
  })
  if (cut && visible.has(cut.index)) cutWidth(units[cut.index], cut.width, cut.bare)
  else cut = undefined
  const entries = hidden.length + (clearParked ? 1 : 0)
  if (entries > 0) wrapper.removeAttribute('data-empty')
  else wrapper.setAttribute('data-empty', '')
  // Where «+N» is now, also while the layout is kept (redesign W0-4b, D-27): the parked pill with the popover open follows
  // «+N» when the bar changes width, and its popover with it (it is anchored to the pill). Which pills are in the row
  // does not change.
  if (hidden.length > 0) {
    const anchor = plus.getBoundingClientRect()
    const origin = start.getBoundingClientRect()
    const rtl = getComputedStyle(start).direction === 'rtl'
    hidden.forEach(unit => {
      unit.style.setProperty('--odc-overflow-x', `${rtl ? origin.right - anchor.right : anchor.left - origin.left}px`)
      unit.style.setProperty('--odc-overflow-y', `${anchor.top - origin.top}px`)
    })
  }
  // «Clear filters» is the last entry of «+N» (redesign W0-4b): its words are the ones of its button.
  const clearEntry = clearParked ? clearNode.textContent.trim() : ''
  // focus on a control that is no longer in the row goes to «+N», not to the page
  if (clearParked && clearHadFocus) plus.focus()
  return { count: entries, items: hidden.map(unit => readPill(unit, units.indexOf(unit))), clear: clearEntry, shown: visible.size, visible: [...visible], collapsed, level, pinned, ranks, room, hold, cut }
}

const sameOverflow = (a, b) => a.count === b.count &&
  (a.clear ?? '') === (b.clear ?? '') &&
  a.items.length === b.items.length &&
  a.items.every((item, index) => ['key', 'label', 'value', 'active'].every(field => item[field] === b.items[index][field]))

/**
 * Keeps `data-overflowed` on the pills that do not fit the one row and returns what «+N» lists, with a
 * `refresh` for when the menu opens (a pill's value may have changed while it was out of the row). It measures
 * on mount, on every render of the owner and whenever the bar or one of the slots' children changes size.
 */
const useOverflowMenu = (ref, enabled, longestLabel, reserve) => {
  const [overflow, setOverflow] = useState({ count: 0, items: [], clear: '' })
  const watch = useRef({ node: null, observer: null, mutations: null, settling: undefined, settledRoom: undefined, visible: undefined, shown: undefined, collapsed: false, level: 0, pinned: undefined, ranks: undefined, room: undefined, hold: undefined, cut: undefined, rest: undefined, longest: longestLabel, reserve, last: overflow })

  // redesign cierre W0 (W0-QA4-02): what a layout leaves in the watch (and in the state), whoever made it.
  const apply = useCallback(next => {
    const current = watch.current
    current.shown = next.shown
    current.visible = next.visible
    current.ranks = next.ranks
    current.room = next.room
    current.hold = next.hold
    current.cut = next.cut
    // redesign tramo A r5 (W0-QA3-05): what the bar looked like the last time nobody had a value or an open popover
    if (next.ranks && !/[01]/.test(next.ranks)) current.rest = { shown: next.shown, visible: next.visible, collapsed: next.collapsed, level: next.level ?? 0, ranks: next.ranks, room: next.room }
    current.collapsed = next.collapsed
    current.level = next.level ?? 0
    current.pinned = next.pinned
    // Compared with what was last handed to the state, not with the state itself: a measure that finds the
    // same pills must never schedule another render.
    if (sameOverflow(current.last, next)) return
    current.last = { count: next.count, items: next.items, clear: next.clear }
    setOverflow(current.last)
  }, [])

  const lastOf = current => ({ shown: current.shown, collapsed: current.collapsed, level: current.level, pinned: current.pinned, ranks: current.ranks, room: current.room, hold: current.hold, cut: current.cut, rest: current.rest })

  // redesign cierre W0 (W0-QA4-02): narrowing and widening back to the same width leaves a pill in «+N» that the load put in the row (a
  // pill that was out asks HYSTERESIS px on top, and the width is the same one). When nobody has a value, no popover is open and the
  // width has not changed for SETTLE_MS, the bar is placed as on load, but ONLY if that keeps every pill that is in the row (D-26: nothing
  // leaves while the bar grows), «Clear filters» where it was and the tools as written when they were. Else it stays as it is.
  const settle = useCallback(() => {
    const current = watch.current
    const node = current.node
    if (!node || !node.isConnected || !current.ranks || /[01]/.test(current.ranks) || current.hold || !current.visible) return
    current.settledRoom = current.room
    const kept = { ...lastOf(current), visible: current.visible }
    const fresh = layoutOverflow(node, {}, current.longest, current.reserve)
    if (!fresh) return
    const keepsAll = kept.visible.every(index => fresh.visible.includes(index)) &&
      (fresh.level ?? 0) <= (kept.level ?? 0) && (!fresh.collapsed || kept.collapsed) && fresh.room === kept.room
    if (keepsAll) apply(fresh)
    else layoutOverflow(node, kept, current.longest, current.reserve)
  }, [apply])

  const run = useCallback(node => {
    const current = watch.current
    const next = layoutOverflow(node, lastOf(current), current.longest, current.reserve)
    if (!next) return
    apply(next)
    clearTimeout(current.settling)
    current.settling = undefined
    // the width moved off the one that was settled: the next time it stays still is a new one
    if (current.settledRoom !== undefined && next.room !== current.settledRoom) current.settledRoom = undefined
    if (next.ranks && !/[01]/.test(next.ranks) && !next.hold && next.room !== current.settledRoom && (next.count > 0 || next.collapsed)) {
      current.settling = setTimeout(settle, SETTLE_MS)
    }
  }, [apply, settle])

  useLayoutEffect(() => {
    const current = watch.current
    current.longest = longestLabel
    current.reserve = reserve
    const node = enabled ? ref.current : null
    if (current.node !== node) {
      current.observer?.disconnect()
      current.node = node
      current.observer = null
      current.shown = undefined
      current.collapsed = false
      current.level = 0
      current.pinned = undefined
      current.ranks = undefined
      current.room = undefined
      if (current.hold) releaseWidth(current.hold.unit)
      current.hold = undefined
      current.cut = undefined
      current.rest = undefined
      clearTimeout(current.settling)
      current.settling = undefined
      current.settledRoom = undefined
      current.visible = undefined
      if (node && typeof ResizeObserver !== 'undefined') {
        current.observer = new ResizeObserver(() => run(node))
        current.observer.observe(node)
      }
    }
    if (!node) return
    run(node)
    // A popover opening or closing, or a pill taking a value, changes who goes first without a render of the bar's
    // owner or a change of size: measure again (F6d-1, Q3-02).
    const filtersNode = node.querySelector('.odc-filterbar-filters')
    if (filtersNode && typeof MutationObserver !== 'undefined' && current.mutations?.node !== filtersNode) {
      current.mutations?.observer.disconnect()
      const observer = new MutationObserver(() => run(node))
      observer.observe(filtersNode, { subtree: true, attributes: true, attributeFilter: ['aria-expanded', 'data-active'] })
      current.mutations = { node: filtersNode, observer }
    }
    node.querySelectorAll('.odc-filterbar-filters > *, .odc-filterbar-tools > *, .odc-filterbar-more > *, .odc-filterbar-clear > *, .odc-filterbar-overflow > *')
      .forEach(child => current.observer?.observe(child))
  })

  useLayoutEffect(() => {
    const current = watch.current
    return () => {
      current.observer?.disconnect()
      current.observer = null
      current.mutations?.observer.disconnect()
      current.mutations = null
      clearTimeout(current.settling)
      current.settling = undefined
      current.node = null
    }
  }, [])

  const refresh = useCallback(() => {
    if (watch.current.node) run(watch.current.node)
  }, [run])

  return { overflow, refresh }
}

/**
 * The element that should get the focus back for a pill's button: the button itself, or the «+N» button
 * while the pill is parked out of the row (an invisible node cannot take the focus). Popovers anchored to a
 * pill use it as their final focus.
 */
export const resolveOpener = node => {
  const button = node?.matches?.('button') ? node : node?.querySelector?.('button') ?? node
  if (!button?.closest?.('[data-overflowed]')) return button
  return button.closest('.odc-filterbar')?.querySelector('[data-filterbar-overflow]') ?? button
}

/**
 * Filter bar (C7): search + quick filter pills + «Filters (n)» on one row, the
 * tools (sort, density, columns) at the end and never split, then one chip per
 * active value, then the inline real-time notice. Every slot is a node: the
 * bar only places them, so it has no text of its own. `label` names the group
 * and is required.
 *
 * The bar never changes height (redesign F1b, D-06). From a phone's width up it is one row:
 * search (it gives up width down to `--od-x-search-min`) · the pills that fit · «+N» · «more» ·
 * «clear» · tools. With `overflowLabel` (a function: `count => 'N more filters'`, the accessible name of
 * the button, whose text is `+N`) the pills that do not fit are marked `data-overflowed`, parked invisible
 * on top of «+N» (they stay mounted, so each keeps its own popover) and listed in the «+N» menu with their
 * value; choosing one opens its popover from there. `overflowActiveLabel` (`count => '1 active'`) is added to «+N»'s
 * text and name when it holds pills with a value. A pill parked when its popover opens stays parked until it closes.
 * The pills are measured at their natural width with a ResizeObserver and hysteresis. They take their place best-fit
 * (F6e-1): the ones with a value (and the one that is open) first, then the rest in the bar's order, and a pill that
 * does not fit never stops a smaller one after it; the row keeps the bar's order. «+N» is budgeted at the width of its
 * longest label, and while any pill's popover is open the layout is frozen (nothing is parked or released, nothing is
 * moved, but the parked pill that is open follows «+N» when the bar changes width, W0-4b D-27) until it closes, unless
 * the pill that is open grew past the room of the bar. «Clear filters» (`clear`) goes to «+N» as one more entry when
 * the row has no room for its words, so the search never goes below its floor (redesign W0-4b, T0-14, decision 18).
 * Without `overflowLabel` the pills slot
 * scrolls sideways instead. Only a phone (a container under 600px on a viewport under 768px) keeps the
 * pills on a row of their own that scrolls, with the edge fade (`data-overflow-start` / `data-overflow-end`
 * on the pills slot, logical, so RTL fades the other side).
 *
 * `flush` removes the bar's own inline padding (main row, chips and notice) for
 * screens that already give the content their page margin. Without it the bar
 * keeps the page gutter.
 */
export const FilterBar = ({
  label,
  search,
  filters,
  more,
  clear,
  tools,
  chips,
  notice,
  overflowLabel,
  overflowActiveLabel,
  moreReserve,
  clearReserve,
  flush = false,
  className,
  ...props
}) => {
  const rootRef = useRef(null)
  const filtersRef = useRef(null)
  const moreRef = useRef(null)
  const hadChips = useRef(Boolean(chips))
  const overflowEnabled = Boolean(filters && overflowLabel)
  useOverflowEdges(filtersRef)
  // redesign F6e-1 (Q4-01): «+N» reserves the width of its longest label, so a parked pill taking a value (the text
  // grows by «· N active») never changes how many pills fit.
  const longestLabel = overflowActiveLabel ? total => `+${total} · ${overflowActiveLabel(total)}` : undefined
  // redesign F6f-1 (Q5-01, Q5-02): the row reserves «Filters» with its longest count (`moreReserve`, the count written
  // out: «99») and «Clear filters» (`clearReserve`, its words) whether they are there or not, so the first filter
  // never changes what fits, and the tools are part of that row.
  const reserve = overflowEnabled ? { more: moreReserve, clear: clearReserve } : undefined
  const { overflow, refresh } = useOverflowMenu(rootRef, overflowEnabled, longestLabel, reserve)
  // redesign tramo A r4 (W0-PA2-03, WCAG 2.5.3 Label in Name): the visible «+N» and its accessible name count the same thing and
  // the name CONTAINS the visible text. Both count the FILTERS hidden in «+N» (overflow.items); the «Clear filters» entry parked
  // beside them never changes the number (round 2 showed «+7» and read «+6 more filters»). When the only thing parked is «Clear
  // filters» (no hidden filter), the visible text is «+1» (one entry), and the name is «+1: Clear filters»: it starts with the
  // visible text and says what the button holds, so it is not announced as a filter and not as a button that clears on press.
  // The width reserved for «+N» is the one of its longest label (`longestLabel`) and a count never exceeds it: it does not move.
  const hiddenFilters = overflow.items.length
  const overflowText = hiddenFilters > 0 ? `+${hiddenFilters}` : `+${overflow.count}`
  // The owner's `overflowLabel(n)` is the name (it carries the number: `+N more filters`, as the pilot and the gallery write it).
  const overflowName = overflowEnabled
    ? (hiddenFilters > 0 ? overflowLabel(hiddenFilters) : (overflow.clear ? `${overflowText}: ${overflow.clear}` : overflowLabel(overflow.count)))
    : undefined
  // redesign F6d-1 (Q3-02): «+4 · 1 active» when «+N» holds a pill with a value, in the text and in the accessible name.
  const activeParked = overflow.items.filter(item => item.active).length
  const activeText = activeParked > 0 && overflowActiveLabel ? overflowActiveLabel(activeParked) : ''
  // the visible text, whole and first (WCAG 2.5.3 wants the visible words inside the name, in order: «+6 · 1 active»), then what it holds
  const visibleText = activeText ? `${overflowText} · ${activeText}` : overflowText
  const accessibleName = activeText ? `${visibleText}: ${overflowName}` : overflowName

  // Choosing a pill in «+N»: its own button opens its own popover (a tick later, once the menu has let go
  // of the focus).
  const openPill = key => {
    const unit = (filtersRef.current ? pillUnits(filtersRef.current) : [])[Number(key)]
    const button = unit && pressTarget(unit)
    window.setTimeout(() => button?.click(), 0)
  }
  // redesign W0-4b (T0-14, decision 18): «Clear filters», parked out of the row, is one more entry of «+N» with its own
  // action: it presses the owner's button.
  const pressClear = () => {
    const button = rootRef.current?.querySelector('.odc-filterbar-clear > *')
    window.setTimeout(() => button?.click(), 0)
  }
  const menuItems = overflow.items.map(item => ({
    key: item.key,
    label: item.label,
    description: item.value || undefined,
    onSelect: () => openPill(item.key)
  }))
  if (overflow.clear) menuItems.push({ key: 'clear', label: overflow.clear, separatorBefore: menuItems.length > 0, onSelect: pressClear })

  // redesign W0-4b (D-25): a pill that takes the focus in a row that scrolls (a phone) comes fully into view, clear of
  // the fade (`scroll-padding-inline`): a pill that grew while its popover was open (a value) had its end under it when
  // the focus came back.
  const revealFocused = event => {
    const slot = event.currentTarget
    if (!slot.contains(event.target) || !event.target.matches?.(PRESS_TARGET)) return
    if (!['auto', 'scroll'].includes(getComputedStyle(slot).overflowX)) return
    event.target.scrollIntoView?.({ inline: 'nearest', block: 'nearest' })
  }

  // When the last chip goes the whole list unmounts with the button that was focused, and the
  // browser drops the focus on BODY. If that is where it is, give it to «more» (else the search).
  useLayoutEffect(() => {
    const had = hadChips.current
    hadChips.current = Boolean(chips)
    if (!had || chips) return
    const active = document.activeElement
    if (active && active !== document.body) return
    const target = moreRef.current?.querySelector('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') ??
      rootRef.current?.querySelector('input:not(:disabled)')
    target?.focus()
  })

  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (label == null) throw new Error('FilterBar needs a label')
  return (
    <div
      ref={rootRef}
      role='group'
      aria-label={label}
      className={cx('odc-root', 'odc-filterbar', className)}
      data-flush={flush ? '' : undefined}
      data-overflow-menu={overflowEnabled ? '' : undefined}
      data-tools={tools ? '' : undefined}
      data-clear={clear ? '' : undefined}
      {...props}
    >
      <div className='odc-filterbar-main'>
        <div className='odc-filterbar-start'>
          {search && <div className='odc-filterbar-search'>{search}</div>}
          {filters && <div ref={filtersRef} className='odc-filterbar-filters odc-fade-x' onFocus={revealFocused}>{filters}</div>}
          {overflowEnabled && (
            <div className='odc-filterbar-overflow' data-empty={overflow.count === 0 ? '' : undefined}>
              <Menu
                label={visibleText}
                align='start'
                className='odc-filterbar-overflow-btn'
                triggerProps={{
                  'aria-label': accessibleName,
                  'data-filterbar-overflow': '',
                  'data-active': overflow.items.some(item => item.active) ? '' : undefined
                }}
                onOpenChange={open => { if (open) refresh() }}
                items={menuItems}
              />
            </div>
          )}
          {more && <div ref={moreRef} className='odc-filterbar-more' data-filterbar-more=''>{more}</div>}
          {clear && <div className='odc-filterbar-clear'>{clear}</div>}
          {!clear && overflowEnabled && clearReserve && <span className='odc-filterbar-clear-reserve' aria-hidden='true' />}
          {overflowEnabled && <span className='odc-filterbar-plus-reserve' aria-hidden='true' />}
        </div>
        {tools && <div className='odc-filterbar-tools'>{tools}</div>}
      </div>
      {chips && <div className='odc-filterbar-chips'>{chips}</div>}
      {notice}
    </div>
  )
}

const setRef = (ref, node) => {
  if (typeof ref === 'function') ref(node)
  else if (ref) ref.current = node
}

/**
 * Search field (C7). A native `type="search"` input in a hairline frame; the
 * focus ring is drawn on the frame. With a value it shows an X that empties the
 * field (`onChange('')`, then `onClear` if given) and gives the focus back to
 * the input, so the keyboard never lands on the page. `label` (the input's
 * name) and `clearLabel` are required: the wrapper has no text of its own.
 */
export const SearchField = ({
  value,
  onChange,
  label,
  placeholder,
  clearLabel,
  onClear,
  inputRef,
  className,
  ...props
}) => {
  const localRef = useRef(null)
  const attachInput = useCallback(node => {
    localRef.current = node
    setRef(inputRef, node)
  }, [inputRef])
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (label == null) throw new Error('SearchField needs a label')
  if (clearLabel == null) throw new Error('SearchField needs a clearLabel')

  const clear = () => {
    onChange?.('')
    onClear?.()
    localRef.current?.focus()
  }

  return (
    <div className={cx('odc-root', 'odc-search', className)} {...props}>
      <Search className='odc-icon odc-search-icon' />
      <InputPrimitive
        ref={attachInput}
        type='search'
        className='odc-search-input'
        value={value ?? ''}
        onValueChange={next => onChange?.(next)}
        aria-label={label}
        placeholder={placeholder}
        autoComplete='off'
      />
      {value
        ? <IconButton icon={X} label={clearLabel} size='sm' className='odc-search-clear' onClick={clear} />
        : null}
    </div>
  )
}

const renderIcon = Icon => Icon ? <Icon className='odc-icon' /> : null

/**
 * Filter pill (C7). Inactive: dashed border, muted text. With a `value` the
 * pill is active: solid border, subtle fill, and the value in semibold after a
 * separator. The accessible name is «label value». `expanded` and `hasPopup`
 * describe the menu or sheet it opens. `priority` is kept as `data-priority` for
 * the caller's own ordering; the bar never hides a pill. `icon` is a component from
 * `../Icon`, as in `Button`.
 */
export const FilterPill = ({
  icon,
  label,
  value,
  onClick,
  priority = 'primary',
  expanded,
  hasPopup,
  className,
  ...props
}) => {
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (label == null) throw new Error('FilterPill needs a label')
  const active = value !== undefined && value !== null && value !== ''
  return (
    <ButtonPrimitive
      type='button'
      className={cx('odc-pill', className)}
      data-priority={priority}
      data-active={active ? '' : undefined}
      aria-expanded={expanded}
      aria-haspopup={hasPopup}
      onClick={onClick}
      {...props}
    >
      {renderIcon(icon)}
      <span className='odc-pill-label'>{label}</span>
      {active && (
        <>
          <span className='odc-pill-sep' aria-hidden='true' />
          {' '}
          {/* cut at --od-x-pill-value-max (F6d-1, Q3-02): the whole value stays as a tooltip and in the name */}
          <span className='odc-pill-value' title={typeof value === 'string' ? value : undefined}>{value}</span>
        </>
      )}
    </ButtonPrimitive>
  )
}

/**
 * Active filter chips (C7), one per value. Each has an X (24px, 44px with a
 * coarse pointer) named by its `removeLabel`, and the list may end with a
 * «clear all» link. Removing a chip moves the focus to the next chip, else the
 * previous one, else «clear all», so it is never lost with the removed button.
 * `label` names the list and is required.
 */
export const FilterChips = ({
  label,
  chips = [],
  clearAllLabel,
  onClearAll,
  className,
  ...props
}) => {
  const removeButtons = useRef(new Map())
  const clearAllRef = useRef(null)
  const pending = useRef(null)
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (label == null) throw new Error('FilterChips needs a label')

  // After the parent drops the chip, put the focus where the removed button was.
  useLayoutEffect(() => {
    const target = pending.current
    if (!target || chips.some(chip => chip.key === target.removed)) return
    pending.current = null
    const active = document.activeElement
    if (active && active !== document.body) return
    const next = removeButtons.current.get(target.next) ?? clearAllRef.current
    next?.focus()
  }, [chips])

  const remove = (chip, index) => {
    pending.current = {
      removed: chip.key,
      next: (chips[index + 1] ?? chips[index - 1])?.key
    }
    chip.onRemove?.()
  }

  const showClearAll = clearAllLabel && onClearAll && chips.length > 0
  return (
    <ul role='list' aria-label={label} className={cx('odc-root', 'odc-chips', className)} {...props}>
      {chips.map((chip, index) => (
        <li key={chip.key} className='odc-chip'>
          <span className='odc-chip-text'>{chip.label}</span>
          <IconButton
            ref={node => {
              if (node) removeButtons.current.set(chip.key, node)
              else removeButtons.current.delete(chip.key)
            }}
            icon={X}
            label={chip.removeLabel}
            size='sm'
            className='odc-chip-remove'
            onClick={() => remove(chip, index)}
          />
        </li>
      ))}
      {showClearAll && (
        <li className='odc-chips-clear'>
          <Button ref={clearAllRef} variant='link' onClick={onClearAll}>{clearAllLabel}</Button>
        </li>
      )}
    </ul>
  )
}

const TONES = ['warning', 'info', 'danger']

/**
 * Inline notice (C7). Sits in the bar's flow, never floating over controls: the
 * real-time warning with filters active is one. A tone-coloured dot (or `icon`,
 * a component from `../Icon`) goes first and `action` last. Role `status`
 * announces it politely; the colour is never the only signal because the text
 * says it.
 *
 * `live={false}` (N-FD3) is for a static note, one that is there from the start and never changes: it is
 * role `note`, not a live region. An explicit `role` still wins over both.
 */
export const InlineNotice = ({ tone, icon, children, action, className, live = true, ...props }) => {
  if (!TONES.includes(tone)) throw new Error(`InlineNotice tone must be one of ${TONES.join(', ')}`)
  return (
    <div role={live ? 'status' : 'note'} className={cx('odc-root', 'odc-notice', className)} data-tone={tone} {...props}>
      {icon
        ? renderIcon(icon)
        : <span className='odc-notice-dot' aria-hidden='true' />}
      <span className='odc-notice-text'>{children}</span>
      {action && <span className='odc-notice-action'>{action}</span>}
    </div>
  )
}
