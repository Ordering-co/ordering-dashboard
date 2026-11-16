import React, { useId } from 'react'

import { useFieldFrame } from '../../Shared/Product'
import { ChevronDown } from '../../Shared/Icon'
import './invoice-form.css'

/**
 * The control that opens a popover, dressed as a field: an icon, the text, a chevron. Inside a `Field` its name is the label and
 * its own text («Period All dates»), so what is chosen is read with what it is for. (The period uses it; the party picker is a
 * filter pill now, in `AnalyticsKit/PartyPicker`.)
 */
export const FieldTrigger = React.forwardRef(function FieldTrigger ({ icon: Icon, text, empty = false, expanded = false, onClick }, ref) {
  const frame = useFieldFrame()
  const textId = useId()
  return (
    <button
      ref={ref}
      type='button'
      className='odc-iv-trigger'
      aria-haspopup='dialog'
      aria-expanded={expanded}
      // the label and the text of its own: a button that points at itself is not read by every engine
      aria-labelledby={frame?.labelId ? `${frame.labelId} ${textId}` : undefined}
      data-empty={empty ? '' : undefined}
      onClick={onClick}
    >
      {Icon && <Icon className='odc-icon odc-iv-trigger-icon' aria-hidden='true' />}
      <span id={textId} className='odc-iv-trigger-text' title={empty ? undefined : text}><bdi>{text}</bdi></span>
      <ChevronDown className='odc-icon odc-iv-trigger-chevron' aria-hidden='true' />
    </button>
  )
})
