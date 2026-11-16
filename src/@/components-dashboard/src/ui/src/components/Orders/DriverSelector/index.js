import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage, useConfig, useSession, DriversList as DriversController } from '../../../../../index'
import { useTheme } from 'styled-components'
import { Select } from '../../../styles/Select'
import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { SelectOptionContent } from '../../Shared/UI/SelectOption'
import { useSelectSurface } from '../../Shared/UI/selectPlacement'
import { canOpenDashboardRoute, getDashboardRoleFlags } from '../../../../../utils/dashboardNavigation'

import {
  Option,
  OptionContent,
  DriverNameContainer,
  WrapperDriverImage,
  DriverImage,
  DriverName,
  OptionInnerContainer,
  SelectWrapper
} from './styles'
import { consumeDriverFocus } from './focusIntent'

// A person's name on one line: the API may send «Marco » (a trailing space) or an empty middle name.
const joinName = (...parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

const DRIVERS_GROUPS_PATH = '/delivery/drivers-groups'

// Values of the list that are labels or actions, never a driver
const NOT_A_DRIVER = ['default', 'remove', 'available', 'busy', 'not_available', 'none']

const DriverSelectorUI = (props) => {
  const {
    driverActionStatus,
    companyActionStatus,
    isFirstSelect,
    order,
    driversList,
    defaultValue,
    isPhoneView,
    small,
    padding,
    handleAssignDriver,
    isTourOpen,
    setCurrentTourStep,
    setAlertState,
    handleOpenMessages,
    setCommentInfostate,
    onSelectedShown
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const [defaultOption, setDefaultOption] = useState(null)
  const [driversOptionList, setDriversOptionList] = useState([])
  const [searchValue, setSearchValue] = useState(null)
  const [{ configs }] = useConfig()
  const [{ user }] = useSession()
  const wrapperRef = useRef(null)
  // redesign F2 (C18): inside the orders surfaces the list is the single dropdown anatomy (a FirstSelect
  // with brand rows) whatever `isFirstSelect` says; outside them it is the legacy select and rows.
  const c18 = !!useSelectSurface().fitTrigger
  const text = (value) => c18 ? <span>{value}</span> : <Option><span>{value}</span></Option>

  const driversLoading = [{ value: 'default', content: c18 ? <span>{t('LOADING', 'loading')}...</span> : <Option small={small}><span>{t('LOADING', 'loading')}...</span></Option> }]
  const showDriverAssignmentComment = configs?.manual_driver_assignment_comment_enabled?.value === '1'
  // redesign fix-qa E6: somebody to pick = any enabled driver (available, busy or not available)
  const hasCandidates = !driversList.loading && (driversList.drivers ?? []).some(driver => driver?.enabled)
  const isNothingToPick = !driversList.loading && !hasCandidates
  // main (cc33a76c): the store has no driver at all (not loading, no error): say why, and where to fix it for those who can
  const hasNoDrivers = !driversList.loading && !driversList.error && !driversList.drivers?.length
  const canOpenDriversGroups = canOpenDashboardRoute(DRIVERS_GROUPS_PATH, user?.level) && !getDashboardRoleFlags(user).isReadOnly
  const noDriversNote = hasNoDrivers && (
    <p className='odt-assign-empty' role='status'>
      {t('DRIVER_SELECTOR_NO_DRIVERS', 'No drivers can take this order. Check that the store is in an enabled driver group that accepts this payment method.')}
      {canOpenDriversGroups && (
        <>
          {' '}
          <Link to={DRIVERS_GROUPS_PATH}>{t('DRIVER_SELECTOR_NO_DRIVERS_LINK', 'Open Delivery Groups')}</Link>
        </>
      )}
    </p>
  )

  // redesign F6c (Q2-19): count-aware, lowercase («1 assigned order», «3 assigned orders»).
  const assignedOrdersText = (count) => (Number(count) === 1
    ? t('ASSIGNED_ORDERS_COUNT_ONE', '_count_ assigned order')
    : t('ASSIGNED_ORDERS_COUNT_OTHER', '_count_ assigned orders')).replace('_count_', count)

  const getOption = (driver) => {
    if (c18) {
      const label = joinName(driver.name, driver.lastname)
      const person = { kind: 'person', name: label, src: driver.photo }
      // redesign F6e-2 (P5-03): the field carries the full name (middle name and second last name, as the driver card had it in
      // `main`); the rows keep the short one. The list does not bring the middle names: the assigned driver's come from the order.
      const assigned = order?.driver_id !== undefined && order?.driver_id !== null && String(order.driver_id) === String(driver.id) ? order?.driver : null
      const fullName = joinName(driver.name, assigned?.middle_name ?? driver.middle_name, driver.lastname, assigned?.second_lastname ?? driver.second_lastname)
      const count = driver?.assigned_orders_count
      return {
        value: driver.id,
        disabled: !(driver?.enabled && driver?.available && !driver?.busy),
        content: <SelectOptionContent label={label} media={person} meta={count === undefined || count === null ? undefined : assignedOrdersText(count)} />,
        showOnSelected: <SelectOptionContent label={<span title={fullName}>{fullName}</span>} media={person} />
      }
    }
    return {
      value: driver.id,
      disabled: !(driver?.enabled && driver?.available && !driver?.busy),
      content: (
        <Option small={small} isPhoneView={isPhoneView} padding={padding}>
          <OptionInnerContainer>
            <WrapperDriverImage small={small} className='driver-photo'>
              <DriverImage bgimage={driver.photo || theme.images.icons?.noDriver} small={small} />
            </WrapperDriverImage>
            <OptionContent>
              <DriverNameContainer className='driver-info'>
                <DriverName small={small}>{driver.name} {driver.lastname} <span className='assigned-orders'>({driver?.assigned_orders_count} {t('ASSIGNED_ORDERS', 'Assigned orders')})</span></DriverName>
              </DriverNameContainer>
            </OptionContent>
          </OptionInnerContainer>
        </Option>
      )
    }
  }

  useEffect(() => {
    const _driversOptionList = [
      {
        value: 'default',
        content: c18 ? <span>{t('SELECT_DRIVER', 'Select driver')}</span> : <Option padding='0px'><span>{t('SELECT_DRIVER', 'Select driver')}</span></Option>,
        color: 'primary',
        disabled: true,
        showDisable: true
      }
    ]
    _driversOptionList.push({
      value: 'remove',
      content: c18
        ? <span>{t('REMOVE_DRIVER', 'Remove assigned driver')}</span>
        : <Option isRemove><span>{t('REMOVE_DRIVER', 'Remove assigned driver')}</span></Option>,
      disabled: defaultValue === 'default',
      danger: c18 || undefined
    })

    if (!driversList.loading) {
      let _driverList
      if (searchValue) {
        _driverList = driversList.drivers.filter(driver => (driver.name + driver.lastname).toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
      } else {
        _driverList = driversList.drivers
      }
      const availableDrivers = _driverList.filter(driver => driver?.enabled && driver?.available && !driver?.busy)
      if (availableDrivers.length) {
        _driversOptionList.push({
          value: 'available',
          content: text(t('AVAILABLE', 'Available')),
          disabled: true,
          group: c18 || undefined
        })
        availableDrivers.forEach(driver => {
          _driversOptionList.push(getOption(driver))
        })
      }

      const busyDrivers = _driverList.filter(driver => driver?.enabled && driver?.available && driver?.busy)
      if (busyDrivers.length) {
        _driversOptionList.push({
          value: 'busy',
          content: text(t('BUSY', 'Busy')),
          disabled: true,
          group: c18 || undefined
        })
        busyDrivers.forEach(driver => {
          _driversOptionList.push(getOption(driver))
        })
      }

      const notAvailableDrivers = _driverList.filter(driver => driver?.enabled && !driver?.available)
      if (notAvailableDrivers.length) {
        _driversOptionList.push({
          value: 'not_available',
          content: text(t('NOT_AVAILABLE', 'Not available')),
          disabled: true,
          group: c18 || undefined
        })
        notAvailableDrivers.forEach(driver => {
          _driversOptionList.push(getOption(driver))
        })
      }
      if (!availableDrivers.length && !busyDrivers.length && !notAvailableDrivers.length) {
        // Nobody to pick: say so in the list too (it used to show only a greyed "Remove assigned driver")
        _driversOptionList.push({
          value: 'none',
          content: text(searchValue ? t('NO_DRIVERS_FOUND', 'No drivers found') : t('NO_DRIVERS_FOR_THIS_ORDER', 'No drivers available for this order')),
          disabled: true
        })
      }
    }
    setDriversOptionList(_driversOptionList)
  }, [driversList, defaultValue, searchValue, c18])

  useEffect(() => {
    if (!companyActionStatus?.error && !driverActionStatus?.error) return
    setAlertState && setAlertState({
      open: true,
      content: companyActionStatus?.error || driverActionStatus?.error
    })
  }, [companyActionStatus?.error, driverActionStatus?.error])

  const changeDriver = (driverId) => {
    if (driverId === 'default') return
    if (driverId === 'remove') {
      driverId = null
    }
    if (driverId && setCommentInfostate && showDriverAssignmentComment) {
      setCommentInfostate({ open: true, driverId })
    } else {
      setCommentInfostate && setCommentInfostate({ open: false, driverId: null })
      handleAssignDriver({ orderId: order.id, driverId })
    }
    if (isTourOpen && setCurrentTourStep) {
      handleOpenMessages('chat')
      setTimeout(() => {
        isTourOpen && setCurrentTourStep && setCurrentTourStep(3)
      }, 50)
    }
  }

  useEffect(() => {
    setDefaultOption(defaultValue)
  }, [defaultValue])

  // redesign F6e-2 (Q4-02): which driver the field shows, said by the selector itself. It is the one the field was given when the
  // list is drawn (not loading) and has a row for it; while typing in the search the field keeps what it showed. The panel hides
  // its own card of that driver by id, once this says so.
  const hasDriverRow = !driversList.loading && defaultOption !== null && defaultOption !== undefined &&
    !NOT_A_DRIVER.includes(defaultOption) && driversOptionList.some(option => option.value === defaultOption)
  const shownRef = useRef(null)
  const shownDriverId = searchValue && shownRef.current !== null ? shownRef.current : (hasDriverRow ? defaultOption : null)
  const onSelectedShownRef = useRef(onSelectedShown)
  onSelectedShownRef.current = onSelectedShown
  useEffect(() => {
    shownRef.current = shownDriverId
    onSelectedShownRef.current && onSelectedShownRef.current(shownDriverId)
  }, [shownDriverId])
  useEffect(() => () => {
    onSelectedShownRef.current && onSelectedShownRef.current(null)
  }, [])

  // "Assign" on a list row asked for the focus to land here (see focusIntent.js); wait for the list.
  useEffect(() => {
    if (driversList.loading || isNothingToPick || !order?.id) return
    if (!consumeDriverFocus(order.id)) return
    wrapperRef.current?.querySelector('[aria-haspopup], button, [tabindex="0"]')?.focus()
  }, [driversList.loading, isNothingToPick, order?.id])

  const handleSearch = (val) => {
    setSearchValue(val)
  }

  if (isNothingToPick && (defaultValue === 'default' || !defaultValue)) {
    return (
      <SelectWrapper>
        {noDriversNote || <p className='odt-assign-empty'>{t('NO_DRIVERS_FOR_THIS_ORDER', 'No drivers available for this order')}</p>}
      </SelectWrapper>
    )
  }

  const LoadingSelect = c18 ? FirstSelect : Select

  return (
    <SelectWrapper ref={wrapperRef}>
      {!driversList.loading
        ? (
        <>
          {isFirstSelect || c18
            ? (
            <FirstSelect
              defaultValue={defaultOption || 'default'}
              options={driversOptionList}
              optionInnerMaxHeight='200px'
              onChange={(driverId) => changeDriver(driverId)}
              isShowSearchBar
              searchBarPlaceholder={t('SEARCH', 'Search')}
              searchBarIsCustomLayout
              searchBarIsNotLazyLoad
              searchValue={searchValue}
              handleChangeSearch={handleSearch}
              className='driver-select'
              ariaLabel={t('DRIVER', 'Driver')}
            />
              )
            : (
            <Select
              defaultValue={defaultOption || 'default'}
              options={driversOptionList}
              optionInnerMaxHeight='200px'
              onChange={(driverId) => changeDriver(driverId)}
              isShowSearchBar
              searchBarIsNotLazyLoad
              searchBarPlaceholder={t('SEARCH', 'Search')}
              searchBarIsCustomLayout
              searchValue={searchValue}
              handleChangeSearch={handleSearch}
              className='driver-select'
            />
              )}
        </>
          )
        : (
        <>
          <LoadingSelect
            placeholder={t('SELECT_DRIVER', 'Select driver')}
            ariaLabel={t('DRIVER', 'Driver')}
            defaultValue='default'
            options={driversLoading}
            optionInnerMargin='10px'
            optionInnerMaxHeight='200px'
            className='driver-select'
          />
        </>
          )}
      {/* review r1: under a select (a driver is assigned) the note keeps its distance, as main's banner did */}
      {noDriversNote && <div className='odt-assign-note'>{noDriversNote}</div>}
    </SelectWrapper>
  )
}

export const DriverSelector = (props) => {
  const DriversControlProps = {
    ...props,
    UIComponent: DriverSelectorUI,
    propsToFetch: ['id', 'name', 'lastname', 'cellphone', 'photo']
  }
  return (
    <>
      <DriversController {...DriversControlProps} />
    </>
  )
}
