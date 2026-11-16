import { useEffect } from 'react'

// redesign settings R-03: the C18 trigger (U/FirstSelect) is a `div[role=button]`, which a <label for> cannot
// point at. Inside a P/Field, a click on the field's label focuses the trigger, as it does for a text field. `rootRef` wraps
// the select; `labelId` is the Field frame's label id.
export const useLabelFocusesTrigger = (rootRef, labelId) => {
  useEffect(() => {
    const labelNode = labelId ? document.getElementById(labelId) : null
    if (!labelNode) return undefined
    const onLabelClick = (event) => {
      const trigger = rootRef.current?.querySelector('[aria-haspopup="listbox"]')
      if (!trigger) return
      event.preventDefault()
      trigger.focus()
    }
    labelNode.addEventListener('click', onLabelClick)
    return () => labelNode.removeEventListener('click', onLabelClick)
  }, [rootRef, labelId])
}
