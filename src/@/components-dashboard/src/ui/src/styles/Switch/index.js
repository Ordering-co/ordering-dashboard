import React, { useEffect, useState } from 'react'

import {
  ToggleSwitchContainer,
  Slider
} from './styles'

export const Switch = (props) => {
  const {
    defaultChecked,
    disabled,
    onChange,
    className,
    notAsync,
    ariaLabel
  } = props
  const [checked, setChecked] = useState(Boolean(defaultChecked))

  useEffect(() => {
    setChecked(defaultChecked)
  }, [defaultChecked])

  const handleCheckBoxChange = (evt) => {
    evt.stopPropagation()
    if (!notAsync) {
      setChecked(evt.target.checked)
    }
    onChange && onChange(evt.target.checked)
  }

  return (
    <ToggleSwitchContainer className={className} disabled={disabled}>
      <input
        type='checkbox'
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={handleCheckBoxChange}
      />
      <Slider />
    </ToggleSwitchContainer>
  )
}
