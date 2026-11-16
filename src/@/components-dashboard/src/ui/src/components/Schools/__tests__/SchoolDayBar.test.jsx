/* eslint-disable import/first */
// redesign SC-B1 (decisions 3A and 13; M-SC01): the filter bar of «Meals & reports», «Print labels» and (without a date) «Students».
// Real P/DatePicker, P/Field and U/FirstSelect; only the contexts of the app are replaced.
import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const mockState = vi.hoisted(() => ({ catalog: {}, configs: {} }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text],
  useConfig: () => [{ configs: mockState.configs }]
}))

import { SchoolDayBar } from '../SchoolDayBar'

const GRADES = [{ id: 1, name: 'Grade A' }, { id: 2, name: 'Grade B' }]
const CLASSROOMS = [{ id: 10, name: 'Room 1' }, { id: 11, name: 'Room 2' }]

const renderBar = (props = {}) => {
  const spies = { setDay: vi.fn(), setGradeId: vi.fn(), setClassroomId: vi.fn() }
  render(
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <SchoolDayBar
        day='2026-10-11'
        grades={GRADES}
        classrooms={CLASSROOMS}
        gradeId={null}
        classroomId={null}
        {...spies}
        {...props}
      />
    </ThemeProvider>
  )
  return spies
}

const triggerOf = (name) => screen.getByRole('button', { name })
const choose = (trigger, optionName) => {
  fireEvent.click(trigger)
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: optionName }))
}

beforeEach(() => {
  mockState.catalog = {}
  mockState.configs = { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
})
afterEach(cleanup)

describe('the date', () => {
  it('is a picker named «Preparation date», never an <input type=date>', () => {
    renderBar()
    expect(document.querySelector('input[type="date"]')).toBeNull()
    expect(screen.getByRole('combobox', { name: /Preparation date/ })).toBeInTheDocument()
    expect(screen.getByText('Preparation date')).toBeInTheDocument()
  })

  it('shows the day in the format of the project, not the ISO one', () => {
    renderBar()
    const picker = screen.getByRole('combobox', { name: /Preparation date/ })
    expect(picker).toHaveTextContent('11-10-2026')
    expect(picker).not.toHaveTextContent('2026-10-11')
  })

  it('follows another format of the project', () => {
    mockState.configs = { dates_general_format: { value: 'MM/DD/YYYY hh:mm a' } }
    renderBar()
    expect(screen.getByRole('combobox', { name: /Preparation date/ })).toHaveTextContent('10/11/2026')
  })

  it('has no «Clear»: there is always a day', async () => {
    renderBar()
    fireEvent.click(screen.getByRole('combobox', { name: /Preparation date/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Select a date' })
    expect(within(dialog).queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('a day picked in the calendar reaches setDay as YYYY-MM-DD', async () => {
    const { setDay } = renderBar()
    fireEvent.click(screen.getByRole('combobox', { name: /Preparation date/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Select a date' })
    fireEvent.click(dialog.querySelector('[data-day="2026-10-14"]'))
    expect(setDay).toHaveBeenCalledWith('2026-10-14')
  })

  it('showDate={false} draws no date at all', () => {
    renderBar({ showDate: false })
    expect(screen.queryByRole('combobox', { name: /Preparation date/ })).toBeNull()
    expect(screen.queryByText('Preparation date')).toBeNull()
    expect(screen.getByText('Grade')).toBeInTheDocument()
    expect(screen.getByText('Classroom')).toBeInTheDocument()
  })
})

describe('grade and classroom', () => {
  it('each has a visible label and starts on «All …»', () => {
    renderBar()
    expect(screen.getByText('Grade')).toBeInTheDocument()
    expect(screen.getByText('Classroom')).toBeInTheDocument()
    expect(triggerOf(/^Grade All grades$/)).toBeInTheDocument()
    expect(triggerOf(/^Classroom All classrooms$/)).toBeInTheDocument()
  })

  it('lists «All grades» first, then the grades; no search box', () => {
    renderBar()
    fireEvent.click(triggerOf(/^Grade/))
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options.map(option => option.textContent.trim())).toEqual(['All grades', 'Grade A', 'Grade B'])
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('shows the grade of the filter', () => {
    renderBar({ gradeId: 2, classroomId: 11 })
    expect(triggerOf(/^Grade Grade B$/)).toBeInTheDocument()
    expect(triggerOf(/^Classroom Room 2$/)).toBeInTheDocument()
  })

  it('choosing «All grades» calls setGradeId(null)', () => {
    const { setGradeId } = renderBar({ gradeId: 2 })
    choose(triggerOf(/^Grade/), 'All grades')
    expect(setGradeId).toHaveBeenCalledTimes(1)
    expect(setGradeId).toHaveBeenCalledWith(null)
  })

  it('choosing a grade calls setGradeId with its id as a number', () => {
    const { setGradeId } = renderBar()
    choose(triggerOf(/^Grade/), 'Grade A')
    expect(setGradeId).toHaveBeenCalledWith(1)
  })

  it('the classroom works the same', () => {
    const { setClassroomId } = renderBar({ classroomId: 10 })
    choose(triggerOf(/^Classroom/), 'All classrooms')
    expect(setClassroomId).toHaveBeenLastCalledWith(null)
    choose(triggerOf(/^Classroom/), 'Room 2')
    expect(setClassroomId).toHaveBeenLastCalledWith(11)
  })

  it('an id that is not among the options shows «All» and changes nothing by itself', () => {
    const { setGradeId, setClassroomId } = renderBar({ gradeId: 99, classroomId: 98 })
    expect(triggerOf(/^Grade All grades$/)).toBeInTheDocument()
    expect(triggerOf(/^Classroom All classrooms$/)).toBeInTheDocument()
    expect(setGradeId).not.toHaveBeenCalled()
    expect(setClassroomId).not.toHaveBeenCalled()
  })

  it('while the lists load (none yet) it still shows «All» and an id waits', () => {
    const { setGradeId } = renderBar({ grades: [], classrooms: [], gradeId: 2 })
    expect(triggerOf(/^Grade All grades$/)).toBeInTheDocument()
    expect(setGradeId).not.toHaveBeenCalled()
  })

  it('takes its words from the catalog', () => {
    mockState.catalog = { SCHOOL_GRADE: 'Grado', SCHOOL_ALL_GRADES: 'Todos los grados', SCHOOL_PREPARATION_DATE: 'Fecha de preparación' }
    renderBar()
    expect(screen.getByText('Fecha de preparación')).toBeInTheDocument()
    expect(triggerOf(/^Grado Todos los grados$/)).toBeInTheDocument()
  })
})

describe('the bar', () => {
  it('is one row that wraps: the class says so', () => {
    renderBar()
    expect(document.querySelector('.odc-school-daybar')).not.toBeNull()
  })
})
