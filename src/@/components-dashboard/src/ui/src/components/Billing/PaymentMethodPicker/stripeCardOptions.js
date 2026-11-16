// redesign BM-B (D4): the options of Stripe's CardElement. The field is an iframe from Stripe: it cannot read our CSS
// variables, it only accepts values. So the brand tokens are read here, once, from the page, and the literals of `main`
// (the old CardForm) stay as the fallback when a token is missing or is not a colour Stripe can paint. This file is
// outside `governed-files` on purpose: it is the one place where a literal colour is the right answer.
const MAIN_TEXT = '#32325d'
const MAIN_PLACEHOLDER = '#aab7c4'
const MAIN_INVALID = '#fa755a'
const MAIN_FONT_SIZE = '16px'

// Stripe takes hex, rgb(a), hsl(a) and names; anything else (color-mix, light-dark, var) would make it drop the style.
const PAINTABLE = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i

const readToken = (styles, name) => styles?.getPropertyValue(name).trim() ?? ''

const readColor = (styles, name, fallback) => {
  const value = readToken(styles, name)
  return PAINTABLE.test(value) ? value : fallback
}

export const getCardElementOptions = (element) => {
  const root = element ?? (typeof document !== 'undefined' ? document.documentElement : null)
  const styles = root && typeof window !== 'undefined' ? window.getComputedStyle(root) : null
  const fontFamily = readToken(styles, '--od-font-sans')
  const invalid = readColor(styles, '--od-danger-functional', MAIN_INVALID)
  return {
    style: {
      base: {
        color: readColor(styles, '--od-text', MAIN_TEXT),
        fontSmoothing: 'antialiased',
        fontSize: MAIN_FONT_SIZE,
        ...(fontFamily ? { fontFamily } : {}),
        '::placeholder': {
          color: readColor(styles, '--od-text-muted', MAIN_PLACEHOLDER)
        }
      },
      invalid: {
        color: invalid,
        iconColor: invalid
      }
    }
  }
}
