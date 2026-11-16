import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

import { timezones } from '../../../config/constants'
import { CircleAlert } from '../../Shared/Icon'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'

// redesign DC-B3 (decision 3 | M-DC10): the company's time zone, the list of main with its search (the former General tab,
// 51-61, 133-148), as a C18 select. Not a P/Field: the list has a search input and the Base UI Field would take it for its own
// control (and rename it with this label), so the frame is the Field's markup and classes without its context, as the user form
// does (Users/UserFormDetails). The error sits under it, as a P/Field error does.
//
// The select keeps its own value (`defaultValue`): the host remounts it (a `key`) to show a value from outside (Discard).

const FIT_TRIGGER = { fitTrigger: true }

export const TimezoneSelect = ({ label, value, onChange, placeholder, error, required = false, requiredLabel, disabled = false }) => {
  const base = useId()
  const labelId = `${base}-label`
  const errorId = `${base}-error`
  const rootRef = useRef(null)
  const [search, setSearch] = useState('')

  const options = useMemo(() => {
    const needle = search.toLocaleLowerCase()
    return timezones
      .filter(zone => zone.toLocaleLowerCase().includes(needle))
      .map(zone => ({ value: zone, content: zone }))
  }, [search])

  // A click on the label focuses the trigger, as it does for a text field
  useEffect(() => {
    const labelNode = document.getElementById(labelId)
    if (!labelNode) return undefined
    const focusTrigger = (event) => {
      const control = rootRef.current?.querySelector('[aria-haspopup="listbox"]')
      if (!control) return
      event.preventDefault()
      control.focus()
    }
    labelNode.addEventListener('click', focusTrigger)
    return () => labelNode.removeEventListener('click', focusTrigger)
  }, [labelId])

  const failed = error != null && error !== ''
  return (
    <div
      ref={rootRef}
      className='odc-root odc-field odc-dc-timezone'
      data-field='timezone'
      data-required={required ? '' : undefined}
      data-invalid={failed ? '' : undefined}
    >
      <span id={labelId} className='odc-field-label'>
        <span className='odc-field-label-text'>{label}</span>
        {required && (
          <>
            {' '}
            <span className='odc-field-required' aria-hidden='true' title={requiredLabel}>*</span>
            <span className='odc-sr-only'>{requiredLabel}</span>
          </>
        )}
      </span>
      <div className='odc-field-control'>
        <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
          <FirstSelect
            ariaLabelledBy={labelId}
            ariaLabel={label}
            ariaDescribedBy={failed ? errorId : undefined}
            options={options}
            defaultValue={value ?? undefined}
            placeholder={placeholder}
            isDisabled={disabled}
            isShowSearchBar
            searchValue={search}
            handleChangeSearch={setSearch}
            onChange={(zone) => {
              setSearch('')
              onChange?.(zone)
            }}
          />
        </SelectSurfaceContext.Provider>
      </div>
      {failed && (
        <div id={errorId} className='odc-field-error' role='alert'>
          <CircleAlert className='odc-icon odc-field-error-icon' aria-hidden='true' />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
