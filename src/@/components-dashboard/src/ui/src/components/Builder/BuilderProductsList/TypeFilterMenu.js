import React, { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { BUILDER_KINDS, BUILDER_TYPE_OPTIONS, getTypeFilterLabel } from '../utils'
import { LinkButton, TypeMenu, TypeMenuPanel } from '../styles'

/**
 * The type filter of the list: a "Type" button that opens the types
 * grouped in Apps and Websites, each with a shortcut for the whole group.
 * `value` is the list of types on; empty means every type.
 */
export const TypeFilterMenu = ({ value = [], onChange }) => {
  const [, t] = useLanguage()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = (type) => {
    onChange(value.includes(type) ? value.filter(item => item !== type) : [...value, type])
  }

  const toggleGroup = (types, allOn) => {
    onChange(allOn
      ? value.filter(item => !types.includes(item))
      : [...value.filter(item => !types.includes(item)), ...types])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
      rootRef.current?.querySelector('button')?.focus()
    }
  }

  return (
    <TypeMenu ref={rootRef} active={value.length > 0} onKeyDown={handleKeyDown}>
      <button type='button' aria-haspopup='true' aria-expanded={open ? 'true' : 'false'} aria-controls={panelId} onClick={() => setOpen(!open)}>
        {t('BUILDER_TYPE_FILTER', 'Type: _types_').replace('_types_', getTypeFilterLabel(value, t))}
        <ChevronDown aria-hidden='true' />
      </button>
      {open && (
        <TypeMenuPanel id={panelId}>
          {BUILDER_KINDS.map(kind => {
            const types = BUILDER_TYPE_OPTIONS.filter(option => option.kind === kind.value)
            const values = types.map(option => option.value)
            const allOn = values.every(item => value.includes(item))
            return (
              <fieldset key={kind.value}>
                <legend>
                  {kind.label(t)}
                  <button type='button' onClick={() => toggleGroup(values, allOn)}>
                    {allOn ? t('BUILDER_CLEAR', 'Clear') : t('BUILDER_SELECT_ALL', 'Select all')}
                  </button>
                </legend>
                {types.map(option => (
                  <label key={option.value}>
                    <input type='checkbox' checked={value.includes(option.value)} onChange={() => toggle(option.value)} />
                    {option.label(t)}
                  </label>
                ))}
              </fieldset>
            )
          })}
          <div>
            <LinkButton type='button' style={{ fontSize: 13 }} disabled={!value.length} onClick={() => onChange([])}>
              {t('BUILDER_ALL_TYPES', 'All types')}
            </LinkButton>
          </div>
        </TypeMenuPanel>
      )}
    </TypeMenu>
  )
}
