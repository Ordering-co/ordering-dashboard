import { createGlobalStyle, css } from 'styled-components'
import interVariable from '~/assets/fonts/ordering/InterVariable.woff2'
import { ORDERING_BRAND } from './tokens.generated'

/**
 * Ordering.co brand adapter for styled-components.
 *
 * The dashboard is a legacy styled-components surface, so it consumes the
 * released tokens as `--od-*` CSS variables instead of the shadcn/Tailwind
 * stack. Values come from `tokens.generated.js` (pinned by release and
 * sha256 in `brand/ordering-brand.lock.json`); never hard-code them here.
 */

export { ORDERING_BRAND }

const declarations = (vars) => Object.entries(vars).map(([name, value]) => `${name}: ${value};`).join('\n')

/** Scope the brand variables on a container, light by default, dark with the OS setting. */
export const orderingBrandScope = css`
  ${declarations(ORDERING_BRAND.root)}
  ${declarations(ORDERING_BRAND.light)}
  color-scheme: light;

  @media (prefers-color-scheme: dark) {
    ${declarations(ORDERING_BRAND.dark)}
    color-scheme: dark;
  }
`

/** Self-hosted Inter, the face `--od-font-sans` names first. */
export const OrderingBrandFonts = createGlobalStyle`
  @font-face {
    font-family: 'Ordering Inter Local';
    src: url(${interVariable}) format('woff2');
    font-weight: 100 900;
    font-style: normal;
    font-display: swap;
  }
`

/** 2px action-blue ring with 2px offset, shown for keyboard focus only. */
export const orderingFocusRing = css`
  outline: 2px solid var(--od-focus);
  outline-offset: 2px;
`
