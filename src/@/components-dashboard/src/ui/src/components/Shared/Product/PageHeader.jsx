import React from 'react'

import { ArrowLeft, Ellipsis } from '../Icon'
import { IconButton } from './Button'
import { cx } from './classNames'
import { Menu } from './Menu'
import { Count } from './Status'
import './product.css'
import './page-header.css'

/**
 * Page header (redesign W0-7, T0-24): the anatomy of the pilot's OrdersContentHeader (5.2-A, F6b, 5.6-B) for every
 * family. One row: [back] title, count, live status, then at the end Learn, the «More» menu and the primary action.
 * The pilot's header is not changed; this is the generalization the next pages (W1-3 /deliveries first) consume.
 *
 * - `title` (required) is the page's h1. It wraps by words to two lines and only the third is cut, with an ellipsis (PH-1:
 *   line clamp 2; a word longer than the line breaks); it carries its full text as `title`, for what the third line cuts.
 *   Redesign tramo B r4 (W0-QB3-01, -02): the back button, the title, the count and the status are ONE block
 *   (`.odc-pagehead-lead`) that never splits: the count stays against the title. The block never goes under a readable minimum and
 *   a short title takes only the width of its text. The row of actions drops to its own line (at its end) only when the block
 *   would go under that minimum; a title longer than the block wraps inside it, and the arrow, count and status stay centred on it.
 *   A wrapped title takes the width left in the block (CSS does not shrink a wrapped box to its longest line), so its count sits at
 *   the end of that box, not right after the last word; a one-line title keeps it against the text. This holds at any width.
 * - `count` (optional) is the number beside the title, drawn as a Count badge. With a count, `countLabel` (its
 *   accessible name, «744 orders») is required: the figure is read by that label, not as a bare number.
 * - `status` (optional node) goes in the live-status slot. The slot is always there: it reserves one line of the
 *   row's height, so a status that appears or goes away (the socket) never pushes the content below the header.
 * - `primaryAction` (optional node): one Product Button (variant primary), always last on the row and always kept.
 * - `actions`: a list of Menu items (`{ key, label, icon, onSelect, … }`) for the «More» menu, which needs
 *   `moreLabel` (required with a non-empty list); the menu is not drawn when the list is empty or absent. A React
 *   node is drawn as is in the group, for a page that composes its own controls.
 * - `learn` (optional node): the help entry, first in the group.
 * - `description` (optional): one muted line under the row.
 * - `onBack` + `backLabel` (required with `onBack`): the back button, for a view opened as a page.
 * - `leading` (optional node, ): drawn first in the lead block, before the back button and the title. It is where a
 *   page puts its «Open menu» button (its own IconButton, label and condition): centred with the title, never split from it,
 *   and 44px where every button of the row is (a phone width or a coarse pointer). The block's minimum grows by the button and
 *   its gap (`data-leading`), so the title keeps the room it had when the button sat outside the header and the actions drop
 *   to their own line at the same width as before. Without it the header does not change.
 * - `wideTitle` (optional, owner decision 28 B): in a narrow header (under 600px) the lead block takes the whole row, so
 *   the actions drop to the line below and the two-line title has the row's width instead of the block's minimum. For headers whose
 *   title is what tells one page from the next (the reports). Wide, and without it, nothing changes.
 *
 * Narrow (the header's own width under 600px, a container query, not the viewport): the title drops to the section
 * size (it still wraps to two lines), the gaps tighten, and anything marked `data-collapse-label` (the text of Learn, of the status
 * button) keeps only its icon or mark: the text is clipped, not removed, so the accessible name stays. An action the page marks
 * `data-fill` (a search among the actions, DD-09) takes a whole line of its own under the block, from the content edge;
 * the other actions stay at the end of the line above. Wide, the mark changes nothing.
 *
 * Phone targets (decision 12): the neighbours on the row are 4px apart there (< 12px), so the buttons are 44px
 * visible, as the pilot's head (the product.css rule), not 32px with a 44px pseudo-element.
 * The wrapper has no text of its own.
 */
export const PageHeader = ({
  title,
  count,
  countLabel,
  status,
  primaryAction,
  actions,
  moreLabel,
  learn,
  description,
  backLabel,
  onBack,
  leading,
  wideTitle,
  className,
  ...props
}) => {
  // redesign W0-7 (T0-24): only a missing name throws; an empty translation paints empty
  if (title == null) throw new Error('PageHeader needs a title')
  const hasCount = count != null
  if (hasCount && countLabel == null) throw new Error('PageHeader needs a countLabel')
  if (onBack && backLabel == null) throw new Error('PageHeader needs a backLabel')
  const isMenu = Array.isArray(actions)
  const hasMenu = isMenu && actions.length > 0
  if (hasMenu && moreLabel == null) throw new Error('PageHeader needs a moreLabel')
  const hasGroup = Boolean(learn) || hasMenu || (actions != null && !isMenu) || Boolean(primaryAction)

  return (
    <div className={cx('odc-root odc-pagehead', className)} {...props}>
      <div className='odc-pagehead-row'>
        {/* redesign tramo B r4 (W0-QB3-01, -02): back, title, count and status are ONE block that never splits; only the actions
            may drop to their own line, and only when the block would go under its minimum */}
        <div className='odc-pagehead-lead' data-leading={leading ? '' : undefined} data-wide-title={wideTitle ? '' : undefined}>
          {leading}
          {onBack && <IconButton icon={ArrowLeft} flipInRtl label={backLabel} onClick={onBack} />}
          <h1 className='odc-pagehead-title' title={typeof title === 'string' ? title : undefined}>{title}</h1>
          {hasCount && <Count className='odc-pagehead-count' value={count} srLabel={countLabel} />}
          {/* Always in the row, even empty: it keeps the line's height, so a status coming or going moves nothing. */}
          <div className='odc-pagehead-status' data-empty={status ? undefined : ''}>{status}</div>
        </div>
        {hasGroup && (
          <div className='odc-pagehead-actions'>
            {learn}
            {hasMenu && <Menu label={moreLabel} icon={Ellipsis} items={actions} />}
            {actions != null && !isMenu && actions}
            {primaryAction}
          </div>
        )}
      </div>
      {description != null && description !== false && <p className='odc-pagehead-description'>{description}</p>}
    </div>
  )
}
