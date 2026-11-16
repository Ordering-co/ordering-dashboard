import React, { useState } from 'react'
import { render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { vi } from 'vitest'

import { EditTaxManager } from '../index'

// A stand-in for the parent controller: it holds `formChanges` and applies `onChange` as the real `handleChangeTax` does
// (a `null` value drops `order_type_rates`; an order type goes under `order_type_rates[orderType][name]` through parseFloat).
export const applyChange = (previous, name, value, orderType) => {
  if (value === null) {
    const next = { ...previous }
    delete next.order_type_rates
    return next
  }
  if (orderType) {
    return {
      ...previous,
      order_type_rates: {
        ...previous.order_type_rates,
        [orderType]: { ...previous.order_type_rates?.[orderType], [name]: parseFloat(value) }
      }
    }
  }
  return { ...previous, [name]: value }
}

const Harness = ({ initial, spy, clearOnSave, handleSave, onDiscard, ...props }) => {
  const [formChanges, setFormChanges] = useState(initial)
  const onChange = (...args) => {
    spy(...args)
    setFormChanges(previous => applyChange(previous, ...args))
  }
  const save = clearOnSave
    ? async (...args) => {
      const result = await handleSave(...args)
      if (result?.ok !== false) setFormChanges({})
      return result
    }
    : handleSave
  return (
    <ThemeProvider theme={{ colors: {} }}>
      <EditTaxManager
        {...props}
        formChanges={formChanges}
        onChange={onChange}
        handleSave={save}
        onDiscard={onDiscard ? () => { onDiscard(); setFormChanges({}) } : undefined}
      />
    </ThemeProvider>
  )
}

export const setup = ({
  type = 'taxes',
  data = true,
  initial = {},
  handleSave = vi.fn().mockResolvedValue({ id: 1 }),
  clearOnSave = false,
  wrapper,
  ...props
} = {}) => {
  const spy = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <Harness
      type={type}
      data={data}
      initial={initial}
      spy={spy}
      clearOnSave={clearOnSave}
      handleSave={handleSave}
      onClose={onClose}
      {...props}
    />,
    { wrapper }
  )
  return { ...view, spy, onClose, handleSave }
}
