import React from 'react'
import PropTypes from 'prop-types'
import { useLanguage } from '../../../../../index'
import { SearchBar } from '../../Shared/SearchBar'
import { FiltersContainer, FilterItem } from './styles'

export const Filters = (props) => {
  const { search, onSearch } = props
  const [, t] = useLanguage()

  return (
    <FiltersContainer>
      <FilterItem>
        <SearchBar
          isCustomLayout
          lazyLoad
          search={search}
          placeholder={t('SEARCH_STORE', 'Search store')}
          onSearch={onSearch}
        />
      </FilterItem>
    </FiltersContainer>
  )
}

Filters.propTypes = {
  search: PropTypes.string
}
