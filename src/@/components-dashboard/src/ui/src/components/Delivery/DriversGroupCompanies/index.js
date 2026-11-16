import React, { useMemo, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { FieldError } from '../DriversGroupAddForm/FieldError'
import { DriversGroupPickList, DriversGroupPickRow } from '../DriversGroupPickList'

export const DriversGroupCompanies = (props) => {
  const {
    companies,
    actionState,
    selectedDriversCompanyIds,
    handleSelectDriversCompany,
    handleSelectAllDriversCompany,
    // redesign (AD-6): `{ loading, error }` of each list the panel picks from (the page's); absent in the add form
    pickLists,
    // (P-2 of batch R): opt-in, `{ id, message }` of the add form's check; without it (the edit form) nothing changes
    selectionError
  } = props
  const [, t] = useLanguage()
  const [searchValue, setSearchValue] = useState(null)

  // redesign (AD-6, root cause): derived from `companies` and the search, not copied into state when the search changes,
  // so the list is there when the companies arrive after the first paint
  const filteredCompanies = useMemo(() => {
    const list = companies ?? []
    if (!searchValue) return list
    return list.filter(company => company?.name?.toLowerCase().includes(searchValue.toLowerCase()))
  }, [companies, searchValue])

  // redesign (AD-4): a named group with Product actions and rows; the add form's message sits in the `message` slot
  return (
    <DriversGroupPickList
      legend={t('DRIVER_COMPANIES', 'Driver companies')}
      search={searchValue}
      onSearch={setSearchValue}
      searchLabel={t('DRIVERS_GROUPS_SEARCH_COMPANIES', 'Search driver companies')}
      clearLabel={t('CLEAR_SEARCH', 'Clear search')}
      placeholder={t('SEARCH', 'Search')}
      onSelectAll={() => handleSelectAllDriversCompany(true)}
      onSelectNone={() => handleSelectAllDriversCompany(false)}
      selectAllLabel={t('SELECT_ALL', 'Select all')}
      selectNoneLabel={t('SELECT_NONE', 'Select none')}
      message={selectionError && <FieldError id={selectionError.id}>{selectionError.message}</FieldError>}
      // redesign the fieldset (named by its legend) is the one group the message describes
      groupProps={selectionError ? { 'aria-describedby': selectionError.id, tabIndex: -1 } : undefined}
      loading={Boolean(pickLists?.companies?.loading)}
      loadingLabel={t('LOADING', 'Loading')}
      error={Boolean(pickLists?.companies?.error)}
      errorTitle={t('DRIVERS_GROUPS_COMPANIES_LOAD_ERROR', "We couldn't load the driver companies.")}
      empty={filteredCompanies.length === 0}
      emptyTitle={t('DRIVERS_GROUPS_NO_COMPANIES', 'No driver companies yet')}
      noMatchTitle={t('DRIVERS_GROUPS_LIST_NO_MATCH', 'Nothing matches your search')}
    >
      {filteredCompanies.map(company => (
        <DriversGroupPickRow
          key={company.id}
          title={company?.name}
          checked={selectedDriversCompanyIds.includes(company.id)}
          disabled={Boolean(actionState?.loading)}
          onCheckedChange={next => handleSelectDriversCompany(company.id, next)}
        />
      ))}
    </DriversGroupPickList>
  )
}
