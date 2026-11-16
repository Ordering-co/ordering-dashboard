import React, { useRef } from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { DirectionProvider } from '@base-ui/react/direction-provider'

import { cx } from './classNames'
import { Count } from './Status'
import { useOverflowEdges } from './useOverflowEdges'
import { useProductDir } from './useProductDir'
import './product.css'
import './tabs.css'

/*
 * Base UI keeps a disabled tab focusable (aria-disabled only) and strips the
 * native `disabled` attribute from composite items. Here a disabled tab is
 * skipped by the arrows and out of the tab order, so it is not handed to Base UI
 * as disabled: it renders a native disabled button, which the roving focus skips.
 */
const disabledTab = props => <button {...props} disabled aria-disabled='true' data-disabled='' />

/**
 * Status tabs (C14) on Base UI Tabs. A tablist with a roving tabindex: arrows
 * (inverted in RTL), Home and End move the focus; Enter and Space activate,
 * because activating reloads the list. Pass `activateOnFocus` for cheap panels.
 *
 * `label` names the tablist and is required. Each item may carry a `count`
 * (drawn as a badge; `attention` for counts that ask for action) and a
 * `countLabel` that reads its meaning to screen readers ("3 pending orders"). A `count` that is a node (a skeleton)
 * stands for a count not known yet: from then on the list keeps the room of two digits for each count (F6e-3).
 * The wrapper has no text of its own.
 *
 * When the tabs do not fit (a phone) the list scrolls sideways and the edge it
 * continues past fades (`data-overflow-start` / `data-overflow-end` on the list,
 * logical, so RTL fades the other side); the fade goes at the end of the row.
 * Every tab stays in the tab order and the arrows still reach it.
 *
 * `wrap` (opt-in, redesign reviews FA1) is the other answer to tabs that do not fit: they break into several lines, with no
 * scroll and no fade (`data-wrap='true'` on the root). It is still one tablist, with the same keyboard; the selected bar is
 * the tab's own, so it stays under its text on whichever line it falls.
 *
 * `children` are the panels. A list that reloads in place renders one
 * `<TabPanel value={value}>` with the current value.
 *
 * redesign stores 5.18 (from 5.15a/5.15b): the list reaches `--od-space-1` (4px) past its box on each side, on purpose:
 * it is the room for the focus ring of the first and the last tab (tabs.css, F6d-4b), given back by a negative margin so nothing
 * moves. A measure of the box sees the list 4px wider than it; it never scrolls anything as long as the host leaves at least that
 * much inline room around the tabs (every host does: the store editor's content has its own padding; document scroll 0 at 390 in
 * 12 locales). Removing it would clip the ring or shift the tabs, so the piece keeps it.
 */
export const Tabs = ({
  value,
  onValueChange,
  label,
  items,
  size = 'md',
  activateOnFocus = false,
  wrap = false,
  dir,
  className,
  children,
  ...props
}) => {
  const direction = useProductDir(dir)
  const listRef = useRef(null)
  // redesign reviews FA1 (D2, coordinador: opción c): with `wrap` the list never scrolls, so nothing watches its edges.
  const idleRef = useRef(null)
  useOverflowEdges(wrap ? idleRef : listRef)
  // redesign F6e-3 (Q4-04): a count that is a node (a loading placeholder) is a count on its way. A list that has had one keeps the
  // room of two digits for its counts for as long as it lives, so they can arrive without moving the tabs; a list that never had one
  // (the chat of the order panel) gives each count just its digits.
  const reserveCountRoom = useRef(false)
  if (items.some(item => item.count != null && typeof item.count === 'object')) reserveCountRoom.current = true
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (label == null) throw new Error('Tabs needs a label')
  return (
    <DirectionProvider direction={direction}>
      <TabsPrimitive.Root
        value={value}
        onValueChange={next => onValueChange?.(next)}
        className={cx('odc-root', 'odc-tabs', className)}
        dir={dir}
        // redesign reviews FA1 (D2, coordinador: opción c): the state is a data attribute, absent unless asked for
        data-wrap={wrap ? 'true' : undefined}
        {...props}
      >
        <TabsPrimitive.List
          ref={listRef}
          aria-label={label}
          activateOnFocus={activateOnFocus}
          className={wrap ? 'odc-tabs-list' : 'odc-tabs-list odc-fade-x'}
          data-size={size}
        >
          {items.map(item => (
            <TabsPrimitive.Tab
              key={item.value}
              value={item.value}
              className='odc-tab'
              render={item.disabled ? disabledTab : undefined}
            >
              <span className='odc-tab-label'>{item.label}</span>
              {item.count != null && (
                <>
                  {/* Whitespace between the label and the count: it reads "Pending 3 pending orders", not "Pending3…". */}
                  {' '}
                  {/* redesign F6d-4b (Q3-04), F6e-3 (Q4-04): the slot holds the room of two digits only in a list whose counts arrive later, so the tabs beside do not slide when they do; otherwise it fits the digits. */}
                  <span className='odc-tab-count-slot' data-reserve={reserveCountRoom.current ? '' : undefined}>
                    <Count value={item.count} attention={item.attention} srLabel={item.countLabel} />
                  </span>
                </>
              )}
            </TabsPrimitive.Tab>
          ))}
        </TabsPrimitive.List>
        {children}
      </TabsPrimitive.Root>
    </DirectionProvider>
  )
}

export const TabPanel = ({ value, children, className, ...props }) => (
  <TabsPrimitive.Panel value={value} className={cx('odc-tab-panel', className)} {...props}>
    {children}
  </TabsPrimitive.Panel>
)
