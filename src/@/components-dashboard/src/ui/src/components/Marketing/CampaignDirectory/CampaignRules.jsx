import React, { useEffect, useRef, useState } from 'react'

import { useConfig, useLanguage } from '../../../../../index'
import { Button, DatePicker, DateRangePopover, IconButton, Menu, NumberField, SegmentedControl } from '../../Shared/Product'
import { Calendar, X } from '../../Shared/Icon'
import { RULE_TYPES } from './campaignData'
import { dateSettings, pickerLabels, ruleProblem } from './campaignDraft'
import './campaign-form.css'

// redesign CA-B5 (decision 3; M-CA9): the rules of the audience, in the form, in place of main's four checkboxes that each opened a modal.
// One row per rule (one per type, as today: conditions are keyed by `type`), drawn in the order of RULE_TYPES whatever the order they
// were added in. The list is the DRAFT of the form: a row that is not finished is in it too (and says what it lacks). The host decides
// what the controller gets (only the finished rows, so the audience is counted once per real change, as main did on «Done»).
//
// The shapes written are exactly today's (K/CampaignAmountOption, K/CampaignSignUpOption):
//   count  { type, condition: '>' | '<', value }
//   before { type, date_condition: '<',  date: 'YYYY-MM-DD 00:00:00', max_date: null }
//   range  { type, date_condition: '><', date: 'YYYY-MM-DD 00:00:00', max_date: 'YYYY-MM-DD 00:00:00' }
//
// @param {Array}    props.conditions   The rows.
// @param {Function} props.onChange     `(nextConditions) => void`, called once per user action.
// @param {Function} [props.formatDate] `(stamp) => text`: a stored date in the project format (parseDate); without it the dates are not written.

const OPERATORS = {
  count: [
    { value: '>', label: (t) => t('MORE_THAN', 'More than') },
    { value: '<', label: (t) => t('LESS_THAN', 'Less than') }
  ],
  date: [
    { value: '<', label: (t) => t('BEFORE', 'Before') },
    { value: '><', label: (t) => t('DATE_RANGE', 'Date range') }
  ]
}

// What a row says while it is not finished (not an alert: the host also names it in the footer)
const PROBLEM_TEXT = {
  operator: (t) => t('CAMPAIGNS_RULE_NEEDS_OPERATOR', 'Choose an option'),
  number: (t) => t('CAMPAIGNS_RULE_NEEDS_NUMBER', 'Enter a number'),
  date: (t) => t('CAMPAIGNS_RULE_NEEDS_DATE', 'Pick a date'),
  range: (t) => t('CAMPAIGNS_RULE_NEEDS_RANGE', 'Pick both dates'),
  same_day: (t) => t('MAX_DATE_AFTER_DATE', 'The Max date must be a date after date')
}

const newRule = (rule) => (
  rule.kind === 'count'
    ? { type: rule.type, condition: '>', value: null }
    : { type: rule.type, date_condition: '<', date: null, max_date: null }
)

// redesign CA-R2 (P2): where the focus goes after the list changes. The nodes are found by the type each row carries in `data-rule-type`.
const ruleNodeOf = (root, type) => (
  Array.from(root?.querySelectorAll('[data-rule-type]') || []).find(node => node.getAttribute('data-rule-type') === type) || null
)
// The first control of a rule that is not its remove button: the segmented control (count and date rules)
const firstControlOf = (node) => {
  const head = node?.querySelector('.odc-campaign-rule-head')
  return Array.from(node?.querySelectorAll('button, input') || []).find(control => !head?.contains(control)) || null
}
const removeButtonOf = (node) => node?.querySelector('.odc-campaign-rule-head button') || null

const dayOf = (stamp) => (typeof stamp === 'string' && stamp.length >= 10 ? stamp.slice(0, 10) : null)
const stampOf = (day) => (day ? `${day} 00:00:00` : null)

// A whole number, and never below the minimum of the operator: «less than 0» is cleared (M/CampaignAmountOption:86-92)
const wholeNumber = (value, operator) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  const whole = Math.trunc(value)
  return operator === '<' && whole < 1 ? null : whole
}

const CountRule = ({ condition, t, onPatch }) => {
  const operator = condition.condition
  return (
    <>
      <SegmentedControl
        label={t('CONDITION', 'Condition')}
        value={operator ?? ''}
        onValueChange={(next) => onPatch({ condition: next, value: null })}
        options={OPERATORS.count.map(option => ({ value: option.value, label: option.label(t) }))}
      />
      <NumberField
        aria-label={t('VALUE', 'Value')}
        value={condition.value ?? null}
        min={operator === '<' ? 1 : 0}
        step={1}
        format={{ maximumFractionDigits: 0 }}
        onChange={(next) => onPatch({ value: wholeNumber(next, operator) })}
      />
    </>
  )
}

const DateRule = ({ condition, t, dateFormat, locale, formatDate, onPatch }) => {
  const operator = condition.date_condition
  const from = dayOf(condition.date)
  const to = dayOf(condition.max_date)
  const show = (stamp) => (typeof formatDate === 'function' ? formatDate(stamp) : '')
  const labels = {
    ...pickerLabels(t),
    presets: t('DATE_RANGE', 'Date range'),
    done: t('DONE', 'Done'),
    from: t('FROM', 'From'),
    to: t('TO', 'To'),
    rangeOrder: t('DATE_RANGE_ORDER', 'The start date must not be after the end date.')
  }
  return (
    <>
      <SegmentedControl
        label={t('CONDITION', 'Condition')}
        value={operator ?? ''}
        // switching Before / Date range starts the dates again (K/CampaignSignUpOption `handleChangeOption`)
        onValueChange={(next) => onPatch({ date_condition: next, date: null, max_date: null })}
        options={OPERATORS.date.map(option => ({ value: option.value, label: option.label(t) }))}
      />
      {operator === '<' && (
        <DatePicker
          label={t('DATE', 'Date')}
          labels={pickerLabels(t)}
          dateFormat={dateFormat}
          locale={locale}
          value={from}
          onChange={(day) => onPatch({ date: stampOf(day), max_date: null })}
        />
      )}
      {operator === '><' && (
        <DateRangePopover
          presets={[]}
          presetValue=''
          from={from}
          to={to}
          dateFormat={dateFormat}
          triggerText=''
          empty={!from}
          labels={labels}
          locale={locale}
          align='start'
          onPreset={() => {}}
          onRange={() => {}}
          // a range is a draft until «Done»: the popover never reports it piece by piece
          onApplyRange={(range) => onPatch({ date: stampOf(range.from), max_date: stampOf(range.to) })}
          renderTrigger={({ ref, expanded, toggle }) => (
            <Button ref={ref} icon={Calendar} aria-haspopup='dialog' aria-expanded={expanded} onClick={toggle}>
              {from && to
                ? (
                  <span className='odc-figure'>{show(condition.date)} – {show(condition.max_date)}</span>
                  )
                : from
                  ? (
                    <span className='odc-figure'>{show(condition.date)} – …</span>
                    )
                  : t('CAMPAIGNS_RULE_PICK_RANGE', 'Select dates')}
            </Button>
          )}
        />
      )}
    </>
  )
}

export const CampaignRules = ({ conditions, onChange, formatDate }) => {
  const [languageState, t] = useLanguage()
  const [{ configs } = {}] = useConfig() || []
  const { dateFormat } = dateSettings(configs)
  const locale = languageState?.language?.code
  const [refused, setRefused] = useState(false)
  // redesign CA-R2 (P2): the focus follows the list. `pending` says where it goes once the rows have changed:
  //   { type, control: 'first' }  a rule was added: its first control (the menu hands the focus back to its trigger as it closes, so the
  //                               menu is told where to return it too: `finalFocus`)
  //   { type, control: 'remove' } a rule was removed: the remove button of its neighbor
  //   { control: 'add' }          no rule is left: «Add rule»
  const root = useRef(null)
  const pending = useRef(null)

  const rows = Array.isArray(conditions) ? conditions : []
  const finished = rows.filter(row => !ruleProblem(row)).length

  // The rows in the order of the types; a type this form does not know goes last, so it is still seen (and can be removed)
  const known = RULE_TYPES.map(rule => ({ rule, row: rows.find(item => item.type === rule.type) })).filter(item => item.row)
  const unknown = rows.filter(row => !RULE_TYPES.some(rule => rule.type === row.type)).map(row => ({ rule: null, row }))
  const drawn = [...known, ...unknown]
  const unused = RULE_TYPES.filter(rule => !rows.some(row => row.type === rule.type))

  // Applies `pending` once the rows have changed. A rule that was added is the menu's to focus (`finalFocus`, below: the menu returns the focus
  // to its trigger when its popup is gone, which is after this effect) unless the menu is gone with the last type in use: then there is no
  // trigger to hand the focus back to and this moves it. `menuStays` is the latest render's answer to that.
  const menuStays = useRef(true)
  menuStays.current = unused.length > 0
  useEffect(() => {
    const target = pending.current
    if (!target || (target.control === 'first' && menuStays.current)) return
    pending.current = null
    let node = null
    if (target.control === 'first') node = firstControlOf(ruleNodeOf(root.current, target.type))
    else if (target.control === 'remove') node = removeButtonOf(ruleNodeOf(root.current, target.type))
    else node = root.current?.querySelector('.odc-campaign-rules-add button')
    node?.focus()
  }, [conditions])

  const change = (next) => {
    setRefused(false)
    onChange(next)
  }

  const patch = (type, changes) => change(rows.map(row => (row.type === type ? { ...row, ...changes } : row)))

  const remove = (row) => {
    // main refuses to uncheck the last rule in add mode (M/CampaignDetailGeneral:145-155); a row that is not a rule yet (unfinished)
    // can always go, as cancelling main's modal did
    if (!ruleProblem(row) && finished < 2) {
      setRefused(true)
      return
    }
    // the neighbor that takes its place: the next rule, the previous one if it was the last, «Add rule» if none is left
    const index = drawn.findIndex(item => item.row === row)
    const neighbor = drawn[index + 1] ?? drawn[index - 1]
    pending.current = neighbor ? { type: neighbor.row.type, control: 'remove' } : { control: 'add' }
    change(rows.filter(item => item !== row))
  }

  // The menu closes after a pick and returns the focus to its trigger unless told otherwise: after adding a rule it goes to the new rule
  const finalFocus = () => {
    const target = pending.current
    if (target?.control !== 'first') return true
    if (menuStays.current) pending.current = null // done; when the menu is gone the effect above still needs it
    return firstControlOf(ruleNodeOf(root.current, target.type)) || true
  }

  return (
    <div ref={root} className='odc-campaign-rules'>
      {drawn.length === 0 && (
        <p className='odc-campaign-muted'>{t('CAMPAIGNS_RULES_REQUIRED_EMPTY', 'No rules yet. Add at least one to choose who receives this campaign.')}</p>
      )}
      {drawn.length > 0 && (
        <ul className='odc-campaign-rules-list'>
          {drawn.map(({ rule, row }) => {
            const label = rule ? rule.label(t) : t('CAMPAIGNS_RULE_UNKNOWN', 'Rule')
            const problem = ruleProblem(row)
            const note = problem && Object.prototype.hasOwnProperty.call(PROBLEM_TEXT, problem) ? PROBLEM_TEXT[problem](t) : null
            return (
              <li key={row.type} className='odc-campaign-rule' data-rule-type={row.type}>
                <div role='group' aria-label={label} className='odc-campaign-rule-body' data-incomplete={problem ? '' : undefined}>
                  <div className='odc-campaign-rule-head'>
                    <span className='odc-campaign-rule-name'>{label}</span>
                    <IconButton
                      icon={X}
                      label={t('CAMPAIGNS_RULE_REMOVE', 'Remove rule _rule_').replace('_rule_', () => label)}
                      onClick={() => remove(row)}
                    />
                  </div>
                  {rule?.kind === 'count' && (
                    <CountRule condition={row} t={t} onPatch={(changes) => patch(row.type, changes)} />
                  )}
                  {rule?.kind === 'date' && (
                    <DateRule
                      condition={row}
                      t={t}
                      dateFormat={dateFormat}
                      locale={locale}
                      formatDate={formatDate}
                      onPatch={(changes) => patch(row.type, changes)}
                    />
                  )}
                  {note && (
                    <p className='odc-campaign-rule-note' data-tone={problem === 'same_day' ? 'error' : undefined}>{note}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {refused && (
        <p role='status' className='odc-campaign-rules-refusal'>
          {t('CAMPAIGNS_RULE_LAST_REQUIRED', 'Conditions field is required')}
        </p>
      )}
      {unused.length > 0 && (
        <div className='odc-campaign-rules-add'>
          <Menu
            label={t('CAMPAIGNS_RULES_ADD', 'Add rule')}
            align='start'
            finalFocus={finalFocus}
            items={unused.map(rule => ({
              key: rule.type,
              label: rule.label(t),
              onSelect: () => {
                pending.current = { type: rule.type, control: 'first' }
                change([...rows, newRule(rule)])
              }
            }))}
          />
        </div>
      )}
    </div>
  )
}
