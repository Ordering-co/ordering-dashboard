import React, { useCallback, useEffect } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Avatar, Skeleton } from '../../Shared/Product'
import { OpenNow } from './OpenNow'
import { StoreRowControllers, StoreRowSwitch } from './StoreRowSwitch'
import './stores-table.css'

// redesign SL-F1 (A2): the card view of /stores/list. The card of SingleBusiness (header image, logo, name, city, ID and the Enabled
// switch; no checkbox, no Featured, no Ratings) with pieces of Product, 50 per page, and the infinite scroll of BusinessesList:105-117.
// redesign stores 3.B: the switches save through the page's one saver (G1-23: no controller per card) and each card says
// whether the store is open now (P-2), under the city.

const SKELETON_CARDS = 30 // inventory 1.7: 30 cards

// The card is a link to `?id=` (a middle click works); a plain click goes through `onOpen`, as the cards of RecordCard do.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

const isModifiedClick = (event) => event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey

const SkeletonCard = () => (
  <li className='odc-sl-card' data-skeleton='' aria-hidden='true'>
    <div className='odc-sl-card-header' />
    <div className='odc-sl-card-body'>
      <Skeleton shape='box' size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' />
      <Skeleton size='60%' />
      <Skeleton size='40%' />
      <Skeleton size='50%' />
    </div>
  </li>
)

/**
 * @param {object}   props
 * @param {{loading: boolean, businesses: Array<object>}} props.businessList
 * @param {{to?: number, total?: number}} props.pagination         `to === total` means there is nothing more to load.
 * @param {Function} props.loadMoreBusinesses                      Called when the window scrolls to the foot and there is more.
 * @param {Function} props.handleOpenBusinessDetails               `(business)`: opens the editor.
 * @param {Function} props.getCityName                             `(business) => string`; empty for EatStreet.
 * @param {boolean}  [props.isEatstreetProject]
 * @param {boolean}  [props.is12Hours]                         The project writes times in 12 hours (Open now).
 * @param {Function} [props.handleSucessUpdateBusiness]            Forwarded to the Enabled switch's controller.
 * @param {Function} [props.handleSucessRemoveBusiness]
 * @param {Function} [props.handleSucessAddBusiness]
 */
export const StoresCards = ({
  businessList,
  pagination,
  loadMoreBusinesses,
  handleOpenBusinessDetails,
  getCityName,
  isEatstreetProject,
  is12Hours,
  handleSucessUpdateBusiness,
  handleSucessRemoveBusiness,
  handleSucessAddBusiness
}) => {
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()

  // Window scroll, as BusinessesList did: near the foot, not loading, and the page has more to give
  const handleScroll = useCallback(() => {
    const innerHeightScrolltop = window.innerHeight + document.documentElement?.scrollTop + 10
    const badScrollPosition = innerHeightScrolltop < document.documentElement?.offsetHeight
    const hasMore = !(pagination?.to === pagination?.total)
    if (badScrollPosition || businessList.loading || !hasMore) return
    loadMoreBusinesses()
  }, [businessList, pagination, loadMoreBusinesses])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const handlers = { handleSucessUpdateBusiness, handleSucessRemoveBusiness, handleSucessAddBusiness }
  const loading = Boolean(businessList?.loading)
  const rows = businessList?.businesses || []

  return (
    <StoreRowControllers businesses={loading ? [] : rows} handleSucessUpdateBusiness={handleSucessUpdateBusiness}>
      <div className='odc-root odc-sl-cards-view'>
        {loading && <span className='odc-sr-only'>{t('STORES_LOADING', 'Loading stores')}</span>}
        <ul className='odc-sl-grid' role='list' aria-label={t('STORES_LIST', 'Stores list')} aria-busy={loading}>
          {loading
            ? Array.from({ length: SKELETON_CARDS }, (_, index) => <SkeletonCard key={index} />)
            : (rows || []).map(business => {
                const city = isEatstreetProject ? '' : getCityName(business)
                const header = business.header ? optimizeImage(business.header, 'h_100,c_limit') : null
                return (
                  <li
                    key={business.id}
                    className='odc-sl-card'
                    data-row-id={business.id}
                    onClick={event => {
                      if (event.target.closest('a, button, [data-card-actions]')) return
                      handleOpenBusinessDetails(business)
                    }}
                  >
                    <div className='odc-sl-card-header'>
                      {/* redesign SL-(R-06): a header that does not load leaves the empty band, as main's background did, not a broken icon */}
                      {header && <img src={header} alt='' loading='lazy' onError={event => { event.currentTarget.hidden = true }} />}
                    </div>
                    <div className='odc-sl-card-body'>
                      <span className='odc-sl-card-logo'>
                        <Avatar kind='business' size='lg' name={business.name} src={business.logo ? optimizeImage(business.logo, 'h_200,c_limit') : undefined} />
                      </span>
                      <a
                        className='odc-sl-card-link'
                        href={hrefFor(business.id)}
                        onClick={event => {
                          if (isModifiedClick(event)) return
                          event.preventDefault()
                          handleOpenBusinessDetails(business)
                        }}
                      >
                        <span className='odc-sl-card-name' dir='auto' title={business.name}>{business.name}</span>
                      </a>
                      {city && <span className='odc-sl-card-city' dir='auto' title={city}>{city}</span>}
                      <OpenNow business={business} is12Hours={is12Hours} />
                      <div className='odc-sl-card-foot'>
                        <span className='odc-sl-card-id'>
                          {t('ID', 'ID')} <bdi dir='ltr' className='odc-figure'>{business.id}</bdi>
                        </span>
                        <span data-card-actions=''>
                          <StoreRowSwitch
                            {...handlers}
                            business={business}
                            label={t('STORES_ENABLE_STORE', 'Enable _name_').replace('_name_', business.name ?? '')}
                          >
                            {/* redesign tanda AB (S-4a): the state, as the «Enabled» column of the table */}
                            {t('ENABLED', 'Enabled')}
                          </StoreRowSwitch>
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
        </ul>
      </div>
    </StoreRowControllers>
  )
}
