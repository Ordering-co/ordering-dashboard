import React, { useMemo, useState } from 'react'
import { useLanguage } from '../../../../../index'

import { Button } from '../../Shared/Product'
import { DriversGroupPickList, DriversGroupPickRow } from '../DriversGroupPickList'
import './drivers-group-paymethods.css'

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

export const DriversGroupPaymethods = (props) => {
  const {
    driversGroupState,
    paymethods,
    actionState,
    changesState,
    selectedPaymethodIds,
    handleUpdateDriversGroup,
    handleAddDriversGroup,
    handleSelectPaymethod,
    handleSelectAllPaymethod,
    actionDisabled,
    pickLists
  } = props
  const [, t] = useLanguage()
  const [searchValue, setSearchValue] = useState('')

  // redesign (AD-6): derived from the methods AND the search. It used to be state refreshed only when the search
  // changed, so a panel opened on this tab (the methods still on their way) kept an empty list for good.
  const filteredPaymethods = useMemo(() => {
    const all = paymethods ?? []
    const needle = searchValue.trim().toLowerCase()
    return needle ? all.filter(paymethod => paymethod?.name?.toLowerCase().includes(needle)) : all
  }, [paymethods, searchValue])

  const loading = Boolean(pickLists?.paymethods?.loading)
  const failed = hasError(pickLists?.paymethods?.error)
  const saving = Boolean(actionState?.loading)

  return (
    <div className='gpb-paymethods' data-disabled={actionDisabled ? '' : undefined}>
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
        loading={loading}
        loadingLabel={t('LOADING', 'Loading')}
        error={!loading && failed}
        errorTitle={t('DRIVERS_GROUPS_PAYMETHODS_LOAD_ERROR', "We couldn't load the payment methods.")}
        empty={filteredPaymethods.length === 0}
        emptyTitle={t('DRIVERS_GROUPS_NO_PAYMETHODS', 'No payment methods enabled')}
        noMatchTitle={t('DRIVERS_GROUPS_LIST_NO_MATCH', 'Nothing matches your search')}
      >
        {filteredPaymethods.map(paymethod => (
          <DriversGroupPickRow
            key={paymethod.id}
            title={t(paymethod?.gateway?.toUpperCase(), paymethod?.name)}
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
        onClick={() => driversGroupState.driversGroup ? handleUpdateDriversGroup(changesState) : handleAddDriversGroup()}
      >
        {driversGroupState.driversGroup ? t('SAVE', 'Save') : t('ADD', 'Add')}
      </Button>
    </div>
  )
}
