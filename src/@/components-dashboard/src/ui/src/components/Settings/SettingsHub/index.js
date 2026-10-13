import React, { useEffect, useMemo, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { Lightbulb, List as MenuIcon, Search, XCircle } from 'react-bootstrap-icons'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import { useLanguage } from '../../../../../index'
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
import { getSettingsConfigCopy } from '../../../../../utils/settingsCustomSections'
import {
  SETTINGS_HUB_MOBILE_MAX,
  SETTINGS_HUB_PATH,
  buildSettingsPath
} from '../../../../../utils/settingsRedirects'
import { seedSettingsI18n } from '../../../../../utils/settingsI18nSeed'

import { SettingsHubDetail } from './SettingsHubDetail'
import {
  DetailColumn,
  GroupButton,
  GroupHint,
  GroupLabel,
  HubBody,
  HubHeader,
  HubPage,
  HubSubtitle,
  HubTitle,
  HubTitleBlock,
  HeaderActions,
  IconButton,
  ListColumn,
  ListHeading,
  NavColumn,
  SearchClear,
  SearchField,
  SuggestionsButton,
  SectionButton,
  StatusPanel
} from './styles'

const moveIndex = (list, currentKey, delta) => {
  if (!list.length) return currentKey
  const index = Math.max(0, list.findIndex(item => item.key === currentKey))
  const next = (index + delta + list.length) % list.length
  return list[next].key
}

export const SettingsHub = (props) => {
  const {
    categoryLists,
    loadingCategories,
    categoriesError,
    configs
  } = props

  const [, t] = useLanguage()
  seedSettingsI18n(t)
  const history = useHistory()
  const location = useLocation()
  const { width } = useWindowSize()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [searchReady, setSearchReady] = useState(false)

  const isMobile = (width || 1024) <= SETTINGS_HUB_MOBILE_MAX
  const query = new URLSearchParams(location.search)
  const groupKey = query.get('group')
  const categoryKey = query.get('category')
  const searchValue = query.get('q') || ''
  const focus = query.get('focus') || ''
  const view = query.get('view') || ''
  // A category alone is a valid deep link: its group is resolved from the hub
  const showTasks = !searchValue && (view === 'tasks' || (!groupKey && !categoryKey && !focus))

  const hub = useMemo(
    () => buildSettingsHub({ categoryLists, configs }),
    [categoryLists, configs]
  )

  const selection = useMemo(
    () => resolveSettingsHubSelection(hub, { group: groupKey, category: categoryKey }),
    [hub, groupKey, categoryKey]
  )

  const searchResults = useMemo(
    () => searchValue ? searchSettingsHub(hub, searchValue) : [],
    [hub, searchValue]
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

  const selectedGroup = selection.group
  const selectedSection = categoryKey || !isMobile ? selection.section : null
  const showDetail = !showTasks && !searchValue && (!isMobile || !!categoryKey)
  const showList = !isMobile || !categoryKey
  const groupIsCurrent = (group) => {
    if (showTasks) return false
    if (searchValue && !groupKey && !categoryKey) return false
    return selectedGroup?.key === group.key
  }

  const replacePath = ({ group, category, q, focus: nextFocus, view: nextView }) => {
    const next = buildSettingsPath({
      group: group || undefined,
      category: category || undefined,
      q: q || undefined,
      focus: nextFocus || undefined,
      view: nextView || undefined
    })
    if (`${location.pathname}${location.search}` !== next) {
      history.replace(next)
    }
  }

  useEffect(() => {
    if (location.pathname !== SETTINGS_HUB_PATH) return
    if (loadingCategories || !hub.length) return
    if (showTasks) {
      if (groupKey || categoryKey || view || focus) replacePath({})
      return
    }
    if (searchValue) return
    if (!selectedGroup?.key) return
    const staleGroup = groupKey && !hub.some(group => group.key === groupKey)
    if (!groupKey || staleGroup) {
      // Fill in the group but keep every other param (country, city, site, id…)
      const next = new URLSearchParams(location.search)
      next.set('group', selectedGroup.key)
      const nextCategory = isMobile ? categoryKey : (categoryKey || selectedSection?.key)
      if (nextCategory) next.set('category', nextCategory)
      history.replace(`${SETTINGS_HUB_PATH}?${next.toString()}`)
    }
  }, [loadingCategories, hub, groupKey, selectedGroup?.key, showTasks, view])

  const getSectionLabel = (section) => t(
    section.copy?.labelKey,
    section.copy?.label || section.category?.name || section.key
  )

  const getGroupLabel = (key, fallback) => t(
    key ? `SETTINGS_GROUP_${String(key).toUpperCase()}` : '',
    fallback
  )

  const getConfigLabel = (config) => {
    const copy = getSettingsConfigCopy(config)
    return t(copy?.labelKey, copy?.label || config?.name || config?.key)
  }

  const handleGroupSelect = (group) => {
    const first = sortSettingsSections(group.sections, getSectionLabel)[0]
    replacePath({
      group: group.key,
      category: isMobile ? null : first?.key,
      q: searchValue
    })
  }

  const handleSectionSelect = (section, group) => {
    replacePath({
      group: section.groupKey || group?.key || selectedGroup?.key,
      category: section.key,
      q: searchValue
    })
  }

  const handleTaskSelect = (task) => {
    const loc = findSettingsConfigLocation(hub, task.configKey)
    if (!loc) return
    replacePath({
      group: loc.groupKey,
      category: loc.sectionKey,
      q: '',
      focus: loc.configKey
    })
  }

  const handleHitSelect = (hit) => {
    replacePath({
      group: hit.groupKey,
      category: hit.section.key,
      q: '',
      focus: hit.type === 'config' ? hit.config.key : ''
    })
  }

  const handleSearchChange = (value) => {
    if (!value) {
      replacePath({})
      return
    }
    replacePath({
      group: groupKey || undefined,
      category: categoryKey || undefined,
      q: value,
      focus: focus || undefined
    })
  }

  const handleSearchInput = (event) => {
    if (event.nativeEvent?.inputType === 'insertReplacementText') {
      event.target.value = searchValue
      return
    }
    handleSearchChange(event.target.value)
  }

  const handleShowTasks = () => {
    replacePath({})
  }

  const handleGroupKeyDown = (event, group) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const nextKey = moveIndex(hub, group.key, event.key === 'ArrowDown' ? 1 : -1)
      const nextGroup = hub.find(item => item.key === nextKey)
      if (nextGroup) handleGroupSelect(nextGroup)
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleGroupSelect(group)
    }
  }

  const handleSectionKeyDown = (event, section, list, group) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const nextKey = moveIndex(list, section.key, event.key === 'ArrowDown' ? 1 : -1)
      const nextSection = list.find(item => item.key === nextKey)
      if (nextSection) handleSectionSelect(nextSection, group)
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleSectionSelect(section, group)
    }
  }

  const focusTaskButton = (taskKey) => {
    const el = document.querySelector(`[data-hub-task="${taskKey}"]`)
    if (el && typeof el.focus === 'function') {
      el.focus()
    }
  }

  const handleTaskKeyDown = (event, task, list) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const nextKey = moveIndex(list, task.key, event.key === 'ArrowDown' ? 1 : -1)
      focusTaskButton(nextKey)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleTaskSelect(task)
    }
  }

  const handleHitKeyDown = (event, hit, list) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const nextKey = moveIndex(list, hit.key, event.key === 'ArrowDown' ? 1 : -1)
      const nextHit = list.find(item => item.key === nextKey)
      if (nextHit) handleHitSelect(nextHit)
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleHitSelect(hit)
    }
  }

  const listSections = (!searchValue && !showTasks)
    ? sortSettingsSections(selectedGroup?.sections || [], getSectionLabel)
    : []
  const listTitle = searchValue
    ? t('SETTINGS_HUB_SEARCH_RESULTS', 'Search results')
    : showTasks
      ? t('SETTINGS_HUB_TASKS', 'What do you want to do?')
      : t(selectedGroup?.labelKey, selectedGroup?.label)

  if (loadingCategories) {
    return (
      <HubPage>
        <HubHeader>
          <HubTitle>{t('SETTINGS', 'Settings')}</HubTitle>
        </HubHeader>
        <HubBody>
          <NavColumn aria-hidden>
            {[...Array(6)].map((_, index) => (
              <Skeleton key={index} height={48} style={{ marginBottom: 8 }} />
            ))}
          </NavColumn>
          <ListColumn aria-hidden>
            {[...Array(6)].map((_, index) => (
              <Skeleton key={index} height={36} style={{ marginBottom: 8 }} />
            ))}
          </ListColumn>
          <DetailColumn aria-hidden>
            <Skeleton height={220} />
          </DetailColumn>
        </HubBody>
      </HubPage>
    )
  }

  if (categoriesError) {
    return (
      <HubPage>
        <StatusPanel role='alert'>
          {t('SETTINGS_HUB_ERROR', 'Settings could not be loaded. Refresh the page and try again.')}
        </StatusPanel>
      </HubPage>
    )
  }

  return (
    <HubPage>
      <HubHeader>
        <HubTitleBlock>
          {isCollapse && (
            <IconButton
              type='button'
              aria-label={t('MENU', 'Menu')}
              onClick={() => handleMenuCollapse(false)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <div>
            <HubTitle>{t('SETTINGS', 'Settings')}</HubTitle>
            <HubSubtitle>
              {t('SETTINGS_HUB_SUBTITLE', 'Find a setting by task, then edit it on the right.')}
            </HubSubtitle>
          </div>
        </HubTitleBlock>
        <HeaderActions>
          <SuggestionsButton
            type='button'
            active={showTasks}
            aria-pressed={showTasks}
            onClick={handleShowTasks}
            aria-label={t('SETTINGS_HUB_SUGGESTIONS', 'Suggestions')}
          >
            <Lightbulb aria-hidden />
            <span>{t('SETTINGS_HUB_SUGGESTIONS', 'Suggestions')}</span>
          </SuggestionsButton>
          <SearchField>
            <Search aria-hidden />
            <input
              type='text'
              role='searchbox'
              name='settings-search'
              autoComplete='off'
              autoCorrect='off'
              spellCheck={false}
              readOnly={!searchReady}
              value={searchValue}
              onFocus={() => setSearchReady(true)}
              onChange={handleSearchInput}
              placeholder={t('SETTINGS_HUB_SEARCH', 'Search settings')}
              aria-label={t('SETTINGS_HUB_SEARCH', 'Search settings')}
            />
            {searchValue && (
              <SearchClear
                type='button'
                onClick={() => handleSearchChange('')}
                aria-label={t('SETTINGS_HUB_CLEAR_SEARCH', 'Clear search')}
              >
                <XCircle aria-hidden />
              </SearchClear>
            )}
          </SearchField>
        </HeaderActions>
      </HubHeader>

      <HubBody>
        <NavColumn
          aria-label={t('SETTINGS_HUB_GROUPS', 'Setting groups')}
          hiddenOnMobile={!!categoryKey}
        >
          {hub.map(group => (
            <GroupButton
              key={group.key}
              type='button'
              active={groupIsCurrent(group)}
              aria-current={groupIsCurrent(group) ? 'page' : undefined}
              onClick={() => handleGroupSelect(group)}
              onKeyDown={(event) => handleGroupKeyDown(event, group)}
            >
              <GroupLabel>{t(group.labelKey, group.label)}</GroupLabel>
              <GroupHint>{t(group.descriptionKey, group.description)}</GroupHint>
            </GroupButton>
          ))}
        </NavColumn>

        {showList && (
          <ListColumn
            key={searchValue ? 'search' : showTasks ? 'tasks' : `group:${selectedGroup?.key || ''}`}
            aria-label={listTitle}
            hiddenOnMobile={!!categoryKey}
            mobileOnly={isMobile && !categoryKey}
          >
            <ListHeading>{listTitle}</ListHeading>
            {searchValue && !searchHits.length && (
              <StatusPanel>
                {t('SETTINGS_HUB_NO_RESULTS', 'No settings match that search.')}
              </StatusPanel>
            )}
            {showTasks && visibleTasks.map(task => (
              <SectionButton
                key={task.key}
                type='button'
                data-hub-task={task.key}
                onClick={() => handleTaskSelect(task)}
                onKeyDown={(event) => handleTaskKeyDown(event, task, visibleTasks)}
              >
                {t(task.labelKey, task.label)}
              </SectionButton>
            ))}
            {searchHits.map(hit => {
              const isConfig = hit.type === 'config'
              const isActive = selectedSection?.key === hit.section.key && (
                isConfig ? focus === hit.config.key : !focus
              )
              return (
                <SectionButton
                  key={hit.key}
                  type='button'
                  active={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleHitSelect(hit)}
                  onKeyDown={(event) => handleHitKeyDown(event, hit, searchHits)}
                >
                  {isConfig ? getConfigLabel(hit.config) : getSectionLabel(hit.section)}
                  {hit.groupLabel && (
                    <GroupHint>
                      {isConfig
                        ? `${getGroupLabel(hit.groupKey, hit.groupLabel)} › ${getSectionLabel(hit.section)}`
                        : getGroupLabel(hit.groupKey, hit.groupLabel)}
                    </GroupHint>
                  )}
                </SectionButton>
              )
            })}
            {listSections.map(section => (
              <SectionButton
                key={`${section.groupKey || selectedGroup?.key}-${section.key}`}
                type='button'
                active={selectedSection?.key === section.key}
                aria-current={selectedSection?.key === section.key ? 'page' : undefined}
                onClick={() => handleSectionSelect(section, selectedGroup)}
                onKeyDown={(event) => handleSectionKeyDown(event, section, listSections, selectedGroup)}
              >
                {t(section.copy?.labelKey, section.copy?.label)}
              </SectionButton>
            ))}
          </ListColumn>
        )}

        {showDetail && (
          <DetailColumn
            aria-live='polite'
            hiddenOnMobile={!categoryKey}
          >
            <SettingsHubDetail
              section={selectedSection}
              focus={focus || undefined}
              onBack={isMobile
                ? () => replacePath({
                    group: selectedGroup?.key,
                    category: null,
                    q: searchValue,
                    view: view || undefined
                  })
                : null}
            />
          </DetailColumn>
        )}
      </HubBody>
    </HubPage>
  )
}

export default SettingsHub
