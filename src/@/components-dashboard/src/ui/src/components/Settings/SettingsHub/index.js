import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useHistory, useLocation } from 'react-router-dom'

import { useLanguage } from '../../../../../index'
import { isLegacyUpgradeSettingsSection } from '../../../../../utils/legacyPlanUpgradeDestinations'
import { useLegacyPlanUpgrade } from '../../../contexts/LegacyPlanUpgradeContext'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useWindowSize } from '../../../hooks/useWindowSize'
import {
  buildSettingsHub,
  findSettingsConfigLocation,
  listVisibleSettingsTasks,
  resolveSettingsHubSelection,
  searchSettingsHub,
  sortSettingsSections
} from '../../../../../utils/settingsIa'
import { getSettingsBlockFieldName, getSettingsConfigCopy } from '../../../../../utils/settingsCustomSections'
import {
  SETTINGS_HUB_MOBILE_MAX,
  SETTINGS_HUB_PATH,
  buildSettingsPath,
  resolveSettingsCategoryAlias
} from '../../../../../utils/settingsRedirects'
import { seedSettingsI18n } from '../../../../../utils/settingsI18nSeed'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  SearchField,
  SectionNav,
  Skeleton
} from '../../Shared/Product'
import { ChevronLeft, Lightbulb, Menu as MenuIcon } from '../../Shared/Icon'

import { SettingsHubDetail } from './SettingsHubDetail'
import { HubOverview } from './HubOverview'
import { useSettingsHubGuard } from './useSettingsHubGuard'
import { HubPage, ListColumn } from './styles'
import './settings-hub.css'

// redesign settings A: the hub shell. Two columns, the navigation (P/SectionNav with the groups folded, their
// description always in view) and the content (the open section, or the landing); on the phone one screen at a time.

// Params of the editors inside a section (Developers panels, Sites, Multi-country…). Typing in the search keeps them while
// the section stays the same (before, `replacePath` dropped them and closed the open panel).
const EDITOR_PARAMS = ['id', 'site', 'country', 'city', 'page', 'pageSize']
const OVERVIEW_SECTIONS_PER_GROUP = 3

const navId = (groupKey, sectionKey) => `${groupKey}/${sectionKey}`

export const SettingsHub = (props) => {
  const {
    categoryLists,
    loadingCategories,
    categoriesError,
    configs,
    onRetry
  } = props

  const [, t] = useLanguage()
  seedSettingsI18n(t)
  const history = useHistory()
  const { upgradeRequired, upgradePending, requestUpgrade } = useLegacyPlanUpgrade()
  const location = useLocation()
  const { width } = useWindowSize()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  // The input is the browser's autofill target: see `attachSearchInput`
  const searchNodeRef = useRef(null)
  const ignoreNextChangeRef = useRef(false)
  const lastPendingRef = useRef(null)
  // whether the phone section on screen was pushed from the list by this hub (a ref, not `location.state`: the
  // editors inside a section replace the URL without state)
  const pushedSectionRef = useRef(false)
  // the list column, and the section the phone is showing, to hand the focus back when it returns to the list
  const listColumnRef = useRef(null)
  const phoneOriginRef = useRef(null)

  const isMobile = (width || 1024) <= SETTINGS_HUB_MOBILE_MAX
  const query = new URLSearchParams(location.search)
  const groupKey = query.get('group')
  const categoryKey = query.get('category')
  const searchValue = query.get('q') || ''
  const focus = query.get('focus') || ''
  const view = query.get('view') || ''
  // A category alone is a valid deep link: its group is resolved from the hub.
  // redesign settings A: the landing also shows beside a search that has opened nothing.
  const hasSelection = !!(groupKey || categoryKey || focus)
  const showOverview = !hasSelection || (view === 'tasks' && !searchValue)

  const hub = useMemo(
    () => buildSettingsHub({ categoryLists, configs }),
    [categoryLists, configs]
  )

  const selection = useMemo(
    () => resolveSettingsHubSelection(hub, { group: groupKey, category: categoryKey }),
    [hub, groupKey, categoryKey]
  )

  const searchResults = useMemo(
    () => searchValue ? searchSettingsHub(hub, searchValue, { t }) : [],
    [hub, searchValue, t]
  )

  const visibleTasks = useMemo(
    () => listVisibleSettingsTasks(hub),
    [hub]
  )

  const searchHits = useMemo(
    () => searchResults.map(hit => ({
      ...hit,
      key: hit.type === 'config'
        ? `config:${hit.groupKey}:${hit.section.key}:${hit.config.key}`
        : `section:${hit.groupKey}:${hit.section.key}`
    })),
    [searchResults]
  )

  // Where the focused config lives, when the section on screen does not hold it. On the phone a valid group alone is the list
  // of its sections, so nothing moves there.
  const focusRelocation = useMemo(() => {
    if (!focus || !hub.length) return null
    if (selection.section?.category?.configs?.some(config => config.key === focus)) return null
    if (isMobile && !categoryKey && groupKey && hub.some(group => group.key === groupKey)) return null
    return findSettingsConfigLocation(hub, focus)
  }, [hub, selection, focus, categoryKey, groupKey, isMobile])

  const selectedGroup = selection.group
  // The phone opens a section only with an explicit `category`; the desktop always has one open once something is selected.
  const sectionOpen = !showOverview && (!isMobile || !!categoryKey)
  const selectedSection = sectionOpen ? selection.section : null
  const phoneSection = isMobile && sectionOpen
  // Back on the list (system Back, back row, Suggestions…): the next section opened from it is a new push
  useEffect(() => {
    if (!phoneSection) pushedSectionRef.current = false
  }, [phoneSection])

  // back on the phone's list (the back row, the system Back…) the focus the removed screen held would fall to
  // `body`. It goes to the row of the section the user came from, or to its group's row; an element that already holds the
  // focus keeps it. The origin follows the section on screen: on a deep link the first render has no catalog yet, and its
  // provisional group is not the one the user comes back from.
  useEffect(() => {
    if (phoneSection) phoneOriginRef.current = { groupKey: selectedGroup?.key, sectionKey: selectedSection?.key }
  }, [phoneSection, selectedGroup?.key, selectedSection?.key])

  useEffect(() => {
    if (phoneSection) return
    const origin = phoneOriginRef.current
    phoneOriginRef.current = null
    if (!origin || !isMobile) return
    const active = document.activeElement
    if (active && active !== document.body) return
    const rows = [...(listColumnRef.current?.querySelectorAll('button[data-row-id]') || [])]
    const isOriginRow = (rowId) => rowId === navId(origin.groupKey, origin.sectionKey) ||
      rowId === `section:${origin.groupKey}:${origin.sectionKey}` ||
      rowId.startsWith(`config:${origin.groupKey}:${origin.sectionKey}:`)
    const target = rows.find(row => row.dataset.kind === 'section' && isOriginRow(row.dataset.rowId)) ||
      rows.find(row => row.dataset.kind === 'group' && row.dataset.rowId === origin.groupKey)
    target?.focus()
  }, [phoneSection])

  const replacePath = ({ group, category, q, focus: nextFocus, view: nextView }, { keepEditor = false } = {}) => {
    const base = buildSettingsPath({
      group: group || undefined,
      category: category || undefined,
      q: q || undefined,
      focus: nextFocus || undefined,
      view: nextView || undefined
    })
    let next = base
    if (keepEditor && (group || category)) {
      const extras = new URLSearchParams()
      EDITOR_PARAMS.forEach(name => {
        if (query.has(name)) extras.set(name, query.get(name))
      })
      const tail = extras.toString()
      if (tail) next = `${base}${base.includes('?') ? '&' : '?'}${tail}`
    }
    if (`${location.pathname}${location.search}` !== next) {
      // (settings P-7): on the phone, opening a section from the list is its own history entry, so the system
      // Back returns to the list, and the back row pops that same entry.
      if (isMobile && !phoneSection && category) {
        pushedSectionRef.current = true
        history.push(next)
      } else {
        history.replace(next)
      }
    }
  }

  useEffect(() => {
    if (location.pathname !== SETTINGS_HUB_PATH) return
    // without the catalog (loading, or failed) the hub holds only the special screens, so no group or category in
    // the URL can be judged stale: it is left as it came.
    if (loadingCategories || categoriesError || !hub.length) return
    if (showOverview) {
      if (!searchValue && (groupKey || categoryKey || view || focus)) replacePath({})
      return
    }
    // (row #2): `?focus=<config key>` opens the section that holds the key. Without a category (or with one that
    // does not hold it) the URL is normalised, like the other redirects; an unknown key keeps today's behaviour.
    if (focusRelocation) {
      history.replace(buildSettingsPath({
        group: focusRelocation.groupKey,
        category: focusRelocation.sectionKey,
        q: searchValue || undefined,
        focus
      }))
      return
    }
    // the URL names the group and section the hub really opens. A category that opens nothing is renamed when
    // it moved (`basic_maps` -> `google_maps`) or dropped from the URL; one that opens a section of another group takes
    // that group. Every other param (country, city, site, id…) stays.
    if (categoryKey) {
      const matched = selection.section && (selection.section.key === categoryKey || String(selection.section.id) === String(categoryKey))
      const next = new URLSearchParams(location.search)
      if (!matched) {
        const alias = resolveSettingsCategoryAlias(categoryKey)
        const moved = alias && resolveSettingsHubSelection(hub, { category: alias })
        if (moved?.section?.key === alias) {
          next.set('group', moved.group.key)
          next.set('category', alias)
        } else {
          next.delete('category')
        }
        history.replace(`${SETTINGS_HUB_PATH}?${next.toString()}`)
        return
      }
      if (selection.group?.key && groupKey !== selection.group.key) {
        next.set('group', selection.group.key)
        history.replace(`${SETTINGS_HUB_PATH}?${next.toString()}`)
        return
      }
    }
    if (!selectedGroup?.key) return
    const staleGroup = groupKey && !hub.some(group => group.key === groupKey)
    if (!groupKey || staleGroup) {
      // Fill in the group but keep every other param (country, city, site, id…)
      const next = new URLSearchParams(location.search)
      next.set('group', selectedGroup.key)
      const nextCategory = isMobile ? categoryKey : (categoryKey || selection.section?.key)
      if (nextCategory) next.set('category', nextCategory)
      history.replace(`${SETTINGS_HUB_PATH}?${next.toString()}`)
    }
  }, [loadingCategories, categoriesError, hub, groupKey, categoryKey, selectedGroup?.key, showOverview, view, focus, focusRelocation])

  const getSectionLabel = (section) => t(
    section.copy?.labelKey,
    section.copy?.label || section.category?.name || section.key
  )

  const getGroupLabel = (key, fallback) => t(
    key ? `SETTINGS_GROUP_${String(key).toUpperCase()}` : '',
    fallback
  )

  // redesign (owner decision 32 A): the name the section shows, the cell's one for a custom block's cell
  const getConfigLabel = (config) => {
    const blockName = getSettingsBlockFieldName(config, t)
    if (blockName) return blockName
    const copy = getSettingsConfigCopy(config)
    return t(copy?.labelKey, copy?.label || config?.name || config?.key)
  }

  const requestSectionUpgrade = (key, proceed) => isLegacyUpgradeSettingsSection(key) && requestUpgrade(undefined, proceed)
  const selectSection = (params, options) => {
    const select = () => replacePath(params, options)
    if (!requestSectionUpgrade(params.category, select)) select()
  }

  const handleGroupSelect = (group) => {
    const first = sortSettingsSections(group.sections, getSectionLabel)
      .find(section => !upgradeRequired || !isLegacyUpgradeSettingsSection(section.key))
    selectSection({
      group: group.key,
      category: isMobile ? null : first?.key || group.sections[0]?.key,
      q: searchValue
    })
  }

  const handleSectionSelect = (section, group) => {
    selectSection({
      group: section.groupKey || group?.key || selectedGroup?.key,
      category: section.key,
      q: searchValue
    })
  }

  const handleTaskSelect = (task) => {
    const loc = findSettingsConfigLocation(hub, task.configKey)
    if (!loc) return
    selectSection({
      group: loc.groupKey,
      category: loc.sectionKey,
      q: '',
      focus: loc.configKey
    })
  }

  // redesign settings A (decision 2A): opening a result keeps the search; the section shows beside it.
  const handleHitSelect = (hit) => {
    selectSection({
      group: hit.groupKey,
      category: hit.section.key,
      q: searchValue,
      focus: hit.type === 'config' ? hit.config.key : ''
    }, { keepEditor: selectedSection?.key === hit.section.key })
  }

  // Typing keeps the open section and its editor params; clearing keeps group, category and focus (with nothing open it is
  // the landing again, as before).
  const handleSearchChange = (value) => {
    replacePath({
      group: groupKey || undefined,
      category: categoryKey || undefined,
      q: value || undefined,
      focus: focus || undefined
    }, { keepEditor: true })
  }

  const handleSearchChangeGuarded = (value) => {
    // The browser's «fill» is not typing: it is dropped, and the field keeps what the URL says.
    if (ignoreNextChangeRef.current) {
      ignoreNextChangeRef.current = false
      if (searchNodeRef.current) searchNodeRef.current.value = searchValue
      return
    }
    handleSearchChange(value)
  }

  const handleShowTasks = () => {
    replacePath({})
  }

  const handleBack = () => {
    if (phoneSection && pushedSectionRef.current) {
      history.goBack()
      return
    }
    replacePath({
      group: selectedGroup?.key,
      category: null,
      q: searchValue,
      view: view || undefined
    })
  }

  // The current section row does nothing in P/SectionNav; the hub's row always reset the section (it dropped `focus`), so
  // pressing it still does.
  const handleNavClick = (event) => {
    const row = event.target.closest?.('[data-kind="section"][data-current]')
    if (row && selectedSection) handleSectionSelect(selectedSection, selection.group)
  }

  const attachSearchInput = useCallback((node) => {
    searchNodeRef.current = node
    if (!node) return
    // P/SearchField draws a type=search input and keeps its attributes to itself. The hub's field is the one Chrome fills
    // with a saved email, so it keeps the hardening it had: a plain text box named for what it is, read-only until the
    // first focus (see the `onFocus` of the field), no autocorrect.
    node.setAttribute('type', 'text')
    node.setAttribute('role', 'searchbox')
    node.setAttribute('name', 'settings-search')
    node.setAttribute('autocorrect', 'off')
    node.setAttribute('spellcheck', 'false')
    node.readOnly = true
  }, [])

  // redesign settings A (decision 5): the discard guard. Reads the section on screen at interception time.
  const getLocationSectionKey = (next) => {
    if (next.pathname !== SETTINGS_HUB_PATH) return null
    const params = new URLSearchParams(next.search)
    const nextGroup = params.get('group')
    const nextCategory = params.get('category')
    if (!nextGroup && !nextCategory && !params.get('focus')) return null
    if (params.get('view') === 'tasks' && !params.get('q')) return null
    if (isMobile && !nextCategory) return null
    return resolveSettingsHubSelection(hub, { group: nextGroup, category: nextCategory }).section?.key || null
  }
  const guard = useSettingsHubGuard({
    history,
    getCurrentSectionKey: () => selectedSection?.key || null,
    getCurrentSectionLabel: () => (selectedSection ? getSectionLabel(selectedSection) : ''),
    getLocationSectionKey
  })
  if (guard.pending) lastPendingRef.current = guard.pending

  const nav = useMemo(() => {
    const lookup = new Map()
    const items = hub.flatMap(group => sortSettingsSections(group.sections, getSectionLabel).map(section => {
      const id = navId(group.key, section.key)
      lookup.set(id, { section, group })
      return { id, label: getSectionLabel(section), group: group.key }
    }))
    return { items, lookup }
  }, [hub, t])

  const handleNavSectionSelect = (id) => {
    const entry = nav.lookup.get(id)
    if (entry) handleSectionSelect(entry.section, entry.group)
  }

  const handleNavGroupSelect = (id) => {
    const group = hub.find(item => item.key === id)
    if (group) handleGroupSelect(group)
  }

  const handleHitNavSelect = (id) => {
    const hit = searchHits.find(item => item.key === id)
    if (hit) handleHitSelect(hit)
  }

  const handleTaskSelectByKey = (taskKey) => {
    const task = visibleTasks.find(item => item.key === taskKey)
    if (task) handleTaskSelect(task)
  }

  const handleOverviewSection = (nextGroupKey, sectionKey) => {
    selectSection({ group: nextGroupKey, category: sectionKey, q: searchValue })
  }

  const handleOverviewGroup = (nextGroupKey) => {
    const group = hub.find(item => item.key === nextGroupKey)
    if (group) handleGroupSelect(group)
  }

  const groupText = (group) => t(group.labelKey, group.label)

  if (loadingCategories) {
    return (
      <HubPage aria-busy='true'>
        <header className='odc-root odc-hub-header'>
          <h1 className='odc-hub-title'>{t('SETTINGS', 'Settings')}</h1>
        </header>
        <span className='odc-sr-only' role='status'>{t('LOADING', 'Loading')}</span>
        <div className='odc-hub-body' data-phone={isMobile ? '' : undefined}>
          <div className='odc-root odc-hub-skeleton-nav'>
            {[...Array(6)].map((_, index) => (
              <Skeleton key={index} block='var(--od-x-control-height-lg)' />
            ))}
          </div>
          {!isMobile && (
            <div className='odc-root odc-hub-skeleton-content'>
              <Skeleton size='var(--od-x-record-nav)' block='var(--od-x-control-height-lg)' />
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} block='var(--od-x-control-height)' />
              ))}
            </div>
          )}
        </div>
      </HubPage>
    )
  }

  if (categoriesError) {
    // redesign settings A (decision 9): «Retry» when the AllSettings wrapper passes
    // `onRetry` (it mounts the controller again); without it the text stands alone.
    return (
      <HubPage>
        <EmptyState
          tone='error'
          title={t('SETTINGS_HUB_ERROR', 'Settings could not be loaded. Refresh the page and try again.')}
          action={onRetry ? <Button onClick={onRetry}>{t('RETRY', 'Retry')}</Button> : undefined}
        />
      </HubPage>
    )
  }

  const navValue = selectedSection && selection.group ? navId(selection.group.key, selectedSection.key) : undefined
  const openGroups = !showOverview && selectedGroup ? [selectedGroup.key] : []

  const hitItems = searchHits.map(hit => {
    const isConfig = hit.type === 'config'
    return {
      id: hit.key,
      label: isConfig ? getConfigLabel(hit.config) : getSectionLabel(hit.section),
      description: hit.groupLabel
        ? (isConfig
            ? `${getGroupLabel(hit.groupKey, hit.groupLabel)} › ${getSectionLabel(hit.section)}`
            : getGroupLabel(hit.groupKey, hit.groupLabel))
        : undefined
    }
  })
  const activeHit = selectedSection
    ? searchHits.find(hit => selectedSection.key === hit.section.key && (
      hit.type === 'config' ? focus === hit.config.key : !focus
    ))
    : null

  const resultsCount = searchHits.length === 1
    ? t('SETTINGS_HUB_RESULTS_ONE', '1 result')
    : t('SETTINGS_HUB_RESULTS_OTHER', '_count_ results').replace('_count_', searchHits.length)

  const overviewTasks = visibleTasks.map(task => ({ key: task.key, label: t(task.labelKey, task.label) }))
  const overviewGroups = showOverview && !isMobile
    ? hub.map(group => {
      const sorted = sortSettingsSections(group.sections, getSectionLabel)
      const moreCount = Math.max(0, sorted.length - OVERVIEW_SECTIONS_PER_GROUP)
      return {
        key: group.key,
        label: groupText(group),
        description: t(group.descriptionKey, group.description),
        sections: sorted.slice(0, OVERVIEW_SECTIONS_PER_GROUP).map(section => ({
          key: section.key,
          label: getSectionLabel(section)
        })),
        moreCount,
        moreLabel: t('SETTINGS_HUB_MORE_SECTIONS', '+_count_').replace('_count_', moreCount)
      }
    })
    : []
  const overviewTitle = t('SETTINGS_HUB_TASKS', 'What do you want to do?')

  const backLabel = searchValue
    ? t('SETTINGS_HUB_BACK_TO_RESULTS', 'Search results')
    : (selection.group ? groupText(selection.group) : t('SETTINGS_HUB_BACK', 'Back to settings'))

  const dialogPending = guard.pending || lastPendingRef.current
  const discardText = guard.saving
    ? t('SETTINGS_DISCARD_SAVING', 'Your changes are still saving. If you leave, some may not be saved.')
    : t('SETTINGS_DISCARD_DESCRIPTION', 'You have unsaved changes in _section_. If you leave, they are lost.')
      .replace('_section_', dialogPending?.sectionLabel || '')

  return (
    <HubPage>
      {/* redesign settings A: the header (Suggestions, search, menu) stays on the phone's section screen, as in main */}
      <header className='odc-root odc-hub-header'>
        <div className='odc-hub-title-block'>
          {isCollapse && (
            <IconButton
              icon={MenuIcon}
              label={t('MENU', 'Menu')}
              onClick={() => handleMenuCollapse(false)}
            />
          )}
          <div>
            <h1 className='odc-hub-title'>{t('SETTINGS', 'Settings')}</h1>
            <p className='odc-hub-subtitle'>
              {t('SETTINGS_HUB_SUBTITLE_TEXT', 'Find a setting by task, then select it to edit.')}
            </p>
          </div>
        </div>
        <div className='odc-hub-actions'>
          <Button
            icon={Lightbulb}
            aria-pressed={showOverview && !searchValue}
            aria-label={t('SETTINGS_HUB_SUGGESTIONS', 'Suggestions')}
            onClick={handleShowTasks}
          >
            <span className='odc-hub-suggestions-label'>{t('SETTINGS_HUB_SUGGESTIONS', 'Suggestions')}</span>
          </Button>
          <SearchField
            className='odc-hub-search'
            value={searchValue}
            onChange={handleSearchChangeGuarded}
            inputRef={attachSearchInput}
            label={t('SETTINGS_HUB_SEARCH', 'Search settings')}
            placeholder={t('SETTINGS_HUB_SEARCH', 'Search settings')}
            clearLabel={t('SETTINGS_HUB_CLEAR_SEARCH', 'Clear search')}
            onInputCapture={(event) => {
              ignoreNextChangeRef.current = event.nativeEvent?.inputType === 'insertReplacementText'
            }}
            onFocus={() => {
              if (searchNodeRef.current) searchNodeRef.current.readOnly = false
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && searchValue) {
                event.preventDefault()
                handleSearchChange('')
              }
            }}
          />
        </div>
      </header>

      <div className='odc-hub-body' data-phone={isMobile ? '' : undefined}>
        {!phoneSection && (
          <ListColumn ref={listColumnRef} className='odc-root odc-hub-nav-col'>
            {searchValue && (
              <div className='odc-hub-results'>
                {searchHits.length === 0
                  ? <p className='odc-hub-results-empty'>{t('SETTINGS_HUB_NO_RESULTS', 'No settings match that search.')}</p>
                  : (
                    <>
                      <p className='odc-hub-results-count' aria-live='polite'>{resultsCount}</p>
                      <SectionNav
                        label={t('SETTINGS_HUB_SEARCH_RESULTS', 'Search results')}
                        compactLabel={t('SETTINGS_HUB_SEARCH_RESULTS', 'Search results')}
                        items={hitItems}
                        value={activeHit?.key}
                        onValueChange={handleHitNavSelect}
                        listOnly
                        activateOnFocus={!upgradeRequired && !upgradePending} // Upgrade prompts need explicit selection
                      />
                    </>
                    )}
              </div>
            )}
            {/* apply-list row 44 (settings P-2, D-65): while searching, the results take the place of the groups (spaces only are no
                search: review J4 #3) */}
            {!searchValue.trim() && <div onClick={handleNavClick}>
              <SectionNav
                label={t('SETTINGS_HUB_GROUPS', 'Setting groups')}
                compactLabel={t('SETTINGS_HUB_GROUPS', 'Setting groups')}
                groups={hub.map(group => ({
                  id: group.key,
                  label: groupText(group),
                  // apply-list row 44 (settings P-1, D-65): only the open group carries its description. The landing keeps them all:
                  // the desktop in its group cards (HubOverview), the phone in this list (it has no cards: its navigation is the landing)
                  description: openGroups.includes(group.key) || (isMobile && showOverview)
                    ? t(group.descriptionKey, group.description)
                    : undefined
                }))}
                items={nav.items}
                value={navValue}
                openGroups={openGroups}
                onGroupSelect={handleNavGroupSelect}
                onValueChange={handleNavSectionSelect}
                listOnly
                activateOnFocus={!upgradeRequired && !upgradePending} // Upgrade prompts need explicit selection
              />
            </div>}
            {isMobile && showOverview && (
              <HubOverview
                title={overviewTitle}
                tasks={overviewTasks}
                onTaskSelect={handleTaskSelectByKey}
                onSectionSelect={handleOverviewSection}
                onGroupSelect={handleOverviewGroup}
              />
            )}
          </ListColumn>
        )}

        {(!isMobile || phoneSection) && (
          <div className='odc-hub-content'>
            {phoneSection && (
              <Button variant='ghost' icon={ChevronLeft} className='odc-hub-back' onClick={handleBack}>
                {backLabel}
              </Button>
            )}
            {showOverview
              ? (
                <HubOverview
                  title={overviewTitle}
                  tasks={overviewTasks}
                  groups={overviewGroups}
                  onTaskSelect={handleTaskSelectByKey}
                  onSectionSelect={handleOverviewSection}
                  onGroupSelect={handleOverviewGroup}
                />
                )
              : (
                <div className='odc-hub-detail'>
                  <SettingsHubDetail
                    section={selectedSection}
                    groupLabel={!isMobile && selection.group ? groupText(selection.group) : undefined}
                    focus={focus || undefined}
                    focusHeading={isMobile}
                    report={guard.report}
                  />
                </div>
                )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!guard.pending}
        title={t('SETTINGS_DISCARD_TITLE', 'Discard your changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        tone='danger'
        onConfirm={guard.discard}
        onCancel={guard.keepEditing}
      >
        {discardText}
      </ConfirmDialog>
    </HubPage>
  )
}

export default SettingsHub
