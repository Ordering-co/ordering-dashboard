import React, { useEffect, useRef, useState } from 'react'
import { useTheme } from 'styled-components'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { usePopper } from 'react-popper'

import { ChevronDown } from '../Icon'
import { Pagination } from '../Pagination'
import { SearchBar } from '../SearchBar'
import { HeaderItem, PopoverBody, legacySelectStyle } from './legacy-select-styles'
import { useSession } from '../../../../../index'
import './legacy-select.css'

const isActivationKey = event => event.key === 'Enter' || event.key === ' '

const classNames = (...values) => values.filter(Boolean).join(' ')
const textFromNode = node => {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textFromNode).join(' ').trim()
  if (React.isValidElement(node)) return textFromNode(node.props.children)
  return ''
}

export const LegacySelect = (props) => {
  const {
    placeholder,
    options,
    defaultValue,
    onChange,
    notAsync,
    noSelected,
    isSecondIcon,
    isShowSearchBar,
    searchValue,
    handleChangeSearch,
    searchBarIsCustomLayout,
    searchBarPlaceholder,
    searchBarIsNotLazyLoad,
    className,
    isShowCustomOption,
    customOptionTitle,
    handleCustomOptionClick,
    pagination,
    handleChangePage,
    handleChangePageSize,
    useLazyPagination,
    isHidePagecontrol
  } = props
  const theme = useTheme()
  const rootStyle = legacySelectStyle(theme)
  const defaultOption = options.find(option => option.value === defaultValue)
  const [selectedOption, setSelectedOption] = useState(defaultOption)
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [sessionState] = useSession()
  const referenceElement = useRef()
  const popperElement = useRef()
  const arrowElement = useRef()
  const { styles, attributes, update } = usePopper(referenceElement.current, popperElement.current, {
    placement: 'bottom',
    modifiers: [
      { name: 'arrow', options: { element: arrowElement.current } },
      { name: 'offset', options: { offset: [0, 12] } }
    ]
  })

  useEffect(() => {
    if (update) update()
  }, [open, sessionState])

  useEffect(() => {
    if (isShowSearchBar && searchValue) return
    if (!notAsync) {
      const nextDefault = options.find(option => option.value === defaultValue)
      if (!(useLazyPagination && pagination)) setSelectedOption(nextDefault)
      setValue(defaultValue)
    }
  }, [defaultValue, options, searchValue])

  useEffect(() => {
    const handleClickOutside = event => {
      if (!open) return
      const outsidePopover = !popperElement.current?.contains(event.target)
      const outsideTrigger = !referenceElement.current?.contains(event.target)
      if (!outsidePopover || !outsideTrigger) return
      if (isShowSearchBar) handleChangeSearch('')
      setOpen(false)
    }
    const handleEscape = event => {
      if (event.keyCode !== 27 || !open) return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      referenceElement.current?.focus()
    }

    window.addEventListener('mouseup', handleClickOutside)
    window.addEventListener('keydown', handleEscape, true)
    return () => {
      window.removeEventListener('mouseup', handleClickOutside)
      window.removeEventListener('keydown', handleEscape, true)
    }
  }, [open, isShowSearchBar, handleChangeSearch]) // (main): the handlers see the current search props

  const accessibleName = textFromNode(selectedOption ? (selectedOption.showOnSelected || selectedOption.content) : placeholder)
  const visibleOptions = options.filter((_, index) => {
    if (!pagination || useLazyPagination) return true
    return pagination.currentPage === 1
      ? index < pagination.pageSize
      : index >= pagination.pageSize * (pagination.currentPage - 1) && index < pagination.pageSize * pagination.currentPage
  })

  const handleOpenChange = nextOpen => setOpen(nextOpen)

  const selectOption = option => {
    if (!noSelected) {
      setSelectedOption(option)
      setValue(option.value)
    }
    onChange && onChange(option.value)
  }

  const handleTriggerKeyDown = event => {
    if (event.target !== event.currentTarget) {
      event.preventBaseUIHandler?.()
      return
    }
    if (!isActivationKey(event)) {
      event.preventBaseUIHandler?.()
      return
    }
    if (event.target.closest('.open-disabled')) return
    event.preventDefault()
    event.preventBaseUIHandler?.()
    setOpen(current => !current)
  }

  const handleTriggerClick = event => {
    if (event.target.closest('.open-disabled')) event.preventBaseUIHandler?.()
  }

  const handleOptionClick = (event, option) => {
    if (event.target.closest('.disabled') === null) setOpen(false)
    if (option.value === null || option.disabled) return
    selectOption(option)
  }

  const handleOptionKeyDown = (event, option) => {
    if (event.target !== event.currentTarget) return
    if (!isActivationKey(event)) return
    if (option.disabled || option.value === null) return
    event.preventDefault()
    handleOptionClick(event, option)
    referenceElement.current?.focus()
  }

  const handleCustomOption = event => {
    if (event.type === 'keydown' && event.target !== event.currentTarget) return
    if (event.type === 'keydown' && !isActivationKey(event)) {
      event.stopPropagation()
      return
    }
    if (event.type === 'keydown') event.preventDefault()
    handleCustomOptionClick()
    setOpen(false)
    if (event.type === 'keydown') referenceElement.current?.focus()
  }

  const handlePagination = page => {
    setOpen(true)
    handleChangePage(page)
  }

  const popupStyle = {
    ...styles.popper,
    display: open ? 'block' : 'none',
    minWidth: referenceElement.current?.offsetWidth || '100px'
  }
  if (!open) popupStyle.transform = 'translate3d(0px, 0px, 0px)'
  const listStyle = {
    ...(props.optionInnerMargin !== undefined ? { '--od-legacy-select-option-margin': props.optionInnerMargin } : {}),
    ...(props.optionInnerMaxHeight !== undefined ? { '--od-legacy-select-option-max-height': props.optionInnerMaxHeight } : {})
  }

  return (
    <CollapsiblePrimitive.Root
      open={open}
      onOpenChange={handleOpenChange}
      disabled={false}
      render={(
        <div
          className={classNames('od-ui', 'od-legacy-select-root', className || 'select-wrapper')}
          style={rootStyle}
          dir={theme?.rtl ? 'rtl' : 'ltr'}
          data-slot='legacy-select-root'
        />
      )}
    >
        <CollapsiblePrimitive.Trigger
          render={<HeaderItem role='button' aria-label={accessibleName || undefined} />}
          nativeButton={false}
          ref={referenceElement}
          aria-expanded={open}
          aria-haspopup='listbox'
          data-second-icon={isSecondIcon || undefined}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
          onKeyUp={event => {
            // Activation already ran on keydown, matching the native legacy div.
            if (event.target === event.currentTarget && isActivationKey(event)) event.preventBaseUIHandler?.()
          }}
        >
          <div className='od-legacy-select-selected'>
            {selectedOption
              ? <div className='od-legacy-select-header header'>{selectedOption.showOnSelected || selectedOption.content}</div>
              : (placeholder || '')}
            <span className='od-legacy-select-chevron' aria-hidden='true'>
              <ChevronDown />
            </span>
          </div>
        </CollapsiblePrimitive.Trigger>

        {options && (
          <CollapsiblePrimitive.Panel
            keepMounted
            render={(
              <PopoverBody
                ref={popperElement}
                style={popupStyle}
                {...attributes.popper}
              />
            )}
          >
            <div
                className='od-ui od-legacy-select-popup options'
                dir={theme?.rtl ? 'rtl' : 'ltr'}
                role='presentation'
              >
                {isShowSearchBar && (
                  <div
                    className='od-legacy-select-search search-bar-container'
                    onKeyDown={event => event.key !== 'Escape' && event.stopPropagation()}
                  >
                    <SearchBar
                      lazyLoad={!searchBarIsNotLazyLoad}
                      isCustomLayout={searchBarIsCustomLayout}
                      search={searchValue}
                      onSearch={handleChangeSearch}
                      placeholder={searchBarPlaceholder || ''}
                    />
                  </div>
                )}

                <div className='od-legacy-select-options-inner list-wrapper' style={listStyle} role='listbox'>
                  {visibleOptions.map((option, index) => (
                    <div
                      key={index}
                      className={classNames(
                        'od-legacy-select-option option',
                        option.disabled && 'disabled',
                        option.showDisable && 'od-option-hidden',
                        props.optionBottomBorder && 'od-option-border',
                        option.color === 'primary' && 'od-option-primary'
                      )}
                      role='option'
                      tabIndex={option.disabled || option.value === null ? -1 : 0}
                      data-disabled={option.disabled || undefined}
                      data-selected={option.value === value ? '' : undefined}
                      aria-disabled={Boolean(option.disabled || option.value === null)}
                      aria-selected={option.value === value}
                      onClick={event => handleOptionClick(event, option)}
                      onKeyDown={event => handleOptionKeyDown(event, option)}
                    >
                      {option.content}
                    </div>
                  ))}

                  {isShowCustomOption && (
                    <div
                      className='od-legacy-select-custom-option option custom-option'
                      role='option'
                      tabIndex={0}
                      aria-selected='false'
                      onClick={handleCustomOption}
                      onKeyDown={handleCustomOption}
                    >
                      {customOptionTitle}
                    </div>
                  )}
                </div>

                {pagination && handleChangePageSize && handleChangePage && (
                  <div className='od-legacy-select-pagination' onClick={event => event.stopPropagation()}>
                    <Pagination
                      currentPage={pagination.currentPage}
                      totalPages={pagination.totalPages}
                      handleChangePage={handlePagination}
                      handleChangePageSize={handleChangePageSize}
                      defaultPageSize={pagination.pageSize}
                      isHidePagecontrol={isHidePagecontrol}
                    />
                  </div>
                )}
            </div>
          </CollapsiblePrimitive.Panel>
        )}
    </CollapsiblePrimitive.Root>
  )
}

LegacySelect.displayName = 'OrderingLegacySelect'
