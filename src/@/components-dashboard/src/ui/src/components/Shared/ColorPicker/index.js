import React, { useEffect, useState, useRef } from 'react'
import { CaretDownFill } from 'react-bootstrap-icons'
import { SketchPicker } from 'react-color'
import {
  Container,
  ColorWrapper,
  ColorBox,
  ColorPickerWrapper
} from './styles'

export const ColorPicker = (props) => {
  const {
    defaultColor,
    isDisabled,
    onChangeColor
  } = props

  const [sketchPickerColor, setSketchPickerColor] = useState('#F5F9FF')
  const [open, setOpen] = useState(false)
  const [timeoutId, setTimeoutId] = useState(null)
  const buttonRef = useRef()

  const handleChangePickerColor = (picker) => {
    setSketchPickerColor(picker.hex)
    clearTimeout(timeoutId)
    const newTimeoutId = setTimeout(() => {
      onChangeColor && onChangeColor(picker.hex)
    }, 750)
    setTimeoutId(newTimeoutId)
  }

  useEffect(() => {
    return () => clearTimeout(timeoutId)
  }, [timeoutId])

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
    if (isDisabled) {
      setOpen(!open)
    }
  }, [isDisabled])

  return (
    <Container>
      <ColorWrapper ref={buttonRef} onClick={() => !isDisabled && setOpen(!open)}>
        <ColorBox bgColor={sketchPickerColor} />
        <CaretDownFill />
      </ColorWrapper>
      {open && (
        <ColorPickerWrapper className='ordering-color-picker'>
          <SketchPicker
            onChange={!isDisabled && handleChangePickerColor}
            color={sketchPickerColor}
            disableAlpha
          />
        </ColorPickerWrapper>
      )}
    </Container>
  )
}
