import React, { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTheme } from 'styled-components'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'

import { Button } from '../../../styles/Buttons'
import { Check, ChevronDown, Square, SquareCheck, X } from '../Icon'
import { Pagination } from '../Pagination'
import { SearchBar } from '../SearchBar'
import { Button as ProductButton, IconButton as ProductIconButton } from '../Product/Button'
import { SearchField } from '../Product/FilterBar'
import { useLanguage } from '../../../../../index'
import { SelectFieldLabelContext } from './FirstSelect'
import { CheckBox, PaginationWrapper, TextFormatted, multiSelectStyle } from './multi-select-styles'
import { PLACEMENT_MODES, chooseFloating, useSelectSurface } from './selectPlacement'
import { createTypeahead, focusOption, focusSearch, navigateOptions, typeaheadFromField } from './selectKeyboard'
import './multi-select.css'

const isActivationKey = event => event.key === 'Enter' || event.key === ' '
const classNames = (...values) => values.filter(Boolean).join(' ')

// The chips of a C18 field (redesign F6c, P3-01): one per chosen value, each with its own X, as in `main`. The
// ones that do not fit the field leave it (they stay mounted, `data-overflowed`, so «Clear» and the list keep
// working) and «+N» counts them. The first chip always stays: when it alone is wider than the field, its text is
// cut with an ellipsis. Measured from natural widths, so the result never depends on what is showing.
const CHIP_MARGIN = 2
const px = value => Number.parseFloat(value) || 0
const widthOf = node => (node ? node.getBoundingClientRect().width : 0)

// What a screen reader would read of a node: its text without the decorative parts (an avatar's initials are `aria-hidden`).
const readableText = node => {
  if (node.nodeType === 3) return node.nodeValue
  if (node.nodeType !== 1 || node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('hidden')) return ''
  return Array.from(node.childNodes).map(readableText).join(' ')
}

const layoutChips = header => {
  const children = Array.from(header.children)
  const chips = children.filter(node => node.classList.contains('od-multi-select-chip'))
  const more = children.find(node => node.classList.contains('od-multi-select-more'))
  // A field nobody can see (display: none above it) has no width to measure: keep what it had.
  if (!header.clientWidth) return null
  chips.forEach(chip => chip.removeAttribute('data-overflowed'))
  more?.removeAttribute('data-empty')
  header.setAttribute('data-measuring', '')
  let shown = chips.length
  try {
    const widths = chips.map(widthOf)
    const gap = px(getComputedStyle(header).columnGap)
    const room = header.clientWidth - CHIP_MARGIN
    const required = count => {
      const parts = widths.slice(0, count)
      if (count < chips.length) parts.push(widthOf(more))
      return parts.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, parts.length - 1)
    }
    while (shown > 1 && required(shown) > room) shown -= 1
  } finally {
    header.removeAttribute('data-measuring')
  }
  chips.forEach((chip, index) => {
    if (index >= shown) chip.setAttribute('data-overflowed', '')
  })
  if (shown >= chips.length) more?.setAttribute('data-empty', '')
  return chips.slice(shown).map(chip => {
    const content = chip.querySelector('.od-multi-select-chip-content')
    return (content ? readableText(content) : '').replace(/\s+/g, ' ').trim()
  })
}

// The picture of a row's checkbox (C18). The row is the control and carries the state in `aria-selected`: the box is
// drawn like the Product checkbox (multi-select.css) but is not a control, so the option has no interactive child (A2-02).
const OptionBox = ({ checked }) => (
  <span className='od-multi-select-picture' aria-hidden='true' {...(checked ? { 'data-checked': '' } : {})}>
    {checked && <Check className='od-multi-select-picture-mark' />}
  </span>
)

export const MultiSelect = (props) => {
  const {
    placeholder,
    options,
    onChange,
    defaultValue,
    className,
    isShowSearchBar,
    searchBarIsNotLazyLoad,
    searchBarPlaceholder,
    searchBarIsCustomLayout,
    searchValue,
    handleChangeSearch,
    useTextStyle,
    textClassnames,
    hideChevronIcon,
    andText,
    pagination,
    handleChangePage,
    handleChangePageSize,
    useLazyPagination,
    isLoading,
    optionsPosition,
    isHidePagecontrol,
    dropdownMinWidth,
    isFullWidthOptions,
    ariaLabelledBy,
    ariaLabel
  } = props
  const theme = useTheme()
  const rootStyle = multiSelectStyle(theme)
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState([])
  const [selectedOptions, setSelectedOptions] = useState([])
  const dropdownReference = useRef()
  const referenceElement = useRef()
  // redesign F6h-4 (A2): a field with chips is a plain container; its opener and every X are siblings inside it.
  const fieldElement = useRef(null)
  const [, t] = useLanguage()
  // Opt-in (selectPlacement.js): `fitTrigger` aligns the list to the trigger's start and width with brand rows
  // and no pager, and implies `placement='auto'`: it flips up without room and never leaves its clipping parent.
  const surface = useSelectSurface(props)
  const fit = !!surface.fitTrigger
  const placementMode = PLACEMENT_MODES.includes(surface.placement) ? surface.placement : (fit ? 'auto' : null)
  const [side, setSide] = useState(null)
  const [measureKey, setMeasureKey] = useState(0)
  // C18: where the focus goes when the list opens from the keyboard, the type-ahead buffer, whether the
  // search field was shown during this opening, and the values «Clear» still has to take out one by one.
  const focusOnOpen = useRef(null)
  const typeahead = useRef(null)
  const [clearQueue, setClearQueue] = useState(null)
  // The chips of the field (C18): the names that did not fit, the node measured, and where the focus goes when
  // an X takes its chip away.
  const [hiddenChips, setHiddenChips] = useState([])
  // The text each chip draws, by value (redesign F6e-2, Q4-08): the options of the sheet are JSX, so the X reads its name from
  // the chip once it is drawn and puts it in `aria-label` and `title` (the tooltip), not only in `aria-labelledby`.
  const [chipTexts, setChipTexts] = useState({})
  const headerRef = useRef(null)
  const chipsId = useId()
  // redesign F6h-2 (A2-02), C18 only (opt-in per surface, pilot L2-09): the popup is a group that holds the search
  // field, the listbox (only the option rows) and the footer; the listbox has a name and the field points to it. The
  // legacy popup stays a single `role=listbox` with `aria-multiselectable`, as before.
  const listboxId = fit ? `${chipsId}-listbox` : undefined
  // redesign F6i-2 (A3-02), C18 only: the trigger is named «<field label> <current value>». The label is the one the consumer points
  // to, else the visible label of the surrounding field (the Filters sheet), else `ariaLabel`.
  const fieldLabelId = useContext(SelectFieldLabelContext)
  const labelRef = fit ? (ariaLabelledBy || fieldLabelId || undefined) : undefined
  const chipsWatch = useRef({ node: null, observer: null, hidden: [] })
  const removeButtons = useRef(new Map())
  const pendingFocus = useRef(null)

  const handleTriggerClick = event => {
    if (event.target.closest('.remove_option')) event.preventBaseUIHandler?.()
  }

  // The container of a field with chips: a click anywhere on it that is not one of its buttons (a chip's text, the free
  // area, the chevron) opens the list as the old trigger did. The opener and the X's handle their own clicks.
  const handleFieldClick = event => {
    if (event.target.closest('button')) return
    setOpen(current => !current)
  }

  const handleSelectKeyDown = event => {
    if (event.target !== event.currentTarget) {
      event.preventBaseUIHandler?.()
      return
    }
    if (fit && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      event.preventBaseUIHandler?.()
      if (open) focusOption(dropdownReference.current, 'selected')
      else {
        focusOnOpen.current = 'selected'
        setOpen(true)
      }
      return
    }
    // Q3-06: with the list open and no search field, typing jumps to the row that starts with those letters.
    if (fit && open) {
      typeahead.current = typeahead.current || createTypeahead()
      if (typeaheadFromField(event, dropdownReference.current, typeahead.current)) {
        event.preventBaseUIHandler?.()
        return
      }
    }
    if (!isActivationKey(event)) return
    event.preventDefault()
    event.preventBaseUIHandler?.()
    setOpen(current => !current)
  }

  const handleSelectKeyUp = event => {
    if (event.target === event.currentTarget && isActivationKey(event)) event.preventBaseUIHandler?.()
  }

  const handleClickOutside = event => {
    if (!open || isLoading) return
    const outsideDropdown = !dropdownReference.current?.contains(event.target)
    const outsideDropdownMenu = !(fieldElement.current || referenceElement.current)?.contains(event.target)
    if (!outsideDropdown || !outsideDropdownMenu) return
    if (isShowSearchBar) handleChangeSearch('')
    setOpen(false)
  }

  const handleKeyDown = event => {
    if (event.key !== 'Escape' || !open || isLoading) return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    referenceElement.current?.focus()
  }

  useEffect(() => {
    if (isShowSearchBar && searchValue) return
    const nextDefault = options?.filter(option => defaultValue.includes(option.value))
    if (!(useLazyPagination && pagination)) setSelectedOptions(nextDefault)
    setValues(defaultValue)
  }, [defaultValue, options, searchValue])

  useEffect(() => {
    if (!open) {
      handleChangeSearch && handleChangeSearch('')
      return
    }
    window.addEventListener('mouseup', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('mouseup', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  // Measure the trigger against its clipping parents once the list is in the DOM (before paint): pick the side
  // with room and cap the options to it so they scroll inside. The cap is written on the DOM node, never by React,
  // so every pass starts from the uncapped list (typing in the search box changes its height).
  useLayoutEffect(() => {
    if (!open || !placementMode) {
      setSide(null)
      return
    }
    const trigger = fieldElement.current || referenceElement.current
    const list = dropdownReference.current
    if (!trigger || !list) return
    const inner = list.querySelector('.od-multi-select-options-inner')
    if (inner) inner.style.maxHeight = ''
    const natural = list.getBoundingClientRect().height
    const chrome = inner ? natural - inner.getBoundingClientRect().height : 0
    const floating = chooseFloating({ trigger, natural, chrome, mode: placementMode, fit })
    if (inner) inner.style.maxHeight = floating.maxHeight ? `${floating.maxHeight}px` : ''
    setSide(floating.side)
  }, [open, placementMode, fit, options, searchValue, measureKey])

  useEffect(() => {
    if (!open || !placementMode) return
    const remeasure = () => setMeasureKey(key => key + 1)
    window.addEventListener('resize', remeasure)
    return () => window.removeEventListener('resize', remeasure)
  }, [open, placementMode])

  // Once the list is drawn the focus goes in: to the search field when the list has one, however it was opened (redesign
  // F6d-2, Q3-06: typing filters at once, as in the pill popovers); else, opened with an arrow key, to the first row
  // (or the selected one).
  useLayoutEffect(() => {
    if (!open) {
      focusOnOpen.current = null
      return
    }
    const which = focusOnOpen.current
    focusOnOpen.current = null
    if (fit && focusSearch(dropdownReference.current)) return
    if (which) focusOption(dropdownReference.current, which)
  }, [open])

  // Marks the chips that do not fit, after every render and whenever the field changes size.
  useLayoutEffect(() => {
    const watch = chipsWatch.current
    const node = fit ? headerRef.current : null
    const run = () => {
      const hidden = watch.node ? layoutChips(watch.node) : []
      if (!hidden || (hidden.length === watch.hidden.length && hidden.every((name, index) => name === watch.hidden[index]))) return
      watch.hidden = hidden
      setHiddenChips(hidden)
    }
    if (watch.node !== node) {
      watch.observer?.disconnect()
      watch.observer = null
      watch.node = node
      if (node && typeof ResizeObserver !== 'undefined') {
        watch.observer = new ResizeObserver(run)
        watch.observer.observe(node)
      }
    }
    run()
  })

  useLayoutEffect(() => {
    const header = fit ? headerRef.current : null
    const next = {}
    if (header) {
      const nodes = Array.from(header.querySelectorAll('.od-multi-select-chip-content'))
      selectedOptions.forEach((option, index) => {
        const text = (nodes[index] ? readableText(nodes[index]) : '').replace(/\s+/g, ' ').trim()
        if (text) next[option.value] = text
      })
    }
    const keys = Object.keys(next)
    setChipTexts(current => {
      const currentKeys = Object.keys(current)
      return currentKeys.length === keys.length && keys.every(key => current[key] === next[key]) ? current : next
    })
  })

  useLayoutEffect(() => () => {
    chipsWatch.current.observer?.disconnect()
    chipsWatch.current.observer = null
  }, [])

  // After an X takes its chip away the focus would fall with the removed button: it goes to the next chip's X,
  // else the previous one, else the field.
  useLayoutEffect(() => {
    const pending = pendingFocus.current
    if (!pending || selectedOptions.some(option => option.value === pending.removed)) return
    pendingFocus.current = null
    const active = document.activeElement
    if (active && active !== document.body) return
    const next = removeButtons.current.get(pending.next)
    const target = next && !next.closest('[data-overflowed]') ? next : referenceElement.current
    target?.focus()
  }, [selectedOptions])

  // «Clear» takes the values out one at a time, each from the props the parent has after the one before:
  // the filters controller writes from the closure it was created in, so two calls in a tick lose one.
  useEffect(() => {
    if (!clearQueue) return
    if (!clearQueue.length) {
      setClearQueue(null)
      return
    }
    const [next, ...rest] = clearQueue
    setValues(current => Array.isArray(current) ? current.filter(value => value !== next) : [])
    setSelectedOptions(current => (current || []).filter(option => option.value !== next))
    onChange && onChange(next)
    setClearQueue(rest)
  }, [clearQueue])

  const handleClear = () => {
    const pending = selectedOptions.map(option => option.value).filter(value => value !== null && value !== 'default')
    if (pending.length) setClearQueue(pending)
  }

  const handleListKeyDown = event => {
    if (!fit) return
    typeahead.current = typeahead.current || createTypeahead()
    navigateOptions(event, dropdownReference.current, typeahead.current)
  }

  const handleSelectOption = option => {
    if (option.value === null || option.value === 'default') return
    const nextSelectedOptions = [...selectedOptions]
    const nextValues = [...values]
    if (!nextValues.includes(option.value)) {
      nextValues.push(option.value)
      nextSelectedOptions.push(option)
    } else {
      for (let index = 0; index < nextValues.length; index++) {
        if (nextValues[index] === option.value) {
          nextValues.splice(index, 1)
          nextSelectedOptions.splice(index, 1)
          index--
        }
      }
    }
    setSelectedOptions(nextSelectedOptions)
    setValues(nextValues)
    onChange && onChange(option.value)
  }

  const handleOptionKeyDown = (event, option) => {
    if (event.target !== event.currentTarget || !isActivationKey(event)) return
    event.preventDefault()
    handleSelectOption(option)
  }

  const optionsTextFormatted = (selectedOption, index) => {
    if (index <= 2) {
      return `${selectedOption.showOnSelected || selectedOption.content}${index + 1 !== selectedOptions?.length && index <= 2 ? ', ' : ' '}`
    }
    if (index + 1 === selectedOptions?.length && selectedOptions?.length >= 4) {
      return `${andText || 'And'} ${index - 2} +`
    }
    return null
  }

  const filterFunction = (_, index) => {
    if (fit || !pagination || useLazyPagination) return true
    return pagination?.currentPage === 1
      ? index < pagination.pageSize * pagination.currentPage
      : index >= pagination.pageSize * (pagination.currentPage - 1) && index < pagination.pageSize * pagination.currentPage
  }

  const handlePagination = page => {
    setOpen(true)
    handleChangePage(page)
  }

  // As in `main`, the search field is there whenever the consumer asks for it (redesign F6c, P3-03).
  const showSearch = !!isShowSearchBar
  const removeChip = (option, index) => {
    const neighbour = selectedOptions[index + 1] ?? selectedOptions[index - 1]
    pendingFocus.current = { removed: option.value, next: neighbour?.value }
    handleSelectOption(option)
  }
  const normalizedPosition = open && options && !fit ? (optionsPosition ?? 'right').toLowerCase() : undefined
  const panelStyle = {
    ...rootStyle,
    '--od-multi-select-dropdown-min-width': dropdownMinWidth || '330px'
  }
  const innerStyle = {
    ...(props.optionInnerMargin !== undefined && !fit ? { margin: props.optionInnerMargin } : {}),
    ...(props.optionInnerMaxHeight !== undefined && !placementMode ? { maxHeight: props.optionInnerMaxHeight } : {})
  }
  // The name of the listbox: the label the consumer points to, else its own `ariaLabel`, else the placeholder text.
  const listboxLabel = ariaLabel || (typeof placeholder === 'string' && placeholder ? placeholder : t('OPTIONS', 'Options'))
  const panel = open && options
    ? (
      <div
        className='od-ui od-multi-select-options'
        role={fit ? 'group' : 'listbox'}
        aria-multiselectable={fit ? undefined : 'true'}
        ref={dropdownReference}
        data-position={normalizedPosition}
        data-placement={placementMode ? (side || undefined) : undefined}
        data-fit={fit ? 'trigger' : undefined}
        style={panelStyle}
        onKeyDown={handleListKeyDown}
      >
        {showSearch && (
          <div className='od-multi-select-search search-bar-container'>
            {fit
              ? (
                <SearchField
                  value={searchValue}
                  onChange={next => handleChangeSearch?.(next)}
                  label={t('SEARCH', 'Search')}
                  clearLabel={t('CLEAR_SEARCH', 'Clear search')}
                  placeholder={searchBarPlaceholder || t('SEARCH', 'Search')}
                />
                )
              : (
                <SearchBar
                  lazyLoad={!searchBarIsNotLazyLoad}
                  isCustomLayout={searchBarIsCustomLayout}
                  search={searchValue}
                  onSearch={handleChangeSearch}
                  placeholder={searchBarPlaceholder || ''}
                />
                )}
          </div>
        )}
        <div
          id={listboxId}
          className='od-multi-select-options-inner'
          role={fit ? 'listbox' : undefined}
          aria-multiselectable={fit ? 'true' : undefined}
          aria-label={fit && !labelRef ? listboxLabel : undefined}
          aria-labelledby={fit ? labelRef : undefined}
          style={innerStyle}
        >
          {options.filter(filterFunction).map((option, index) => fit && option.group
            ? (
              <div key={index} className='od-multi-select-group' role='presentation'>{option.content}</div>
              )
            : (
            <div
              key={index}
              className={classNames(
                'od-multi-select-option',
                props.optionBottomBorder && 'od-option-border',
                option.color === 'primary' && 'od-option-primary'
              )}
              style={isFullWidthOptions ? { width: '100%' } : undefined}
              role='option'
              tabIndex={option.value === null || option.value === 'default' ? -1 : 0}
              aria-disabled={option.value === null || option.value === 'default'}
              aria-selected={values.includes(option.value)}
              onClick={() => handleSelectOption(option)}
              onKeyDown={event => handleOptionKeyDown(event, option)}
            >
              {option.value !== 'default' && (
                fit
                  ? (
                    <OptionBox checked={values.includes(option.value)} />
                    )
                  : (
                    <CheckBox className='od-multi-select-check'>
                      {values.includes(option.value) ? <SquareCheck /> : <Square />}
                    </CheckBox>
                    )
              )}
              {option.content}
            </div>
              ))}
        </div>
        {!fit && pagination && handleChangePageSize && handleChangePage && (
          <PaginationWrapper>
            <Pagination
              currentPage={pagination?.currentPage}
              totalPages={pagination?.totalPages}
              handleChangePage={handlePagination}
              handleChangePageSize={handleChangePageSize}
              defaultPageSize={pagination?.pageSize}
              isHidePagecontrol={isHidePagecontrol}
            />
          </PaginationWrapper>
        )}
        {fit && (
          <div className='od-multi-select-footer'>
            <ProductButton
              variant='link'
              size='sm'
              disabled={selectedOptions.length === 0 || !!clearQueue}
              onClick={handleClear}
            >
              {t('CLEAR', 'Clear')}
            </ProductButton>
          </div>
        )}
      </div>
      )
    : null

  const triggerTextStyle = selectedOptions.length === 0 && useTextStyle
  const chevron = !hideChevronIcon && (
    <div className='od-multi-select-chevron'>
      <ChevronDown />
    </div>
  )
  const popupProps = {
    'aria-expanded': open,
    'aria-haspopup': 'listbox',
    'aria-controls': fit && open && options ? listboxId : undefined
  }

  // redesign F6h-4 (A2): with chips (C18) the field is NOT a button: a button holding the X buttons is nested-interactive.
  // The field is a container (it keeps the `od-multi-select-trigger` class, so its layout is unchanged) that holds, as
  // siblings: the opener (a button that covers the field, behind the chips; Tab reaches it first), the chips with their X and
  // the chevron. A click on the container outside its buttons opens the list too. The opener is named with the label of the
  // field and the chosen values (the chips' text is what a sighted user reads in the field).
  const chipsField = fit && selectedOptions.length > 0
  const openerId = `${chipsId}-opener`
  const summaryId = `${chipsId}-summary`
  // F6i-2: the empty field (no chips) names itself the same way, its placeholder being the value; only when it has a label.
  const plainNamed = fit && !chipsField && !!(labelRef || ariaLabel)
  const chipName = option => option.name || (typeof option.content === 'string' ? option.content : null) || chipTexts[option.value] || null
  const summary = selectedOptions.filter(option => option.value !== 'default').map(chipName).filter(Boolean).join(', ')
  const triggerField = chipsField
    ? (
      <div
        className='od-multi-select-trigger'
        ref={fieldElement}
        data-chips-field=''
        onClick={handleFieldClick}
      >
        <CollapsiblePrimitive.Trigger
          render={(
            <button
              type='button'
              id={openerId}
              className='od-multi-select-opener'
              {...popupProps}
              aria-label={labelRef ? undefined : listboxLabel}
              aria-labelledby={`${labelRef || openerId} ${summaryId}`}
              onKeyDown={handleSelectKeyDown}
              onKeyUp={handleSelectKeyUp}
            />
          )}
          ref={referenceElement}
        >
          <span id={summaryId} className='od-multi-select-opener-summary'>{summary}</span>
        </CollapsiblePrimitive.Trigger>
        <div className='od-multi-select-header' data-chips='' ref={headerRef}>
          {selectedOptions.map((selectedOption, index) => {
            // The X is named «Remove <the chip's own text>»: its label and the text of the chip, read together.
            const textId = `${chipsId}-text-${index}`
            const buttonId = `${chipsId}-remove-${index}`
            const named = chipName(selectedOption)
            return (
              <span key={selectedOption.value} className='od-multi-select-chip'>
                <span id={textId} className='od-multi-select-chip-content selected_option_content'>
                  {selectedOption.showOnSelected || selectedOption.content}
                </span>
                {selectedOption.value !== 'default' && (
                  <ProductIconButton
                    ref={node => {
                      if (node) removeButtons.current.set(selectedOption.value, node)
                      else removeButtons.current.delete(selectedOption.value)
                    }}
                    id={buttonId}
                    icon={X}
                    size='sm'
                    label={named ? `${t('REMOVE', 'Remove')} ${named}` : t('REMOVE', 'Remove')}
                    aria-labelledby={named ? undefined : `${buttonId} ${textId}`}
                    className='od-multi-select-remove remove_option'
                    onClick={() => removeChip(selectedOption, index)}
                  />
                )}
              </span>
            )
          })}
          <span
            className='od-multi-select-more'
            title={hiddenChips.join(', ') || undefined}
            data-empty={hiddenChips.length ? undefined : ''}
          >
            +{hiddenChips.length}
          </span>
        </div>
        {chevron}
      </div>
      )
    : (
      <CollapsiblePrimitive.Trigger
        render={(
          <div
            className='od-multi-select-trigger'
            role='button'
            tabIndex={0}
            {...popupProps}
            id={plainNamed ? openerId : undefined}
            aria-label={plainNamed && !labelRef ? ariaLabel : undefined}
            aria-labelledby={plainNamed ? `${labelRef || openerId} ${summaryId}` : undefined}
            data-trigger-text-style={triggerTextStyle || undefined}
            onClick={handleTriggerClick}
            onKeyDown={handleSelectKeyDown}
            onKeyUp={handleSelectKeyUp}
          />
        )}
        nativeButton={false}
        ref={referenceElement}
      >
        {selectedOptions.length === 0
          ? (useTextStyle
              ? (
                <div className='od-multi-select-header' id={plainNamed ? summaryId : undefined}>
                  <TextFormatted className={textClassnames}>{placeholder || ''}</TextFormatted>
                </div>
                )
              : (plainNamed ? <span id={summaryId}>{placeholder || ''}</span> : (placeholder || '')))
          : (
            <div className='od-multi-select-header' data-text-style={useTextStyle || undefined}>
              {selectedOptions.map((selectedOption, index) => (
              <React.Fragment key={selectedOption.value}>
                {useTextStyle
                  ? (
                    <TextFormatted className={textClassnames} primary>
                      {optionsTextFormatted(selectedOption, index)}
                    </TextFormatted>
                    )
                  : (
                    <div className='od-multi-select-chip'>
                      <span className='od-multi-select-chip-content selected_option_content'>
                        {selectedOption.showOnSelected || selectedOption.content}
                      </span>
                      {selectedOption?.value !== 'default' && (
                        <Button
                          circle
                          outline
                          color='primary'
                          type='reset'
                          className='od-multi-select-remove remove_option'
                          aria-label={`${t('REMOVE', 'Remove')} ${selectedOption.name || (typeof selectedOption.content === 'string' ? selectedOption.content : selectedOption.value)}`}
                          onClick={() => handleSelectOption(selectedOption)}
                        >
                          <X />
                        </Button>
                      )}
                    </div>
                    )}
              </React.Fragment>
              ))}
            </div>
            )}
        {chevron}
      </CollapsiblePrimitive.Trigger>
      )
  return (
    <CollapsiblePrimitive.Root
      open={open}
      onOpenChange={setOpen}
      disabled={false}
      render={(
        <div
          className={classNames('od-ui', 'od-multi-select-root', className || 'multi-select')}
          style={rootStyle}
          dir={theme?.rtl ? 'rtl' : 'ltr'}
          data-text-style={useTextStyle || undefined}
          data-fit={fit ? 'trigger' : undefined}
          data-slot='multi-select'
        />
      )}
    >
      {triggerField}

      {open && options && <CollapsiblePrimitive.Panel render={panel} />}
    </CollapsiblePrimitive.Root>
  )
}

MultiSelect.displayName = 'OrderingMultiSelect'
