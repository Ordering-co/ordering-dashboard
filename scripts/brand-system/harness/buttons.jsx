import { CommentButton } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/ReviewCustomer/styles'
import React, { useState } from 'react'
import styled, { ThemeProvider, useTheme } from 'styled-components'

import { getOrderingAction } from '../../../src/brand/adapter'
import { Button, ButtonLink, IconButton, LinkButton } from '../../../src/@/components-dashboard/src/ui/src/styles/Buttons'
import { Button as OwnedButton } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/UI/Button'
import { Plus } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Icon'

export const ButtonsFixture = () => {
  const theme = useTheme()
  const customFontTheme = { ...theme, fonts: { ...theme.fonts, primary: { name: 'Fixture Tenant Sans', weights: [400] } } }
  const [events, setEvents] = useState(0)
  const [busy, setBusy] = useState(false)
  const record = () => setEvents(value => value + 1)
  const submit = event => {
    event.preventDefault()
    record()
  }

  return (
    <main data-testid='buttons-fixture' style={{ display: 'grid', gap: 16, padding: 24 }}>
      <output data-testid='resolved-action'>{getOrderingAction(theme)}</output>
      <section data-testid='owned-button-variants' aria-label='Owned action variants' style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {[undefined, 'primary', 'lightPrimary', 'lightGreen', 'green', 'warning', 'secundaryDark', 'secundary', 'black'].flatMap(color => [false, true].map(outline => (
          <OwnedButton key={String(color) + outline} data-owned-variant={(color || 'default') + '-' + (outline ? 'outline' : 'solid')} color={color} outline={outline}>{(color || 'default') + (outline ? ' outline' : ' solid')}</OwnedButton>
        )))}
      </section>
      <section aria-label='Button colors' style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <Button data-testid='button-default'>Default</Button>
        <Button data-testid='button-primary' color='primary' onClick={record}>Primary</Button>
        <Button data-testid='button-light-primary' color='lightPrimary'>Light primary</Button>
        <Button data-testid='button-light-green' color='lightGreen'>Light green</Button>
        <Button data-testid='button-green' color='green'>Green</Button>
        <Button data-testid='button-warning' color='warning'>Warning</Button>
        <Button data-testid='button-secondary' color='secundary'>Secondary</Button>
        <Button data-testid='button-secondary-dark' color='secundaryDark'>Secondary dark</Button>
        <Button data-testid='button-black' color='black'>Black</Button>
        <Button data-testid='button-dark-blue' color='darkBlue'>Legacy dark blue</Button>
      </section>
      <section aria-label='Button shapes' style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <Button data-testid='button-outline' outline color='primary'>Outline</Button>
        <Button data-testid='button-circle' circle color='primary' aria-label='Circle action'>+</Button>
        <Button data-testid='button-short' aria-label='Short button'>+</Button>
        <Button data-testid='button-rectangle' rectangle>Rectangle</Button>
        <Button data-testid='button-custom-radius' borderRadius='12px'>Custom radius</Button>
        <Button data-testid='button-transparent' bgtransparent color='primary'>Transparent</Button>
        <Button data-testid='button-forced-transparent' bgtransparent color='primary' style={{ background: 'red' }}>Forced transparent</Button>
        <Button data-testid='button-initial-icon' initialIcon><img alt='' /><span>Initial icon</span></Button>
        <Button data-testid='button-caller-graphic'><svg width='32' height='18' viewBox='0 0 32 18' aria-label='Fixture caller graphic'><rect width='32' height='18' /></svg>Caller graphic</Button>
        <Button data-testid='button-long-label'>Continue with this exceptionally long translated action</Button>
        <ThemeProvider theme={customFontTheme}><Button data-testid='button-custom-font'>Custom font</Button></ThemeProvider>
      </section>
      <section aria-label='Icon buttons' style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <IconButton data-testid='icon-default' aria-label='Default icon'><Plus /></IconButton>
        <IconButton data-testid='icon-black' color='black' aria-label='Black icon'><Plus /></IconButton>
        <IconButton data-testid='icon-active' color='black' active aria-label='Active icon'><Plus /></IconButton>
        <IconButton data-testid='icon-primary' color='primary' aria-label='Primary icon'><Plus /></IconButton>
        <IconButton data-testid='icon-disabled' disabled onClick={record} aria-label='Disabled icon'><Plus /></IconButton>
        <IconButton data-testid='icon-pointer-guarded' isDisabled onClick={record} aria-label='Pointer guarded icon'><Plus /></IconButton>
      </section>
      <section aria-label='Native contracts' style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <form onSubmit={submit}><Button data-testid='implicit-submit'>Implicit submit</Button></form>
        <Button data-testid='disabled-button' disabled onClick={record}>Disabled</Button>
        <Button data-testid='busy-button' disabled={busy} aria-busy={busy}>Save changes</Button>
        <Button data-testid='toggle-busy' type='button' onClick={() => setBusy(value => !value)}>Toggle busy</Button>
        <ButtonLink data-testid='button-link' href='#button-target' onClick={record}>Button link</ButtonLink>
        <LinkButton data-testid='link-button' href='#button-target' onClick={record}>Text link</LinkButton>
        <LinkButton data-testid='link-short' href='#button-target'>A</LinkButton>
        <LinkButton data-testid='disabled-link' href='#button-target' disabled>Disabled text link</LinkButton>
      </section>
      <div id='button-target'>Anchor target</div>
      <output data-testid='button-events'>{events}</output>
    </main>
  )
}

const ThemeAttrsProbe = styled(Button).attrs(props => ({
  theme: {
    ...props.theme,
    fonts: { ...props.theme.fonts, primary: { name: 'Fixture final font', family: 'monospace', local: true } },
    ordering: { ...props.theme.ordering, component: { ...props.theme.ordering.component, focusRing: { width: '7px', offset: '9px' } } }
  }
}))``

export const ActionProbesFixture = () => (
  <main data-testid='action-probes' style={{ padding: 24, fontWeight: 300 }}>
    <h1>Ordering.co compatibility state probes</h1>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {[undefined, 'primary', 'lightPrimary', 'lightGreen', 'green', 'warning', 'secundaryDark', 'secundary', 'black'].flatMap(color =>
        [false, true].map(outline => (
          <Button key={String(color) + outline} data-probe={'button-' + (color || 'default') + '-' + (outline ? 'outline' : 'solid')} color={color} outline={outline}>
            {(color || 'default') + (outline ? ' outline' : ' solid')}
          </Button>
        ))
      )}
      <CommentButton data-probe='comment-selected' active>Selected comment</CommentButton>
      <CommentButton data-probe='comment-unselected'>Unselected comment</CommentButton>
      <IconButton data-probe='icon-text'>Text icon control</IconButton>
      <LinkButton data-probe='link-text' href='#fixture-target'>Text link control</LinkButton>
      <ThemeAttrsProbe data-probe='final-theme' color='primary'>Final theme</ThemeAttrsProbe>
      <Button data-probe='caller-svg'><svg width='32' height='18' viewBox='0 0 32 18'><rect width='32' height='18' /></svg>Caller graphic</Button>
      <Button data-probe='circle-initial' circle initialIcon>+</Button>
      <ButtonLink data-probe='link-initial' href='#fixture-target' initialIcon>Initial link</ButtonLink>
    </div>
    <div id='fixture-target'>Fixture destination</div>
  </main>
)
