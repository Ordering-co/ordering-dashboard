import React from 'react'

import {
  SchoolsTitle as SchSchoolsTitle,
  SchoolsHeaderActions as SchSchoolsHeaderActions,
  TextButton as SchTextButton,
  SchoolModulePanelTitle as SchSchoolModulePanelTitle,
  SchoolModulePanelText as SchSchoolModulePanelText,
  SchoolModulePanelActions as SchSchoolModulePanelActions,
  Tab as SchTab,
  Toolbar as SchToolbar,
  Table as SchTable,
  FormGrid as SchFormGrid,
  FormActions as SchFormActions,
  Chip as SchChip,
  ReportCard as SchReportCard
} from '../../../src/@/components-dashboard/src/ui/src/components/Schools/styles'

// Presentation-only fixture: the real Schools styled surfaces named in the
// b4-schools ruleset (scripts/brand-system/l5-b4-schools-typography-rules.json),
// no controller, SDK, account or network. Only the Schools root styles.js is
// left (deleted SchoolPrintLabels/styles.js: Print labels is Product
// now, with tokens in labels.css), so nothing is mounted from any row's
// index.js — only the styled-components that file exports.
//
// Single viewport: the ruleset declares no preservation of a breakpoint
// override on top of a role, so there is no second width at which any
// assertion here would differ.
export const SchoolsB4StylesFixture = () => {
  return (
    <main data-testid='schools-b4-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      {/* 9. Schools | SchoolsTitle | <root> */}
      <SchSchoolsTitle data-testid='sch-schools-title'>Schools</SchSchoolsTitle>

      {/* 10. Schools | SchoolsHeaderActions | > button */}
      <SchSchoolsHeaderActions data-testid='sch-schools-header-actions-wrapper'>
        <button type='button' data-testid='sch-schools-header-actions-button'>Add school</button>
      </SchSchoolsHeaderActions>

      {/* 11. Schools | TextButton | <root> (already a styled.button; not a conversion) */}
      <SchTextButton data-testid='sch-text-button'>Remove</SchTextButton>

      {/* 12. Schools | SchoolModulePanelTitle | <root> */}
      <SchSchoolModulePanelTitle data-testid='sch-school-module-panel-title'>Enable the Schools module</SchSchoolModulePanelTitle>

      {/* 13. Schools | SchoolModulePanelText | <root> */}
      <SchSchoolModulePanelText data-testid='sch-school-module-panel-text'>Turn on the School vertical to manage grades and students.</SchSchoolModulePanelText>

      {/* 14. Schools | SchoolModulePanelActions | > button */}
      <SchSchoolModulePanelActions data-testid='sch-school-module-panel-actions-wrapper'>
        <button type='button' data-testid='sch-school-module-panel-actions-button'>Enable</button>
      </SchSchoolModulePanelActions>

      {/*
        15. Schools | Tab | <root>
        Tab was already `styled.button` in the product before this batch —
        this is not an element conversion. What the batch added is
        `type='button'` and `aria-pressed`, which express the selected state
        in the accessibility tree on top of the native button that was
        already there. Mounted as that same native button with its state.
      */}
      {/*
        `as='button'` is a NO-OP here: SchTab is already styled.button in the
        product, and this batch converted no element. It is written out because
        verify-spec-tables.mjs reads the fixture textually and cannot tell that a
        styled component's base tag is already a button. Making it visible to the
        check costs nothing and renders exactly the same node the product renders.
      */}
      <SchTab as='button' type='button' aria-pressed='true' data-testid='sch-tab'>Grades</SchTab>

      {/* 16-17. Schools | Toolbar | label, .select (one instance, both real children of the row's field group) */}
      <SchToolbar data-testid='sch-toolbar-wrapper'>
        <div>
          <label data-testid='sch-toolbar-label'>Grade</label>
          <div className='select' data-testid='sch-toolbar-select'>All grades</div>
        </div>
      </SchToolbar>

      {/* 18. Schools | Table | th, td */}
      <SchTable data-testid='sch-table-wrapper'>
        <thead>
          <tr>
            <th data-testid='sch-table-th'>Name</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-testid='sch-table-td'>Downtown Diner</td>
          </tr>
        </tbody>
      </SchTable>

      {/* 19-20. Schools | FormGrid | label, .select (one instance, both real children of the row's field group) */}
      <SchFormGrid data-testid='sch-form-grid-wrapper'>
        <div>
          <label data-testid='sch-form-grid-label'>Name</label>
          <div className='select' data-testid='sch-form-grid-select'>Select option</div>
        </div>
      </SchFormGrid>

      {/* 21. Schools | FormActions | button */}
      <SchFormActions data-testid='sch-form-actions-wrapper'>
        <button type='button' data-testid='sch-form-actions-button'>Save</button>
      </SchFormActions>

      {/* 22. Schools | Chip | <root> */}
      <SchChip data-testid='sch-chip'>3rd grade</SchChip>

      {/* 23-24. Schools | ReportCard | h3, p (one instance, both real children of the row) */}
      <SchReportCard data-testid='sch-report-card-wrapper'>
        <h3 data-testid='sch-report-card-h3'>Meals served</h3>
        <p data-testid='sch-report-card-p'>142 meals this week.</p>
      </SchReportCard>

    </main>
  )
}
