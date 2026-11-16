import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { AsyncSwitch, Button, DataTable, EmptyState, RecordCardList, SearchField } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Plus, Search, TriangleAlert } from '../../Shared/Icon'
import { BANNER_POSITIONS, POSITION_GROUPS, positionsOfGroup, usePositionText } from './bannerPositions'
import './ad-banners.css'

// redesign AB-B2 (decision 1; defects M-AB06, M-AB13 list, M-AB15, M-AB16, M-AB21, M-AB26): the banners as one list grouped by position,
// Web and App with their three positions each (main drew six cards that opened a panel per position). It draws what the host gives
// it (`banners`, `loading`, `error`, `search`, the open banner, the switch from useBannerEnabledToggle); it fetches nothing and owns
// no panel or dialog. What changes against `main`: every position is on the page with its size and description in view (not in a
// tooltip), each with its own «Add banner»; the search is by name in ALL positions (main had it in the two «Business page» ones);
// the switch is an AsyncSwitch, so a failed change goes back and says why; a failed load shows its error with «Retry».
//
// Props: banners (all of them), loading, error, onRetry(), search, onSearch(text), activeId, onOpen(banner), onAdd(positionKey),
// toggle (the return of useBannerEnabledToggle), focusPosition (a key or null: `?position=` from ⌘K while the page is open).

const THUMB_SIZE_OPTIONS = 'h_40,c_limit'
const SKELETON_ROWS = 2
const OTHER_KEY = 'other'

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const errorText = (t, error) => {
  const first = (Array.isArray(error) ? error.flat(Infinity) : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .find(Boolean)
  return translateApiMessage(t, first, undefined)
}

// M-AB21: a banner from the API may come without a name, items or business
const nameOf = (banner) => (typeof banner?.name === 'string' ? banner.name : '')
const imagesOf = (banner) => (Array.isArray(banner?.items) ? banner.items : []).filter(item => item?.type === 'image')
const businessCountOf = (banner) => (Array.isArray(banner?.business) ? banner.business.length : 0)

// «_count_ images»: the number becomes an .odc-figure node (decision 11) and keeps its direction in RTL
const withFigure = (template, count) => template.split('_count_').flatMap((part, index) => (
  index === 0
    ? [part]
    : [<bdi key={index} dir='ltr' className='odc-figure'>{count}</bdi>, part]
))

// «Recommended size 1440 x 300» with the measure as a figure
const withSizeFigure = (sentence, dimensions) => {
  const at = dimensions ? sentence.indexOf(dimensions) : -1
  if (at < 0) return sentence
  return (
    <>
      {sentence.slice(0, at)}
      <bdi dir='ltr' className='odc-figure'>{dimensions}</bdi>
      {sentence.slice(at + dimensions.length)}
    </>
  )
}

// The card is a link to `?banner=`, as the campaign cards are: a middle click works; a plain click goes through `onOpen`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?banner=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('banner', id)
  return `${window.location.pathname}?${params}`
}

// The first image of the banner, decorative (the name says what it is): 48x10 for the web positions, 24x24 for the app ones. A banner
// with no image, or an image that does not load, leaves the neutral box.
const Thumb = ({ url, shape, optimizeImage }) => {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [url])
  const drawn = Boolean(url) && !failed
  return (
    <span className='odc-banners-thumb' data-shape={shape} data-empty={drawn ? undefined : ''} aria-hidden='true'>
      {drawn && <img src={optimizeImage(url, THUMB_SIZE_OPTIONS)} alt='' loading='lazy' onError={() => setFailed(true)} />}
    </span>
  )
}

const PositionSection = ({
  sectionKey,
  title,
  size,
  dimensions,
  description,
  shape,
  rawKeys = false,
  showBusinesses = false,
  canAdd = true,
  all,
  rows,
  searchText,
  quietNoMatch = false,
  headingRef,
  context
}) => {
  const { t, optimizeImage, isPhone, loading, activeId, toggle, onOpen, onAdd } = context
  const headingId = `odc-banners-position-${sectionKey}`
  const addLabel = t('AD_BANNERS_ADD_TO', 'Add banner to _position_').replace('_position_', () => title)
  const loadingLabel = t('LOADING', 'Loading')
  const activeRowId = activeId != null && activeId !== '' ? all.find(banner => String(banner.id) === String(activeId))?.id : undefined

  const imagesText = (banner) => {
    const count = imagesOf(banner).length
    return withFigure(count === 1 ? t('AD_BANNERS_IMAGES_COUNT_ONE', '_count_ image') : t('AD_BANNERS_IMAGES_COUNT_OTHER', '_count_ images'), count)
  }
  const businessesText = (banner) => {
    const count = businessCountOf(banner)
    return withFigure(count === 1 ? t('AD_BANNERS_BUSINESSES_COUNT_ONE', '_count_ business') : t('AD_BANNERS_BUSINESSES_COUNT_OTHER', '_count_ businesses'), count)
  }
  const thumbOf = (banner) => <Thumb url={imagesOf(banner)[0]?.url} shape={shape} optimizeImage={optimizeImage} />

  // The switch of a row or a card: its words are the status («On» / «Off»); its name adds the banner, so a list of switches is not a
  // list of «On» (M-AB16). AsyncSwitch is controlled by `banner.enabled`: a failed change goes back and says why (M-AB06).
  const switchOf = (banner) => {
    const label = banner.enabled ? t('AD_BANNERS_ON', 'On') : t('AD_BANNERS_OFF', 'Off')
    const name = nameOf(banner)
    return (
      <span className='odc-banners-control' data-odc-no-open=''>
        <AsyncSwitch
          checked={Boolean(banner.enabled)}
          busy={(toggle?.pendingIds ?? []).includes(banner.id)}
          failureText={t('AD_BANNERS_TOGGLE_FAILED', "We couldn't change the banner")}
          aria-label={name ? t('AD_BANNERS_STATUS_SWITCH', '_status_, _name_').replace('_status_', () => label).replace('_name_', () => name) : label}
          onToggle={next => toggle?.setEnabled?.(banner, next)}
        >
          {label}
        </AsyncSwitch>
      </span>
    )
  }

  const nameCell = (banner) => (
    <>
      <span className='odc-banners-name' dir='auto' title={nameOf(banner)}>{nameOf(banner)}</span>
      {rawKeys && <span className='odc-mono odc-banners-raw-key'>{banner.position ?? ''}</span>}
    </>
  )

  const columns = [
    { id: 'image', header: '', srHeader: t('PREVIEW', 'Preview'), className: 'odc-banners-col-image', skeleton: { lines: 1 }, cell: thumbOf },
    { id: 'name', header: t('NAME', 'Name'), rowHeader: true, wrap: true, locked: true, skeleton: { lines: 1 }, cell: nameCell },
    { id: 'images', header: t('IMAGES', 'Images'), skeleton: { lines: 1 }, cell: banner => <span className='odc-banners-count'>{imagesText(banner)}</span> },
    ...(showBusinesses
      ? [{ id: 'businesses', header: t('BUSINESSES', 'Businesses'), skeleton: { lines: 1 }, cell: banner => <span className='odc-banners-count'>{businessesText(banner)}</span> }]
      : []),
    { id: 'status', header: t('STATUS', 'Status'), locked: true, skeleton: { lines: 1 }, cell: switchOf }
  ]

  const toCard = (banner) => ({
    id: banner.id,
    href: hrefFor(banner.id),
    label: t('AD_BANNERS_OPEN_BANNER', 'Open _name_').replace('_name_', () => nameOf(banner)),
    title: <span className='odc-banners-card-name' dir='auto'>{nameOf(banner)}</span>,
    from: (
      <span className='odc-banners-card-counts'>
        <span className='odc-banners-count'>{imagesText(banner)}</span>
        {showBusinesses && <>{' · '}<span className='odc-banners-count'>{businessesText(banner)}</span></>}
        {rawKeys && <>{' · '}<span className='odc-mono odc-banners-raw-key'>{banner.position ?? ''}</span></>}
      </span>
    ),
    indicator: thumbOf(banner),
    // the switch is above the card's link overlay and never opens the card (`data-card-actions`)
    actions: <div className='odc-banners-card-actions' data-card-actions=''>{switchOf(banner)}</div>,
    active: activeRowId != null && banner.id === activeRowId,
    onOpen: () => onOpen?.(banner)
  })

  let body
  if (loading || rows.length > 0) {
    body = isPhone
      ? (
        <RecordCardList
          label={title}
          items={loading ? [] : rows.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={SKELETON_ROWS}
        />
        )
      : (
        <DataTable
          label={title}
          columns={columns}
          rows={loading ? [] : rows}
          getRowId={banner => banner.id}
          activeRowId={activeRowId}
          onOpenRow={banner => onOpen?.(banner)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonRows={SKELETON_ROWS}
        />
        )
  } else if (all.length === 0) {
    body = <p className='odc-banners-section-empty'>{t('AD_BANNERS_POSITION_EMPTY', 'No banners here yet.')}</p>
  } else if (!quietNoMatch) {
    // redesign AB-R1 (review r1 #7): with no match anywhere the notice above the sections says it once
    body = (
      <p className='odc-banners-section-empty'>
        {t('AD_BANNERS_POSITION_NO_MATCH', 'No banners match "_search_".').replace('_search_', () => searchText)}
      </p>
    )
  }

  return (
    <section className='odc-banners-section' aria-labelledby={headingId} data-position={sectionKey}>
      <div className='odc-banners-section-head'>
        <div className='odc-banners-section-text'>
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className='odc-banners-section-title'>{title}</h2>
          {size && <p className='odc-banners-section-info'>{withSizeFigure(size, dimensions)}</p>}
          {description && <p className='odc-banners-section-info'>{description}</p>}
        </div>
        {canAdd && (
          <Button size='sm' icon={Plus} aria-label={addLabel} disabled={loading} onClick={() => onAdd?.(sectionKey)}>
            {t('ADD_BANNER', 'Add banner')}
          </Button>
        )}
      </div>
      {body}
    </section>
  )
}

export const BannersSections = ({
  banners = [],
  loading = false,
  error = null,
  onRetry,
  search = '',
  onSearch,
  activeId,
  onOpen,
  onAdd,
  toggle,
  focusPosition = null
}) => {
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const isPhone = useIsPhone()
  const positionText = usePositionText()
  const headingRefs = useRef(new Map())
  const handledFocus = useRef(null)

  const failed = !loading && hasError(error)

  // M-AB11: `?position=` from ⌘K while the page is open. Once per change of the key, and only when the sections are there with their
  // rows (not while loading, not behind an error), so the rows do not push the section away after the scroll.
  useEffect(() => {
    if (focusPosition == null) {
      handledFocus.current = null
      return
    }
    if (loading || failed || handledFocus.current === focusPosition) return
    const heading = headingRefs.current.get(focusPosition)
    if (!heading) return
    handledFocus.current = focusPosition
    const section = heading.closest('section') || heading
    if (typeof section.scrollIntoView === 'function') section.scrollIntoView({ block: 'start' })
    heading.focus({ preventScroll: false })
  }, [focusPosition, loading, failed])

  if (failed) {
    return (
      <div className='odc-root odc-banners-sections'>
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={t('AD_BANNERS_LOAD_FAILED', "We couldn't load the banners.")}
          description={errorText(t, error)}
          action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
        />
      </div>
    )
  }

  const all = Array.isArray(banners) ? banners : []
  const searchText = (typeof search === 'string' ? search : '').trim()
  const needle = searchText.toLocaleLowerCase()
  const matches = (banner) => needle === '' || nameOf(banner).toLocaleLowerCase().includes(needle)

  const knownKeys = new Set(BANNER_POSITIONS.map(position => position.key))
  const otherAll = all.filter(banner => !knownKeys.has(banner.position))
  const otherRows = otherAll.filter(matches)
  const shownTotal = all.filter(banner => knownKeys.has(banner.position) && matches(banner)).length + otherRows.length
  const noMatchAnywhere = !loading && needle !== '' && all.length > 0 && shownTotal === 0

  const context = { t, optimizeImage, isPhone, loading, activeId, toggle, onOpen, onAdd }
  const headingRefOf = (key) => (node) => {
    if (node) headingRefs.current.set(key, node)
    else headingRefs.current.delete(key)
  }

  const groupTitles = {
    web: t('AD_BANNERS_GROUP_WEB', 'Web'),
    app: t('AD_BANNERS_GROUP_APP', 'App')
  }

  return (
    <div className='odc-root odc-banners-sections'>
      <div className='odc-banners-bar'>
        <SearchField
          value={search}
          onChange={text => onSearch?.(text)}
          label={t('AD_BANNERS_SEARCH', 'Search banners')}
          placeholder={t('AD_BANNERS_SEARCH', 'Search banners')}
          clearLabel={t('CLEAR_SEARCH', 'Clear search')}
        />
      </div>

      {noMatchAnywhere && (
        <EmptyState
          icon={Search}
          title={t('AD_BANNERS_NO_MATCH', 'No banners match "_search_"').replace('_search_', () => searchText)}
          action={<Button onClick={() => onSearch?.('')}>{t('CLEAR_SEARCH', 'Clear search')}</Button>}
        />
      )}

      {POSITION_GROUPS.map(group => {
        const groupId = `odc-banners-group-${group}`
        return (
          <div key={group} className='odc-banners-group' role='group' aria-labelledby={groupId}>
            <p id={groupId} className='odc-banners-group-title'>{groupTitles[group]}</p>
            {positionsOfGroup(group).map(position => {
              const text = positionText(position)
              const inPosition = all.filter(banner => banner.position === position.key)
              return (
                <PositionSection
                  key={position.key}
                  sectionKey={position.key}
                  title={text.title}
                  size={text.size}
                  dimensions={text.dimensions}
                  description={text.description}
                  shape={position.group === 'web' ? 'wide' : 'square'}
                  showBusinesses={position.isBusinessPage}
                  all={inPosition}
                  rows={inPosition.filter(matches)}
                  searchText={searchText}
                  quietNoMatch={noMatchAnywhere}
                  headingRef={headingRefOf(position.key)}
                  context={context}
                />
              )
            })}
          </div>
        )
      })}

      {otherAll.length > 0 && (
        <PositionSection
          key={OTHER_KEY}
          sectionKey={OTHER_KEY}
          title={t('AD_BANNERS_GROUP_OTHER', 'Other')}
          shape='wide'
          rawKeys
          showBusinesses={otherAll.some(banner => businessCountOf(banner) > 0)}
          canAdd={false}
          all={otherAll}
          rows={otherRows}
          searchText={searchText}
          quietNoMatch={noMatchAnywhere}
          headingRef={headingRefOf(OTHER_KEY)}
          context={context}
        />
      )}
    </div>
  )
}
