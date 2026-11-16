import React, { useState, useEffect, useId } from 'react'
import { IconButton } from '../../../styles/Buttons'
import { Columns3 as LayoutThreeColumns, Square as RiCheckboxBlankLine, SquareCheck as RiCheckboxFill } from '../Icon'
import { usePopper } from 'react-popper'
import { useLanguage } from '../../../../../index'

import {
  HeaderItem,
  PopoverBody,
  PopoverList,
  AllowItem,
  Title
} from './column-allow-setting-popover-styles'

const PANEL_OFFSET = 12
const VIEWPORT_MARGIN = 8

// Module-level so `usePopper` sees a stable options object. A long column list
// must stay anchored to the trigger and scroll inside itself instead of running
// off the viewport, so the panel gets the room left on its side of the trigger.
const fitViewportHeight = {
  name: 'fitViewportHeight',
  enabled: true,
  phase: 'beforeWrite',
  requires: ['computeStyles', 'flip'],
  fn: ({ state }) => {
    const { reference } = state.rects
    const room = state.placement.startsWith('top')
      ? reference.y
      : window.innerHeight - reference.y - reference.height
    state.styles.popper.maxHeight = `${Math.max(120, Math.floor(room - PANEL_OFFSET - VIEWPORT_MARGIN))}px`
  }
}

export const ColumnAllowSettingPopover = (props) => {
  const {
    optionsDefault,
    allowColumns,
    handleChangeAllowColumns,
    title,
    isOrder
  } = props
  const [, t] = useLanguage()
  const popoverId = useId()
  const accessibleName = typeof title === 'string' ? title : t('MANAGE_COLUMNS', 'Manage columns')

  const [open, setOpen] = useState(false)

  // State, not refs: usePopper must receive the real nodes, and `ref.current` is
  // still null during the first render.
  const [referenceElement, setReferenceElement] = useState(null)
  const [popperElement, setPopperElement] = useState(null)

  // The panel is `position: fixed` (see the stylesheet), so Popper has to compute
  // viewport coordinates, not document ones.
  const popper = usePopper(referenceElement, popperElement, {
    placement: 'bottom-end',
    strategy: 'fixed',
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [0, PANEL_OFFSET]
        }
      },
      fitViewportHeight
    ]
  })

  const { styles, attributes, update } = popper

  useEffect(() => {
    update && update()
  }, [open])

  const handleClickOutside = (e) => {
    if (!open) return
    const outsidePopover = !popperElement?.contains(e.target)
    const outsidePopoverMenu = !referenceElement?.contains(e.target)
    if (outsidePopover && outsidePopoverMenu) {
      setOpen(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key !== 'Escape' && e.keyCode !== 27) return
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    referenceElement?.focus()
  }

  useEffect(() => {
    window.addEventListener('mouseup', handleClickOutside)
    if (open) window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('mouseup', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  const popStyle = { ...styles.popper, display: open ? 'block' : 'none' }
  if (!open) {
    popStyle.transform = 'translate3d(0px, 0px, 0px)'
  }

  return (
    <div className='od-ui od-column-allow-popover' data-slot='column-allow-setting-popover'>
      <HeaderItem>
        <IconButton
          type='button'
          color='black'
          ref={setReferenceElement}
          aria-label={accessibleName}
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={() => setOpen(!open)}
        >
          <LayoutThreeColumns />
        </IconButton>
      </HeaderItem>
      <PopoverBody
        id={popoverId}
        ref={setPopperElement}
        style={popStyle}
        role='group'
        aria-label={accessibleName}
        {...attributes.popper}
      >
        {title && <Title>{title}</Title>}
        <PopoverList>
          {optionsDefault.map(option => {
            const isChecked = isOrder ? allowColumns?.[option.value]?.visable : allowColumns[option.value]
            return (
              <AllowItem
                key={option.value}
                aria-pressed={Boolean(isChecked)}
                onClick={() => handleChangeAllowColumns(option.value)}
              >
                {isChecked
                  ? (
                    <RiCheckboxFill />
                    )
                  : (
                    <RiCheckboxBlankLine />
                    )}
                <span>
                  {option.content}
                </span>
              </AllowItem>
            )
          })}
        </PopoverList>
      </PopoverBody>
    </div>
  )
}

ColumnAllowSettingPopover.displayName = 'OrderingColumnAllowSettingPopover'
