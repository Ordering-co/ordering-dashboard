import React, { useEffect, useRef } from 'react'
import { useLanguage, OpenCartFilter as OpenCartFilterController } from '../../../../../index'
import { BusinessesSelector } from '../BusinessesSelector'
import { CitySelector } from '../CitySelector'
import { DateTypeSelector } from '../DateTypeSelector'
import { Modal } from '../../Shared'
import { Button, Input } from '../../../styles'

import {
  FilterGroupListContainer,
  WrapperRow,
  ButtonGroup
} from './styles'
import { CustomerSelector } from '../CustomerSelector'

const OpenCartsFilterGroupUI = (props) => {
  const {
    open,
    handleCloseFilterModal,
    filterValues,
    businessesList,
    citiesList,
    handleChangeDateRange,
    handleChangeBusinesses,
    handleChangeCity,
    handleResetFilterValues,
    handleChangeFilterValues,
    handleChangeCartId,
    handleChangeCustomers
  } = props

  const [, t] = useLanguage()

  const contentEndRef = useRef()

  const handleAcceptFilter = () => {
    handleChangeFilterValues(filterValues)
    handleCloseFilterModal()
  }

  const handleClearFilter = () => {
    handleResetFilterValues()
    handleChangeFilterValues({})
  }

  const scrollDown = (e) => {
    if (!e.target.closest('.ordering-calendar-btn') && !e.target.closest('.multi-select')) return

    const el = document.querySelector('.dialog-inner')
    if (!el) return

    const scrollToBottom = (behavior) => {
      if (el.scrollHeight > el.clientHeight && contentEndRef.current) {
        el.scrollTo({ top: contentEndRef.current.offsetTop, behavior })
      }
    }

    scrollToBottom('smooth')

    // Selectors like customer load their list async; the load re-render would
    // otherwise snap the dialog back to the top. Re-assert the position while
    // the content settles, then stop observing.
    const observer = new MutationObserver(() => scrollToBottom('auto'))
    observer.observe(el, { childList: true, subtree: true })
    setTimeout(() => observer.disconnect(), 1500)
  }

  useEffect(() => {
    window.addEventListener('click', scrollDown)
    return () => window.removeEventListener('click', scrollDown)
  }, [])

  return (open
    ? (
      <Modal
        title={t('FILTER', 'Filter')}
        width='80%'
        padding='30px'
        open={open}
        onClose={() => handleCloseFilterModal()}
      >
        <FilterGroupListContainer className='filter-modal'>
          <WrapperRow>
            <Input
              type='text'
              placeholder='ID'
              autoComplete='off'
              value={filterValues?.cartId || ''}
              onChange={(e) => handleChangeCartId(e)}
            />
          </WrapperRow>
          <WrapperRow>
            <BusinessesSelector
              filterValues={filterValues}
              businessesList={businessesList}
              handleChangeBusinesses={handleChangeBusinesses}
            />
            <CustomerSelector
              cartFilterValues={filterValues}
              handleChangeCustomers={handleChangeCustomers}
            />
          </WrapperRow>
          <WrapperRow className='city-filter'>
            <CitySelector
              cities={citiesList}
              filterValues={filterValues}
              handleChangeCity={handleChangeCity}
            />
            <DateTypeSelector
              handleChangeDateRange={handleChangeDateRange}
              filterValues={filterValues}
            />
          </WrapperRow>
          <ButtonGroup>
            <Button
              color='primary'
              borderRadius='8px'
              onClick={() => handleAcceptFilter()}
            >
              {t('ACCEPT', 'Accept')}
            </Button>
            <Button
              color='secundaryDark'
              borderRadius='8px'
              onClick={() => handleClearFilter()}
            >
              {t('CLEAR', 'Clear')}
            </Button>
          </ButtonGroup>
        </FilterGroupListContainer>
        <div ref={contentEndRef} />
      </Modal>
      )
    : null
  )
}

export const OpenCartsFilterGroup = (props) => {
  const openCartFilterGroupProps = {
    ...props,
    UIComponent: OpenCartsFilterGroupUI
  }

  return <OpenCartFilterController {...openCartFilterGroupProps} />
}
