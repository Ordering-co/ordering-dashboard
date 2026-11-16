import React, { useId, useRef } from 'react'

import { Button } from '../../Shared/Product'
import './settings-hub.css'

// redesign settings A: the hub's landing, with no group and no section open. «What do you want to do?» with the
// visible tasks in two columns (one below 768px), and a card per group: its label, its description and its first sections.
//
// Presentational: every text arrives translated, and the hub keeps the behaviour (`handleTaskSelect`, `handleGroupSelect`,
// `handleSectionSelect`).
//
// @param {string}   props.title           «What do you want to do?»
// @param {Array}    props.tasks           [{ key, label }]
// @param {Array}    [props.groups]        [{ key, label, description, sections: [{ key, label }], moreCount, moreLabel }]; the
//                                         phone passes none (its navigation already lists the groups)
// @param {Function} props.onTaskSelect    (taskKey) => void
// @param {Function} props.onSectionSelect (groupKey, sectionKey) => void
// @param {Function} props.onGroupSelect   (groupKey) => void
export const HubOverview = ({ title, tasks, groups = [], onTaskSelect, onSectionSelect, onGroupSelect }) => {
  const tasksRef = useRef(null)
  const titleId = useId()

  // ArrowUp and ArrowDown move the focus between tasks (they never open one), as the landing did.
  const handleTaskKeyDown = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const buttons = [...(tasksRef.current?.querySelectorAll('[data-hub-task]') ?? [])]
    const at = buttons.indexOf(event.currentTarget)
    if (at < 0 || buttons.length === 0) return
    event.preventDefault()
    const next = (at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next].focus()
  }

  return (
    <div className='odc-root odc-hub-overview'>
      <section aria-labelledby={titleId}>
        <h2 id={titleId} className='odc-hub-overview-title'>{title}</h2>
        <ul ref={tasksRef} className='odc-hub-tasks'>
          {tasks.map(task => (
            <li key={task.key}>
              <Button
                variant='link'
                data-hub-task={task.key}
                onClick={() => onTaskSelect(task.key)}
                onKeyDown={handleTaskKeyDown}
              >
                {task.label}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      {groups.length > 0 && (
        <div className='odc-hub-cards'>
          {groups.map(group => (
            <section key={group.key} className='odc-hub-card' aria-labelledby={`odc-hub-card-${group.key}`}>
              <h3 id={`odc-hub-card-${group.key}`} className='odc-hub-card-title'>{group.label}</h3>
              {group.description && <p className='odc-hub-card-desc'>{group.description}</p>}
              {group.sections.length > 0 && (
                <ul className='odc-hub-card-links'>
                  {group.sections.map(section => (
                    <li key={section.key}>
                      <Button variant='link' onClick={() => onSectionSelect(group.key, section.key)}>
                        {section.label}
                      </Button>
                    </li>
                  ))}
                  {group.moreCount > 0 && (
                    <li>
                      <Button
                        variant='link'
                        className='odc-hub-more'
                        aria-label={`${group.moreLabel} ${group.label}`}
                        onClick={() => onGroupSelect(group.key)}
                      >
                        {group.moreLabel}
                      </Button>
                    </li>
                  )}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
