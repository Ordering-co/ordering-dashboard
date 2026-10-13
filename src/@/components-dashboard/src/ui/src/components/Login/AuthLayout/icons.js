import React from 'react'

/**
 * Lucide icons used by the login (https://lucide.dev, ISC license,
 * Copyright (c) Lucide Contributors). Inlined so the dashboard does not add
 * a dependency for seven glyphs; stroke follows the brand `--od-icon-stroke`.
 */
const Icon = ({ children }) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.75'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
    focusable='false'
  >
    {children}
  </svg>
)

export const FolderIcon = () => (
  <Icon><path d='M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' /></Icon>
)

export const MailIcon = () => (
  <Icon>
    <rect width='20' height='16' x='2' y='4' rx='2' />
    <path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' />
  </Icon>
)

export const LockIcon = () => (
  <Icon>
    <rect width='18' height='11' x='3' y='11' rx='2' ry='2' />
    <path d='M7 11V7a5 5 0 0 1 10 0v4' />
  </Icon>
)

export const PhoneIcon = () => (
  <Icon><path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' /></Icon>
)

export const EyeIcon = () => (
  <Icon>
    <path d='M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0' />
    <circle cx='12' cy='12' r='3' />
  </Icon>
)

export const EyeOffIcon = () => (
  <Icon>
    <path d='M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49' />
    <path d='M14.084 14.158a3 3 0 0 1-4.242-4.242' />
    <path d='M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143' />
    <path d='m2 2 20 20' />
  </Icon>
)

export const ArrowRightIcon = () => (
  <Icon>
    <path d='M5 12h14' />
    <path d='m12 5 7 7-7 7' />
  </Icon>
)

export const CheckIcon = () => (
  <Icon><path d='M20 6 9 17l-5-5' /></Icon>
)

export const ShieldIcon = () => (
  <Icon><path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' /></Icon>
)

export const CircleCheckIcon = () => (
  <Icon>
    <circle cx='12' cy='12' r='10' />
    <path d='m9 12 2 2 4-4' />
  </Icon>
)

export const ClockIcon = () => (
  <Icon>
    <circle cx='12' cy='12' r='10' />
    <path d='M12 6v6l4 2' />
  </Icon>
)
