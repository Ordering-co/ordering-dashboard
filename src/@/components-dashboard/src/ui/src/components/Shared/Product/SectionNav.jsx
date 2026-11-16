import React from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'

import { cx } from './classNames'
import { Menu } from './Menu'
import { Count } from './Status'
import './product.css'
import './section-nav.css'

// redesign W0-7 (T0-27): the vertical list of sections of an editor with more than four (owner decision 35).
// Wide when the container offers 600px or the viewport 768px; below both, one selector replaces it.
const WIDE_CONTAINER = 600
const WIDE_VIEWPORT = 768
const VIEWPORT_QUERY = `(min-width: ${WIDE_VIEWPORT}px)`

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/**
 * Wide (list) or narrow (selector). The root's own width decides, not only the viewport: a list beside a wide
 * panel is narrow on a desktop. Nothing laid out (a hidden tab, no layout engine) keeps the list.
 */
const useWide = (rootRef, wideMinWidth, measureTarget) => {
  const [wide, setWide] = React.useState(true)
  React.useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const media = canMatch() ? window.matchMedia(VIEWPORT_QUERY) : null
    // redesign UC-R2 (Q-02): `measureTarget` only counts together with `wideMinWidth`; without either, the root is what is measured
    const target = typeof wideMinWidth === 'number' && typeof measureTarget === 'function' ? (measureTarget(root) ?? root) : root
    const update = () => {
      const width = target.clientWidth
      // redesign UC-B1 (decision 35, B1-1): with `wideMinWidth` the container alone decides, the viewport no longer counts
      if (typeof wideMinWidth === 'number') setWide(width === 0 || width >= wideMinWidth)
      else setWide(width === 0 || width >= WIDE_CONTAINER || Boolean(media?.matches))
    }
    update()
    media?.addEventListener?.('change', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(target)
    return () => {
      media?.removeEventListener?.('change', update)
      observer?.disconnect()
    }
  }, [rootRef, wideMinWidth, measureTarget])
  return wide
}

// Consecutive items of the same `group` share one header; items without a group have none.
const groupRuns = items => items.reduce((runs, item) => {
  const last = runs[runs.length - 1]
  if (last && last.group === item.group) last.items.push(item)
  else runs.push({ group: item.group, items: [item] })
  return runs
}, [])

const MOVE_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End']

/**
 * Section navigation (W0-7, T0-27): a vertical list of the sections of one editor. It navigates by state, not by
 * route: pressing a section calls `onValueChange(id)` and the consumer decides what to show (a `?section=`
 * deep link included). It never navigates by itself.
 *
 * Semantics: navigation, not a tablist. A `nav` named by `label` holding buttons, the current one with
 * `aria-current="page"`. Every row is a Tab stop (no roving tabindex: links and buttons of a navigation are
 * reached by Tab, like the sidebar); ArrowUp, ArrowDown, Home and End also move the focus between the rows
 * without activating, and a disabled row is skipped by both. Enter and Space activate.
 *
 * Narrow (the container under 600px and the viewport under 768px) the list becomes one selector, a Product
 * `Menu` of radio items whose trigger shows the current section and is named by `compactLabel` plus that
 * section. The selector shows each item's `label` and `description`; `count` and `attention` stay in the list.
 * There are never tabs that do not fit.
 *
 * `wideMinWidth` (optional number, UC-B1): when set, the nav is the list only when its own container is at least
 * that wide, whatever the viewport (a nothing-laid-out container still keeps the list); otherwise it is the
 * selector. Without it the 600px container / 768px viewport rule above applies unchanged.
 *
 * `measureTarget` (optional function `root => Element`, UC-R2), used only together with `wideMinWidth`: the width compared is
 * that element's `clientWidth` (the root's when it returns nothing) and the ResizeObserver watches that element. For a nav
 * that sits in a column of a wider panel: the panel's width decides, not the column's. Pass a stable function (a module
 * constant), or the observer is set up again on every render. Without `wideMinWidth` it is ignored; without it the root is measured.
 *
 * `label` and `compactLabel` are required (an Error when missing; an empty string is a text that was
 * translated to nothing and draws as such). `items`: `{ id, label, description?, count?, countLabel?,
 * attention?, disabled?, group? }`. `group` (already translated) puts a caption header above the first item of
 * a run. The wrapper has no text of its own.
 *
 * redesign settings 0, all opt-in (without them nothing above changes):
 * - `groups: [{ id, label, description? }]`: items are grouped by `item.group === group.id`, in the order of
 *   `groups`. Each group is a row (a button with `aria-expanded` and `aria-controls` to its list, `data-expanded`
 *   when open) that shares the section row's class, ring and height. Its list is mounted only when its `id` is in
 *   `openGroups`; pressing the row calls `onGroupSelect(id)` and the consumer decides what opens (no state here).
 *   A group with no items is drawn as a row with no list.
 * - `listOnly`: never becomes the selector; it is a list at any width.
 * - `activateOnFocus`: ArrowUp, ArrowDown, Home and End also activate the row they land on
 *   (`onValueChange(id)` for a section, `onGroupSelect(id)` for a group), like `Tabs activateOnFocus`.
 * Group rows and section rows share the arrow navigation (the visible rows, disabled ones skipped).
 *
 * redesign stores 5.1b (decision 35), opt-in: `selectorOnly` is the mirror of `listOnly`: it is the selector at any
 * width (nothing laid out included), for the subsections of one section, which never become a second list beside the editor's.
 * With both, `listOnly` wins. Without it nothing above changes.
 */
export const SectionNav = ({
  label,
  compactLabel,
  items,
  value,
  onValueChange,
  wideMinWidth,
  measureTarget,
  className,
  groups,
  openGroups,
  onGroupSelect,
  listOnly = false,
  selectorOnly = false,
  activateOnFocus = false,
  ...props
}) => {
  // redesign W0-7 (T0-27): missing, not empty
  if (label == null) throw new Error('SectionNav needs a label')
  if (compactLabel == null) throw new Error('SectionNav needs a compactLabel')
  const rootRef = React.useRef(null)
  const listRef = React.useRef(null)
  const measuredWide = useWide(rootRef, wideMinWidth, measureTarget)
  // redesign settings 0: listOnly never becomes the selector
  // redesign stores 5.1b: selectorOnly never becomes the list
  const wide = listOnly || (!selectorOnly && measuredWide)
  const ids = React.useId()
  const current = items.find(item => item.id === value)

  const onKeyDown = (event) => {
    if (!MOVE_KEYS.includes(event.key)) return
    const rows = [...(listRef.current?.querySelectorAll('button.odc-sectionnav-row:not(:disabled)') ?? [])]
    if (rows.length === 0) return
    const at = rows.indexOf(document.activeElement)
    if (at < 0) return
    const target = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? rows.length - 1
        : Math.min(rows.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)))
    event.preventDefault()
    rows[target].focus()
    // redesign settings 0: moving to the same row activates nothing; the current section neither
    if (!activateOnFocus || target === at) return
    const row = rows[target]
    const id = row.dataset.rowId
    if (row.dataset.kind === 'group') onGroupSelect?.(id)
    else if (!row.hasAttribute('data-current')) onValueChange?.(id)
  }

  const open = new Set(openGroups ?? [])

  return (
    <div
      ref={rootRef}
      className={cx('odc-root', 'odc-sectionnav', className)}
      data-mode={wide ? 'list' : 'selector'}
      {...props}
    >
      <nav aria-label={label}>
        {wide
          ? (
            <div ref={listRef} className='odc-sectionnav-list' onKeyDown={onKeyDown}>
              {groups
                ? groups.map((group) => {
                  const groupItems = items.filter(item => item.group === group.id)
                  const expanded = open.has(group.id)
                  const rowId = `${ids}-gr-${group.id}`
                  const listId = `${ids}-gl-${group.id}`
                  return (
                      <div key={group.id} className='odc-sectionnav-run' data-collapsible=''>
                        <GroupRow
                          id={rowId}
                          group={group}
                          expanded={expanded}
                          controls={groupItems.length > 0 ? listId : undefined}
                          onGroupSelect={onGroupSelect}
                        />
                        {expanded && groupItems.length > 0 && (
                          <ul id={listId} className='odc-sectionnav-items' aria-labelledby={rowId}>
                            {groupItems.map(item => (
                              <li key={item.id}>
                                <SectionRow item={item} current={item.id === value} onValueChange={onValueChange} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                  )
                })
                : groupRuns(items).map((run, index) => {
                  const headingId = `${ids}-g${index}`
                  return (
                      <div key={run.items[0].id} className='odc-sectionnav-run'>
                        {run.group != null && <p id={headingId} className='odc-sectionnav-group'>{run.group}</p>}
                        <ul className='odc-sectionnav-items' aria-labelledby={run.group != null ? headingId : undefined}>
                          {run.items.map(item => (
                            <li key={item.id}>
                              <SectionRow item={item} current={item.id === value} onValueChange={onValueChange} />
                            </li>
                          ))}
                        </ul>
                      </div>
                  )
                })}
            </div>
            )
          : (
            <>
              <span id={`${ids}-compact`} className='odc-sr-only'>{compactLabel}</span>
              <Menu
                label={current ? current.label : compactLabel}
                align='start'
                side='bottom'
                className='odc-sectionnav-trigger'
                triggerProps={{ id: `${ids}-trigger`, 'aria-labelledby': `${ids}-compact ${ids}-trigger` }}
                data-field-menu=''
                items={items.map((item, index) => ({
                  key: item.id,
                  label: item.label,
                  description: item.description,
                  type: 'radio',
                  checked: item.id === value,
                  disabled: item.disabled,
                  separatorBefore: index > 0 && item.group != null && item.group !== items[index - 1].group,
                  onSelect: () => { if (item.id !== value) onValueChange?.(item.id) }
                }))}
              />
            </>
            )}
      </nav>
    </div>
  )
}

// redesign settings 0: a group row. Same class (ring, height, touch floor) as a section row.
const GroupRow = ({ id, group, expanded, controls, onGroupSelect }) => (
  <ButtonPrimitive
    id={id}
    type='button'
    className='odc-sectionnav-row'
    aria-expanded={expanded}
    aria-controls={controls}
    data-kind='group'
    data-row-id={group.id}
    data-expanded={expanded ? '' : undefined}
    data-has-description={group.description ? '' : undefined}
    onClick={() => onGroupSelect?.(group.id)}
  >
    <span className='odc-sectionnav-text'>
      <span className='odc-sectionnav-label'>{group.label}</span>
      {group.description && <span className='odc-sectionnav-description'>{group.description}</span>}
    </span>
  </ButtonPrimitive>
)

const SectionRow = ({ item, current, onValueChange }) => (
  <ButtonPrimitive
    type='button'
    className='odc-sectionnav-row'
    data-kind='section'
    data-row-id={item.id}
    disabled={item.disabled}
    aria-current={current ? 'page' : undefined}
    data-current={current ? '' : undefined}
    data-attention={item.attention ? '' : undefined}
    data-has-description={item.description ? '' : undefined}
    onClick={() => { if (!current) onValueChange?.(item.id) }}
  >
    <span className='odc-sectionnav-text'>
      <span className='odc-sectionnav-label'>{item.label}</span>
      {item.description && <span className='odc-sectionnav-description'>{item.description}</span>}
    </span>
    {item.count != null && <Count value={item.count} attention={item.attention} srLabel={item.countLabel} />}
  </ButtonPrimitive>
)
