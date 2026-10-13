import React from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { Button, ButtonLink, IconButton, LinkButton } from '../Buttons'
import { Checkbox, RadioButton } from '../Checkbox'
import { Input, TextArea } from '../Inputs'
import { Switch } from '../Switch'
import { Tab, Tabs } from '../Tabs'

describe('shared style primitives', () => {
  it('renders buttons, form controls, and tab primitives', () => {
    const onClick = vi.fn()

    renderWithProviders(
      <>
        <Button color='primary' onClick={onClick}>Save</Button>
        <IconButton aria-label='close'>×</IconButton>
        <LinkButton href='/help'>Help</LinkButton>
        <ButtonLink href='/next'>Next</ButtonLink>
        <Input aria-label='Name' defaultValue='Ada' />
        <TextArea aria-label='Notes' defaultValue='Hello' />
        <Checkbox aria-label='Terms' type='checkbox' />
        <RadioButton aria-label='Option' type='radio' />
        <Switch aria-label='Enabled' defaultChecked={false} type='checkbox' />
        <Tabs><Tab active>Current</Tab><Tab>Other</Tab></Tabs>
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help')
    expect(screen.getByLabelText('Name')).toHaveValue('Ada')
    expect(screen.getByLabelText('Notes')).toHaveValue('Hello')
    expect(screen.getByText('Current')).toBeInTheDocument()
  })
})
