import React, { useState } from 'react'

import { ArrowDown, ArrowUp, GripVertical, LockKeyhole } from '../../Shared/Icon'
import { IconButton, Switch } from '../../Shared/Product'
import { editorOf, formatText, getAt, isDefaultSections, moveSection, optionsOf, resolveSections, toSectionsValue } from './schemaNodes'
import './theme-editor.css'

// redesign B3b: the switches are P/Switch, the arrows P/IconButton, the glyphs Shared/Icon; the list keeps native
// drag and drop within a block, the announcement and every text

/**
 * A page's sections (`sections`), in the order the website shows them: those
 * of a group move among their group (dragging them, or with the arrows), the
 * fixed ones keep their place, and only the ones that can be hidden have a
 * switch. `value` is the theme's `[{ key, visible }]`, or null for the
 * schema's; going back to the schema's order saves null.
 */
export const SectionsControl = ({ ctx, path, label, value, own, fallback, onChange, keepValue }) => {
  const { t, schema } = ctx
  const defaults = (getAt(schema, path)?.$value || []).filter(item => item && typeof item.key === 'string')
  const names = Object.fromEntries(optionsOf(schema, path).map(option => [option.value, option.label]))
  // The node's blocks (`section_groups`: label and help), else the names every page shared before 26.1.0
  const blocks = editorOf(getAt(schema, path)).section_groups
  const groupsMeta = Array.isArray(blocks)
    ? Object.fromEntries(blocks.filter(block => block?.key).map(block => [block.key, block]))
    : Object.fromEntries(Object.entries(schema?.editor?.labels?.page_section_groups || {}).map(([key, label]) => [key, { key, label }]))
  // On a platform the page follows all screens until it has its own order: a switch copies it, or drops it (null)
  const readOnly = !!ctx.platform && !own
  const sections = resolveSections(defaults, value)
  const schemaSections = resolveSections(defaults, null)
  const groups = new Set(defaults.map(section => section.group).filter(group => group != null))
  const [dragging, setDragging] = useState(null)
  const [announce, setAnnounce] = useState('')
  const nameOf = (key) => formatText(t, names[key], { fallback: key })

  const save = (next) => onChange(!keepValue && isDefaultSections(defaults, next) ? null : toSectionsValue(next))
  const move = (key, toKey) => {
    const next = moveSection(sections, key, toKey)
    if (next === sections) return
    save(next)
    const section = next.find(item => item.key === key)
    const place = next.filter(item => item.group === section.group).indexOf(section) + 1
    setAnnounce(t('BUILDER_THEME_SECTION_MOVED', '_name_ is now number _place_ in its block.').replace('_name_', nameOf(key)).replace('_place_', place))
  }
  const neighbor = (index, step) => {
    const group = sections[index].group
    for (let i = index + step; i >= 0 && i < sections.length; i += step) {
      if (sections[i].group === group) return sections[i].key
    }
    return null
  }

  if (!defaults.length) return <p className='odc-te-muted'>{t('BUILDER_THEME_PAGE_NO_SECTIONS', 'This page has no sections to move or hide.')}</p>

  return (
    <>
      {ctx.platform && (
        <div className='odc-te-own-order'>
          <Switch checked={!!own} onCheckedChange={(next) => onChange(next ? toSectionsValue(resolveSections(defaults, fallback)) : null)}>
            {t('BUILDER_THEME_PAGE_SECTIONS_OWN_PLATFORM', 'Order and hide them differently on phones')}
          </Switch>
          {!own && <p className='odc-te-muted'>{t('BUILDER_THEME_PAGE_SECTIONS_AS_ALL_SCREENS', 'Phones show them as on all screens.')}</p>}
        </div>
      )}
      <ul className='odc-te-sections' aria-label={label} aria-disabled={readOnly ? 'true' : undefined}>
        {sections.map((section, index) => {
          const name = nameOf(section.key)
          const movable = !readOnly && section.group != null
          // A block's name, where more than one block or a fixed section shares the list
          const showGroup = (groups.size > 1 || sections.some(item => item.group == null)) && section.group != null && sections[index - 1]?.group !== section.group
          const up = movable ? neighbor(index, -1) : null
          const down = movable ? neighbor(index, 1) : null
          const fromSchema = schemaSections[index]
          const changed = fromSchema?.key !== section.key || fromSchema?.visible !== section.visible
          return (
            <React.Fragment key={section.key}>
              {showGroup && (
                <li className='odc-te-sections-group'>
                  {formatText(t, groupsMeta[section.group]?.label, { fallback: section.group })}
                  {groupsMeta[section.group]?.info && <small>{formatText(t, groupsMeta[section.group].info)}</small>}
                </li>
              )}
              <li
                className='odc-te-section'
                data-hidden={!section.visible ? 'true' : undefined}
                data-dragging={dragging === section.key ? 'true' : undefined}
                draggable={movable && (up || down) ? 'true' : undefined}
                onDragStart={(e) => { setDragging(section.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', section.key) }}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  const from = sections.find(item => item.key === dragging)
                  if (from && from.group != null && from.group === section.group) e.preventDefault()
                }}
                onDrop={(e) => { e.preventDefault(); if (dragging) move(dragging, section.key); setDragging(null) }}
              >
                <span className='odc-te-section-handle' aria-hidden='true' title={section.group == null ? t('BUILDER_THEME_SECTION_FIXED', 'Keeps its place') : undefined}>
                  {section.group == null ? <LockKeyhole className='odc-icon' /> : movable ? <GripVertical className='odc-icon' /> : null}
                </span>
                <span className='odc-te-section-name'>
                  {name}
                  {section.group == null && !readOnly && <span className='odc-sr-only'>{t('BUILDER_THEME_SECTION_FIXED', 'Keeps its place')}</span>}
                  {!readOnly && changed && <span className='odc-sr-only'>{t('BUILDER_THEME_CHANGED', 'Changed')}</span>}
                </span>
                <div className='odc-te-section-actions'>
                  <span className='odc-te-section-moves'>
                    {movable && (up || down) && (
                      <>
                        <IconButton icon={ArrowUp} size='sm' disabled={!up} label={t('BUILDER_THEME_MOVE_UP', 'Move _name_ up').replace('_name_', name)} onClick={() => move(section.key, up)} />
                        <IconButton icon={ArrowDown} size='sm' disabled={!down} label={t('BUILDER_THEME_MOVE_DOWN', 'Move _name_ down').replace('_name_', name)} onClick={() => move(section.key, down)} />
                      </>
                    )}
                  </span>
                  <span className='odc-te-section-show'>
                    {section.hideable
                      ? <Switch label={t('BUILDER_THEME_SHOW_SECTION', 'Show _name_').replace('_name_', name)} checked={section.visible} disabled={readOnly} onCheckedChange={(next) => save(sections.map(item => item.key === section.key ? { ...item, visible: next } : item))} />
                      : t('BUILDER_THEME_ALWAYS_VISIBLE', 'Always visible')}
                  </span>
                </div>
              </li>
            </React.Fragment>
          )
        })}
      </ul>
      <span className='odc-sr-only' role='status'>{announce}</span>
    </>
  )
}
