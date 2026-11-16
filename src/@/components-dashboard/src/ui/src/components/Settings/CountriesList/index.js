import React, { useState, useEffect, useRef } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { Pagination, SideBar, Confirm } from '../../Shared'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import { useTheme } from 'styled-components'
import FiMoreVertical from '@meronex/icons/fi/FiMoreVertical'
import { Switch } from '../../../styles'
import { CountryDetails } from '../CountryDetails'
import RiCheckboxBlankLine from '@meronex/icons/ri/RiCheckboxBlankLine'
import RiCheckboxFill from '@meronex/icons/ri/RiCheckboxFill'

import {
  CountriesContainer,
  ActionsContainer,
  EnableWrapper,
  ActionSelectorWrapper,
  CountryWrapper,
  CheckboxWrapper,
  CountryName,
  AddCountryButton,
  PagesBottomContainer
} from './styles'

export const CountriesList = (props) => {
  const {
    actionState,
    searchValue,
    countriesState,
    handleUpdateCountry,
    handleAddCountry,
    selectedCountries,
    setSelectedCountries,
    handleDeleteCountry
  } = props

  const history = useHistory()
  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const theme = useTheme()
  const [currentPage, setCurrentPage] = useState(1)
  const [countriesPerPage, setCountriesPerPage] = useState(10)
  const [totalPages, setTotalPages] = useState(null)
  const [currentCountries, setCurrentCountries] = useState([])

  const [openDetails, setOpenDetails] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })

  // what opened the panel gets the focus back when it closes (the panel takes it when it opens).
  const rowRefs = useRef({})
  const addButtonRef = useRef(null)
  const openerRef = useRef(null) // a country id, or 'add'
  const wasOpenRef = useRef(false)

  useEffect(() => {
    const wasOpen = wasOpenRef.current
    wasOpenRef.current = openDetails
    if (!wasOpen || openDetails) return
    // Only when the focus went down with the panel: a control the user moved to meanwhile keeps it.
    const active = document.activeElement
    if (active && active !== document.body) return
    const opener = openerRef.current
    openerRef.current = null
    const target = (opener !== 'add' && rowRefs.current[opener]) || addButtonRef.current
    target?.focus({ preventScroll: true })
  }, [openDetails])

  const handleChangePageSize = (pageSize) => {
    const expectedPage = Math.ceil(((currentPage - 1) * countriesPerPage + 1) / pageSize)
    setCurrentPage(expectedPage)
    setCountriesPerPage(pageSize)
  }

  useEffect(() => {
    if (countriesState.loading) return
    let _totalPages
    let dropdownOptions = []
    if (searchValue) {
      dropdownOptions = countriesState.countries.filter(option => option.name?.toLowerCase().includes(searchValue?.toLowerCase()))
    } else {
      dropdownOptions = [...countriesState.countries]
    }
    if (dropdownOptions.length > 0) {
      _totalPages = Math.ceil(dropdownOptions.length / countriesPerPage)
    }
    const indexOfLastPost = currentPage * countriesPerPage
    const indexOfFirstPost = indexOfLastPost - countriesPerPage
    const _currentDropdownOptions = dropdownOptions.slice(indexOfFirstPost, indexOfLastPost)
    setTotalPages(_totalPages)
    setCurrentCountries(_currentDropdownOptions)
  }, [countriesState, currentPage, countriesPerPage, searchValue])

  const handleClickCountry = (e, country, isInitialRender) => {
    const isInvalid = e?.target?.closest('.country-checkbox') || e?.target?.closest('.country-enabled') || e?.target?.closest('.country-actions')
    if (isInvalid) return
    openerRef.current = country.id
    setSelectedCountry(country)
    setOpenDetails(true)
    if (!isInitialRender) {
      const category = query.get('category')
      history.replace(`${location.pathname}?category=${category}&country=${country.id}`)
    }
  }

  const onDeleteCountry = (countryId) => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_ITEM', 'Are you sure to delete this _item_?').replace('_item_', t('COUNTRY', 'Country')),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeleteCountry(countryId)
      }
    })
  }

  const handleAllCheckbox = () => {
    const isAllChecked = currentCountries.every(item => selectedCountries.find(elem => elem.id === item.id))
    if (!isAllChecked) {
      setSelectedCountries(currentCountries)
    } else {
      setSelectedCountries([])
    }
  }

  const handleCheckCountry = (country) => {
    const found = selectedCountries.find(item => item.id === country.id)
    if (found) {
      setSelectedCountries(selectedCountries.filter(_country => _country.id !== country.id))
    } else {
      setSelectedCountries([...selectedCountries, country])
    }
  }

  const handleCloseDetail = () => {
    setOpenDetails(false)
    setSelectedCountry(null)
    const category = query.get('category')
    history.replace(`${location.pathname}?category=${category}`)
  }

  useEffect(() => {
    if (actionState.loading || actionState.error || selectedCountry) return
    setOpenDetails(false)
    setSelectedCountry(null)
  }, [actionState])

  useEffect(() => {
    if (countriesState.loading) return
    const countryId = query.get('country')
    if (countryId) {
      const initCountry = countriesState.countries.find(country => country.id === Number(countryId))
      if (initCountry) {
        handleClickCountry(null, initCountry, true)
      }
    }
  }, [countriesState.loading])

  return (
    <CountriesContainer>
      <CountryWrapper isHeader>
        <CountryName>
          <CheckboxWrapper
            onClick={() => handleAllCheckbox()}
            active={!countriesState.loading && selectedCountries.length === currentCountries.length}
          >
            {!countriesState.loading && selectedCountries.length === currentCountries.length
              ? (
              <RiCheckboxFill />
                )
              : (
              <RiCheckboxBlankLine />
                )}
          </CheckboxWrapper>
          <span>{t('COUNTRY', 'Zone')}</span>
        </CountryName>
        <ActionsContainer isHeader>{t('ACTIONS', 'Actions')}</ActionsContainer>
      </CountryWrapper>
      {countriesState.loading
        ? (
            [...Array(10).keys()].map(i => (
          <CountryWrapper key={i}>
            <CountryName><Skeleton width={150} /></CountryName>
            <ActionsContainer><Skeleton width={100} /></ActionsContainer>
          </CountryWrapper>
            ))
          )
        : (
        <>
          {currentCountries.length > 0 && (
            <>
              {currentCountries.map(country => (
                <CountryWrapper
                  key={country.id}
                  ref={node => { rowRefs.current[country.id] = node }}
                  tabIndex={-1}
                  active={selectedCountry?.id === country.id}
                  onClick={e => handleClickCountry(e, country)}
                >
                  <CountryName>
                    <CheckboxWrapper
                      className='country-checkbox'
                      onClick={() => handleCheckCountry(country)}
                      active={selectedCountries.find(_country => _country?.id === country.id)}
                    >
                      {selectedCountries.find(_country => _country?.id === country.id)
                        ? (
                        <RiCheckboxFill />
                          )
                        : (
                        <RiCheckboxBlankLine />
                          )}
                    </CheckboxWrapper>
                    <span>{country?.name}</span>
                  </CountryName>
                  <ActionsContainer>
                    <EnableWrapper className='country-enabled'>
                      <span>{t('ENABLE', 'Enable')}</span>
                      <Switch
                        defaultChecked={country?.enabled}
                        onChange={enabled => handleUpdateCountry(country.id, { enabled })}
                      />
                    </EnableWrapper>
                    <ActionSelectorWrapper className='country-actions'>
                      <DropdownButton
                        menuAlign={theme?.rtl ? 'left' : 'right'}
                        title={<FiMoreVertical />}
                        id={theme?.rtl ? 'dropdown-menu-align-left' : 'dropdown-menu-align-right'}
                      >
                        <Dropdown.Item
                          onClick={() => {
                            openerRef.current = country.id
                            setSelectedCountry(country)
                            setOpenDetails(true)
                          }}
                        >
                          {t('EDIT', 'Edit')}
                        </Dropdown.Item>
                        <Dropdown.Item
                          onClick={() => onDeleteCountry(country.id)}
                        >
                          {t('DELETE', 'Delete')}
                        </Dropdown.Item>
                      </DropdownButton>
                    </ActionSelectorWrapper>
                  </ActionsContainer>
                </CountryWrapper>
              ))}
            </>
          )}
        </>
          )}

      {!countriesState.loading && (
        <PagesBottomContainer>
          <AddCountryButton
            as='button'
            type='button'
            ref={addButtonRef}
            onClick={() => {
              openerRef.current = 'add'
              setSelectedCountry(null)
              setOpenDetails(true)
            }}
          >
            {t('ADD_NEW_COUNTRY ', 'Add new country')}
          </AddCountryButton>
          {currentCountries?.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              handleChangePage={page => setCurrentPage(page)}
              defaultPageSize={countriesPerPage}
              handleChangePageSize={handleChangePageSize}
            />
          )}
        </PagesBottomContainer>
      )}
      {openDetails && (
        <SideBar
          open={openDetails}
          onClose={() => handleCloseDetail()}
          showExpandIcon
        >
          <CountryDetails
            country={selectedCountry}
            handleUpdateCountry={handleUpdateCountry}
            handleAddCountry={handleAddCountry}
          />
        </SideBar>
      )}
      <Confirm
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
    </CountriesContainer>
  )
}
