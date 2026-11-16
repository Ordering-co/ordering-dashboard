import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage, useUtils, useCustomer, useConfig } from '../../../../../../index'
import { UserAddForm } from '../../../Users'
import { AddressList } from '../../../Delivery'
import { Avatar, Button, IconButton } from '../../../Shared/Product'
import { cx } from '../../../Shared/Product/classNames'
import { ChevronLeft, LoaderCircle, MapPin, X } from '../../../Shared/Icon'
import { findExitingCountryPhoneCode } from '../../../../utils'
import '../steps.css'

const VIEW_USER_FORM = 'user_add_form'
const VIEW_ADDRESS_LIST = 'address_list'

// The back arrow points the other way in right-to-left scripts.
const BackIcon = ({ className }) => <ChevronLeft className={cx(className, 'odc-icon-flip')} />

const fullName = user => [user?.name, user?.lastname].filter(Boolean).join(' ')

// Redesign 5.5-B: the customer step. "New user" and the address list are views of this same step
// (one panel level, C8) instead of sidebars stacked on the form; the controllers and handlers are the
// ones of before. `hideTitle` lets the wizard keep the only title of the step.
export const SelectCustomer = (props) => {
  const {
    phone,
    customersPhones,
    selectedUser,
    setSelectedUser,
    onChangeNumber,
    customerAddress,
    hideTitle = false
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [, { setUserCustomer, deleteUserCustomer }] = useCustomer()
  const [{ configs }] = useConfig()

  const addressPromptKey = selectedUser && !customerAddress?.address ? (selectedUser.id ?? 'customer') : null
  const [searchInputFocus, setSearchInputFocus] = useState(false)
  // redesign F6c (Q2-28): the field is a combobox over the suggestions. The focus never leaves the field: the
  // option the arrows reached is `aria-activedescendant`. Escape closes the list (and only that) while it shows.
  const listId = `${useId()}-customer-suggestions`
  const [activeIndex, setActiveIndex] = useState(-1)
  const [suggestionsClosed, setSuggestionsClosed] = useState(false)
  const [showSearchbar, setShowSearchbar] = useState(true)
  const [view, setView] = useState(null)
  // The customer for whom «Back» left the address view that opened by itself; see addressPromptKey below.
  const [dismissedKey, setDismissedKey] = useState(null)
  const [openExtraAdddress, setOpenExtraAddress] = useState(false)
  // redesign fix-qa: E3. The sub view owns the focus while it is open and gives it back to the button that opened it.
  const subviewRef = useRef(null)
  const openerRef = useRef(VIEW_ADDRESS_LIST)
  // The suggestions stay a moment after the field loses focus so a click on one lands; the timer must not outlive the step.
  const blurTimer = useRef(null)
  useEffect(() => () => clearTimeout(blurTimer.current), [])
  // redesign F6d (Q3-09): picking a customer unmounts the phone field, which is where the focus was; the customer
  // summary that replaces it takes the focus (otherwise it falls to <body>, outside the wizard dialog).
  const pickedRef = useRef(null)
  const focusPickedRef = useRef(false)

  let timeout = null
  const onInputChange = (inputValue) => {
    if (inputValue && inputValue.length > 10) {
      return
    }
    clearTimeout(timeout)
    timeout = setTimeout(function () {
      onChangeNumber(inputValue)
    }, 750)
  }

  const onSelectUser = (user) => {
    setUserCustomer(user, true)
    setSelectedUser(user)
    onChangeNumber('')
    focusPickedRef.current = true
    setShowSearchbar(false)
  }

  const onRemoveCustomer = () => {
    deleteUserCustomer(true)
    setSelectedUser(null)
    setShowSearchbar(true)
  }

  const handleOpenAddForm = () => {
    openerRef.current = VIEW_USER_FORM
    setView(VIEW_USER_FORM)
  }

  // What the field offers: the customers found, or «New user» when nothing was found for a full number.
  const foundUsers = customersPhones?.users ?? []
  const offersNewUser = foundUsers.length === 0 && !customersPhones?.loading && phone?.length > 6
  const suggestionCount = foundUsers.length > 0 ? foundUsers.length : (offersNewUser ? 1 : 0)
  const suggestionsShown = searchInputFocus && !suggestionsClosed
  const listOpen = suggestionsShown && suggestionCount > 0
  const optionId = index => `${listId}-${index}`
  // New results start again from no active option.
  const resultsKey = foundUsers.map(user => user.id).join(',') + (offersNewUser ? '+new' : '')
  useEffect(() => { setActiveIndex(-1) }, [resultsKey])

  const pickSuggestion = (index) => {
    if (foundUsers.length > 0) {
      if (foundUsers[index]) onSelectUser(foundUsers[index])
    } else if (offersNewUser) {
      handleOpenAddForm()
    }
  }

  const handleSearchKeyDown = (event) => {
    if (suggestionCount === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const wasOpen = listOpen
      setSuggestionsClosed(false)
      setSearchInputFocus(true)
      setActiveIndex(current => {
        if (!wasOpen && event.key === 'ArrowDown') return 0
        if (event.key === 'ArrowDown') return current + 1 >= suggestionCount ? 0 : current + 1
        return current <= 0 ? suggestionCount - 1 : current - 1
      })
    } else if (event.key === 'Enter' && listOpen && activeIndex >= 0) {
      event.preventDefault()
      pickSuggestion(activeIndex)
    } else if (event.key === 'Escape' && listOpen) {
      // Closing the list is all this Escape does: the Sheet behind would read it as «discard».
      event.preventDefault()
      event.stopPropagation()
      setSuggestionsClosed(true)
      setActiveIndex(-1)
    }
  }

  const handleCloseView = () => {
    setView(null)
    setOpenExtraAddress(false)
    setDismissedKey(addressPromptKey)
  }

  const onPhoneNumberPaste = (event) => {
    event.preventDefault()
    const pastedValue = event.clipboardData.getData('text/plain')
    const trimmedValue = pastedValue.replace(/\D/g, '')
    document.execCommand('insertText', false, trimmedValue)
    onChangeNumber(trimmedValue)
  }

  const handleOpenAddressList = () => {
    openerRef.current = VIEW_ADDRESS_LIST
    setView(VIEW_ADDRESS_LIST)
  }

  // A user created from the form is picked like a found one; the form has nothing left to do.
  const handleUserAdded = (user) => {
    onSelectUser(user)
    setView(null)
  }

  // A located address answers the question the address view asks, so the view closes with it.
  useEffect(() => {
    if (!customerAddress?.location) return
    setView(null)
    setOpenExtraAddress(false)
  }, [customerAddress?.location])

  // The address view that opens by itself, once per episode. Derived while rendering and not in an effect, so the
  // picked-customer card never flashes first. The episode is keyed by the customer's id and not by the object, and
  // «Back» dismisses it: a refreshed copy of the same customer does not reopen the view, and «Add new address» /
  // «Change» still do it on demand. The episode ends when the customer has an address or is removed.
  useEffect(() => {
    if (addressPromptKey === null) setDismissedKey(null)
  }, [addressPromptKey])

  const renderUser = (user) => (
    <>
      <Avatar
        name={fullName(user)}
        src={user?.photo ? optimizeImage(user.photo, 'h_50,c_limit') : undefined}
      />
      <span className='odc-steps-row-main'>
        <span className='odc-steps-row-name'>{user?.name} {user?.lastname}</span>
        <span className='odc-steps-row-meta odc-num'>{user?.cellphone || user?.phone}</span>
      </span>
    </>
  )

  // Escape inside the view goes back one level and stops there: the Sheet behind would read it as «discard».
  // A key pressed in a dialog that opened from the view bubbles here through the React tree, not the DOM: left alone.
  const handleSubviewKeyDown = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    if (!event.currentTarget.contains(event.target)) return
    event.stopPropagation()
    handleCloseView()
  }

  const renderSubview = ({ id, title, children, formOpen }) => (
    <div
      id={id}
      ref={subviewRef}
      tabIndex={-1}
      className='odc-steps-subview'
      data-form-open={formOpen ? 'true' : undefined}
      onKeyDown={handleSubviewKeyDown}
    >
      <div className='odc-steps-subview-head'>
        <Button variant='ghost' icon={BackIcon} onClick={handleCloseView}>
          {t('BACK', 'Back')}
        </Button>
        {title && <h4 className='odc-steps-heading' tabIndex={-1} data-subview-title=''>{title}</h4>}
      </div>
      <div className='odc-steps-subview-body'>{children}</div>
    </div>
  )

  const activeView = view ?? (addressPromptKey !== null && addressPromptKey !== dismissedKey ? VIEW_ADDRESS_LIST : null)

  // The title of the view takes the focus when it opens (the heading the form draws, when the view has none of its own);
  // when it closes, the focus goes back to what opened it, so the next Escape does not fall on the Sheet.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (activeView !== null) {
      wasOpen.current = true
      const root = subviewRef.current
      const target = root?.querySelector('[data-subview-title]') ?? root?.querySelector('h1, h2, h3, h4') ?? root
      if (target && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target?.focus()
    } else if (wasOpen.current) {
      wasOpen.current = false
      document.querySelector(`[data-subview-opener="${openerRef.current}"]`)?.focus()
    }
  }, [activeView])

  // The summary takes the focus unless a view opened by itself (the address list of a customer without address), which
  // has its own focus rule above.
  useEffect(() => {
    if (showSearchbar || !focusPickedRef.current) return
    focusPickedRef.current = false
    if (activeView === null) pickedRef.current?.focus()
  }, [showSearchbar])

  if (activeView === VIEW_USER_FORM) {
    return (
      <div className='odc-steps'>
        {renderSubview({
          id: VIEW_USER_FORM,
          children: (
            <UserAddForm
              isFromCustomOrder
              hideUserTypeSelector
              defaultPhoneNumber={(selectedUser?.cellphone || phone) && `+${findExitingCountryPhoneCode(configs?.default_country_code?.value?.toUpperCase())} ${selectedUser?.cellphone || phone}`}
              handleSuccessAdd={handleUserAdded}
              onClose={handleCloseView}
            />
          )
        })}
      </div>
    )
  }

  if (activeView === VIEW_ADDRESS_LIST) {
    return (
      <div className='odc-steps'>
        {renderSubview({
          id: VIEW_ADDRESS_LIST,
          title: fullName(selectedUser),
          formOpen: openExtraAdddress,
          children: (
            <>
              {/* The form that opens inside the list has its own title; the question belongs to the list. */}
              {!openExtraAdddress && <p className='odc-steps-lead'>{t('SELECT_CUSTOMER_ADDRESS', 'Select customer address')}</p>}
              <AddressList
                isEmbedded
                isAutoOpenAddNewAddress
                isSeletectedUserAddresses
                userId={selectedUser?.id}
                addresses={selectedUser?.addresses}
                userState={{
                  user: selectedUser
                }}
                setExtraOpen={setOpenExtraAddress}
                handleSuccessUpdate={setSelectedUser}
              />
            </>
          )
        })}
      </div>
    )
  }

  return (
    <div className='odc-steps'>
      {!hideTitle && <h3 className='odc-steps-title'>{t('CUSTOMER', 'Customer')}</h3>}
      <p className='odc-steps-lead'>{t('SEARCH_WITH_PHONE_FOR_CUSTOM_ORDER', 'Search for the customer by phone number.')}</p>
      <div className='odc-steps-customer-row'>
        {showSearchbar
          ? (
            <div className='odc-steps-search-field'>
              <input
                className='odc-steps-input'
                placeholder={t('PHONE_NUMBER', 'Phone number')}
                aria-label={t('PHONE_NUMBER', 'Phone number')}
                inputMode='numeric'
                autoComplete='off'
                role='combobox'
                data-wizard-initial-focus=''
                aria-autocomplete='list'
                aria-haspopup='listbox'
                aria-expanded={listOpen}
                aria-controls={listOpen ? listId : undefined}
                aria-activedescendant={listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                onChange={e => { setSuggestionsClosed(false); onInputChange(e.target.value) }}
                onKeyDown={handleSearchKeyDown}
                defaultValue={phone}
                onKeyPress={(e) => {
                  if (!/^[0-9]$/.test(e.key) || e.target.value.length >= 10) {
                    e.preventDefault()
                  }
                }}
                onFocus={() => { setSuggestionsClosed(false); setSearchInputFocus(true) }}
                onBlur={() => {
                  blurTimer.current = setTimeout(() => {
                    setSearchInputFocus(false)
                  }, 300)
                }}
                onPaste={(event) => onPhoneNumberPaste(event)}
              />
              {customersPhones.loading && (
                <span className='odc-steps-search-loading' aria-hidden='true'>
                  <LoaderCircle className='odc-icon' />
                </span>
              )}
              {suggestionsShown && (
                <div className='odc-steps-suggestions'>
                  {suggestionCount > 0
                    ? (
                      <div role='listbox' id={listId} aria-label={t('CUSTOMER_SUGGESTIONS', 'Customer suggestions')}>
                        {foundUsers.length > 0
                          ? foundUsers.map((user, index) => (
                            <button
                              type='button'
                              role='option'
                              id={optionId(index)}
                              tabIndex={-1}
                              aria-selected={index === activeIndex}
                              className='odc-steps-row'
                              key={user.id}
                              onClick={() => onSelectUser(user)}
                            >
                              {renderUser(user)}
                            </button>
                          ))
                          : (
                            <button
                              type='button'
                              role='option'
                              id={optionId(0)}
                              tabIndex={-1}
                              aria-selected={activeIndex === 0}
                              className='odc-steps-row'
                              onClick={() => handleOpenAddForm()}
                            >
                              {t('USERS_REGISTER', 'New user')}
                            </button>
                            )}
                      </div>
                      )
                    : customersPhones.loading
                      ? <p className='odc-steps-suggestions-note'>{t('LOADING', 'Loading')}</p>
                      : <p className='odc-steps-suggestions-note'>{t('TYPE_AT_LEAST_NUMBER_SUGGEST', 'Type at least 7 digits to see suggestions')}</p>}
                </div>
              )}
            </div>
            )
          : (
            <div className='odc-steps-picked'>
              <button
                ref={pickedRef}
                type='button'
                className='odc-steps-row'
                aria-label={[
                  t('CHANGE_CUSTOMER', 'Change customer'),
                  [selectedUser?.cellphone || selectedUser?.phone, selectedUser?.name, selectedUser?.lastname].filter(Boolean).join(' ')
                ].filter(Boolean).join(': ')}
                onClick={() => setShowSearchbar(true)}
              >
                {renderUser(selectedUser)}
                <span className='odc-steps-row-end'>{t('CHANGE', 'Change')}</span>
              </button>
              <IconButton
                icon={X}
                label={t('REMOVE_CUSTOMER', 'Remove customer')}
                onClick={() => onRemoveCustomer()}
              />
            </div>
            )}
        <Button
          variant='secondary'
          data-subview-opener={VIEW_USER_FORM}
          disabled={!showSearchbar}
          onClick={() => handleOpenAddForm()}
        >
          {t('USERS_REGISTER', 'New user')}
        </Button>
      </div>
      {selectedUser && (
        <div className='odc-steps-address-row'>
          {customerAddress?.address && (
            <>
              <MapPin className='odc-icon' aria-hidden='true' />
              <span className='odc-steps-address-text'>{customerAddress.address}</span>
            </>
          )}
          <Button data-subview-opener={VIEW_ADDRESS_LIST} onClick={() => handleOpenAddressList()}>
            {customerAddress?.address ? t('CHANGE', 'Change') : t('ADD_NEW_ADDRESS', 'Add new address')}
          </Button>
        </div>
      )}
    </div>
  )
}
