import React, { useState, useEffect, useRef } from 'react'

import {
  AddressList as AddressListController,
  useLanguage
} from '../../../../../index'

import { Button as ProductButton, ConfirmDialog, EmptyState, IconButton as ProductIconButton, InlineNotice, Skeleton as ProductSkeleton } from '../../Shared/Product'
import { House, MapPin, Plus, Star, Store, Trash2 } from '../../Shared/Icon'
import { AddressForm } from '../AddressForm'
import { scrollTo } from '../../../utils'
import '../../Orders/CreateCustomOrder/steps.css'

// redesign fix-qa: E3. Icon of each address type in the embedded list; the type is also written next to it.
const TAG_ICONS = { home: House, office: Store, favorite: Star }
const TAG_LABELS = {
  // redesign W0-4c (T0-15, decisión 19): address type uses HOME_ADDRESS; HOME is the menu.
  home: ['HOME_ADDRESS', 'Home'],
  office: ['OFFICE', 'Office'],
  favorite: ['ADDRESS_TAG_FAVORITE', 'Favorite']
}
const SKELETON_ROWS = 3

const AddressListUI = (props) => {
  const {
    actionStatus,
    addressList,
    handleDelete,
    setAddressList,
    handleSetDefault,
    isSeletectedUserAddresses,
    isProductForm,
    userId,
    userCustomerSetup,
    setCustomerModalOpen,
    setExtraOpen,
    userState,
    handleSuccessUpdate,
    isAutoOpenAddNewAddress
  } = props

  const [, t] = useLanguage()

  const [curAddress, setCurAddress] = useState(false)
  const [addressOpen, setAddressOpen] = useState(false)
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  // Redesign fix-qa E3: the button that opened the form, to give the focus back to it.
  const rootRef = useRef(null)
  const openerRef = useRef(null)
  const wasFormOpen = useRef(false)

  const [uniqueAddressesList, setUniqueAddressesList] = useState([])

  const openAddress = (address) => {
    setCurAddress(address)
    setAddressOpen(true)
    const container = window.document.getElementsByClassName('form_edit')[0]
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (container && reduceMotion) container.scrollTop = 0
    else if (container) scrollTo(container, 0, 500)
  }

  const handleSaveAddress = (address) => {
    let found = false
    const addresses = addressList.addresses.map(_address => {
      if (_address?.id === address?.id) {
        Object.assign(_address, address)
        found = true
      } else if (address.default) {
        _address.default = false
      }
      return _address
    })
    if (!found) {
      addresses.push(address)
      setAddressOpen(false)
    }
    setAddressList({
      ...addressList,
      addresses
    })
    if (handleSuccessUpdate) {
      const updatedUser = { ...userState.user, addresses }
      handleSuccessUpdate(updatedUser)
    }
    if (userCustomerSetup) {
      handleSetAddress(address)
    }
  }

  const handleSetAddress = (address) => {
    if (address?.default) {
      setCustomerModalOpen && setCustomerModalOpen(false)
      return
    }
    setAddressOpen(false)
    handleSetDefault(address, userCustomerSetup)
  }

  const handleDeleteClick = (address) => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_ADDRESS', 'Are you sure that you want to delete the address?'),
      handleOnAccept: () => {
        handleDelete(address)
        setConfirm({ ...confirm, open: false })
      }
    })
  }

  /**
   * Close modals and alerts
   */
  useEffect(() => {
    return () => {
      setConfirm({ ...confirm, open: false })
      setAddressOpen(false)
    }
  }, [])

  useEffect(() => {
    setExtraOpen && setExtraOpen(addressOpen)
  }, [addressOpen])

  useEffect(() => {
    if (addressOpen) {
      wasFormOpen.current = true
    } else if (wasFormOpen.current) {
      wasFormOpen.current = false
      rootRef.current?.querySelector(`[data-address-opener="${openerRef.current}"]`)?.focus()
    }
  }, [addressOpen])

  useEffect(() => {
    if (addressList.loading) return
    const _uniqueAddressesList = (addressList.addresses && addressList.addresses.filter(
      (address, i, self) =>
        i === self.findIndex(obj => (
          address.address === obj.address &&
          address.address_notes === obj.address_notes &&
          address.zipcode === obj.zipcode &&
          address.internal_number === obj.internal_number
        )))) || []
    setUniqueAddressesList(_uniqueAddressesList)
  }, [addressList])

  useEffect(() => {
    if (addressList.loading || !isAutoOpenAddNewAddress) return
    if (!addressList.error && addressList?.addresses?.length === 0) {
      setTimeout(() => {
        openAddress({})
      }, 500)
    }
  }, [addressList])

  const busy = Boolean(addressList.loading || actionStatus?.loading)
  const listError = !busy && addressList.error?.length > 0 ? (addressList.error[0]?.message || addressList.error[0]) : null
  const actionError = !busy && actionStatus?.error ? [].concat(actionStatus.error).filter(Boolean).join(' ') : null
  const openFrom = (key, address) => {
    openerRef.current = key
    openAddress(address)
  }

  // Escape in the form goes back to the list, and only that: the view that holds the list takes the next one.
  const handleFormKeyDown = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    if (!event.currentTarget.contains(event.target)) return
    event.stopPropagation()
    setAddressOpen(false)
  }

  if (addressOpen && isSeletectedUserAddresses) {
    return (
      <div ref={rootRef} className='odc-addr' onKeyDown={handleFormKeyDown}>
        <AddressForm
          isEmbedded
          isSeletectedUserAddresses
          userId={userId}
          addressesList={addressList?.addresses}
          useValidationFileds
          address={curAddress}
          onCancel={() => setAddressOpen(false)}
          onSaveAddress={handleSaveAddress}
          userCustomerSetup={userCustomerSetup}
        />
      </div>
    )
  }

  // No #address_control on this one: the sub view hides that id while the form is open, which would hide the button
  // the focus returns to when it closes.
  return (
    <div ref={rootRef} className='odc-addr' aria-busy={busy || undefined}>
      <div className='odc-addr-add'>
        <ProductButton
          variant='secondary'
          icon={Plus}
          data-address-opener='add'
          disabled={busy}
          onClick={() => openFrom('add', {})}
        >
          {t('ADD_NEW_ADDRESS', 'Add new address')}
        </ProductButton>
      </div>

      {actionError && <InlineNotice tone='danger' role='alert'>{actionError}</InlineNotice>}
      {listError && <InlineNotice tone='danger' role='alert'>{listError}</InlineNotice>}

      {busy && (
        <div role='group' aria-busy='true' aria-label={t('SELECT_CUSTOMER_ADDRESS', 'Select customer address')} className='odc-steps-list'>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className='odc-steps-skeleton-row'><ProductSkeleton size='60%' /></div>
          ))}
        </div>
      )}

      {!busy && !addressList.error && addressList?.addresses?.length === 0 && !isProductForm && (
        <EmptyState
          icon={MapPin}
          title={t('NOT_FOUND_ADDRESS', 'Sorry, You don\'t seem to have any addresses.')}
        />
      )}

      {!busy && !addressList.error && addressList?.addresses?.length > 0 && (
        // redesign UF-R1 (F5): a named list, not `role='radiogroup'`: the rows also hold the Edit and Delete buttons, which a
        // radiogroup may not own (axe: list children / radiogroup content). The native radios are one group by their `name`.
        <ul className='odc-steps-list odc-addr-list' aria-label={t('SELECT_CUSTOMER_ADDRESS', 'Select customer address')}>
          {uniqueAddressesList.map(address => {
            const TagIcon = TAG_ICONS[address?.tag] || MapPin
            const tagLabel = TAG_LABELS[address?.tag] ? t(TAG_LABELS[address.tag][0], TAG_LABELS[address.tag][1]) : null
            const detail = [tagLabel, [address.internal_number, address.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
            return (
              <li key={address?.id} className='odc-addr-row'>
                <label className='odc-addr-main'>
                  <input
                    type='radio'
                    className='odc-addr-radio'
                    name='customer-address'
                    checked={Boolean(address.default)}
                    disabled={actionStatus?.loading}
                    onChange={() => handleSetAddress(address)}
                  />
                  <TagIcon className='odc-icon odc-addr-tag' aria-hidden='true' />
                  <span className='odc-steps-row-main'>
                    <span className='odc-addr-name'>{address.address}</span>
                    {detail && <span className='odc-steps-row-meta'>{detail}</span>}
                  </span>
                </label>
                <ProductButton
                  variant='ghost'
                  data-address-opener={`edit-${address.id}`}
                  disabled={actionStatus?.loading}
                  aria-label={`${t('EDIT', 'Edit')} ${address.address}`}
                  onClick={() => openFrom(`edit-${address.id}`, address)}
                >
                  {t('EDIT', 'Edit')}
                </ProductButton>
                <ProductIconButton
                  icon={Trash2}
                  label={`${t('DELETE', 'Delete')} ${address.address}`}
                  disabled={actionStatus?.loading || address.default}
                  onClick={() => handleDeleteClick(address)}
                />
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirm.open}
        title={t('DELETE_ADDRESS', 'Delete address')}
        confirmLabel={t('DELETE', 'Delete')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => confirm.handleOnAccept?.()}
        onCancel={() => setConfirm({ ...confirm, open: false })}
      >
        {confirm.content}
      </ConfirmDialog>
    </div>
  )
}

export const AddressList = (props) => {
  const addressListProps = {
    ...props,
    UIComponent: AddressListUI
  }

  return <AddressListController {...addressListProps} />
}
