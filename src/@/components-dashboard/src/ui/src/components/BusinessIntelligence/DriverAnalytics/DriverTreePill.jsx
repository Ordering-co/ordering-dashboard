import React, { useEffect, useId, useState } from 'react'
import { useLanguage, AnalyticsDriversFilter as AnalyticsDriversFilterController } from '../../../../../index'
import { Checkbox, FilterPopover, IconButton, PopoverFoot, SearchField } from '../../Shared/Product'
import { Bike, ChevronDown, ChevronRight } from '../../Shared/Icon'
import { SkeletonRows, asList, figure, toggled, useSearchTexts } from '../AnalyticsKit/reportPillParts'
import './driver-tree.css'

// redesign drivers FC1 (D5; auditor 1; DR-02, DR-14): the drivers tree of `main` (AnalyticsDriversFilter: a group checks all its
// drivers, and the checks combine: «the group G minus X», «G plus Y») in a Product pill, with the pattern of the pills of
// ReportPeoplePills. The body is the UIComponent of the controller of `main`, used as it is (same propsToFetch as its UI) and mounted
// when the popover opens (the popup unmounts on close), so GET users goes out on each opening, as `main` did with its modal.
//
// Of the controller only `usersList` (`loading`, `users`) and `groupList` (`[{ id, name, children: [users] }]`) are read. Its own
// selection (`userIds`, which opens with everyone checked), «Select All / None» and «Filter» are NOT used: the checks are the ids
// the page holds (`selected`, `[]` = every driver) and each check applies at once (`onSetIds`), so the popover opens with what is
// applied and not with everything checked (DR-02). The fold and the checks are native buttons (DR-14: `main` had `div onClick`).
//
// redesign (row 7, P4): with groups chosen in the Driver group pill (`filterList.driver_groups_ids`) the tree lists only
// those groups and their drivers (see `narrowedByGroups`).
//
// Drivers without a group are not listed (as in `main`: the tree is built from `drivergroups`). Noted, not fixed.
//
// @param {object}   props
// @param {string}   props.label       The pill (and dialog) name.
// @param {*}        props.value       What the pill says of the ids it holds (the bar computes it).
// @param {object}   props.filterList  The page's filters (the controller takes it as a prop).
// @param {number[]} props.selected    The driver ids the page holds (`[]` = all).
// @param {Function} props.onSetIds    `(ids: number[]) => void`: the whole new list, without duplicates.
// @param {Function} props.onClear     `() => void`: «Clear» of the popover.
// @param {Function} props.onLearn     `(kind, [[id, value], …]) => void`.

const POPUP = 'odc-orders-checklist-popup odc-orders-picker-popup'

const fullName = (person) => [person?.name, person?.lastname].filter(Boolean).join(' ')

// Case and accents do not count when searching («jose» finds «José»).
const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase()

// true when every driver of the group is held, 'mixed' when some are, false when none (a group with no driver is false).
const groupState = (children, held) => {
  const count = children.filter(user => held.has(user.id)).length
  if (count === 0) return false
  return count === children.length ? true : 'mixed'
}

// redesign (row 7, P4; D-31): the groups chosen in the Driver group pill narrow the tree to those groups and their drivers, as
// /intelligence/reports narrows its Driver pill (`driversByGroup`). The kit does that in the bar, from the group → drivers memory, and
// hands the kit's own pill `availableDriverIds`; the page's pill is not given it, but this tree already holds each group with its drivers.
// Same rules as the bar: none chosen, or a group chosen that the tree cannot place, leaves it whole (it cannot know that group's drivers).
// A driver applied outside the groups chosen is left applied, as in the reports (the list narrows; the applied ids do not change).
const narrowedByGroups = (groups, chosenIds) => {
  const chosen = new Set(asList(chosenIds).map(String))
  if (chosen.size === 0) return groups
  const known = new Set(groups.map(group => String(group.id)))
  if (![...chosen].every(id => known.has(id))) return groups
  return groups.filter(group => chosen.has(String(group.id)))
}

const DriverTreeBody = ({ label, selected, onSetIds, onClear, onLearn, usersList, groupList, filterList }) => {
  const [, t] = useLanguage()
  const texts = useSearchTexts(label)
  const baseId = useId()
  const [query, setQuery] = useState('')
  const [unfolded, setUnfolded] = useState([])
  const loading = Boolean(usersList?.loading)
  const users = asList(usersList?.users)
  const held = asList(selected)
  const heldSet = new Set(held)
  const needle = normalize(query.trim())
  const searching = needle !== ''

  useEffect(() => {
    if (!loading && users.length > 0) onLearn('drivers', users.map(user => [user.id, fullName(user)]))
  }, [usersList?.users, loading])

  // The groups to paint: all of them, or (searching) those with a driver that matches, with only the drivers that match.
  const groups = narrowedByGroups(asList(groupList), filterList?.driver_groups_ids).map(group => {
    const children = asList(group.children)
    const shown = searching ? children.filter(user => normalize(fullName(user)).includes(needle)) : children
    return { group, children, shown }
  }).filter(({ shown }) => !searching || shown.length > 0)

  const toggleGroup = ({ children }) => {
    const ids = children.map(user => user.id)
    if (groupState(children, heldSet) === true) {
      onSetIds(held.filter(id => !ids.includes(id)))
    } else {
      onSetIds([...held, ...ids.filter((id, index) => !heldSet.has(id) && ids.indexOf(id) === index)])
    }
  }

  const fold = (groupId) => setUnfolded(toggled(unfolded, groupId))

  return (
    <div className='odc-orders-picker odc-bi-picker'>
      <SearchField
        className='odc-orders-picker-search'
        value={query}
        onChange={setQuery}
        label={texts.fieldLabel}
        placeholder={texts.searchLabel}
        clearLabel={texts.clearSearchLabel}
      />
      {loading
        ? <SkeletonRows label={label} />
        : (
          <div className='odc-orders-checklist odc-orders-picker-list odc-bi-tree' role='group' aria-label={label}>
            {groups.map(entry => {
              const { group, children, shown } = entry
              const open = searching || unfolded.includes(group.id)
              const panelId = `${baseId}-group-${group.id}`
              const Chevron = open ? ChevronDown : ChevronRight
              // `main` shows the name of the group on its row, so the toggle says whose drivers it folds (a name, never a glyph)
              const toggleLabel = open
                ? t('DRIVER_REPORTS_HIDE_GROUP_DRIVERS', 'Hide drivers of _group_').replace('_group_', () => group.name ?? '')
                : t('DRIVER_REPORTS_SHOW_GROUP_DRIVERS', 'Show drivers of _group_').replace('_group_', () => group.name ?? '')
              return (
                <div key={group.id} className='odc-bi-tree-group'>
                  <div className='odc-bi-tree-row'>
                    <IconButton
                      icon={Chevron}
                      flipInRtl={!open}
                      size='md' // redesign drivers R1 (F7, decision 12): seen at 32 with the 44x44 area on a phone; `sm` was 28x28
                      className='odc-bi-tree-toggle'
                      label={toggleLabel}
                      aria-expanded={open}
                      aria-controls={panelId}
                      disabled={searching}
                      onClick={() => fold(group.id)}
                    />
                    <Checkbox checked={groupState(children, heldSet)} onCheckedChange={() => toggleGroup(entry)}>
                      <span className='odc-orders-picker-row'>
                        <span className='odc-orders-picker-name'>{group.name ?? ''}</span>
                        <span className='odc-orders-picker-meta'>{figure(children.length)}</span>
                      </span>
                    </Checkbox>
                  </div>
                  <div id={panelId} className='odc-bi-tree-children' role='group' aria-label={group.name} hidden={!open}>
                    {open && shown.map(user => (
                      <Checkbox
                        key={user.id}
                        checked={heldSet.has(user.id)}
                        onCheckedChange={() => onSetIds(toggled(held, user.id))}
                      >
                        <span className='odc-orders-picker-row'>
                          <span className='odc-orders-picker-name'>{fullName(user)}</span>
                        </span>
                      </Checkbox>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          )}
      {!loading && groups.length === 0 && (
        <p className='odc-orders-picker-empty' role='status'>{texts.noResultsLabel}</p>
      )}
      {held.length > 0 && <PopoverFoot onClear={onClear} clearLabel={texts.clearLabel} />}
    </div>
  )
}

export const DriverTreePill = ({ label, value, filterList, selected, onSetIds, onClear, onLearn }) => (
  <FilterPopover icon={Bike} label={label} value={value} priority='secondary' popupClassName={POPUP}>
    <AnalyticsDriversFilterController
      UIComponent={DriverTreeBody}
      propsToFetch={['id', 'name', 'driver_groups']}
      filterList={filterList}
      label={label}
      selected={selected}
      onSetIds={onSetIds}
      onClear={onClear}
      onLearn={onLearn}
    />
  </FilterPopover>
)
