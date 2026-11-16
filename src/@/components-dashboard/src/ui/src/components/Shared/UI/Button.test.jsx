import React from 'react'
import styled, { ThemeProvider } from 'styled-components'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button, ButtonLink, IconButton, LinkButton, TextButton } from './Button'
import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const current = createDashboardTheme(theme)
const renderButton = children => render(<ThemeProvider theme={current}>{children}</ThemeProvider>)

describe('Ordering.co pilot Button contracts', () => {
  it('preserves shared submit, explicit types, reset, disabled and callback counts', () => {
    const submit = vi.fn(event => event.preventDefault())
    const click = vi.fn()
    renderButton(<form onSubmit={submit}><input aria-label='Value' defaultValue='initial' /><Button onClick={click}>Save</Button><Button type={null}>Null submit</Button><Button type='submit'>Explicit submit</Button><Button type='button'>Other</Button><Button type='reset'>Reset</Button><Button disabled onClick={click}>Disabled</Button></form>)
    const save = screen.getByText('Save')
    expect(save).toHaveAttribute('type', 'submit')
    expect(save.type).toBe('submit')
    fireEvent.click(screen.getByText('Save'))
    expect(submit).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Other'))
    fireEvent.click(screen.getByText('Disabled'))
    expect(submit).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Explicit submit')).toHaveAttribute('type', 'submit')
    expect(screen.getByText('Null submit')).toHaveAttribute('type', 'submit')
    expect(screen.getByText('Other')).toHaveAttribute('type', 'button')
    expect(screen.getByText('Reset')).toHaveAttribute('type', 'reset')
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'changed' } })
    fireEvent.click(screen.getByText('Reset'))
    expect(screen.getByLabelText('Value')).toHaveValue('initial')
  })

  it('keeps styled identity, attrs, interpolation, refs and explicit custom styles', () => {
    const ref = React.createRef()
    const attrsTheme = {
      ...current,
      fonts: { ...current.fonts, primary: { name: 'Attrs Font', weights: [500] } },
      ordering: {
        ...current.ordering,
        component: {
          ...current.ordering.component,
          focusRing: { ...current.ordering.component.focusRing, width: '7px', offset: '9px' }
        }
      }
    }
    const Extended = styled(Button).attrs({ title: 'From attrs' })`letter-spacing: 1px;`
    const VariantAttrs = styled(Button).attrs({ color: 'green', borderRadius: '19px' })``
    const CircleAttrs = styled(Button).attrs({ circle: true })``
    const OverrideAttrs = styled(Button).attrs({ color: 'primary' })``
    const PolymorphicAttrs = styled(Button).attrs({ as: 'a', color: 'primary', outline: true, href: '#attrs-link' })``
    const ThemeAttrs = styled(Button).attrs({ theme: attrsTheme })``
    const NestedLabel = styled.span`
      padding-left: 22px;
      padding-right: 22px;
      vertical-align: top;
    `
    const Container = styled.div`${Button} { text-decoration: underline; }`
    renderButton(<Container><Extended ref={ref} className='existing-hook od-button-circle' color='primary' outline style={{ marginTop: 7 }}>Extended</Extended><VariantAttrs>Variant attrs</VariantAttrs><CircleAttrs>Circle attrs</CircleAttrs><OverrideAttrs color='black'>Override attrs</OverrideAttrs><PolymorphicAttrs>Polymorphic attrs</PolymorphicAttrs><ThemeAttrs>Theme attrs</ThemeAttrs><Button style={{ '--od-ui-button-background': 'hotpink', '--od-ui-focus-width': '11px' }}>Inline variable</Button><Button><NestedLabel>Nested label</NestedLabel></Button><Button initialIcon><NestedLabel>Initial nested label</NestedLabel></Button></Container>)
    const element = screen.getByText('Extended')
    expect(typeof Button.styledComponentId).toBe('string')
    expect(ref.current).toBe(element)
    expect(element).toHaveAttribute('title', 'From attrs')
    expect(element).toHaveClass('existing-hook', 'od-button-circle', 'od-button-primary', 'od-button-outline')
    expect(element).toHaveStyle({ marginTop: '7px', letterSpacing: '1px' })
    expect(element).not.toHaveAttribute('outline')
    expect(element).not.toHaveAttribute('color')
    expect(getComputedStyle(element).getPropertyValue('--od-ui-action')).toBe(current.ordering.semantic.action.default)
    expect(screen.getByText('Variant attrs')).toHaveClass('od-button-green')
    expect(getComputedStyle(screen.getByText('Variant attrs')).getPropertyValue('--od-ui-button-radius')).toBe('19px')
    expect(screen.getByText('Circle attrs')).toHaveClass('od-button-circle')
    expect(screen.getByText('Override attrs')).toHaveClass('od-button-primary')
    expect(getComputedStyle(screen.getByText('Override attrs')).getPropertyValue('--od-ui-button-background')).toBe(current.ordering.semantic.action.default)
    expect(getComputedStyle(screen.getByRole('link', { name: 'Polymorphic attrs' })).getPropertyValue('--od-ui-button-background')).toBe(current.ordering.semantic.surface.default)
    expect(getComputedStyle(screen.getByText('Theme attrs')).getPropertyValue('--od-ui-font').replace(/,\s*/g, ',')).toBe("'Attrs Font',sans-serif")
    expect(getComputedStyle(screen.getByText('Theme attrs')).getPropertyValue('--od-ui-focus-width')).toBe('7px')
    expect(getComputedStyle(screen.getByText('Theme attrs')).getPropertyValue('--od-ui-focus-offset')).toBe('9px')
    expect(screen.getByText('Inline variable').style.getPropertyValue('--od-ui-button-background')).toBe('hotpink')
    expect(getComputedStyle(screen.getByText('Inline variable')).getPropertyValue('--od-ui-button-background')).toBe('hotpink')
    expect(getComputedStyle(screen.getByText('Inline variable')).getPropertyValue('--od-ui-focus-width')).toBe('11px')
    expect(screen.getByText('Nested label')).toHaveStyle({ paddingLeft: '22px', verticalAlign: 'top' })
    expect(screen.getByText('Initial nested label')).toHaveStyle({ paddingRight: '22px' })
  })

  it('keeps polymorphic anchors styled without introducing button semantics', () => {
    renderButton(<><Button as='a' href='#destination' type='text/html'>Destination</Button><Button forwardedAs='a' href='#forward' type='text/plain'>Forwarded</Button></>)
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveClass('od-button')
      expect(link).not.toHaveAttribute('role', 'button')
    }
    expect(screen.getByText('Destination')).toHaveAttribute('href', '#destination')
    expect(screen.getByText('Destination')).toHaveAttribute('type', 'text/html')
    expect(screen.getByText('Forwarded')).toHaveAttribute('href', '#forward')
    expect(screen.getByText('Forwarded')).toHaveAttribute('type', 'text/plain')
  })

  it('owns the complete shared family and keeps real links separate from Base UI buttons', () => {
    const buttonLinkRef = React.createRef()
    const linkButtonRef = React.createRef()
    const EnabledLinkAttrs = styled(LinkButton).attrs({ disabled: false })``
    renderButton(
      <>
        <IconButton aria-label='More actions' color='black' active />
        <IconButton aria-label='External icon hook' color='primary' className='external-icon od-icon-button-active' />
        <ButtonLink ref={buttonLinkRef} href='#button-link'>Button link</ButtonLink>
        <LinkButton ref={linkButtonRef} href='#text-link' disabled>Text link</LinkButton>
        <EnabledLinkAttrs href='#enabled-link' disabled>Enabled by attrs</EnabledLinkAttrs>
        <TextButton type='button'>Remove</TextButton>
      </>
    )

    expect(typeof IconButton.styledComponentId).toBe('string')
    expect(typeof ButtonLink.styledComponentId).toBe('string')
    expect(typeof LinkButton.styledComponentId).toBe('string')
    expect(typeof TextButton.styledComponentId).toBe('string')
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveClass('od-icon-button-active')
    expect(screen.getByRole('button', { name: 'External icon hook' })).toHaveClass('external-icon', 'od-icon-button-active', 'od-icon-button-primary')
    expect(getComputedStyle(screen.getByRole('button', { name: 'External icon hook' })).getPropertyValue('--od-ui-icon-button-background')).toBe('transparent')
    expect(screen.getByRole('link', { name: 'Button link' })).toHaveAttribute('href', '#button-link')
    expect(buttonLinkRef.current).toBe(screen.getByRole('link', { name: 'Button link' }))
    expect(linkButtonRef.current).toBe(screen.getByText('Text link'))
    expect(screen.getByText('Text link')).toHaveAttribute('disabled')
    expect(screen.getByText('Text link')).toHaveClass('od-link-button-disabled')
    expect(getComputedStyle(screen.getByRole('link', { name: 'Enabled by attrs' })).getPropertyValue('--od-ui-link-button-pointer-events')).toBe('auto')
    expect(getComputedStyle(screen.getByRole('link', { name: 'Enabled by attrs' })).getPropertyValue('--od-ui-link-button-opacity')).toBe('1')
    const textButton = screen.getByRole('button', { name: 'Remove' })
    expect(textButton).toHaveClass('od-button-danger-text')
    expect(getComputedStyle(textButton).getPropertyValue('--od-ui-button-foreground')).toBe(current.ordering.semantic.state.danger.functional)
    expect(getComputedStyle(textButton).getPropertyValue('--od-ui-button-hover-foreground')).toBe('')
    expect(getComputedStyle(textButton).getPropertyValue('--od-ui-button-active-foreground')).toBe('')
    expect(getComputedStyle(screen.getByRole('button', { name: 'More actions' })).getPropertyValue('--od-ui-font-weight')).toBe('500')
    expect(getComputedStyle(screen.getByText('Text link')).getPropertyValue('--od-ui-font-weight')).toBe('500')
  })

  it('maps reviewed legacy variants and shapes while unknown values remain neutral', () => {
    renderButton(
      <>
        <Button color='lightPrimary'>Light primary</Button>
        <Button color='lightGreen'>Light green</Button>
        <Button color='green'>Green</Button>
        <Button color='warning'>Warning</Button>
        <Button color='secundaryDark'>Secondary dark</Button>
        <Button color='secundary'>Secondary</Button>
        <Button color='black'>Black</Button>
        <Button color='darkBlue'>Unknown</Button>
        <Button color='constructor'>Prototype key</Button>
        <Button circle rectangle bgtransparent initialIcon borderRadius='11px'>Shapes</Button>
        <ButtonLink href='#fixture' initialIcon>Initial link</ButtonLink>
      </>
    )

    expect(screen.getByText('Light primary')).toHaveClass('od-button-light-primary')
    expect(screen.getByText('Light green')).toHaveClass('od-button-light-green')
    expect(screen.getByText('Green')).toHaveClass('od-button-green')
    expect(screen.getByText('Warning')).toHaveClass('od-button-warning')
    expect(screen.getByText('Secondary dark')).toHaveClass('od-button-secondary-dark')
    expect(screen.getByText('Secondary')).toHaveClass('od-button-secondary')
    expect(screen.getByText('Black')).toHaveClass('od-button-black')
    expect(screen.getByText('Unknown').className).not.toMatch(/od-button-(?:primary|secondary|black|green|warning)/)
    expect(screen.getByText('Prototype key').className).not.toContain('function Object')
    expect(screen.getByText('Shapes')).toHaveClass('od-button-circle', 'od-button-rectangle', 'od-button-transparent', 'od-button-initial-icon')
    expect(getComputedStyle(screen.getByText('Shapes')).getPropertyValue('--od-ui-button-radius')).toBe(current.ordering.radius.round)
    expect(getComputedStyle(screen.getByText('Shapes')).getPropertyValue('--od-ui-button-text-align')).toBe('center')
    expect(getComputedStyle(screen.getByText('Initial link')).getPropertyValue('--od-ui-button-text-align')).toBe('center')
    for (const attribute of ['color', 'outline', 'circle', 'rectangle', 'bgtransparent', 'initialicon', 'borderRadius']) {
      expect(screen.getByText('Shapes')).not.toHaveAttribute(attribute)
    }
  })
})
