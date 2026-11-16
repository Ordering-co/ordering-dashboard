import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

import { ArrowLeft, X } from '../Icon'
import { IconButton } from './Button'
import { ConfirmDialog } from './Dialog'
import { TabPanel, Tabs } from './Tabs'
import { useSplitView } from './SplitView'
import { cx } from './classNames'
import { useProductDir } from './useProductDir'
import './product.css'
import './record-panel.css'

// redesign W0-7 (T0-26): the fields whose focus «Keep editing» gives back. A button is not one.
const FIELD_SELECTOR = [
  'textarea',
  'select',
  'input:not([type="button"],[type="checkbox"],[type="color"],[type="file"],[type="hidden"],[type="image"],[type="radio"],[type="range"],[type="reset"],[type="submit"])',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="combobox"]'
].join(',')

const DISCARD_PROPS = ['discardTitle', 'discardDescription', 'discardConfirmLabel', 'keepEditingLabel']

/**
 * The shell of a record's panel (redesign W0-7, T0-26), generalised from the order detail: a header (title, status,
 * subtitle, actions and the way out), either tabs or a navigation slot, a body that scrolls, a fixed footer and the
 * discard guard. It carries no record content: that comes in as `children` (or as the `content` of each tab).
 * Works in a SplitView panel (it registers its guard there), in a Sheet or on a page. One panel level: what would be a
 * second panel is a tab or a section of this one.
 *
 *  - `title` and `closeLabel` are required; the wrapper has no text of its own. `subtitle` and `status` are nodes.
 *  - `headerActions` (a node) sits before the close button: «Open as page» (`useSplitView().expanded`), menus.
 *  - `tabs` `{ label, items, value, onValueChange }` draws the Tabs of Product. An item carries its `content`; every
 *    panel stays mounted (hidden) so a draft, an attachment or a list of recipients survives a tab switch.
 *    `tabs.wrap` (opt-in, redesign row 91 O1) is the `wrap` of Tabs: the tabs break into lines instead of scrolling.
 *    OR `nav` (a node: the SectionNav) which is laid out as a column at the start of the body when the panel is
 *    wide (640px of container and up) and as a row above the body when it is narrow. The panel is a size container
 *    named `odc-record`: the nav can follow the same query. Not both.
 *  - `footer` is pinned under the body. In a SplitView opened as a page, header, body and footer stay in one column
 *    (`--od-x-page-content`) while their hairlines still cross the page.
 *  - `dirty` (a boolean) turns the guard on, and then `discardTitle`, `discardDescription`, `discardConfirmLabel` and
 *    `keepEditingLabel` are required (`discardCloseLabel`, optional, names the dialog's own close button; it falls back to
 *    `closeLabel`, which on a phone says «Back»). Closing (the close button, Escape or the scrim of the SplitView) asks first with a
 *    ConfirmDialog: the focus starts on «Keep editing», which gives it back to the field that had it (the one the
 *    first Escape took it from, or the last one the user was in); «Discard» closes through `onClose`. Without `dirty`
 *    (or with it false) it closes straight away.
 *  - `fullWidth` (a boolean, `false` by default; redesign SB-B0, , auditor 2) is the opt-in for a record whose body
 *    is a wide surface (a table, a canvas): opened as a page the content is not held to one column of
 *    `--od-x-page-content` (`data-full-width` on the root). Without it the panel is exactly as before.
 *  - Inside a SplitView the close of Escape and the scrim go through `registerCloseGuard`. Outside one (a Sheet),
 *    those belong to the host: it calls `ref.current.requestClose()` from its own `onOpenChange(false)`.
 *  - On a phone inside a SplitView (`mode === 'full'`) the way out is a Back arrow at the start; the label is the same
 *    `closeLabel`, so the content words it (it can read `useSplitView().mode`).
 */
export const RecordPanel = React.forwardRef(function ProductRecordPanel ({
  title,
  subtitle,
  status,
  closeLabel,
  onClose,
  headerActions,
  tabs,
  nav,
  footer,
  children,
  dirty,
  discardTitle,
  discardDescription,
  discardConfirmLabel,
  keepEditingLabel,
  discardCloseLabel,
  fullWidth = false,
  className,
  ...props
}, ref) {
  // redesign W0-7 (T0-26): missing, not empty (an empty translation paints empty)
  if (title == null) throw new Error('RecordPanel needs a title')
  if (closeLabel == null) throw new Error('RecordPanel needs a closeLabel')
  if (tabs != null && nav != null) throw new Error('RecordPanel takes tabs or nav, not both')
  if (dirty !== undefined) {
    const labels = { discardTitle, discardDescription, discardConfirmLabel, keepEditingLabel }
    for (const name of DISCARD_PROPS) {
      if (labels[name] == null) throw new Error(`RecordPanel needs a ${name} when it has dirty`)
    }
  }

  const dir = useProductDir()
  const split = useSplitView()
  const { registerCloseGuard, getEscapedField, mode, expanded } = split
  const layout = tabs != null ? 'tabs' : nav != null ? 'nav' : 'plain'
  const phone = mode === 'full' && split.open

  const [discardOpen, setDiscardOpen] = useState(false)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = !!dirty
  const closeRef = useRef(onClose)
  closeRef.current = onClose ?? split.onClose
  const pendingRef = useRef(null)
  const lastFieldRef = useRef(null)
  const returnFieldRef = useRef(null)
  const keepingRef = useRef(false)

  const trackField = event => {
    const target = event.target
    if (target instanceof Element && target.matches(FIELD_SELECTOR)) lastFieldRef.current = target
  }

  // True means the question is open and the panel stays. `proceed` is how the caller closes.
  const ask = useCallback(proceed => {
    if (!dirtyRef.current) return false
    pendingRef.current = proceed
    const escaped = getEscapedField()
    const last = lastFieldRef.current
    returnFieldRef.current = escaped ?? (last?.isConnected ? last : null)
    keepingRef.current = false
    setDiscardOpen(true)
    return true
  }, [getEscapedField])

  const requestClose = useCallback(proceed => {
    const next = typeof proceed === 'function' ? proceed : closeRef.current
    if (ask(next)) return
    next?.()
  }, [ask])

  useImperativeHandle(ref, () => ({ requestClose }), [requestClose])

  const askRef = useRef(ask)
  askRef.current = ask
  useEffect(() => registerCloseGuard(proceed => askRef.current(proceed)), [registerCloseGuard])

  const handleDiscard = () => {
    const proceed = pendingRef.current ?? closeRef.current
    pendingRef.current = null
    returnFieldRef.current = null
    keepingRef.current = false
    setDiscardOpen(false)
    proceed?.()
  }

  const handleKeep = () => {
    keepingRef.current = true
    pendingRef.current = null
    setDiscardOpen(false)
  }

  const closeButton = (
    <IconButton
      icon={phone ? ArrowLeft : X}
      flipInRtl={phone}
      label={closeLabel}
      className='odc-record-close'
      onClick={() => requestClose()}
    />
  )

  const foot = footer != null && footer !== false && <div className='odc-record-foot'>{footer}</div>

  return (
    <div
      className={cx('odc-root odc-record', className)}
      dir={dir}
      data-layout={layout}
      data-mode={mode}
      data-expanded={expanded ? '' : undefined}
      data-dirty={dirty ? '' : undefined}
      data-full-width={fullWidth ? '' : undefined} // redesign SB-B0 (auditor 2)
      {...props}
      onFocus={trackField}
    >
      <header className='odc-record-head'>
        <div className='odc-record-head-row'>
          {phone && closeButton}
          {/* redesign (row 63 Q-05): a long name is clamped by the css; the full text stays in the DOM and, for a string, in `title` */}
          <h2 className='odc-record-title' title={typeof title === 'string' ? title : undefined}>{title}</h2>
          {status != null && <span className='odc-record-status'>{status}</span>}
          <span className='odc-record-spacer' />
          {(headerActions != null || !phone) && (
            <div className='odc-record-actions'>
              {headerActions}
              {!phone && closeButton}
            </div>
          )}
        </div>
        {subtitle != null && <div className='odc-record-subtitle'>{subtitle}</div>}
      </header>

      {layout === 'tabs' && (
        <Tabs
          className='odc-record-frame odc-record-tabs'
          value={tabs.value}
          onValueChange={tabs.onValueChange}
          label={tabs.label}
          items={tabs.items}
          size='sm'
          wrap={tabs.wrap} // redesign (row 91 O1): opt-in, forwarded as given (undefined keeps the scrolling row)
        >
          <div className='odc-record-body'>
            {children}
            {tabs.items.map(item => (
              <TabPanel key={item.value} value={item.value} keepMounted className='odc-record-panel'>
                {item.content}
              </TabPanel>
            ))}
          </div>
          {foot}
        </Tabs>
      )}

      {layout === 'nav' && (
        <div className='odc-record-frame'>
          <div className='odc-record-main'>
            <div className='odc-record-nav'>{nav}</div>
            <div className='odc-record-body'>{children}</div>
          </div>
          {foot}
        </div>
      )}

      {layout === 'plain' && (
        <div className='odc-record-frame'>
          <div className='odc-record-body'>{children}</div>
          {foot}
        </div>
      )}

      {dirty !== undefined && (
        <ConfirmDialog
          open={discardOpen}
          title={discardTitle}
          confirmLabel={discardConfirmLabel}
          cancelLabel={keepEditingLabel}
          closeLabel={discardCloseLabel ?? closeLabel}
          onConfirm={handleDiscard}
          onCancel={handleKeep}
          finalFocus={() => {
            // «Keep editing» (and Escape, the scrim, the close of the dialog) goes back to the field; «Discard» to the
            // opener, which is what the layer resolves with `true`.
            const field = returnFieldRef.current
            return keepingRef.current && field?.isConnected ? field : true
          }}
        >
          {discardDescription}
        </ConfirmDialog>
      )}
    </div>
  )
})
