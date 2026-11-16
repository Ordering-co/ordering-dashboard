import React from 'react'
import PropTypes from 'prop-types'
import { useLanguage } from '../../../../../index'
import { SearchField } from '../../Shared/Product' // redesign W1-8 (T1-8-4): P/ search, not the legacy SearchBar
import { FiltersContainer, FilterItem } from './styles'

export const Filters = (props) => {
  const { search, onSearch, inputRef } = props
  const [, t] = useLanguage()

  return (
    <FiltersContainer>
      <FilterItem>
        <SearchField
          value={search}
          onChange={onSearch}
          label={t('SEARCH_STORE', 'Search store')}
          placeholder={t('SEARCH_STORE', 'Search store')}
          clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          inputRef={inputRef}
        />
      </FilterItem>
    </FiltersContainer>
  )
}

Filters.propTypes = {
  search: PropTypes.string
}
