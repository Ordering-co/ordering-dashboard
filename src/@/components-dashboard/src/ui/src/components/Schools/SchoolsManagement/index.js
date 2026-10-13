import React, { useState, useEffect } from 'react'
import { List as MenuIcon } from 'react-bootstrap-icons'
import { useApi, useConfig, useLanguage, useSession } from '../../../../../index'
import { listSchools } from '../../../../../components/Schools/schoolApi'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { SpinnerLoader } from '../../Shared'
import { IconButton } from '../../../styles'
import { addQueryToUrl, isDashboardFeatureEnabled, removeQueryToUrl } from '../../../utils'
import { SCHOOL_MODULE_CONFIG_KEY } from '../../../../../utils/dashboardFeatureAccess'
import { SchoolGrades } from '../SchoolGrades'
import { SchoolClassrooms } from '../SchoolClassrooms'
import { SchoolStudents } from '../SchoolStudents'
import { SchoolMealsReports } from '../SchoolMealsReports'
import { SchoolPrintLabels } from '../SchoolPrintLabels'
import { SchoolModuleToggle } from '../SchoolModuleToggle'
import { SchoolModuleDisabledPanel } from '../SchoolModuleDisabledPanel'
import {
  SchoolsContainer, SchoolsHeader, SchoolsTitle, SchoolsHeaderActions, SchoolSelectorWrapper, TabsWrapper, Tab, EmptyState
} from '../styles'

const TABS = [
  { key: 'grades', label: 'Grades', Component: SchoolGrades },
  { key: 'classrooms', label: 'Classrooms', Component: SchoolClassrooms },
  { key: 'students', label: 'Students', Component: SchoolStudents },
  { key: 'meals', label: 'Meals & Reports', Component: SchoolMealsReports },
  { key: 'labels', label: 'Print Labels', Component: SchoolPrintLabels }
]

export const SchoolsManagement = (props) => {
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [{ configs }] = useConfig()
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const getQuery = () => new URLSearchParams(window.location.search)
  const urlTab = getQuery().get('tab')
  const urlPage = parseInt(getQuery().get('page')) || 1

  const [schools, setSchools] = useState([])
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [restoringSchool, setRestoringSchool] = useState(!!getQuery().get('school'))
  const [activeTab, setActiveTab] = useState(TABS.some((tab) => tab.key === urlTab) ? urlTab : 'grades')
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 10, totalPages: 1 })
  const [searchValue, setSearchValue] = useState('')

  const isModuleEnabled = isDashboardFeatureEnabled({ featureKey: 'schools', configs })
  const isAdmin = user?.level === 0
  const moduleConfig = configs?.[SCHOOL_MODULE_CONFIG_KEY]

  useEffect(() => {
    if (!isModuleEnabled) return
    const schoolId = getQuery().get('school')
    if (!schoolId) return
    let mounted = true
    ;(async () => {
      try {
        const { content } = await ordering.businesses(schoolId).asDashboard().select(['id', 'name', 'logo', 'vertical']).get()
        if (mounted && content?.result) setSelectedSchool(content.result)
      } catch (err) {} finally {
        if (mounted) setRestoringSchool(false)
      }
    })()
    return () => { mounted = false }
  }, [isModuleEnabled])

  const handleSelectSchool = (value) => {
    const school = schools.find((s) => s.id === value) || null
    setSelectedSchool(school)
    if (value) addQueryToUrl({ school: value })
    else removeQueryToUrl(['school'])
    removeQueryToUrl(['page'])
  }

  const handleSelectTab = (key) => {
    setActiveTab(key)
    addQueryToUrl({ tab: key })
    removeQueryToUrl(['page'])
  }

  const handleTabPageChange = (page) => {
    if (page > 1) addQueryToUrl({ page })
    else removeQueryToUrl(['page'])
  }

  const handleChangePage = (page) => {
    setPagination((prev) => ({ ...prev, currentPage: page }))
  }

  const handleChangeSearch = (value) => {
    setSearchValue(value || '')
    setPagination((prev) => ({ ...prev, currentPage: 1 }))
  }

  useEffect(() => {
    if (!isModuleEnabled) return
    let mounted = true
    const loadSchools = async () => {
      setLoadingSchools(true)
      try {
        const { error, result, pagination: pag } = await listSchools(ordering, token, {
          page: pagination.currentPage,
          pageSize: pagination.pageSize,
          search: searchValue
        })
        if (!mounted) return
        setSchools(error ? [] : (result || []))
        setPagination((prev) => ({ ...prev, totalPages: pag?.total_pages || 1 }))
      } catch (err) {
        if (mounted) setSchools([])
      } finally {
        if (mounted) setLoadingSchools(false)
      }
    }
    loadSchools()
    return () => { mounted = false }
  }, [isModuleEnabled, pagination.currentPage, pagination.pageSize, searchValue])

  const makeSchoolOption = (school) => ({
    value: school.id,
    showOnSelected: school.name,
    content: <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{school.name}</span>
  })
  const schoolOptions = schools.map(makeSchoolOption)
  if (selectedSchool && !schoolOptions.some((o) => o.value === selectedSchool.id)) {
    schoolOptions.unshift(makeSchoolOption(selectedSchool))
  }
  const ActiveComponent = TABS.find((tab) => tab.key === activeTab)?.Component

  return (
    <SchoolsContainer>
      {isModuleEnabled
        ? (
          <SchoolsHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isCollapse && (
                <IconButton color='black' onClick={() => handleMenuCollapse(false)}>
                  <MenuIcon />
                </IconButton>
              )}
              <SchoolsTitle>{t('SCHOOLS', 'Schools')}</SchoolsTitle>
            </div>
            <SchoolsHeaderActions>
              <SchoolSelectorWrapper>
                <FirstSelect
                  defaultValue={selectedSchool?.id}
                  options={schoolOptions}
                  placeholder={t('SCHOOL_SELECT_SCHOOL', 'Select a school')}
                  isShowSearchBar
                  searchValue={searchValue}
                  handleChangeSearch={handleChangeSearch}
                  isLoading={loadingSchools}
                  pagination={pagination}
                  handleChangePage={handleChangePage}
                  onChange={handleSelectSchool}
                />
              </SchoolSelectorWrapper>
              <SchoolModuleToggle />
            </SchoolsHeaderActions>
          </SchoolsHeader>
          )
        : isCollapse && (
          <IconButton color='black' onClick={() => handleMenuCollapse(false)}>
            <MenuIcon />
          </IconButton>
        )}

      {!isModuleEnabled
        ? <SchoolModuleDisabledPanel config={moduleConfig} isAdmin={isAdmin} />
        : !loadingSchools && schools.length === 0
            ? <EmptyState>{t('SCHOOL_NO_SCHOOLS', 'No schools yet. Create a business with the "School" vertical first.')}</EmptyState>
            : (
              <>
                <TabsWrapper>
                  {TABS.map((tab) => (
                    <Tab
                      key={tab.key}
                      active={activeTab === tab.key}
                      onClick={() => handleSelectTab(tab.key)}
                    >
                      {t(`SCHOOL_TAB_${tab.key.toUpperCase()}`, tab.label)}
                    </Tab>
                  ))}
                </TabsWrapper>

                {selectedSchool
                  ? (ActiveComponent && <ActiveComponent {...props} school={selectedSchool} initialPage={urlPage} onPageChange={handleTabPageChange} />)
                  : restoringSchool
                    ? <SpinnerLoader />
                    : <EmptyState>{t('SCHOOL_SELECT_SCHOOL_PROMPT', 'Select a school to manage its grades, classrooms, students and meals.')}</EmptyState>}
              </>
              )}
    </SchoolsContainer>
  )
}
