import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'react-bootstrap-icons'
import {
  BrandTrigger,
  BrandTriggerLabel,
  BrandMenu,
  BrandList,
  BrandOption,
  BrandCheck,
  BrandSpinner,
  BrandMore
} from './styles'

const isEnabled = (brand) => brand.enabled !== false

const labelOf = (brand, disabledLabel) => (
  isEnabled(brand) ? brand.name : `${brand.name} (${disabledLabel})`
)

/**
 * Brand picker matching the AI dashboard: a button, a list with a check on
 * the current brand, disabled brands that cannot be chosen, and the next
 * page when the list reaches the end.
 */
export const BrandSelect = (props) => {
  const {
    value,
    onChange,
    brands = [],
    disabled = false,
    loading = false,
    loadingMore = false,
    hasNextPage = false,
    onLoadMore,
    placeholder,
    loadingLabel,
    loadingMoreLabel,
    disabledLabel = 'Disabled',
    fallbackName = '',
    id,
    'aria-label': ariaLabel
  } = props
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [box, setBox] = useState(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const optionRefs = useRef([])
  const typeaheadRef = useRef('')
  const typeaheadTimer = useRef(null)
  const generatedId = useId()
  const controlId = id || `brand-select-${generatedId.replace(/:/g, '')}`
  const listboxId = `${controlId}-listbox`

  const selected = brands.find(brand => String(brand.id) === String(value))
  const display = selected
    ? labelOf(selected, disabledLabel)
    : (value && fallbackName ? fallbackName : '')
  const showLoading = loading && brands.length === 0
  const enabledIndexes = brands.reduce((indexes, brand, index) => {
    if (isEnabled(brand)) indexes.push(index)
    return indexes
  }, [])

  const place = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setBox({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }

  const close = () => {
    setOpen(false)
    window.clearTimeout(typeaheadTimer.current)
    typeaheadRef.current = ''
  }

  useEffect(() => {
    if (!open) return undefined
    place()
    const selectedIndex = brands.findIndex(brand => isEnabled(brand) && String(brand.id) === String(value))
    const index = selectedIndex >= 0 ? selectedIndex : (enabledIndexes[0] ?? -1)
    setActiveIndex(index)
    const frame = requestAnimationFrame(() => {
      if (index >= 0) optionRefs.current[index]?.focus()
    })
    const onPointer = (event) => {
      if (triggerRef.current?.contains(event.target) || listRef.current?.contains(event.target)) return
      close()
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        triggerRef.current?.focus()
      }
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  const choose = (brand) => {
    if (!isEnabled(brand)) return
    onChange(String(brand.id))
    close()
    triggerRef.current?.focus()
  }

  const focusOption = (index) => {
    setActiveIndex(index)
    optionRefs.current[index]?.focus()
  }

  const onTriggerKeyDown = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    setActiveIndex(event.key === 'ArrowUp' ? (enabledIndexes.at(-1) ?? -1) : (enabledIndexes[0] ?? -1))
    setOpen(true)
    place()
  }

  const onOptionKeyDown = (event, currentIndex) => {
    if (!enabledIndexes.length) return
    const position = enabledIndexes.indexOf(currentIndex)
    let nextIndex = null
    if (event.key === 'ArrowDown') nextIndex = enabledIndexes[(position + 1) % enabledIndexes.length]
    else if (event.key === 'ArrowUp') nextIndex = enabledIndexes[(position - 1 + enabledIndexes.length) % enabledIndexes.length]
    else if (event.key === 'Home') nextIndex = enabledIndexes[0]
    else if (event.key === 'End') nextIndex = enabledIndexes.at(-1)
    if (nextIndex != null) {
      event.preventDefault()
      focusOption(nextIndex)
      return
    }
    if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return
    typeaheadRef.current += event.key.toLocaleLowerCase()
    window.clearTimeout(typeaheadTimer.current)
    typeaheadTimer.current = window.setTimeout(() => { typeaheadRef.current = '' }, 500)
    const match = brands.findIndex(brand => (
      isEnabled(brand) && brand.name?.toLocaleLowerCase().startsWith(typeaheadRef.current)
    ))
    if (match >= 0) focusOption(match)
  }

  const onListScroll = () => {
    const list = listRef.current
    if (!list || loadingMore || !hasNextPage) return
    if (list.scrollHeight - list.scrollTop - list.clientHeight < 50) onLoadMore?.()
  }

  const menu = open && box && createPortal(
    <BrandMenu style={{ top: box.top, left: box.left, width: box.width }}>
      <BrandList
        ref={listRef}
        id={listboxId}
        role='listbox'
        aria-label={ariaLabel}
        onScroll={onListScroll}
      >
        {showLoading && (
          <BrandMore>
            <BrandSpinner />
            {loadingLabel}
          </BrandMore>
        )}
        {!showLoading && brands.map((brand, index) => {
          const selectedOption = String(brand.id) === String(value)
          if (!isEnabled(brand)) {
            return (
              <BrandOption
                as='div'
                key={brand.id}
                role='option'
                aria-disabled='true'
                aria-selected='false'
              >
                <BrandCheck aria-hidden='true' />
                <span>{labelOf(brand, disabledLabel)}</span>
              </BrandOption>
            )
          }
          return (
            <BrandOption
              key={brand.id}
              ref={(node) => { optionRefs.current[index] = node }}
              type='button'
              role='option'
              tabIndex={activeIndex === index ? 0 : -1}
              aria-selected={selectedOption}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
              onClick={() => choose(brand)}
            >
              <BrandCheck aria-hidden='true'>
                {selectedOption ? <Check size={16} /> : null}
              </BrandCheck>
              <span>{brand.name}</span>
            </BrandOption>
          )
        })}
        {loadingMore && (
          <BrandMore aria-live='polite'>
            <BrandSpinner />
            {loadingMoreLabel}
          </BrandMore>
        )}
      </BrandList>
    </BrandMenu>,
    document.body
  )

  return (
    <>
      <BrandTrigger
        ref={triggerRef}
        type='button'
        id={controlId}
        disabled={disabled || showLoading}
        $placeholder={!display || showLoading}
        aria-expanded={open}
        aria-haspopup='listbox'
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-busy={loading || loadingMore}
        onClick={() => {
          if (open) {
            close()
            return
          }
          place()
          setOpen(true)
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <BrandTriggerLabel>
          {showLoading ? loadingLabel : (display || placeholder)}
        </BrandTriggerLabel>
        {loadingMore ? <BrandSpinner /> : <ChevronDown size={16} />}
      </BrandTrigger>
      {menu}
    </>
  )
}
