import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import { ADVANCED_REPORTS, ADVANCED_REPORT_GROUPS, GROUP_TEXTS, REPORT_TEXTS, getAdvancedReport } from '../../../../../utils/advancedReports'
import { todayDay } from '../../../../../utils/dateRange'
import { learnOptionsValues } from '../../../utils/learnOptionsValues'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { ClicksView } from '../EcommerceReports/ClicksView'
import { ReportsCatalog } from './ReportsCatalog'
import { ReportView } from './ReportView'
import { EMPTY_REPORT_NAMES } from '../AnalyticsKit/ReportFilterPills'
import { clearedFilters, filtersFromSearch, filtersToSearch, nextCountryCode, withFilterParams } from './reportFilters'

// redesign reports FC1 (D1, D4; RP-08, RP-11; auditor 7, 16): the page /intelligence/reports, exported as `Reports` as before (`~ui` and
// `src/pages/AdvancedReports` import it; the page wrapper does not change). Two states of one address: the catalog, and a report
// at `?id=<n>`. The router decides which one: `?id` is read on every change of the location (a push from the page, Back, or ⌘K while
// the page is already open), and an id that is none of the 22 shows the catalog and is taken out of the address. Report 22 (Clicks,
// n.º 21) is the clicks view of the old ecommerce page, in this shell: it shares the period, brand, country and zone of the page, and adds the
// channel (`app_id`, the filter the clicks send and no other report has), which lives in `filters` and is never written to the address.
//
// The filters, the country and the day of report 7 live here, while the user is on the page: changing report keeps them (D4); a new
// load starts from the defaults of `main` (AdvancedReports:27-40), or from the params of the address when it has them (D-29, below). The old page of `main` (its side panel and its 21 `Reports*` UIs) is not
// used here.

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export const Reports = () => {
  const history = useHistory()
  const location = useLocation()
  const [, t] = useLanguage()
  const report = getAdvancedReport(new URLSearchParams(location.search).get('id'))
  const currentId = report ? report.id : null

  // redesign (row 3, D-29): a fresh load starts from the period and the filters of the address (each value checked, the invalid
  // ones are the defaults of `main`). After that the state is the page's and the address follows it, never the other way round
  const [start] = useState(() => filtersFromSearch(location.search, todayDay(), browserZone(), report))
  // redesign (n.º 21): `app_id` is the channel of the clicks report ('all' = no filter); the other reports never read it
  const [filters, setFilters] = useState(() => ({ ...start.filters, app_id: 'all' }))
  const [countryCode, setCountryCode] = useState(start.countryCode)
  // redesign reports R1 (Q-01, Q-03): what the filter bar has learned (names of stores, brands, drivers…; the drivers of each group). The bar is
  // mounted again for each report (its country opens by itself, as `main`), so the memory is kept here, with the filters, not in the bar
  const [barNames, setBarNames] = useState(EMPTY_REPORT_NAMES)
  const [scheduleDay, setScheduleDay] = useState(start.scheduleDay)

  // report 7 starts on today each time it opens (as `main`): decided in the render that opens it, so a request for an old day never goes out
  const [openedId, setOpenedId] = useState(currentId)
  if (currentId !== openedId) {
    setOpenedId(currentId)
    if (currentId === 7) setScheduleDay(todayDay())
  }

  // redesign (D-21, option B): the country opens by itself only the first time of the visit. This component stays mounted while the
  // user switches report (the bar is mounted again for each), and a new visit mounts it again, so a ref here is exactly «this visit»
  const countryOpened = useRef(false)

  // the report the user comes back from, for the focus of the catalog
  const lastOpened = useRef(null)
  if (currentId !== null) lastOpened.current = currentId

  // redesign (row 3, D-29): the address carries the period and the filters THAT report uses (from/to or the day of 7, the ids of its
  // pills, the country and a zone that is not the browser's), so a report is shared as it is. It is `replace`, never a push, so Back works as
  // before; the catalog carries none. An `?id` that is not a report is dropped (the catalog is already on screen), and the params that are
  // not filters stay. Changing report (menu, Back, ⌘K) lands here too, so the address is always the one of the report on screen.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.has('id') && !report) params.delete('id')
    const base = params.toString() ? `?${params}` : ''
    const search = withFilterParams(base, report ? filtersToSearch(report, filters, countryCode, scheduleDay, browserZone()) : {})
    if (search === location.search) return
    history.replace({ pathname: location.pathname, search, hash: location.hash })
  }, [location.search, currentId, filters, countryCode, scheduleDay])

  // opening, switching and «All reports» are pushes of the router (not `addQueryToUrl`, which uses `replaceState`): Back works
  const go = (id) => {
    const params = new URLSearchParams(location.search)
    if (id === null) params.delete('id')
    else params.set('id', String(id))
    // the filters of the report left are not the next one's: the effect above writes the right ones with a replace
    const search = withFilterParams(`?${params}`, {})
    history.push({ pathname: location.pathname, search, hash: location.hash })
  }

  // «Switch report» of the clicks view: the 22 of the catalog, in its order (the list `ReportView` builds for itself)
  const switchReports = useMemo(
    () => ADVANCED_REPORT_GROUPS
      .flatMap(group => ADVANCED_REPORTS.filter(item => item.group === group))
      .map(item => ({ id: item.id, name: REPORT_TEXTS[item.id](t).name, groupLabel: GROUP_TEXTS[item.group](t) })),
    [t]
  )

  if (!report) return <ReportsCatalog onOpen={go} restoreFocusId={lastOpened.current} />

  const clearFilters = () => {
    setFilters(current => clearedFilters(current, browserZone()))
    setCountryCode('')
  }
  const changeCode = (code) => setCountryCode(current => nextCountryCode(current, code))

  // redesign (n.º 21): the props are written out (no JSX spread): the brand rulesets read every prop of a JSX element (l6-b3)
  if (report.kind === 'clicks') {
    return (
      <ClicksView
        key={report.id}
        reportId={report.id}
        filters={filters}
        countryCode={countryCode}
        names={barNames}
        onChangeFilters={setFilters}
        onChangeCode={changeCode}
        onChangeNames={setBarNames}
        onClearFilters={clearFilters}
        onBack={() => go(null)}
        onSwitch={(id) => { if (id !== report.id) go(id) }}
        switchReports={switchReports}
        // the Learn of `main`, which lived in «Real time», is in the header of the clicks (ecommerce D4)
        learn={<LearnDropDown learnOptions={learnOptionsValues(['business_reports'], t)} />}
      />
    )
  }

  return (
    <ReportView
      key={report.id}
      report={report}
      filters={filters}
      countryCode={countryCode}
      scheduleDay={scheduleDay}
      names={barNames}
      onChangeFilters={setFilters}
      onChangeCode={changeCode}
      onChangeDay={setScheduleDay}
      onChangeNames={setBarNames}
      countryOpensItself={!countryOpened.current}
      onCountryOpened={() => { countryOpened.current = true }}
      // redesign reports R1 (Q-02, D4): «Clear filters» is the defaults of every filter, the period apart (from, to and the day of 7 stay)
      onClearFilters={clearFilters}
      onBack={() => go(null)}
      onSwitch={(id) => { if (id !== report.id) go(id) }}
    />
  )
}
