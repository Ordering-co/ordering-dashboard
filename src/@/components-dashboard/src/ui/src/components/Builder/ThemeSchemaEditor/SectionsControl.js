import React, { useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, LockFill } from 'react-bootstrap-icons'

import { SectionGroupHead, SectionList, SectionRow, SrOnly, SwitchTrack, ToggleControl } from '../BuilderWebTheme/styles'
import { editorOf, formatText, getAt, isDefaultSections, moveSection, optionsOf, resolveSections, toSectionsValue } from './schemaNodes'

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

  if (!defaults.length) return <p style={{ margin: 0, color: '#5E6B7D' }}>{t('BUILDER_THEME_PAGE_NO_SECTIONS', 'This page has no sections to move or hide.')}</p>

  return (
    <>
      {ctx.platform && (
        <div style={{ paddingBottom: 12 }}>
          <ToggleControl style={{ gap: 12, fontWeight: 500 }}>
            <input type='checkbox' role='switch' checked={!!own} onChange={(e) => onChange(e.target.checked ? toSectionsValue(resolveSections(defaults, fallback)) : null)} />
            <SwitchTrack checked={!!own} aria-hidden='true' />
            {t('BUILDER_THEME_PAGE_SECTIONS_OWN_PLATFORM', 'Order and hide them differently on phones')}
          </ToggleControl>
          {!own && <p style={{ margin: '8px 0 0', color: '#5E6B7D', fontSize: 13 }}>{t('BUILDER_THEME_PAGE_SECTIONS_AS_ALL_SCREENS', 'Phones show them as on all screens.')}</p>}
        </div>
      )}
      <SectionList aria-label={label} aria-disabled={readOnly ? 'true' : undefined} $readOnly={readOnly}>
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
                <SectionGroupHead as='li'>
                  {formatText(t, groupsMeta[section.group]?.label, { fallback: section.group })}
                  {groupsMeta[section.group]?.info && <small style={{ display: 'block', marginTop: 2, fontSize: 12, fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>{formatText(t, groupsMeta[section.group].info)}</small>}
                </SectionGroupHead>
              )}
              <SectionRow
                $hidden={!section.visible}
                $dragging={dragging === section.key}
                draggable={movable && (up || down) ? 'true' : undefined}
                onDragStart={(e) => { setDragging(section.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', section.key) }}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  const from = sections.find(item => item.key === dragging)
                  if (from && from.group != null && from.group === section.group) e.preventDefault()
                }}
                onDrop={(e) => { e.preventDefault(); if (dragging) move(dragging, section.key); setDragging(null) }}
              >
                <span aria-hidden='true' title={section.group == null ? t('BUILDER_THEME_SECTION_FIXED', 'Keeps its place') : undefined}>
                  {section.group == null ? <LockFill size={12} /> : movable ? <GripVertical /> : null}
                </span>
                <span>
                  {name}
                  {section.group == null && !readOnly && <SrOnly>{t('BUILDER_THEME_SECTION_FIXED', 'Keeps its place')}</SrOnly>}
                  {!readOnly && changed && <SrOnly>{t('BUILDER_THEME_CHANGED', 'Changed')}</SrOnly>}
                </span>
                <div>
                  <span>
                    {movable && (up || down) && (
                      <>
                        <button type='button' disabled={!up} aria-label={t('BUILDER_THEME_MOVE_UP', 'Move _name_ up').replace('_name_', name)} onClick={() => move(section.key, up)}><ArrowUp aria-hidden='true' /></button>
                        <button type='button' disabled={!down} aria-label={t('BUILDER_THEME_MOVE_DOWN', 'Move _name_ down').replace('_name_', name)} onClick={() => move(section.key, down)}><ArrowDown aria-hidden='true' /></button>
                      </>
                    )}
                  </span>
                  {section.hideable
                    ? (
                      <ToggleControl>
                        <input type='checkbox' role='switch' aria-label={t('BUILDER_THEME_SHOW_SECTION', 'Show _name_').replace('_name_', name)} checked={section.visible} disabled={readOnly} onChange={(e) => save(sections.map(item => item.key === section.key ? { ...item, visible: e.target.checked } : item))} />
                        <SwitchTrack checked={section.visible} aria-hidden='true' />
                      </ToggleControl>
                      )
                    : <small>{t('BUILDER_THEME_ALWAYS_VISIBLE', 'Always visible')}</small>}
                </div>
              </SectionRow>
            </React.Fragment>
          )
        })}
      </SectionList>
      <SrOnly role='status'>{announce}</SrOnly>
    </>
  )
}
