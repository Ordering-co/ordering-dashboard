import React from 'react'
import styled, { css } from 'styled-components'
import { orderingBrandScope, orderingFocusRing } from '../../../styles/OrderingBrand'

/**
 * Login on Ordering.co brand tokens (`--od-*`, light and dark). Legacy
 * styled-components surface: values come from the token adapter, not the
 * global theme.json, so the form keeps the brand on every tenant.
 */

export const LoginContainer = styled.div`
  ${orderingBrandScope}
  width: 100%;
  min-height: ${({ $isPopup }) => $isPopup ? '500px' : '100vh'};
  display: flex;
  background: var(--od-bg);
  color: var(--od-text);
  font-family: var(--od-font-sans);
  font-size: var(--od-font-size-2);
  line-height: var(--od-line-body);
  -webkit-font-smoothing: antialiased;

  *, *::before, *::after {
    box-sizing: border-box;
  }
`

const HeroSide = styled.aside`
  display: none;
  position: relative;
  overflow: hidden;
  background-color: #0B0C0D;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  color: #FFFFFF;
  border-inline-end: var(--od-stroke) solid var(--od-border);

  @media (min-width: 992px) {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--od-space-7);
    width: 46%;
    max-width: 680px;
    padding: var(--od-space-7);
  }

  ${({ $grid }) => $grid && css`
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgb(255 255 255 / 0.05) 1px, transparent 1px);
      background-size: 56px 56px;
      background-position: -1px -1px;
      mask-image: radial-gradient(120% 80% at 30% 45%, #000 0%, transparent 75%);
      pointer-events: none;
    }
  `}

  > * {
    position: relative;
  }
`

/** Brand panel: ink with a grid by default, or the project background image. */
export const LoginHeroContainer = ({ bgimage, children }) => {
  const style = bgimage
    ? { backgroundImage: `linear-gradient(180deg, rgb(11 12 13 / 0.62) 0%, rgb(11 12 13 / 0.3) 40%, rgb(11 12 13 / 0.85) 100%), url(${bgimage})` }
    : undefined
  return <HeroSide style={style} $grid={!bgimage}>{children}</HeroSide>
}

export const HeroLogo = styled.img`
  display: block;
  height: 32px;
  max-width: 240px;
  object-fit: contain;
  object-position: left center;

  ${({ theme }) => theme?.rtl && css`
    object-position: right center;
  `}
`

export const HeroBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--od-space-6);
`

export const HeroCaption = styled.p`
  margin: 0;
  max-width: 16ch;
  color: #FFFFFF;
  font-size: clamp(2rem, 3.2vw, 2.75rem);
  font-weight: var(--od-font-weight-semibold);
  line-height: 1.08;
  letter-spacing: -0.035em;
`

/** One operational route: order → store → driver → customer. */
export const Route = styled.ol`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  max-width: 440px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--od-space-3);
    color: rgb(255 255 255 / 0.72);
    font-size: 13px;
    font-weight: var(--od-font-weight-medium);
  }

  li::before {
    content: '';
    width: 11px;
    height: 11px;
    border: 1.5px solid rgb(255 255 255 / 0.56);
    border-radius: 50%;
    background: #0B0C0D;
    z-index: 1;
  }

  li:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 5px;
    left: 11px;
    right: 0;
    height: 1px;
    background: rgb(255 255 255 / 0.28);
  }

  li:first-child {
    color: #FFFFFF;
  }

  li:first-child::before {
    border-color: var(--od-action);
    background: var(--od-action);
    box-shadow: 0 0 0 4px rgb(38 109 240 / 0.24);
  }

  li:first-child::after {
    background: var(--od-action);
  }

  ${({ theme }) => theme?.rtl && css`
    li:not(:last-child)::after {
      left: 0;
      right: 11px;
    }
  `}
`

export const FormSide = styled.main`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--od-space-6) var(--od-space-5);

  @media (min-width: 768px) {
    padding: var(--od-space-7);
  }
`

export const FormPanel = styled.div`
  width: 100%;
  max-width: 400px;
`

export const MobileLogo = styled.div`
  margin-bottom: var(--od-space-6);

  img {
    display: block;
    height: 28px;
    max-width: 200px;
    object-fit: contain;
    object-position: left center;
  }

  @media (min-width: 992px) {
    display: none;
  }
`

/** Context line above the title, e.g. "Sign in to connect to docs.ordering.co". */
export const AuthNotice = styled.p`
  display: inline-flex;
  margin: 0 0 var(--od-space-4);
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--od-action-soft);
  color: var(--od-action-content);
  font-size: var(--od-font-size-1);
  font-weight: var(--od-font-weight-medium);
`

export const TitleFormSide = styled.div`
  margin-bottom: var(--od-space-6);

  h1 {
    margin: 0 0 var(--od-space-2);
    color: var(--od-text);
    font-size: var(--od-font-size-6);
    font-weight: var(--od-font-weight-semibold);
    line-height: var(--od-line-heading);
    letter-spacing: var(--od-tracking-heading);
  }

  p {
    margin: 0;
    color: var(--od-text-muted);
    font-size: var(--od-font-size-2);
  }
`

export const Tabs = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 4px;
  padding: 4px;
  margin-bottom: var(--od-space-5);
  background: var(--od-surface-subtle);
  border-radius: var(--od-radius-component);
`

export const Tab = styled.button`
  min-height: 32px;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--od-radius-control);
  background: transparent;
  color: var(--od-text-muted);
  font: inherit;
  font-size: var(--od-font-size-2);
  font-weight: var(--od-font-weight-medium);
  cursor: pointer;
  transition: background-color var(--od-duration-fast), color var(--od-duration-fast);

  &:hover {
    color: var(--od-text);
  }

  &:focus-visible {
    ${orderingFocusRing}
  }

  ${({ $active }) => $active && css`
    background: var(--od-surface);
    color: var(--od-text);
    box-shadow: var(--od-shadow-1);
  `}
`

export const FormInput = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--od-space-4);
  width: 100%;
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--od-space-2);

  label {
    margin: 0;
    color: var(--od-text);
    font-size: var(--od-font-size-2);
    font-weight: var(--od-font-weight-medium);
  }
`

const controlStyles = css`
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: var(--od-stroke) solid var(--od-border-strong);
  border-radius: var(--od-radius-component);
  background: var(--od-surface);
  color: var(--od-text);
  font: inherit;
  font-size: var(--od-font-size-3);
  outline: none;
  transition: border-color var(--od-duration-fast);

  &::placeholder {
    color: var(--od-text-muted);
    opacity: 0.7;
  }

  &:hover {
    border-color: var(--od-text-muted);
  }

  &:focus-visible {
    border-color: var(--od-action);
    ${orderingFocusRing}
  }

  &[aria-invalid='true'] {
    border-color: var(--od-danger-functional);
  }

  @media (min-width: 768px) {
    font-size: var(--od-font-size-2);
  }
`

export const TextInput = styled.input`
  ${controlStyles}
`

export const InputWithIcon = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  ${TextInput} {
    padding-inline-start: 40px;
  }

  > svg {
    position: absolute;
    inset-inline-start: 12px;
    width: 18px;
    height: 18px;
    color: var(--od-text-muted);
    pointer-events: none;
  }
`

export const WrapperPassword = styled(InputWithIcon)`
  ${TextInput} {
    padding-inline-end: 48px;
  }
`

export const TogglePassword = styled.button`
  position: absolute;
  inset-inline-end: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: var(--od-radius-control);
  background: transparent;
  color: var(--od-text-muted);
  cursor: pointer;

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    color: var(--od-text);
  }

  &:focus-visible {
    ${orderingFocusRing}
  }
`

export const PhoneNumberWrapper = styled.div`
  .PhoneInput {
    gap: var(--od-space-2);
  }

  .PhoneInputInput {
    ${controlStyles}
  }

  .PhoneInputCountry {
    padding: 0 10px;
    height: 44px;
    border: var(--od-stroke) solid var(--od-border-strong);
    border-radius: var(--od-radius-component);
    background: var(--od-surface);
  }
`

export const ReCAPTCHAWrapper = styled.div`
  display: flex;
  justify-content: center;
`

const buttonBase = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--od-space-2);
  width: 100%;
  min-height: 44px;
  padding: 0 var(--od-space-4);
  border-radius: var(--od-radius-component);
  font: inherit;
  font-size: var(--od-font-size-2);
  font-weight: var(--od-font-weight-semibold);
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--od-duration-fast), border-color var(--od-duration-fast);

  svg {
    width: 18px;
    height: 18px;
  }

  &:focus-visible {
    ${orderingFocusRing}
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const PrimaryButton = styled.button`
  ${buttonBase}
  border: 0;
  background: var(--od-action);
  color: var(--od-action-foreground);

  &:hover:not(:disabled) {
    background: var(--od-action-hover);
  }
`

export const SecondaryButton = styled.button`
  ${buttonBase}
  border: var(--od-stroke) solid var(--od-border-strong);
  background: var(--od-surface);
  color: var(--od-text);

  &:hover:not(:disabled) {
    background: var(--od-surface-subtle);
  }
`

export const RedirectLink = styled.p`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin: 0;
  color: var(--od-text-muted);
  font-size: var(--od-font-size-2);

  a {
    color: var(--od-action-content);
    font-weight: var(--od-font-weight-medium);
    text-decoration: none;
    border-radius: 2px;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      ${orderingFocusRing}
    }
  }
`

export const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: var(--od-space-3);
  margin: var(--od-space-5) 0 var(--od-space-4);
  color: var(--od-text-muted);
  font-size: var(--od-font-size-1);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--od-border);
  }
`

export const SignupLink = styled(RedirectLink)`
  margin-top: var(--od-space-5);
`

export const OtpHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  color: var(--od-text-muted);
`

export const CountdownTimer = styled.span`
  color: var(--od-text);
  font-size: var(--od-font-size-6);
  font-weight: var(--od-font-weight-semibold);
  font-variant-numeric: tabular-nums;
  line-height: var(--od-line-heading);
`

export const OtpWrapper = styled.div`
  width: 100%;

  .otp-container {
    display: flex;
    justify-content: center;
    gap: var(--od-space-2);
  }

  .otp-input {
    width: 44px !important;
    height: 52px;
    border: var(--od-stroke) solid var(--od-border-strong);
    border-radius: var(--od-radius-component);
    background: var(--od-surface);
    color: var(--od-text);
    font: inherit;
    font-size: 20px;
    font-weight: var(--od-font-weight-semibold);
    outline: none;

    &:focus-visible {
      border-color: var(--od-action);
      ${orderingFocusRing}
    }

    &::placeholder {
      color: var(--od-text-muted);
      opacity: 0.4;
    }
  }
`

export const ResendCode = styled.button`
  align-self: center;
  padding: 2px 4px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: var(--od-action-content);
  font: inherit;
  font-weight: var(--od-font-weight-medium);
  cursor: pointer;

  &:disabled {
    color: var(--od-text-muted);
    cursor: not-allowed;
  }

  &:focus-visible {
    ${orderingFocusRing}
  }
`
