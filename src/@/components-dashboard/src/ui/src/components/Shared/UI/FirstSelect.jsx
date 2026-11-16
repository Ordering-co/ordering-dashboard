import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'styled-components'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import { Button } from '../../../styles/Buttons'
import { Check, ChevronDown, Trash2 } from '../Icon'
import { Pagination } from '../Pagination'
import { SearchBar } from '../SearchBar'
import { SearchField } from '../Product/FilterBar'
import { Field } from '../Product/Field'
import { useLanguage } from '../../../../../index'
import { firstSelectStyle } from './first-select-styles'
import { CONFIRM_DIALOG_LAYER, useDialogLayer } from './dialog-layer'
import { PLACEMENT_EDGE, PLACEMENT_GAP, PLACEMENT_MODES, chooseFloating, useSelectSurface } from './selectPlacement'
import { createTypeahead, focusOption, focusSearch, navigateOptions, typeaheadFromField } from './selectKeyboard'
import './first-select.css'

// Opt-in list placement (`placement` / `fitTrigger`, see selectPlacement.js).
const NO_FLOATING = { side: null, maxHeight: null }

// redesign F6i-2 (A3-02): a surface that draws its own visible label for a field (the Filters sheet) puts the id of that
// label here; the C18 selects inside use it as the name of their trigger, followed by their current value. Without it a
// select falls back to its `ariaLabel`, and the legacy select ignores both.
export const SelectFieldLabelContext = createContext(null)

const isActivationKey = event => event.key === 'Enter' || event.key === ' '
const classNames = (...values) => values.filter(Boolean).join(' ')

export const FirstSelect = (props) => {
  const {
    placeholder,
    options,
    defaultValue,
    onChange,
    notAsync,
    type,
    noSelected,
    className,
    onEdit,
    onDelete,
    isShowSearchBar,
    searchValue,
    handleChangeSearch,
    searchBarIsCustomLayout,
    searchBarPlaceholder,
    searchBarIsNotLazyLoad,
    isDisabled,
    position,
    pagination,
    handleChangePage,
    isLoading,
    optionSkeletonHeight,
    id,
    ariaLabelledBy,
    ariaLabel,
    // redesign stores 5.18 (m7 of 5.13): opt-in, the id of a hint that describes the trigger (also when disabled)
    ariaDescribedBy,
    portal
  } = props
  const theme = useTheme()
  const rootStyle = firstSelectStyle(theme)
  const [open, setOpen] = useState(false)
  const defaultOption = options?.find(option => option.value === defaultValue)
  const [selectedOption, setSelectedOption] = useState(defaultOption)
  const [value, setValue] = useState(defaultValue)
  const [, t] = useLanguage()
  const dropdownReference = useRef()
  const selectedOptionRef = useRef()
  const generatedId = useId()
  // Only 'auto' (prefer below, flip up when it does not fit) and 'top' (prefer above) measure anything;
  // without the prop the list is laid out exactly as before.
  const surface = useSelectSurface(props)
  const fit = !!surface.fitTrigger
  // redesign F6h-2 (A2-02), C18 only (opt-in per surface, pilot L2-09): the popup is a group that holds the search
  // field and a `role=listbox` that owns only the option rows; the listbox has a name and the field points to it. The
  // legacy list keeps its single `role=listbox` popup and a trigger with only the `id` the consumer passed.
  const triggerId = fit ? (id || `${generatedId}-trigger`) : id
  const listboxId = fit ? `${generatedId}-listbox` : undefined
  // redesign F6i-2 (A3-02), C18 only: the trigger is named «<field label> <current value>». The label is the one the consumer
  // points to, else the visible label of the surrounding field, else `ariaLabel` (the trigger then names itself through its own
  // `aria-label`, followed by the value). Without any label the trigger keeps naming itself by its value, as before.
  const fieldLabelId = useContext(SelectFieldLabelContext)
  const labelRef = fit ? (ariaLabelledBy || fieldLabelId || undefined) : undefined
  const valueId = fit ? `${generatedId}-value` : undefined
  const triggerNamedBy = !fit
    ? ariaLabelledBy
    : labelRef ? `${labelRef} ${valueId}` : ariaLabel ? `${triggerId} ${valueId}` : undefined
  const placementMode = PLACEMENT_MODES.includes(surface.placement) ? surface.placement : (fit ? 'auto' : null)
  const [floating, setFloating] = useState(NO_FLOATING)
  const [measureKey, setMeasureKey] = useState(0)
  // redesign F6d-2 (Q3-11): `portal` (C18 lists only) draws the list in the shared layer host, as a fixed overlay
  // placed from the field, so a surface whose body clips or sizes to its content (a dialog) keeps its size. While
  // it is open it is a non-modal layer: a dialog below hands the answer over, like it does for a popover.
  const usePortal = fit && !!portal
  const layerFocusRef = useRef(null)
  const layer = useDialogLayer({
    open: usePortal && open && !!options,
    kind: CONFIRM_DIALOG_LAYER,
    popupRef: dropdownReference,
    lastFocusedRef: layerFocusRef,
    modal: false
  })
  const listMounted = open && !!options && (!usePortal || !!layer.host)
  // C18 keyboard: where the focus goes when the list opens from the keyboard and the type-ahead buffer.
  const focusOnOpen = useRef(null)
  const typeahead = useRef(null)

  const handleTriggerClick = event => {
    if (
      event.target.closest('.react-datepicker-wrapper') ||
      event.target.closest('.react-datepicker')
    ) {
      event.preventBaseUIHandler?.()
    }
  }

  const handleSelectKeyDown = event => {
    if (event.target !== event.currentTarget) {
      event.preventBaseUIHandler?.()
      return
    }
    if (fit && !isDisabled && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
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
    if (fit && open && !isDisabled) {
      typeahead.current = typeahead.current || createTypeahead()
      if (typeaheadFromField(event, dropdownReference.current, typeahead.current)) {
        event.preventBaseUIHandler?.()
        return
      }
    }
    if (!isActivationKey(event)) return
    if (isDisabled) {
      event.preventBaseUIHandler?.()
      return
    }
    event.preventDefault()
    event.preventBaseUIHandler?.()
    setOpen(current => !current)
  }

  const handleSelectKeyUp = event => {
    if (event.target === event.currentTarget && isActivationKey(event)) event.preventBaseUIHandler?.()
  }

  useEffect(() => {
    if (!open) return
    const closeSelect = event => {
      const outsideDropdown = !dropdownReference.current?.contains(event.target) && !selectedOptionRef.current?.contains(event.target)
      if (!outsideDropdown) return
      if (isShowSearchBar) handleChangeSearch('')
      setOpen(false)
    }
    const closeSelectWithKeyboard = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      selectedOptionRef.current?.focus()
    }
    document.addEventListener('click', closeSelect)
    window.addEventListener('keydown', closeSelectWithKeyboard, true)
    return () => {
      document.removeEventListener('click', closeSelect)
      window.removeEventListener('keydown', closeSelectWithKeyboard, true)
    }
  }, [open])

  // Measure the trigger against the viewport once the list is in the DOM (before paint): pick the side
  // with room and, when the list is taller than that room, cap the options so they scroll inside it.
  useLayoutEffect(() => {
    if (!open || !placementMode) {
      setFloating(NO_FLOATING)
      return
    }
    const trigger = selectedOptionRef.current
    const list = dropdownReference.current
    if (!trigger || !list) return
    if (usePortal) {
      // The overlay is `position: fixed`: it is as wide as the field at least, starts where the field starts (or ends
      // where it ends when that leaves the window), opens on the side with room measured against the window only,
      // and caps its rows to that room. The coordinates are written on the node, never by React, so every pass starts
      // from the same list.
      const field = trigger.parentElement.getBoundingClientRect()
      list.style.minWidth = `${field.width}px`
      const natural = list.getBoundingClientRect().height
      const inner = list.querySelector('.od-first-select-options-inner')
      const chrome = inner ? natural - inner.getBoundingClientRect().height : 0
      const next = chooseFloating({ trigger, natural, chrome, mode: placementMode, fit: false })
      const width = list.getBoundingClientRect().width
      const viewport = window.innerWidth || document.documentElement.clientWidth
      const startLeft = theme?.rtl ? field.right - width : field.left
      let left = startLeft
      if (left + width > viewport - PLACEMENT_EDGE || left < PLACEMENT_EDGE) left = theme?.rtl ? field.left : field.right - width
      left = Math.max(PLACEMENT_EDGE, Math.min(left, viewport - PLACEMENT_EDGE - width))
      list.style.left = `${left}px`
      if (next.side === 'top') {
        list.style.top = ''
        list.style.bottom = `${(window.innerHeight || document.documentElement.clientHeight) - field.top + PLACEMENT_GAP}px`
      } else {
        list.style.bottom = ''
        list.style.top = `${field.bottom + PLACEMENT_GAP}px`
      }
      setFloating(next)
      return
    }
    // C18: the list is at least as wide as the trigger and may grow to the popover width; it starts where the
    // trigger starts, and starts from the trigger's end instead when it would leave the window (a data attribute
    // written here, never by React, so every pass measures it from the start).
    delete list.dataset.align
    if (fit) {
      const { left, right } = list.getBoundingClientRect()
      const overflows = theme?.rtl ? left < PLACEMENT_EDGE : right > (window.innerWidth || document.documentElement.clientWidth) - PLACEMENT_EDGE
      if (overflows) list.dataset.align = 'end'
    }
    const natural = list.getBoundingClientRect().height
    const inner = list.querySelector('.od-first-select-options-inner')
    const chrome = inner ? natural - inner.getBoundingClientRect().height : 0
    setFloating(chooseFloating({ trigger, natural, chrome, mode: placementMode, fit }))
  }, [listMounted, open, placementMode, fit, usePortal, measureKey])

  useEffect(() => {
    if (!open || !placementMode) return
    // Measure again from the uncapped list when the viewport changes while it is open.
    const remeasure = () => {
      setFloating(NO_FLOATING)
      setMeasureKey(key => key + 1)
    }
    // A fixed overlay does not follow its field when something scrolls under it (the body of a dialog, the page);
    // the scrolling of the list itself is not that.
    const handleScroll = event => {
      if (dropdownReference.current?.contains(event.target)) return
      remeasure()
    }
    window.addEventListener('resize', remeasure)
    if (usePortal) window.addEventListener('scroll', handleScroll, true)
    return () => {
      window.removeEventListener('resize', remeasure)
      if (usePortal) window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open, placementMode, usePortal])

  // Once the list is drawn the focus goes in: to the search field when the list has one, however it was opened (redesign
  // F6d-2, Q3-06: typing filters at once, as in the pill popovers); else, opened with an arrow key, to the selected row.
  useLayoutEffect(() => {
    if (!open) {
      focusOnOpen.current = null
      return
    }
    if (!listMounted) return
    const which = focusOnOpen.current
    focusOnOpen.current = null
    if (fit && focusSearch(dropdownReference.current)) return
    if (which) focusOption(dropdownReference.current, which)
  }, [open, listMounted])

  useEffect(() => {
    if (isShowSearchBar && searchValue) return
    if (!notAsync) {
      const nextDefault = options?.find(option => option.value === defaultValue)
      setSelectedOption(nextDefault)
      setValue(defaultValue)
    }
  }, [defaultValue, options, searchValue])

  const handleChangeOption = (event, option) => {
    if (event.target.closest('.disabled') === null) {
      setOpen(false)
      // redesign F6a (D-12): the row that had the focus leaves the page with the list, and the focus would fall
      // to <body>, outside any layer. It goes back to the field, so the Esc that follows has a place to start from
      // (keyboard and pointer alike) and a sheet around the select keeps its focus inside.
      selectedOptionRef.current?.focus()
    }
    if (
      option.value === null ||
      option.disabled ||
      event.target.closest('.delete') !== null ||
      event.target.closest('.edit') !== null
    ) return
    if (!noSelected) {
      setSelectedOption(option)
      setValue(option.value)
    }
    onChange && onChange(option.value)
  }

  const handleOptionKeyDown = (event, option) => {
    if (event.target !== event.currentTarget || !isActivationKey(event)) return
    if (option.value === null || option.disabled) return
    event.preventDefault()
    handleChangeOption(event, option)
    selectedOptionRef.current?.focus()
  }

  const handleListKeyDown = event => {
    if (!fit) return
    typeahead.current = typeahead.current || createTypeahead()
    navigateOptions(event, dropdownReference.current, typeahead.current)
  }

  // C18: a local list has no pager (it scrolls), a dangerous action goes first (where `main` had «Remove assigned
  // driver») with a separator after it, and group labels are headings. The search field shows whenever the
  // consumer asks for it, as in `main`, whatever the number of options (redesign F6c, P3-02 and P3-03).
  // SC-1: the pager shows in C18 too when the consumer pages the list (`pagination` with more than one page and
  // `handleChangePage`): `!fit` hid it, and a remote list with search never reached page 2. C18 consumers whose list is local
  // pass neither (Orders/AdminsSelector, BusinessesSelector drop `pagination` in C18), so their list is as it was.
  const hasPagination = !!(handleChangePage && pagination && pagination.totalPages > 1)
  const rows = (options || []).map((option, index) => ({ option, index }))
  const orderedRows = fit
    ? [...rows.filter(row => row.option.danger), ...rows.filter(row => !row.option.danger)]
    : rows
  const dangerCount = fit ? rows.filter(row => row.option.danger).length : 0
  // The separator closes the dangerous rows, and only when something follows them.
  const hasRowsAfter = rows.some(({ option }) => !option.danger && !option.showDisable)
  const separatorAfterIndex = dangerCount > 0 && hasRowsAfter ? orderedRows[dangerCount - 1].index : -1
  const showSearch = !!isShowSearchBar
  const normalizedPosition = fit ? undefined : (position || 'right').toLowerCase()
  const placementCap = floating.maxHeight
  const innerStyle = fit
    ? (placementCap ? { maxHeight: `min(${placementCap}px, var(--odc-fit-max))` } : {})
    : {
        ...(props.optionInnerMargin !== undefined ? { margin: props.optionInnerMargin } : {}),
        maxHeight: placementCap
          ? (props.optionInnerMaxHeight ? `min(${props.optionInnerMaxHeight}, ${placementCap}px)` : `${placementCap}px`)
          : hasPagination ? (props.optionInnerMaxHeight || '200px') : (props.optionInnerMaxHeight || 'initial'),
        ...(hasPagination || placementCap ? { overflowY: 'auto' } : {})
      }
  // The name of the listbox: the label the consumer points to, else its own `ariaLabel`, else the placeholder
  // text, else the field itself (its trigger).
  const listboxLabelledBy = labelRef || (ariaLabel || typeof placeholder === 'string' ? undefined : triggerId)
  const listboxLabel = ariaLabel || (typeof placeholder === 'string' ? placeholder : undefined)
  const renderOption = ({ option, index }) => {
    const isSelected = value === option.value
    // The hidden placeholder row only exists to name the field; with the C18 list it is not drawn at all.
    if (fit && option.showDisable) return null
    if (fit && option.group) {
      return (
        <div key={index} className='od-first-select-group' role='presentation'>
          {option.content}
        </div>
      )
    }
    return (
      <React.Fragment key={index}>
        <div
          className={classNames(
            'od-first-select-option',
            option.disabled && 'disabled',
            option.showDisable && 'od-option-hidden',
            props.optionBottomBorder && 'od-option-border',
            option.color === 'primary' && 'od-option-primary'
          )}
          role='option'
          tabIndex={option.disabled || option.value === null ? -1 : 0}
          aria-disabled={Boolean(option.disabled || option.value === null)}
          aria-selected={isSelected}
          data-disabled={option.disabled || undefined}
          data-selected={isSelected ? '' : undefined}
          data-danger={fit && option.danger ? '' : undefined}
          onClick={event => handleChangeOption(event, option)}
          onKeyDown={event => handleOptionKeyDown(event, option)}
        >
          {fit && (
            <span className='od-first-select-check' aria-hidden='true'>
              {isSelected && <Check />}
            </span>
          )}
          {option.content}
          {(option.editFunctionality || option.deleteFunctionality) && (
            <div
              className='od-first-select-functionality'
              data-selected-option={isSelected ? '' : undefined}
            >
              {option.editFunctionality && (
                <Button
                  borderRadius='8px'
                  color='lightPrimary'
                  onClick={() => onEdit(option, index)}
                  className='edit'
                >
                  {t('EDIT', 'Edit')}
                </Button>
              )}
              {option.deleteFunctionality && onDelete && (
                <button
                  type='button'
                  className='od-first-select-delete delete'
                  disabled={isSelected}
                  aria-label={t('DELETE', 'Delete')}
                  onClick={() => onDelete(option.value)}
                >
                  <Trash2 />
                </button>
              )}
            </div>
          )}
        </div>
        {/* A separator is not an allowed child of a listbox (axe, aria-required-children): it only draws the line. */}
        {fit && index === separatorAfterIndex && (
          <div className='od-first-select-separator' role='presentation' />
        )}
      </React.Fragment>
    )
  }

  const list = listMounted
    ? (
      <div
        className='od-ui od-first-select-list list'
        role={fit ? 'group' : 'listbox'}
        ref={dropdownReference}
        data-position={normalizedPosition}
        data-placement={placementMode ? (floating.side || undefined) : undefined}
        data-fit={fit ? 'trigger' : undefined}
        style={fit && props.listMaxInlineSize ? { '--odc-fit-max-inline': props.listMaxInlineSize } : undefined}
        onKeyDown={handleListKeyDown}
      >
        {showSearch && (fit
          ? (
            // SC-3: inside a P/Field the list is part of the field, and a Base UI input there takes the Field's label as
            // its name («Driver» instead of «Search»). A Field.Scope (a Field.Root of its own) keeps the search out of the outer field.
            <Field.Scope className='od-first-select-search search-bar-container'>
              <SearchField
                value={searchValue}
                onChange={next => handleChangeSearch?.(next)}
                label={t('SEARCH', 'Search')}
                clearLabel={t('CLEAR_SEARCH', 'Clear search')}
                placeholder={searchBarPlaceholder || t('SEARCH', 'Search')}
              />
            </Field.Scope>
            )
          : (
            <div className='od-first-select-search search-bar-container'>
              <SearchBar
                lazyLoad={!searchBarIsNotLazyLoad}
                isCustomLayout={searchBarIsCustomLayout}
                search={searchValue}
                onSearch={handleChangeSearch}
                placeholder={searchBarPlaceholder || ''}
              />
            </div>
            ))}
        <div
          id={listboxId}
          className='od-first-select-options-inner list-wrapper'
          role={fit ? 'listbox' : undefined}
          aria-label={fit && !listboxLabelledBy ? listboxLabel : undefined}
          aria-labelledby={fit ? listboxLabelledBy : undefined}
          aria-busy={fit ? (isLoading || undefined) : undefined}
          style={innerStyle}
        >
          {isLoading
            ? [...Array(Number(pagination?.pageSize) >= 1 ? Number(pagination.pageSize) : 5).keys()].map(index => (
              <div
                key={`skeleton-${index}`}
                className={classNames('od-first-select-option', props.optionBottomBorder && 'od-option-border')}
                aria-hidden={fit ? 'true' : undefined}
              >
                <div style={{ flex: 1, lineHeight: 1 }}>
                  <Skeleton height={optionSkeletonHeight || 20} />
                </div>
              </div>
              ))
            : orderedRows.map(renderOption)}
        </div>
        {!!hasPagination && pagination.totalPages > 1 && (
          <div className='od-first-select-pagination' onClick={event => event.stopPropagation()}>
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              handleChangePage={handleChangePage}
              isHidePagecontrol
            />
          </div>
        )}
      </div>
      )
    : null

  return (
    <CollapsiblePrimitive.Root
      open={open}
      onOpenChange={setOpen}
      disabled={false}
      render={(
        <div
          className={classNames('od-ui', 'od-first-select-root', className || 'select')}
          style={rootStyle}
          dir={theme?.rtl ? 'rtl' : 'ltr'}
          type={type}
          data-type={type}
          data-fit={fit ? 'trigger' : undefined}
          data-disabled={isDisabled || undefined}
          data-slot='first-select'
        />
      )}
    >
      <CollapsiblePrimitive.Trigger
        render={(
          <div
            className='od-first-select-trigger'
            id={triggerId}
            role='button'
            tabIndex={isDisabled ? -1 : 0}
            aria-disabled={Boolean(isDisabled)}
            aria-expanded={open}
            aria-haspopup='listbox'
            aria-label={fit && !labelRef && ariaLabel ? ariaLabel : undefined}
            aria-labelledby={triggerNamedBy}
            aria-describedby={ariaDescribedBy || undefined}
            aria-controls={fit && listMounted ? listboxId : undefined}
            data-disabled={isDisabled || undefined}
            data-empty={fit && !selectedOption ? '' : undefined}
            onClick={handleTriggerClick}
            onKeyDown={handleSelectKeyDown}
            onKeyUp={handleSelectKeyUp}
          />
        )}
        nativeButton={false}
        ref={selectedOptionRef}
      >
        {selectedOption
          ? (
            <div
              id={valueId}
              className='od-first-select-header'
              data-placeholder={fit && selectedOption.showDisable && selectedOption.disabled ? '' : undefined}
            >
              {selectedOption.showOnSelected || selectedOption.content}
            </div>
            )
          : (fit ? <span id={valueId}>{placeholder || ''}</span> : (placeholder || ''))}
        <div className={classNames('od-first-select-chevron', !selectedOption && 'select-arrow')} aria-hidden='true'>
          <ChevronDown />
        </div>
      </CollapsiblePrimitive.Trigger>

      {listMounted && !usePortal && <CollapsiblePrimitive.Panel render={list} />}
      {listMounted && usePortal && createPortal(
        // The wrapper has the field's class and variables so the list's rules (`root > list`) and tokens reach it, and
        // draws nothing itself (`display: contents`, first-select.css).
        <div
          className='od-ui od-first-select-root'
          // The host lets the pointer through while only non-modal layers are in it; the list takes it back.
          style={{ ...rootStyle, pointerEvents: 'auto' }}
          dir={theme?.rtl ? 'rtl' : 'ltr'}
          data-portal=''
          data-slot='first-select-portal'
        >
          {list}
        </div>,
        layer.host
      )}
    </CollapsiblePrimitive.Root>
  )
}

FirstSelect.displayName = 'OrderingFirstSelect'
