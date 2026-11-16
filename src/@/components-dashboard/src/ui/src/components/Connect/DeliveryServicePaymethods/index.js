import React, { useMemo, useState } from 'react'
import { useLanguage } from '../../../../../index'

import { Button } from '../../Shared/Product'
import { DriversGroupPickList, DriversGroupPickRow } from '../../Delivery/DriversGroupPickList'
import './delivery-service-paymethods.css'

// the Payment methods of the delivery provider panel on the pick list of the delivery group panel, in
// place of main's SearchBar, grey buttons and legacy checkboxes. Same handlers, same Save / Add.
export const DeliveryServicePaymethods = (props) => {
  const {
    deliveryServiceState,
    paymethods,
    actionState,
    changesState,
    selectedPaymethodIds,
    handleAddDeliveryService,
    handleSelectPaymethod,
    handleSelectAllPaymethod,
    actionDisabled,
    handleUpdateDeliveryGroup
  } = props
  const [, t] = useLanguage()
  const [searchValue, setSearchValue] = useState('')

  // derived from the methods AND the search: as state refreshed only on a search, methods that arrived later never showed
  const filteredPaymethods = useMemo(() => {
    const all = paymethods ?? []
    const needle = searchValue.trim().toLowerCase()
    return needle ? all.filter(paymethod => paymethod?.name?.toLowerCase().includes(needle)) : all
  }, [paymethods, searchValue])

  const saving = Boolean(actionState?.loading)

  return (
    <div className='dsp-paymethods' data-disabled={actionDisabled ? '' : undefined}>
      <DriversGroupPickList
        legend={t('PAYMENT_METHODS', 'Payment methods')}
        search={searchValue}
        onSearch={setSearchValue}
        searchLabel={t('DRIVERS_GROUPS_SEARCH_PAYMETHODS', 'Search payment methods')}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
        placeholder={t('SEARCH', 'Search')}
        onSelectAll={() => handleSelectAllPaymethod(true)}
        onSelectNone={() => handleSelectAllPaymethod(false)}
        selectAllLabel={t('SELECT_ALL', 'Select all')}
        selectNoneLabel={t('SELECT_NONE', 'Select none')}
        empty={filteredPaymethods.length === 0}
        emptyTitle={t('DRIVERS_GROUPS_NO_PAYMETHODS', 'No payment methods enabled')}
        noMatchTitle={t('DRIVERS_GROUPS_LIST_NO_MATCH', 'Nothing matches your search')}
      >
        {filteredPaymethods.map(paymethod => (
          <DriversGroupPickRow
            key={paymethod.id}
            title={t(paymethod?.gateway?.toUpperCase(), paymethod?.name)}
            // the gateway tells apart the methods that share a name (Google Pay of Stripe and of Braintree)
            meta={paymethod?.gateway && <bdi dir='ltr' className='odc-figure'>{paymethod.gateway}</bdi>}
            checked={selectedPaymethodIds.includes(paymethod.id)}
            disabled={saving}
            onCheckedChange={next => handleSelectPaymethod(paymethod.id, next)}
          />
        ))}
      </DriversGroupPickList>
      <Button
        variant='primary'
        disabled={Object.keys(changesState).length === 0}
        busy={saving}
        onClick={() => deliveryServiceState.deliveryService ? handleUpdateDeliveryGroup(changesState) : handleAddDeliveryService()}
      >
        {deliveryServiceState.deliveryService ? t('SAVE', 'Save') : t('ADD', 'Add')}
      </Button>
    </div>
  )
}
