import React, { useEffect, useRef } from 'react'
import styled, { css } from 'styled-components'

import { resolveSelectTheme } from '../../../styles/selectTheme'
import { Search, CircleX as XCircle } from '../Icon'
import { useLanguage } from '../../../../../index'
import { NativeInput } from './Input'
import './search-bar.css'

const DEBOUNCE_MS = 750
const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-search-${key}`, String(value)])
)

export const searchBarStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    surface: roles.surface,
    text: roles.text,
    'text-subtle': roles.textSubtle,
    border: roles.border,
    'border-strong': roles.borderStrong,
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    font: roles.fontFamily,
    'font-size': roles.fontSize,
    'compact-height': roles.compactHeight,
    'touch-target': roles.touchTarget,
    radius: roles.radiusControl,
    duration: roles.duration,
    easing: roles.easing,
    'icon-size': roles.iconSize
  })
}

export const SearchContainer = styled.div.attrs({
  className: 'od-ui od-search-bar',
  'data-slot': 'search-bar'
})`
  ${props => searchBarStyle(props.theme)}

  ${props => !props.isCustomInput && css`
    > input {
      box-sizing: border-box;
      width: 100%;
      min-height: var(--od-search-compact-height);
      border: 1px solid var(--od-search-border) !important;
      background: var(--od-search-surface);
      outline: none;
      padding: 0 15px;
      border-radius: var(--od-search-radius);
      font-family: var(--od-search-font);
      font-size: var(--od-search-font-size);
      color: var(--od-search-text);
      transition:
        background-color var(--od-search-duration) var(--od-search-easing),
        border-color var(--od-search-duration) var(--od-search-easing),
        color var(--od-search-duration) var(--od-search-easing);

      ${props.theme?.rtl ? css`padding-left: 40px;` : css`padding-right: 40px;`}

      &::placeholder {
        color: var(--od-search-text-subtle);
        opacity: 1;
      }

      &:hover {
        border-color: var(--od-search-border-strong) !important;
      }

      &:focus-visible {
        border-color: var(--od-search-focus) !important;
        outline: var(--od-search-focus-width) solid var(--od-search-focus);
        outline-offset: var(--od-search-focus-offset);
      }

      @media (pointer: coarse) {
        min-height: var(--od-search-touch-target);
        ${props.theme?.rtl
          ? css`padding-left: calc(var(--od-search-touch-target) + 15px);`
          : css`padding-right: calc(var(--od-search-touch-target) + 15px);`}
      }

      @media (prefers-reduced-motion: reduce) {
        transition-property: none;
        transition-duration: 0s;
      }
    }
  `}

  > svg,
  > button.close {
    ${props => props.theme?.rtl ? css`left: 15px;` : css`right: 15px;`}
  }
`

export const SearchBar = (props) => {
  const [, t] = useLanguage()
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
  const inputRef = useRef()

  const onChangeSearch = event => {
    const value = event.target.value
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
    if (inputRef.current) inputRef.current.value = ''
    inputRef.current?.focus()
  }

  useEffect(() => {
    if (!inputRef.current) return
    if (!search) {
      inputRef.current.value = ''
      return
    }
    // Show a search set from outside (e.g. carried with `?q=`), never while typing
    const isTyping = typeof document !== 'undefined' && document.activeElement === inputRef.current
    if (!isTyping && inputRef.current.value !== String(search)) {
      inputRef.current.value = search
    }
  }, [search])

  const inputProps = {
    type: 'text',
    ref: inputRef,
    name: 'search',
    placeholder,
    autoComplete: 'off',
    onChange: onChangeSearch
  }

  return (
    <SearchContainer className={customClass || ''} isCustomInput={!!CustomInput}>
      {CustomInput
        ? <CustomInput {...inputProps} />
        : <NativeInput {...inputProps} compatibility='legacy' nativeValueCompatibility />}
      {inputRef.current?.value
        ? (
          <button type='button' className='close od-search-clear' aria-label={t('CLEAR_SEARCH', 'Clear search')} onClick={handleClear}>
            <XCircle />
          </button>
          )
        : !hideSearchIcon && <Search />}
    </SearchContainer>
  )
}

SearchBar.displayName = 'OrderingSearchBar'
