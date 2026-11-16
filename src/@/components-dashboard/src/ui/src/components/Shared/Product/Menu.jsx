import React from 'react'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'

import { Check, ChevronDown } from '../Icon'
import { Button, IconButton } from './Button'
import { cx } from './classNames'
import { tokenOffset } from './positioning'
import { useProductDir } from './useProductDir'
import './product.css'
import './menu.css'

const sideOffset = tokenOffset('--od-space-1')

/**
 * Action menu (C10) on Base UI Menu. The trigger announces `aria-haspopup="menu"`
 * and `aria-expanded`; the popup is a `menu` of `menuitem`s with a roving focus:
 * arrows, Home and End move, typing jumps to a label, Enter and Space select, and
 * Escape closes and returns the focus to the trigger.
 *
 * `label` names the trigger and is required. With `icon` the trigger is an
 * `IconButton` (ghost by default) named by `label`; without it, a `Button` that
 * shows `label` with a chevron (secondary by default). `className` goes on the
 * trigger.
 *
 * Items: `{ key, label, icon?, onSelect(), tone?: 'danger', separatorBefore?,
 * disabled?, description?, current?, href? }`. `href` (opt-in) draws the item as a real link (`<a href>` with the `menuitem` role, same look):
 * a click with Ctrl, Cmd, Shift or Alt, or a non-primary button, is left to the browser (new tab or window) and does not call `onSelect`;
 * a plain click calls `preventDefault()` and `onSelect()`, as any item. A disabled item is never a link. `current` marks the item of the page the
 * user is on (`aria-current="page"`, the active indicator). `triggerProps` adds
 * attributes to the trigger (`aria-describedby`, `data-*`, `title`). A disabled item does nothing; give it a
 * `description` and that is the reason, drawn as a second line and read as its
 * accessible description. The wrapper has no text of its own.
 *
 * Single choice: an item with `type: 'radio'` and `checked` is a `menuitemradio`
 * (`aria-checked`) with a check mark at its start; unchecked radios keep the empty
 * mark slot so the labels stay aligned. A run of radio items is one group and the
 * one with `checked` is the current choice. Choosing an item calls its `onSelect`
 * (also when it is already the checked one) and closes the menu, like any item.
 * Items without `type` are drawn and read exactly as before.
 */
export const Menu = ({
  items,
  label,
  icon,
  triggerVariant,
  side = 'bottom',
  align = 'end',
  dir,
  className,
  onOpenChange,
  triggerProps = {},
  ...props
}) => {
  const direction = useProductDir(dir)
  if (label == null) throw new Error('Menu needs a label') // redesign W0-2 r2 (W0-Q1-01)
  const variant = triggerVariant || (icon ? 'ghost' : 'secondary')
  const trigger = icon
    ? <IconButton icon={icon} label={label} variant={variant} className={className} {...triggerProps} />
    : <Button variant={variant} iconEnd={ChevronDown} className={className} {...triggerProps}>{label}</Button>
  return (
    <MenuPrimitive.Root onOpenChange={(open, details) => onOpenChange?.(open, details)}>
      <MenuPrimitive.Trigger render={trigger} />
      <MenuPrimitive.Portal className='odc-root' dir={direction}>
        <MenuPrimitive.Positioner
          className='odc-menu-positioner'
          side={side}
          align={align}
          sideOffset={sideOffset}
        >
          <MenuPrimitive.Popup className='odc-menu' dir={direction} {...props}>
            {groupItems(items).map(group => <MenuGroup key={group.items[0].key} group={group} />)}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

// Consecutive radio items form one group; every other item stands alone.
const groupItems = items => items.reduce((groups, item) => {
  const radio = item.type === 'radio'
  const last = groups[groups.length - 1]
  if (radio && last?.radio) last.items.push(item)
  else groups.push({ radio, items: [item] })
  return groups
}, [])

const MenuGroup = ({ group }) => group.radio
  ? (
    <MenuPrimitive.RadioGroup
      className='odc-menu-group'
      value={group.items.find(item => item.checked)?.key ?? null}
    >
      {group.items.map(item => <MenuEntry key={item.key} item={item} />)}
    </MenuPrimitive.RadioGroup>
    )
  : group.items.map(item => <MenuEntry key={item.key} item={item} />)

const MenuEntry = ({ item }) => (
  <>
    {item.separatorBefore && <MenuPrimitive.Separator className='odc-menu-separator' />}
    <MenuItem item={item} />
  </>
)

// A click the browser should handle itself: «open in a new tab / window» (the same test the RecordCard link uses)
const isModifiedClick = (event) => event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey

const MenuItem = ({ item }) => {
  const { label, icon: Icon, onSelect, tone, disabled, description, current, type, href } = item
  const radio = type === 'radio'
  const link = Boolean(href) && !radio && !disabled
  const handleClick = (event) => {
    if (link) {
      if (isModifiedClick(event)) return
      event.preventDefault()
    }
    onSelect?.()
  }
  const textId = React.useId()
  const descriptionId = React.useId()
  const Item = radio ? MenuPrimitive.RadioItem : MenuPrimitive.Item
  return (
    <Item
      className='odc-menu-item'
      label={label}
      disabled={disabled}
      data-tone={tone}
      data-current={current ? '' : undefined}
      aria-current={current ? 'page' : undefined}
      aria-labelledby={description ? textId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      onClick={handleClick}
      {...(link ? { render: <a href={href} /> } : {})}
      {...(radio ? { value: item.key, closeOnClick: true } : {})}
    >
      {radio && (
        <span className='odc-menu-mark' aria-hidden='true'>
          <MenuPrimitive.RadioItemIndicator>
            <Check className='odc-icon' />
          </MenuPrimitive.RadioItemIndicator>
        </span>
      )}
      {Icon && <Icon className={cx('odc-icon', 'odc-menu-icon')} aria-hidden='true' />}
      <span className='odc-menu-text'>
        <span id={textId} className='odc-menu-label'>{label}</span>
        {description && <span id={descriptionId} className='odc-menu-description'>{description}</span>}
      </span>
    </Item>
  )
}
