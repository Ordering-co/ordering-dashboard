import React, { useEffect, useState } from 'react'
import { useLanguage, useUtils } from '../../../../../../index'
import { useTheme } from 'styled-components'
import { Avatar, SearchField, Skeleton } from '../../../Shared/Product'
import { Check } from '../../../Shared/Icon'
import '../steps.css'

// F6b (D-17): the list shows at most six rows (steps.css, max-block-size), so six ghost rows fill the same
// area the real list will; the real rows are taller than the cap's unit, never shorter.
const SKELETON_ROWS = 6

// Redesign 5.5-B: the open businesses as selectable rows (avatar, name, address) with a search, in
// place of the select. Same list, same filter by name, same choice by slug.
export const SelectBusinesses = (props) => {
  const {
    businessList,
    selectedBusiness,
    setSelectedBusiness
  } = props

  const theme = useTheme()
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [searchValue, setSearchValue] = useState('')

  const onChange = (slug) => {
    const findStore = businessList?.businesses.find(store => store?.slug === slug)
    setSelectedBusiness(findStore)
    setSearchValue('')
  }

  useEffect(() => {
    if (!selectedBusiness || businessList?.loading || !businessList?.businesses) return
    const found = businessList.businesses.find(store => store?.slug === selectedBusiness?.slug)
    if (!found) setSelectedBusiness(null)
  }, [businessList, selectedBusiness])

  const loading = !!businessList?.loading
  const visible = loading || !businessList?.businesses
    ? []
    : businessList.businesses.filter(business => (business?.name || '').toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
  const label = t('SELECT_BUSINESS', 'Select business')

  return (
    <div className='odc-steps'>
      <h4 className='odc-steps-heading'>{label}</h4>
      <SearchField
        label={t('SEARCH_BUSINESSES', 'Search businesses')}
        placeholder={t('SEARCH_BUSINESSES', 'Search businesses')}
        clearLabel={t('CLEAR', 'Clear')}
        value={searchValue}
        onChange={setSearchValue}
      />
      <ul className='odc-steps-list' data-scroll='' aria-label={label} aria-busy={loading || undefined}>
        {loading && Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <li key={index} className='odc-steps-skeleton-row' data-rich=''>
            <Skeleton shape='box' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
            <span className='odc-steps-row-main'>
              <span className='odc-steps-skeleton-name'><Skeleton size={index % 2 ? '44%' : '56%'} /></span>
              <span className='odc-steps-skeleton-meta'><Skeleton size={index % 2 ? '68%' : '76%'} /></span>
            </span>
          </li>
        ))}
        {visible.map(business => {
          const selected = selectedBusiness?.slug === business?.slug
          return (
            <li key={business?.slug ?? business?.id}>
              <button
                type='button'
                className='odc-steps-row'
                aria-pressed={selected}
                data-selected={selected ? 'true' : undefined}
                onClick={() => onChange(business?.slug)}
              >
                <Avatar
                  kind='business'
                  name={business?.name}
                  src={optimizeImage(business?.logo || theme.images?.dummies?.businessLogo, 'h_50,c_limit') || undefined}
                />
                <span className='odc-steps-row-main'>
                  <span className='odc-steps-row-name'>{business?.name}</span>
                  {business?.address && <span className='odc-steps-row-meta'>{business.address}</span>}
                </span>
                {selected && <Check className='odc-icon odc-steps-row-mark' aria-hidden='true' />}
              </button>
            </li>
          )
        })}
      </ul>
      {!loading && businessList?.businesses && visible.length === 0 && (
        <p className='odc-steps-hint'>{t('NO_BUSINESSES_FOUND', 'No businesses found')}</p>
      )}
    </div>
  )
}
