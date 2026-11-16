import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { SearchField } from '../../Shared/Product'

// redesign PE-B2 (decision 2): the search of the promotions list, shared by Quick offers and Advanced offers (one search state: the
// controller's `searchValue` / `onSearch`). Moved here from M/EnterprisePromotionListing so both views import it without a cycle.

// The wait before the search text reaches the controller: each change of it is a request of the list (SearchBar lazyLoad: 750 ms)
const SEARCH_DEBOUNCE_MS = 750

// ---- the search box: typed here, sent after a wait (at once on Enter and on clear). A value set from outside shows unless the person is typing. ----
export const PromotionSearch = ({ search = '', onSearch }) => {
  const [, t] = useLanguage()
  const [text, setText] = useState(search || '')
  const timer = useRef(null)
  const input = useRef(null)
  const sent = useRef(search || '')
  sent.current = search || ''

  useEffect(() => {
    if (!search) {
      setText('')
      return
    }
    if (typeof document !== 'undefined' && document.activeElement !== input.current) setText(search)
  }, [search])
  useEffect(() => () => clearTimeout(timer.current), [])

  const send = (value) => {
    clearTimeout(timer.current)
    if (value !== sent.current) onSearch?.(value)
  }
  const type = (value) => {
    setText(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => send(value), SEARCH_DEBOUNCE_MS)
  }

  const label = t('PROMOTIONS_SEARCH', 'Search promotions')
  return (
    <div className='odc-promo-search'>
      <SearchField
        value={text}
        onChange={type}
        onClear={() => send('')}
        onKeyDown={(event) => { if (event.key === 'Enter') send(text) }}
        inputRef={input}
        label={label}
        placeholder={label}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
      />
    </div>
  )
}
