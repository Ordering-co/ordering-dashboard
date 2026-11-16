import React, { useEffect, useId, useState, useRef } from 'react'
import { ChevronDown as CaretDownFill } from '../Icon'
import { SketchPicker } from 'react-color'
import { useLanguage } from '../../../../../index'
import {
  Container,
  ColorWrapper,
  ColorBox,
  ColorPickerWrapper
} from './color-picker-styles'

const REPORT_DELAY_MS = 750

// the picked color is reported 750 ms after the last change (as in main, so a drag does not report every step), but a
// Save pressed sooner saved the old color and still said «Settings updated». So a pending color is also handed over as soon as the
// pointer or the focus goes outside the picker (before that click runs) and when it closes. An unmount still cancels it: Discard
// remounts the field to drop a pending color (Stores/BusinessBrandGENDetail, auditor 14).
export const ColorPicker = (props) => {
  const {
    defaultColor,
    isDisabled,
    onChangeColor,
    debounce = true // (main): `debounce={false}` reports every change at once
  } = props
  const [, t] = useLanguage()

  const [sketchPickerColor, setSketchPickerColor] = useState('#F5F9FF')
  const [open, setOpen] = useState(false)
  const buttonRef = useRef()
  const containerRef = useRef()
  const pickerId = useId()
  const timerRef = useRef(null)
  const pendingRef = useRef(null)
  const onChangeColorRef = useRef(onChangeColor)
  onChangeColorRef.current = onChangeColor

  const reportPending = () => {
    clearTimeout(timerRef.current)
    const hex = pendingRef.current
    if (hex == null) return
    pendingRef.current = null
    onChangeColorRef.current && onChangeColorRef.current(hex)
  }

  const handleChangePickerColor = (picker) => {
    setSketchPickerColor(picker.hex)
    pendingRef.current = picker.hex
    clearTimeout(timerRef.current)
    if (!debounce) {
      reportPending()
      return
    }
    timerRef.current = setTimeout(reportPending, REPORT_DELAY_MS)
  }

  useEffect(() => () => {
    clearTimeout(timerRef.current)
    pendingRef.current = null
  }, [])

  useEffect(() => {
    if (!open) reportPending()
  }, [open])

  useEffect(() => {
    const leaveOutside = (event) => {
      if (pendingRef.current != null && !containerRef.current?.contains(event.target)) reportPending()
    }
    document.addEventListener('pointerdown', leaveOutside, true)
    document.addEventListener('focusin', leaveOutside, true)
    return () => {
      document.removeEventListener('pointerdown', leaveOutside, true)
      document.removeEventListener('focusin', leaveOutside, true)
    }
  }, [])

  useEffect(() => {
    if (defaultColor) {
      setSketchPickerColor(defaultColor)
    }
  }, [defaultColor])

  const closePicker = (e) => {
    const outSideClick = !e.target.closest('.ordering-color-picker') && !buttonRef.current?.contains(e.target)
    if (outSideClick) setOpen(false)
  }

  useEffect(() => {
    document.addEventListener('click', closePicker)
    return () => document.removeEventListener('click', closePicker)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const closePickerWithKeyboard = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('keydown', closePickerWithKeyboard, true)
    return () => window.removeEventListener('keydown', closePickerWithKeyboard, true)
  }, [open])

  useEffect(() => {
    // redesign bugs F row 43: disabling closes the picker; it used to toggle it (open on mount when disabled)
    if (isDisabled) {
      setOpen(false)
    }
  }, [isDisabled])

  return (
    <Container ref={containerRef}>
      <ColorWrapper
        ref={buttonRef}
        disabled={Boolean(isDisabled)}
        aria-label={t('SELECT_COLOR', 'Select color')}
        aria-expanded={open}
        aria-haspopup='dialog'
        aria-controls={open ? pickerId : undefined}
        onClick={() => !isDisabled && setOpen(!open)}
      >
        <ColorBox bgColor={sketchPickerColor} />
        <CaretDownFill />
      </ColorWrapper>
      {open && (
        <ColorPickerWrapper
          id={pickerId}
          className='ordering-color-picker'
          role='dialog'
          aria-label={t('SELECT_COLOR', 'Select color')}
        >
          <SketchPicker
            onChange={!isDisabled && handleChangePickerColor}
            color={sketchPickerColor}
            disableAlpha
            styles={{
              default: {
                picker: {
                  background: 'var(--od-color-picker-surface)',
                  borderRadius: 'var(--od-color-picker-radius)',
                  boxShadow: 'var(--od-color-picker-shadow)'
                },
                hue: {
                  height: 'var(--od-color-picker-slider-height)'
                },
                color: {
                  width: 'var(--od-color-picker-preview-size)',
                  height: 'var(--od-color-picker-preview-size)'
                }
              },
              disableAlpha: {
                hue: {
                  height: 'var(--od-color-picker-slider-height)'
                },
                color: {
                  height: 'var(--od-color-picker-preview-size)'
                }
              }
            }}
          />
        </ColorPickerWrapper>
      )}
    </Container>
  )
}

ColorPicker.displayName = 'OrderingColorPicker'
