import React, { useEffect, useRef, useState } from 'react'
import styled, { ThemeProvider, useTheme } from 'styled-components'

import { getOrderingAction } from '../../../src/brand/adapter'
import { mergeThemePrimary } from '../../../src/utils/bootTheme'
import { Checkbox, RadioButton } from '../../../src/@/components-dashboard/src/ui/src/styles/Checkbox'
import {
  Input,
  InputGroup,
  InputGroupLeft,
  InputGroupPrimary,
  InputGroupRight,
  InputPrimary,
  InputSecundary,
  TextArea
} from '../../../src/@/components-dashboard/src/ui/src/styles/Inputs'
import { Button } from '../../../src/@/components-dashboard/src/ui/src/styles/Buttons'
import { Switch } from '../../../src/@/components-dashboard/src/ui/src/styles/Switch'
import { Slider, ToggleSwitchContainer } from '../../../src/@/components-dashboard/src/ui/src/styles/Switch/styles'
import { useTheme as useDashboardTheme } from '../../../src/@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { Checkbox as OwnedCheckbox } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/UI/Checkbox'

const TenantAttrsGroup = styled(InputGroupPrimary).attrs(props => ({
  theme: mergeThemePrimary(props.theme, '#123456')
}))``

const ComposedSwitchContainer = styled(ToggleSwitchContainer).attrs(props => ({
  theme: mergeThemePrimary(props.theme, '#123456')
}))``
const ComposedSlider = styled(Slider).attrs(props => ({ theme: { ...props.theme, rtl: true } }))`
  background-color: rgb(100, 110, 120);
  width: 31px;
  height: 17px;
`

const targetStyle = {
  alignItems: 'center',
  display: 'inline-flex',
  gap: 12,
  minHeight: 44,
  minWidth: 44,
  maxWidth: '100%'
}

export const FieldsFixture = () => {
  const theme = useTheme()
  const [, { update }] = useDashboardTheme()
  const inputRef = useRef()
  const textAreaRef = useRef()
  const indeterminateRef = useRef()
  const ownedCheckboxRef = useRef()
  const [ownedCheckboxDefault, setOwnedCheckboxDefault] = useState(undefined)
  const [controlled, setControlled] = useState('Controlled value')
  const [switchValue, setSwitchValue] = useState(false)
  const [switchEvent, setSwitchEvent] = useState(null)
  const [pendingSwitch, setPendingSwitch] = useState(null)
  const [serialized, setSerialized] = useState('')
  const customFontTheme = {
    ...theme,
    fonts: {
      ...theme.fonts,
      primary: { name: 'Fixture Tenant Sans', family: '"Fixture Tenant Sans", sans-serif', weights: [400], local: true }
    }
  }

  useEffect(() => {
    if (indeterminateRef.current) indeterminateRef.current.indeterminate = true
  }, [])

  const submit = event => {
    event.preventDefault()
    setSerialized(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())))
  }

  return (
    <main data-testid='fields-fixture' style={{ boxSizing: 'border-box', display: 'grid', gap: 20, maxWidth: 960, minWidth: 0, padding: 24, width: '100%' }}>
      <output data-testid='resolved-action'>{getOrderingAction(theme)}</output>
      <form data-testid='fields-form' onSubmit={submit} style={{ display: 'grid', gap: 16, minWidth: 0, width: '100%' }}>
        <section aria-label='Text fields' style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', minWidth: 0, width: '100%' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            Uncontrolled field with an exceptionally long translated label
            <Input ref={inputRef} className='fixture-input-hook' name='uncontrolled' defaultValue='Initial value' placeholder='Uncontrolled placeholder' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Controlled field
            <Input name='controlled' value={controlled} onChange={event => setControlled(event.target.value)} placeholder='Controlled placeholder' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Required field
            <Input data-testid='required-input' name='required' required placeholder='Required placeholder' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Read-only field
            <Input data-testid='readonly-input' name='readonly' readOnly defaultValue='Read-only value' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Disabled field
            <Input data-testid='disabled-input' name='disabled' disabled defaultValue='Disabled value' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Primary field
            <InputPrimary data-testid='primary-input' name='primary' defaultValue='Primary value' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Secondary field
            <InputSecundary data-testid='secondary-input' name='secondary' defaultValue='Secondary value' />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Notes with a long value that must remain readable and editable
            <TextArea ref={textAreaRef} className='fixture-textarea-hook' name='notes' defaultValue='A long fixture note that preserves the native textarea value contract.' placeholder='Notes placeholder' rows={3} />
          </label>
          <ThemeProvider theme={customFontTheme}>
            <label style={{ display: 'grid', gap: 6 }}>
              Tenant font field
              <Input data-testid='custom-font-input' defaultValue='Custom font value' />
            </label>
          </ThemeProvider>
        </section>

        <section aria-label='Input group' style={{ minWidth: 0, width: '100%' }}>
          <InputGroup data-testid='input-group' className='fixture-input-group-hook' style={{ minWidth: 0, width: '100%' }}>
            <Input name='groupLeft' defaultValue='Left value' aria-label='Group left' />
            <Input name='groupRight' defaultValue='Right value' aria-label='Group right' />
          </InputGroup>
          <InputGroupPrimary data-testid='adorned-input-group' style={{ marginTop: 12, minWidth: 0, width: '100%' }}>
            <InputGroupLeft data-testid='input-group-left'>
              <Button data-testid='left-adornment-button' type='button'>Prefix</Button>
            </InputGroupLeft>
            <InputPrimary name='adorned' defaultValue='Adorned value' aria-label='Adorned value' />
            <InputGroupRight data-testid='input-group-right'>
              <Button data-testid='right-adornment-button' type='button'>Suffix</Button>
            </InputGroupRight>
          </InputGroupPrimary>
          <TenantAttrsGroup data-testid='tenant-attrs-group' style={{ marginTop: 12 }}>
            <InputGroupLeft data-testid='tenant-attrs-group-left'>Prefix</InputGroupLeft>
            <Input aria-label='Tenant group input' defaultValue='Ambient input theme' />
            <InputGroupRight data-testid='tenant-attrs-group-right'>Suffix</InputGroupRight>
          </TenantAttrsGroup>
        </section>

        <section aria-label='Checks' style={{ display: 'flex', flexWrap: 'wrap', gap: 16, minWidth: 0, width: '100%' }}>
          <label data-testid='checkbox-target' style={targetStyle}>
            <Checkbox className='fixture-checkbox-hook' name='accepted' value='yes' defaultChecked />
            <span style={{ minWidth: 0 }}>A long checkbox label that remains operable when content wraps</span>
          </label>
          <label data-testid='controlled-checkbox-target' style={targetStyle}>
            <Checkbox data-testid='controlled-checkbox' checked={controlled === 'Checked state'} onChange={event => setControlled(event.target.checked ? 'Checked state' : 'Controlled value')} />
            <span style={{ minWidth: 0 }}>Controlled checkbox</span>
          </label>
          <label data-testid='radio-checkbox-target' style={targetStyle}>
            <RadioButton data-testid='radio-checkbox' name='roundChoice' value='round' defaultChecked />
            <span style={{ minWidth: 0 }}>Round checkbox presentation</span>
          </label>
          <label data-testid='indeterminate-target' style={targetStyle}>
            <Checkbox ref={indeterminateRef} data-testid='indeterminate-checkbox' name='partial' value='partial' defaultChecked />
            <span style={{ minWidth: 0 }}>Partially selected value</span>
          </label>
          <label style={targetStyle}>
            <Checkbox data-testid='default-value-checkbox' name='defaultChoice' defaultChecked />
            <span>Native default checkbox value</span>
          </label>
        </section>

        <section aria-label='Switches' style={{ display: 'flex', flexWrap: 'wrap', gap: 16, minWidth: 0, width: '100%' }}>
          <div data-testid='switch-target' style={targetStyle}>
            <Switch className='fixture-switch-hook' defaultChecked={switchValue} onChange={value => { setSwitchEvent(value); setSwitchValue(value) }} />
            <span style={{ minWidth: 0 }}>A long switch label that remains visually centered</span>
          </div>
          <div data-testid='not-async-switch-target' style={targetStyle}>
            <Switch className='fixture-not-async-hook' defaultChecked={switchValue} notAsync onChange={setPendingSwitch} />
            <span style={{ minWidth: 0 }}>Externally committed switch</span>
          </div>
          <div data-testid='disabled-switch-target' style={targetStyle}>
            <Switch className='fixture-disabled-switch-hook' defaultChecked disabled onChange={setSwitchEvent} />
            <span style={{ minWidth: 0 }}>Pointer-only disabled switch</span>
          </div>
        </section>

        <button type='button' data-testid='commit-switch' onClick={() => setSwitchValue(Boolean(pendingSwitch))}>Commit switch value</button>
        <button type='submit'>Serialize form</button>
      </form>

      <output data-testid='controlled-value'>{controlled}</output>
      <output data-testid='switch-event'>{String(switchEvent)}</output>
      <output data-testid='pending-switch'>{String(pendingSwitch)}</output>
      <output data-testid='ref-contract'>{`${inputRef.current?.tagName}:${inputRef.current?.type}:${textAreaRef.current?.tagName}`}</output>
      <output data-testid='serialized-form'>{serialized}</output>
      <button
        type='button'
        data-testid='update-field-theme'
        onClick={() => update({
          ...mergeThemePrimary(theme, '#123456'),
          rtl: !theme.rtl,
          fonts: { ...theme.fonts, primary: { name: 'Fixture Selection Mono', family: 'monospace', local: true } }
        })}
      >Update field fixture theme</button>
      <label style={targetStyle}>
        <OwnedCheckbox ref={ownedCheckboxRef} data-testid='owned-dynamic-checkbox' defaultChecked={false} defaultValue={ownedCheckboxDefault} />
        <span>Owned checkbox with changing default value</span>
      </label>
      <button
        type='button'
        data-testid='update-owned-checkbox-default'
        onClick={() => {
          ownedCheckboxRef.current.indeterminate = true
          ownedCheckboxRef.current.focus()
          setOwnedCheckboxDefault('updated-default')
        }}
      >Update owned checkbox default</button>
      <ComposedSwitchContainer style={{ width: 60, height: 44 }}>
        <input type='checkbox' aria-label='Composed switch' />
        <ComposedSlider data-testid='composed-switch-slider' />
      </ComposedSwitchContainer>
    </main>
  )
}
