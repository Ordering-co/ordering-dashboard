import React, { useEffect, useRef, useState } from 'react'
import { useApi, useConfig, useLanguage, useSession } from '../../../../../index'
import { listSchools } from '../../../../../components/Schools/schoolApi'
import { SCHOOL_VERTICAL } from '../../../../../constants/school'
import { SCHOOL_MODULE_CONFIG_KEY } from '../../../../../utils/dashboardFeatureAccess'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { addQueryToUrl, isDashboardFeatureEnabled, removeQueryToUrl } from '../../../utils'
import { GraduationCap, Menu as MenuIcon, TriangleAlert } from '../../Shared/Icon'
import { Button, EmptyState, IconButton, InlineNotice, PageHeader, Skeleton, TabPanel, Tabs } from '../../Shared/Product'
import { SchoolGrades } from '../SchoolGrades'
import { SchoolClassrooms } from '../SchoolClassrooms'
import { SchoolStudents } from '../SchoolStudents'
import { SchoolMealsReports } from '../SchoolMealsReports'
import { SchoolPrintLabels } from '../SchoolPrintLabels'
import { SchoolModuleToggle } from '../SchoolModuleToggle'
import { SchoolModuleDisabledPanel } from '../SchoolModuleDisabledPanel'
import { SchoolListError } from '../SchoolListError'
import { readRememberedSchool, rememberSchool } from '../rememberedSchool'
import { useSchoolDay } from '../useSchoolDay'
import { useSchoolList } from '../useSchoolList'
import { SchoolPicker } from './SchoolPicker'
import './schools-page.css'

// redesign SC-B5 (decisions 1A, 2A, 3A; M-SC03, M-SC04, M-SC07, M-SC13, M-SC14): the shell of /schools. Page header with the module switch,
// the school picker on its own row, the five tabs (a real tablist) and the states that take their place. The tabs keep the public props of
// main: `school`, `initialPage`, `onPageChange`.

const TAB_COMPONENTS = {
  grades: SchoolGrades,
  classrooms: SchoolClassrooms,
  students: SchoolStudents,
  meals: SchoolMealsReports,
  labels: SchoolPrintLabels
}
const TAB_KEYS = Object.keys(TAB_COMPONENTS)
// redesign (n.º 7, P-1): with no valid ?tab= the page opens on Meals & reports, the daily task; the order of the tabs is unchanged
const DEFAULT_TAB = 'meals'

// main: 10 schools a page in the picker
const SCHOOLS_PAGE_SIZE = 10
const BUSINESS_FIELDS = ['id', 'name', 'logo', 'vertical']

const getQuery = () => new URLSearchParams(window.location.search)

const SchoolsWorkspace = ({ onOpenMenu, isAdmin, ...props }) => {
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [, t] = useLanguage()
  const { clearGroupFilters } = useSchoolDay()

  // the remembered school is per project and user (rememberedSchool.js); the project is the one the API client is set to
  const project = ordering?.project
  const userId = user?.id

  const urlTab = getQuery().get('tab')
  const urlPage = parseInt(getQuery().get('page')) || 1

  // redesign SC-B5 (decision 2A, M-SC04): the school that opens is, in this order, ?school=, the remembered one, the only one there is.
  // The first two are restored with the same request; `restoringSchool` keeps the skeleton up meanwhile so «Select a school…» never flashes.
  const [restore] = useState(() => {
    const fromUrl = getQuery().get('school')
    if (fromUrl) return { id: fromUrl, remembered: false }
    const remembered = readRememberedSchool(project, userId)
    return remembered ? { id: remembered, remembered: true } : null
  })
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [restoringSchool, setRestoringSchool] = useState(!!restore)
  const [activeTab, setActiveTab] = useState(TAB_KEYS.includes(urlTab) ? urlTab : DEFAULT_TAB)
  const [searchValue, setSearchValue] = useState('')
  const [firstList, setFirstList] = useState(null)
  // the person chose a school: nothing that comes back later (the restored one, the only one) opens another over it
  const userChose = useRef(false)
  const autoDecided = useRef(false)

  const list = useSchoolList({
    fetchPage: ({ page, pageSize }) => listSchools(ordering, token, { page, pageSize, search: searchValue }),
    deps: [searchValue],
    pageSize: SCHOOLS_PAGE_SIZE
  })

  const openSchool = (school, { manual }) => {
    if (manual) {
      userChose.current = true
      // redesign SC-B5 (M-SC13): grade, classroom and page belong to the school that is left; the date stays (it is the day, not the school)
      clearGroupFilters()
    }
    setSelectedSchool(school)
    addQueryToUrl({ school: school.id })
    removeQueryToUrl(['page'])
    rememberSchool(project, userId, school.id)
  }

  useEffect(() => {
    if (!restore) return
    let mounted = true
    ;(async () => {
      let business = null
      try {
        const { content } = await ordering.businesses(restore.id).asDashboard().select(BUSINESS_FIELDS).get()
        if (!content?.error && content?.result?.id) business = content.result
      } catch (err) {}
      if (!mounted) return
      // a remembered school that is gone, forbidden or no longer a school is forgotten (a level 2 who lost access gets the API's error here)
      if (restore.remembered && business?.vertical !== SCHOOL_VERTICAL) {
        rememberSchool(project, userId, null)
        business = null
      }
      if (business && !userChose.current) {
        setSelectedSchool(business)
        rememberSchool(project, userId, business.id)
        if (restore.remembered) addQueryToUrl({ school: business.id })
      }
      setRestoringSchool(false)
    })()
    return () => { mounted = false }
  }, [])

  // the first answer of the list without a search: what the single-school rule looks at
  useEffect(() => {
    if (firstList || list.loading || list.error || searchValue !== '') return
    setFirstList({ count: list.items.length, totalPages: list.totalPages, school: list.items[0] })
  }, [list.loading, list.error, list.items, list.totalPages, searchValue, firstList])

  useEffect(() => {
    if (!firstList || restoringSchool || autoDecided.current) return
    autoDecided.current = true
    if (selectedSchool || userChose.current) return
    if (firstList.count === 1 && firstList.totalPages === 1) openSchool(firstList.school, { manual: false })
  }, [firstList, restoringSchool])

  const handleSelectSchool = (value) => {
    if (selectedSchool?.id === value) return
    const school = list.items.find((item) => item.id === value)
    if (school) openSchool(school, { manual: true })
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

  const tabItems = [
    { value: 'grades', label: t('SCHOOL_TAB_GRADES', 'Grades') },
    { value: 'classrooms', label: t('SCHOOL_TAB_CLASSROOMS', 'Classrooms') },
    { value: 'students', label: t('SCHOOL_TAB_STUDENTS', 'Students') },
    { value: 'meals', label: t('SCHOOL_TAB_MEALS', 'Meals & Reports') },
    { value: 'labels', label: t('SCHOOL_TAB_LABELS', 'Print Labels') }
  ]
  const ActiveComponent = TAB_COMPONENTS[activeTab]

  // a search that finds nothing leaves the page as it is (M-SC14); only a project with no schools at all has the empty state
  const hasNoSchools = !list.loading && !list.error && list.items.length === 0 && searchValue === ''

  let body
  if (list.error && !selectedSchool && !restoringSchool) {
    // M-SC03: a failed load is not «No schools yet». With a school open, a failed page of the picker leaves the tab where it is (notice
    // under the picker)
    body = <SchoolListError message={list.error} onRetry={list.reload} />
  } else if (hasNoSchools) {
    body = <EmptyState icon={GraduationCap} title={t('SCHOOL_NO_SCHOOLS', 'No schools yet. Create a business with the "School" vertical first.')} />
  } else {
    body = (
      <Tabs wrap label={t('SCHOOLS', 'Schools')} items={tabItems} value={activeTab} onValueChange={handleSelectTab}>
        <TabPanel value={activeTab} className='odc-school-tabpanel'>
          {selectedSchool
            ? (
              // redesign SC-B5 (M-SC13): one tab per school, so what it held of the other school (rows, dialogs, filters) does not survive
              <ActiveComponent key={selectedSchool.id} {...props} school={selectedSchool} initialPage={urlPage} onPageChange={handleTabPageChange} />
              )
            : restoringSchool
              ? (
                <div className='odc-school-restoring' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
                  <Skeleton size='40%' />
                  <Skeleton />
                  <Skeleton />
                  <Skeleton size='75%' />
                </div>
                )
              : <EmptyState icon={GraduationCap} title={t('SCHOOL_SELECT_SCHOOL_PROMPT', 'Select a school to manage its grades, classrooms, students and meals.')} />}
        </TabPanel>
      </Tabs>
    )
  }

  return (
    <>
      <PageHeader
        leading={onOpenMenu && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={onOpenMenu} />}
        title={t('SCHOOLS', 'Schools')}
        actions={isAdmin ? <SchoolModuleToggle /> : undefined}
      />
      {/* redesign SC-B5 (auditor 9): the picker is not inside PageHeader: there its list would sit under the header's stacking context and,
          at 390, would not drop to its own line */}
      <div className='odc-school-picker'>
        <SchoolPicker
          schools={list.items}
          selectedSchool={selectedSchool}
          loading={list.loading}
          searchValue={searchValue}
          onSearch={(value) => setSearchValue(value || '')}
          page={list.page}
          totalPages={list.totalPages}
          pageSize={SCHOOLS_PAGE_SIZE}
          onChangePage={list.goToPage}
          onSelect={handleSelectSchool}
        />
        {list.error && (selectedSchool || restoringSchool) && (
          <InlineNotice
            tone='danger'
            icon={TriangleAlert}
            action={<Button size='sm' onClick={list.reload}>{t('RETRY', 'Retry')}</Button>}
          >
            {t('SCHOOL_LIST_FAILED', 'The list of schools could not be loaded.')}
          </InlineNotice>
        )}
      </div>
      <div className='odc-school-body'>{body}</div>
    </>
  )
}

export const SchoolsManagement = (props) => {
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const isModuleEnabled = isDashboardFeatureEnabled({ featureKey: 'schools', configs })
  const isAdmin = user?.level === 0
  const openMenu = isCollapse ? () => handleMenuCollapse(false) : undefined

  return (
    <div className='odc-root odc-school-page'>
      {isModuleEnabled
        ? <SchoolsWorkspace {...props} isAdmin={isAdmin} onOpenMenu={openMenu} />
        : (
          <>
            {/* the menu button stays with the module off, as in main; redesign SC-R1 (review r1 #2): and the page keeps its title, so it has
                a heading (P/EmptyState draws its title in a <p>, X-SC5) */}
            <PageHeader
              leading={openMenu && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={openMenu} />}
              title={t('SCHOOLS', 'Schools')}
            />
            <SchoolModuleDisabledPanel config={configs?.[SCHOOL_MODULE_CONFIG_KEY]} isAdmin={isAdmin} />
          </>
          )}
    </div>
  )
}
