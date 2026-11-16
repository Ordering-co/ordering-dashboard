import React, { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { mergeThemePrimary, tenantAccentPaint } from '~/utils/bootTheme'

import { Button, ButtonLink, IconButton, LinkButton } from '.'
import { resolveButtonTheme, resolveTransparentButtonText, safeDarken } from './theme'
import { DangerOutlineButton } from '../../components/MyProducts/OrderingWebsite/styles'
import { CommentButton } from '../../components/Orders/ReviewCustomer/styles'
import { InputGroupLeft } from '../Inputs'

const renderWithTheme = (content, customTheme = createDashboardTheme(theme)) => render(
  <ThemeProvider theme={customTheme}>{content}</ThemeProvider>
)

describe('Button element contracts', () => {
  it('keeps the implicit submit type, ref, attributes and form event', () => {
    const ref = createRef()
    const submit = vi.fn(event => event.preventDefault())
    renderWithTheme(
      <form onSubmit={submit}>
        <Button ref={ref} data-contract='preserved'>Save</Button>
        <Button type={null}>Null button</Button>
        <IconButton type={null} aria-label='Null icon' />
      </form>
    )

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveClass('od-button-legacy')
    expect(button).not.toHaveAttribute('compatibility')
    expect(button).not.toHaveAttribute('type')
    expect(button.type).toBe('submit')
    expect(button).toHaveAttribute('data-contract', 'preserved')
    expect(screen.getByRole('button', { name: 'Null button' })).not.toHaveAttribute('type')
    expect(screen.getByRole('button', { name: 'Null icon' })).not.toHaveAttribute('type')
    expect(ref.current).toBe(button)
    fireEvent.click(button)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('keeps native disabled separate from the legacy isDisabled pointer guard', () => {
    const click = vi.fn()
    renderWithTheme(
      <>
        <IconButton disabled onClick={click} aria-label='Native disabled' />
        <IconButton isDisabled onClick={click} aria-label='Pointer guarded' />
      </>
    )

    const disabled = screen.getByRole('button', { name: 'Native disabled' })
    const pointerGuarded = screen.getByRole('button', { name: 'Pointer guarded' })
    expect(disabled).toBeDisabled()
    expect(pointerGuarded).not.toBeDisabled()
    fireEvent.click(disabled)
    expect(click).not.toHaveBeenCalled()
    fireEvent.click(pointerGuarded)
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('keeps both link exports as anchors with refs and click handlers', () => {
    const buttonLinkRef = createRef()
    const linkButtonRef = createRef()
    const click = vi.fn(event => event.preventDefault())
    renderWithTheme(
      <>
        <ButtonLink ref={buttonLinkRef} href='#target' onClick={click}>Button link</ButtonLink>
        <LinkButton ref={linkButtonRef} href='#target' onClick={click}>Text link</LinkButton>
      </>
    )

    const buttonLink = screen.getByRole('link', { name: 'Button link' })
    const textLink = screen.getByRole('link', { name: 'Text link' })
    expect(buttonLink.tagName).toBe('A')
    expect(textLink.tagName).toBe('A')
    expect(buttonLinkRef.current).toBe(buttonLink)
    expect(linkButtonRef.current).toBe(textLink)
    fireEvent.click(buttonLink)
    fireEvent.click(textLink)
    expect(click).toHaveBeenCalledTimes(2)
  })

  it('preserves each legacy facade polymorphic precedence', () => {
    const OuterButtonAs = styled(Button).attrs({ as: 'a', href: '#outer-button' })``
    const OuterButtonLinkAs = styled(ButtonLink).attrs({ as: 'button', type: 'button' })``
    renderWithTheme(
      <>
        <Button data-testid='button-as' as='a' href='#ignored'>Button as</Button>
        <Button data-testid='button-forwarded' forwardedAs='a'>Button forwarded</Button>
        <ButtonLink data-testid='button-link-as' as='button'>Button link as</ButtonLink>
        <ButtonLink data-testid='button-link-forwarded' forwardedAs='button'>Button link forwarded</ButtonLink>
        <IconButton data-testid='icon-as' as='a' href='#icon' aria-label='Icon as' />
        <IconButton data-testid='icon-forwarded' forwardedAs='a' aria-label='Icon forwarded' />
        <LinkButton data-testid='link-as' as='button' type='button'>Link as</LinkButton>
        <LinkButton data-testid='link-forwarded' forwardedAs='button'>Link forwarded</LinkButton>
        <OuterButtonAs data-testid='outer-button-as'>Outer button attrs</OuterButtonAs>
        <OuterButtonLinkAs data-testid='outer-button-link-as'>Outer button link attrs</OuterButtonLinkAs>
      </>
    )

    expect(screen.getByTestId('button-as').tagName).toBe('BUTTON')
    expect(screen.getByTestId('button-as')).not.toHaveAttribute('as')
    expect(screen.getByTestId('button-forwarded').tagName).toBe('BUTTON')
    expect(screen.getByTestId('button-forwarded')).toHaveAttribute('as', 'a')
    expect(screen.getByTestId('button-link-as').tagName).toBe('A')
    expect(screen.getByTestId('button-link-as')).not.toHaveAttribute('as')
    expect(screen.getByTestId('button-link-forwarded').tagName).toBe('A')
    expect(screen.getByTestId('button-link-forwarded')).toHaveAttribute('as', 'button')
    expect(screen.getByTestId('icon-as').tagName).toBe('A')
    expect(screen.getByTestId('icon-forwarded').tagName).toBe('BUTTON')
    expect(screen.getByTestId('icon-forwarded')).toHaveAttribute('as', 'a')
    expect(screen.getByTestId('link-as').tagName).toBe('BUTTON')
    expect(screen.getByTestId('link-forwarded').tagName).toBe('A')
    expect(screen.getByTestId('link-forwarded')).toHaveAttribute('as', 'button')
    expect(screen.getByTestId('outer-button-as').tagName).toBe('A')
    expect(screen.getByTestId('outer-button-link-as').tagName).toBe('BUTTON')
  })

  it('paints the tenant action as tenantAccentPaint gives it, keeps an invalid legacy value and never throws', () => {
    const customFont = { name: 'Tenant Font', weights: [400] }
    const custom = mergeThemePrimary(createDashboardTheme({ ...theme, fonts: { ...theme.fonts, primary: customFont } }), '#F5A300')
    // decision 42: white misses AA on #F5A300, so the fill is the darker shade tenantAccentPaint gives, with white text,
    // and the outline and transparent primary write in that shade on the page; the stored value is untouched
    const shade = tenantAccentPaint('#F5A300').background
    expect(resolveButtonTheme(custom).action).toBe(shade)
    expect(shade).not.toBe('#F5A300')
    expect(resolveButtonTheme(custom).actionContent).toBe(shade)
    expect(resolveTransparentButtonText(custom, 'primary')).toBe(shade)
    expect(resolveButtonTheme(custom).actionHover).not.toBe('#F5A300')
    expect(resolveButtonTheme(custom).easing).toBe('cubic-bezier(0.32, 0.72, 0, 1)')
    expect(resolveButtonTheme(custom).fontFamily).toBe("'Tenant Font', sans-serif")

    const invalid = mergeThemePrimary(createDashboardTheme(theme), 'tenant-value-as-supplied')
    expect(() => resolveButtonTheme(invalid)).not.toThrow()
    expect(resolveButtonTheme(invalid).action).toBe('tenant-value-as-supplied')
    expect(safeDarken(0.04, 'tenant-value-as-supplied')).toBe('tenant-value-as-supplied')
  })

  it('keeps every legacy styled identity, extension and descendant interpolation live', () => {
    // the styled(Button) extension of the deleted Connect/ImportersPanel, kept here as a local fixture
    const LogsDeleteButton = styled(Button)`
      min-height: 36px;
      padding: 0 14px;
      flex-shrink: 0;
    `
    const Extended = styled(Button).attrs({ title: 'Legacy attrs' })`
      letter-spacing: 2px;
    `
    const Selector = styled.div`
      ${Button} {
        text-transform: uppercase;
      }
    `

    renderWithTheme(
      <>
        <LogsDeleteButton>Delete logs</LogsDeleteButton>
        <DangerOutlineButton borderRadius='8px'>Remove domain</DangerOutlineButton>
        <CommentButton active>Selected comment</CommentButton>
        <InputGroupLeft><Button>Grouped</Button></InputGroupLeft>
        <Selector><Extended>Extended</Extended></Selector>
      </>
    )

    for (const component of [Button, ButtonLink, IconButton, LinkButton]) {
      expect(typeof component.styledComponentId).toBe('string')
    }
    expect(new Set([Button, ButtonLink, IconButton, LinkButton].map(component => component.styledComponentId)).size).toBe(4)
    expect(screen.getByText('Delete logs')).toHaveStyle({ minHeight: '36px' })
    expect(getComputedStyle(screen.getByText('Remove domain')).getPropertyValue('--od-ui-button-radius')).toBe('8px')
    expect(screen.getByText('Selected comment')).toHaveStyle({ color: 'var(--od-ui-action-foreground)' })
    expect(screen.getByText('Grouped')).toHaveStyle({ marginLeft: '-7px' })
    expect(screen.getByText('Extended')).toHaveAttribute('title', 'Legacy attrs')
    expect(screen.getByText('Extended')).toHaveStyle({ letterSpacing: '2px', textTransform: 'uppercase' })
  })
})
