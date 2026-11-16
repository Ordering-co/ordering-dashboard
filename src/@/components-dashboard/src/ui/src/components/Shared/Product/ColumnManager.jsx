import React from 'react'
import { Popover } from '@base-ui/react/popover'

import { ChevronDown, ChevronUp, Columns3, GripVertical } from '../Icon'
import { Button, IconButton } from './Button'
import { Checkbox } from './Checkbox'
import { tokenOffset } from './positioning'
import { useProductDir } from './useProductDir'
import './product.css'
import './column-manager.css'

const REQUIRED_TEXT = ['triggerLabel', 'title', 'resetLabel', 'lockedNote', 'widthHiddenNote']
const REQUIRED_LABELS = ['moveUpLabel', 'moveDownLabel']

const SIDE_OFFSET = tokenOffset('--od-space-1')

const moveItem = (list, from, to) => {
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * Column manager (orders list, wave 3 `columns` state). A popover with one row
 * per column: the checkbox (the whole row toggles) shows or hides it, two small
 * buttons move it up or down (the keyboard and WCAG 2.5.7 way to reorder) and a
 * grip lets a pointer drag it. Locked columns cannot be hidden and say so;
 * columns the list drops at the current width say so while they are visible.
 * A column may also carry `disabled` (its checkbox cannot change, and it keeps its state: a view that
 * cannot show it) and `note` (its own short reason, shown beside it); both are opt-in. A column can
 * still be moved while it is disabled. The locked note outranks a column note, which outranks the
 * width note.
 *
 * Focus starts on the first checkbox that can change, not on «Reset».
 *
 * Controlled: `columns` is the current order, `onChange(nextColumns)` returns the
 * same shape. Every text arrives by props, already translated.
 */
export const ColumnManager = ({
  columns,
  onChange,
  onReset,
  triggerLabel,
  title,
  resetLabel,
  lockedNote,
  widthHiddenNote,
  moveUpLabel,
  moveDownLabel,
  dir,
  className
}) => {
  const texts = { triggerLabel, title, resetLabel, lockedNote, widthHiddenNote, moveUpLabel, moveDownLabel }
  for (const key of REQUIRED_TEXT) {
    // redesign W0-2 r2 (W0-Q1-01): missing, not empty
    if (texts[key] == null) throw new Error(`ColumnManager needs ${key}`)
  }
  for (const key of REQUIRED_LABELS) {
    if (typeof texts[key] !== 'function') throw new Error(`ColumnManager needs ${key}(label)`)
  }

  const resolvedDir = useProductDir(dir)
  const idPrefix = React.useId()
  const listRef = React.useRef(null)
  const popupRef = React.useRef(null)
  const firstChangeableRef = React.useRef(null)
  const columnsRef = React.useRef(columns)
  columnsRef.current = columns
  const focusRequest = React.useRef(null)
  const [draggingId, setDraggingId] = React.useState(null)

  // Reordering moves DOM nodes, which can drop focus: put it back on the same
  // button of the moved row (or on its sibling when that one is now disabled).
  React.useLayoutEffect(() => {
    const request = focusRequest.current
    if (!request) return
    focusRequest.current = null
    const rowNode = listRef.current?.querySelector(`[data-column-id="${CSS.escape(request.id)}"]`)
    const buttons = rowNode ? [...rowNode.querySelectorAll('[data-move]')] : []
    const wanted = buttons.find(button => button.dataset.move === request.direction)
    const target = wanted && !wanted.disabled ? wanted : buttons.find(button => !button.disabled)
    target?.focus()
  })

  // Focus starts on the first checkbox that can change (locked and disabled ones cannot), never on
  // «Reset», which undoes the whole configuration; with every column locked it starts on the popup.
  const firstChangeableId = columns.find(column => !column.locked && !column.disabled)?.id
  const initialFocus = () => firstChangeableRef.current ?? popupRef.current ?? true

  const toggle = (id, visible) => {
    onChange(columns.map(column => column.id === id ? { ...column, visible } : column))
  }

  const move = (id, direction) => {
    const from = columns.findIndex(column => column.id === id)
    const to = direction === 'up' ? from - 1 : from + 1
    if (from < 0 || to < 0 || to >= columns.length) return
    focusRequest.current = { id, direction }
    onChange(moveItem(columns, from, to))
  }

  const startDrag = (event, id) => {
    if (event.button != null && event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDraggingId(id)
  }

  const dragOver = (event) => {
    if (!draggingId) return
    const rows = [...(listRef.current?.children || [])]
    if (!rows.length) return
    let to = rows.findIndex((rowNode) => {
      const rect = rowNode.getBoundingClientRect()
      return event.clientY >= rect.top && event.clientY < rect.bottom
    })
    if (to < 0) to = event.clientY < rows[0].getBoundingClientRect().top ? 0 : rows.length - 1
    const current = columnsRef.current
    const from = current.findIndex(column => column.id === draggingId)
    if (from < 0 || from === to) return
    onChange(moveItem(current, from, to))
  }

  const endDrag = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setDraggingId(null)
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        render={<IconButton icon={Columns3} label={triggerLabel} className={className} />}
        aria-haspopup='dialog'
      />
      <Popover.Portal dir={resolvedDir}>
        <Popover.Positioner
          side='bottom'
          align='end'
          sideOffset={SIDE_OFFSET}
          className='odc-cm-positioner'
        >
          <Popover.Popup ref={popupRef} className='odc-root odc-cm-popup' dir={resolvedDir} initialFocus={initialFocus}>
            <div className='odc-cm-head'>
              <Popover.Title className='odc-cm-title'>{title}</Popover.Title>
              <Button variant='ghost' size='sm' onClick={() => onReset()}>{resetLabel}</Button>
            </div>
            <ul className='odc-cm-list' ref={listRef}>
              {columns.map((column, index) => {
                const noteId = `${idPrefix}-${column.id}-note`
                const note = column.locked
                  ? lockedNote
                  : (column.note || (column.visible && column.widthHidden ? widthHiddenNote : null))
                return (
                  <li
                    key={column.id}
                    className='odc-cm-row'
                    data-column-id={column.id}
                    data-dragging={draggingId === column.id ? '' : undefined}
                  >
                    <span
                      className='odc-cm-grip'
                      aria-hidden='true'
                      onPointerDown={event => startDrag(event, column.id)}
                      onPointerMove={dragOver}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    >
                      <GripVertical className='odc-icon' />
                    </span>
                    <Checkbox
                      ref={column.id === firstChangeableId ? firstChangeableRef : undefined}
                      checked={column.visible}
                      disabled={Boolean(column.locked || column.disabled)}
                      onCheckedChange={next => toggle(column.id, next)}
                      aria-describedby={note ? noteId : undefined}
                    >
                      {column.label}
                    </Checkbox>
                    {note && <span id={noteId} className='odc-cm-note'>{note}</span>}
                    <span className='odc-cm-moves'>
                      <IconButton
                        icon={ChevronUp}
                        size='sm'
                        label={moveUpLabel(column.label)}
                        data-move='up'
                        disabled={index === 0}
                        onClick={() => move(column.id, 'up')}
                      />
                      <IconButton
                        icon={ChevronDown}
                        size='sm'
                        label={moveDownLabel(column.label)}
                        data-move='down'
                        disabled={index === columns.length - 1}
                        onClick={() => move(column.id, 'down')}
                      />
                    </span>
                  </li>
                )
              })}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
