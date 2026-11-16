import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'

import { BuildApps, useApi, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { learnKeys } from '../../../config/constants'
import { learnOptionsValues } from '../../../utils'
import { EmptyState, IconButton, PageHeader, SectionNav, Skeleton } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Menu as MenuIcon } from '../../Shared/Icon'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { AppsUtilities } from '../AppUI/utils'
import { DEFAULT_SECTION, buildSections, groupLabels, visibleSections } from './sections'
import './app-editor.css'

// redesign my-products B2 (; D1, D4, D7): the shell of the editor of an app, in place of `AppLayout` + the Basic / Advanced tabs.
// - Header (D4): the app's name as the one h1, its description and Learn; no «My products» title and no «More settings for your».
// - Navigation (D1): P/SectionNav with the sections this app has (./sections.js), under its captions (Build Apps · App · Look ·
//   Advanced settings, ). The
//   section is in the URL, `?section=`, written with `history.replace` so `id`, the other parameters and the location state stay.
// - Sections (D1): the open one and every one visited before, each in its own `section` with its h2; the others are `hidden` but
//   mounted, so changing section never throws away what was typed. Changing it by the navigation or by a section's `onNavigate(id)`
//   puts the focus on the new h2 (loading the page does not).
// - ONE `BuildApps` for the whole editor (one socket, one load of the businesses, as in main) wraps every section; each receives all its
//   props and `onNavigate`. `appId` there is the app's numeric id; the code of the app (`base.code`) is `appCode`.
// - Loading and error (D7) take the place of the content, under the same header.
// `AppUI` wires `AppsController` and gives this its props (`singleAppState`, `updateAppValues`, `themesList`, `orderingTheme`,
// `advancedValues`, `setAdvancedValues`, `handleUpdateSiteTheme`) and `appId`, which for the controller is the app's code.

// The message of a failed load, whatever shape the controller gave it (text, list of texts or an Error); '' without text.
const messageOf = (error) => {
  const first = Array.isArray(error) ? error[0] : error
  const raw = first instanceof Error ? first.message : first
  return typeof raw === 'string' ? raw : ''
}

// The Learn articles of an app, by its code (the same keys `AppLayout` gave).
const learnKeysOf = (appCode) => (
  appCode === 'app_marketplace_x'
    ? learnKeys?.appLearnKeys
    : appCode === 'app_business_x'
      ? learnKeys?.businessLearnKeys
      : appCode === 'app_driver_x'
        ? learnKeys?.driverLearnKeys
        : []
)

const LoadingContent = () => {
  const [, t] = useLanguage()
  return (
    <div className='odc-ape-skeleton' role='status' aria-busy='true'>
      <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
      <Skeleton size='30%' />
      <Skeleton block='var(--od-x-control-height)' />
      <Skeleton size='30%' />
      <Skeleton block='var(--od-x-control-height-lg)' />
      <Skeleton size='30%' />
      <Skeleton block='var(--od-x-control-height)' />
    </div>
  )
}

// The root and the header, which the editor, its loading and its error share.
const AppEditorFrame = ({ app, appCode, failed, children }) => {
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const { getAppInfo } = AppsUtilities()
  const learnOptions = useMemo(() => learnOptionsValues(learnKeysOf(appCode), t), [appCode, t])

  const name = app?.name
  const description = name ? getAppInfo(app).description : undefined
  // R1-09: the error page of an unknown id has no app and never will, so its h1 is the section's name, not a skeleton that never loads
  const skeleton = (
    <>
      <Skeleton size='40%' block='var(--od-x-control-height-lg)' />
      <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
    </>
  )
  const title = name || (failed ? t('MY_PRODUCTS', 'My products') : skeleton)

  return (
    <div className='odc-root odc-ape'>
      <PageHeader
        leading={isCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
        title={title}
        description={description}
        learn={<LearnDropDown learnOptions={learnOptions} />}
      />
      {children}
    </div>
  )
}

/** The view `BuildApps` draws: the navigation and the sections, with every prop of the controller. */
export const AppEditorView = (props) => {
  const { app, appCode } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const location = useLocation()
  const history = useHistory()
  const isPhone = useIsPhone()
  const baseId = useId()

  const project = ordering?.project
  const sections = useMemo(() => visibleSections(buildSections({ t, app, appCode, project })), [t, app, appCode, project])
  const groups = useMemo(() => groupLabels(t), [t])

  // The section is in the URL; an unknown or hidden one is the first (Builds).
  const requested = new URLSearchParams(location.search).get('section')
  const current = sections.find((section) => section.id === requested) ?? sections.find((section) => section.id === DEFAULT_SECTION) ?? sections[0]

  // The sections visited stay mounted; the open one is always among them (this render, not the next).
  const [visited, setVisited] = useState(() => [current.id])
  const mountedIds = visited.includes(current.id) ? visited : [...visited, current.id]
  useEffect(() => {
    setVisited((ids) => (ids.includes(current.id) ? ids : [...ids, current.id]))
  }, [current.id])

  // Focus goes to the new h2 only when the person asked for the change (navigation or `onNavigate`), never on load or on Back.
  const headings = useRef({})
  const focusNext = useRef(false)
  useEffect(() => {
    if (!focusNext.current) return
    focusNext.current = false
    headings.current[current.id]?.focus()
  }, [current.id])

  const navigate = (id) => {
    const target = sections.find((section) => section.id === id)?.id ?? DEFAULT_SECTION
    if (target === current.id) {
      headings.current[target]?.focus()
      return
    }
    focusNext.current = true
    const next = new URLSearchParams(location.search)
    next.set('section', target)
    history.replace({ pathname: location.pathname, search: `?${next.toString()}`, hash: location.hash, state: location.state })
  }

  return (
    <AppEditorFrame app={app} appCode={appCode}>
      <div className='odc-ape-body' data-layout='split'>
        <div className='odc-ape-nav'>
          <SectionNav
            label={t('BUILDER_APP_SECTIONS', 'App sections')}
            compactLabel={t('BUILDER_APP_SECTIONS', 'App sections')}
            items={sections.map((section) => ({ id: section.id, label: section.label, description: section.description, group: groups[section.group] }))}
            value={current.id}
            onValueChange={navigate}
            selectorOnly={isPhone}
          />
        </div>

        <div className='odc-ape-main'>
          {sections.filter((section) => mountedIds.includes(section.id)).map((section) => {
            const headingId = `${baseId}-${section.id}`
            const SectionComponent = section.Component
            return (
              <section
                key={section.id}
                className='odc-ape-content'
                aria-labelledby={headingId}
                data-section={section.id}
                hidden={section.id !== current.id}
                tabIndex={-1}
              >
                <h2
                  id={headingId}
                  ref={(node) => { headings.current[section.id] = node }}
                  className='odc-ape-title'
                  tabIndex={-1}
                >
                  {section.label}
                </h2>
                <SectionComponent {...props} onNavigate={navigate} />
              </section>
            )
          })}
        </div>
      </div>
    </AppEditorFrame>
  )
}

export const AppEditor = (props) => {
  const { singleAppState, appId: appCode, ...rest } = props
  const [, t] = useLanguage()

  const app = singleAppState?.app
  const failed = singleAppState?.error

  // Loading, no app yet or an error: the header and, in the place of the content, what is true. `BuildApps` is not mounted, as in main
  // (main's basic settings only drew with `!loading`).
  if (failed) {
    return (
      <AppEditorFrame app={app} appCode={appCode} failed>
        <div className='odc-ape-body'>
          <EmptyState
            tone='error'
            title={t('BUILDER_APP_LOAD_FAILED', "We couldn't open this app")}
            description={translateApiMessage(t, messageOf(failed), '')}
          />
        </div>
      </AppEditorFrame>
    )
  }

  if (singleAppState?.loading || !app) {
    return (
      <AppEditorFrame app={app} appCode={appCode}>
        <div className='odc-ape-body'>
          <LoadingContent />
        </div>
      </AppEditorFrame>
    )
  }

  return (
    <BuildApps
      {...rest}
      singleAppState={singleAppState}
      app={app}
      appId={app.id}
      appCode={appCode}
      UIComponent={AppEditorView}
    />
  )
}
