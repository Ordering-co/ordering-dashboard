import React, { useRef, useEffect } from 'react'
import { Search, XCircle } from 'react-bootstrap-icons'
import {
  SearchContainer
} from './styles'

const DEBOUNCE_MS = 750

export const SearchBar = (props) => {
  const {
    onSearch,
    search,
    placeholder,
    lazyLoad,
    customClass,
    hideSearchIcon,
    CustomInput
  } = props

  const timeoutRef = useRef(null)
  const el = useRef()

  const onChangeSearch = (e) => {
    const value = e.target.value
    clearTimeout(timeoutRef.current)
    if (!lazyLoad) {
      onSearch(value)
      return
    }
    timeoutRef.current = setTimeout(() => {
      onSearch(value)
    }, DEBOUNCE_MS)
  }

  const handleClear = () => {
    onSearch('')
    if (el.current) el.current.value = ''
  }

  useEffect(() => {
    if (!el.current) return
    if (!search) {
      el.current.value = ''
      return
    }
    // Show a search set from outside (e.g. carried with `?q=`), never while typing
    const isTyping = typeof document !== 'undefined' && document.activeElement === el.current
    if (!isTyping && el.current.value !== String(search)) {
      el.current.value = search
    }
  }, [search])

  const inputProps = {
    type: 'text',
    ref: el,
    name: 'search',
    placeholder,
    autoComplete: 'off',
    onChange: onChangeSearch
  }
  return (
    <SearchContainer className={customClass || ''} isCustomInput={!!CustomInput}>
      {CustomInput
        ? (
        <CustomInput {...inputProps} />
          )
        : (
        <input {...inputProps} />
          )}
      {el.current?.value
        ? <XCircle className='close' onClick={handleClear} />
        : !hideSearchIcon && <Search />}
    </SearchContainer>
  )
}
