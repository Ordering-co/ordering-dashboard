// redesign W0-5 (T0-17, G9): the named breakpoints of the dashboard, for JavaScript. A CSS variable cannot go in an
// @media or @container prelude, so the CSS repeats these numbers as literals (they are the only literals that guard
// allows there) and this module is where JS reads them, once. Ranges never overlap: «down» is the token minus 0.02px
// when a gapless range is wanted (PHONE_DOWN) and minus 1px in the integer form that the stylesheets already use
// (PHONE_DOWN_PX, `(max-width: 767px)`), so JS and CSS agree to the pixel.
//
//   phone        < 768   one column, bottom sheets, 44px touch targets
//   overlay      768–1279 the panel is a modal sheet over the list
//   split        >= 1280 the panel sits beside the list
//   container narrow < 600 (container query, not a viewport one)

export const BREAKPOINT_PHONE = 768
export const BREAKPOINT_SPLIT = 1280
export const BREAKPOINT_CONTAINER_NARROW = 600
// The narrow panel of the split view runs from BREAKPOINT_SPLIT up to this width (split-view.css repeats it).
export const BREAKPOINT_SPLIT_NARROW_UNTIL = 1359

const GAP = 0.02

export const minWidth = px => `(min-width: ${px}px)`
export const maxWidth = px => `(max-width: ${px}px)`
/** Largest width that is still below `px`, without a gap for fractional viewports (zoom, device pixel ratios). */
export const maxWidthBelow = px => `(max-width: ${Number((px - GAP).toFixed(2))}px)`

// Viewport queries.
export const PHONE_DOWN = maxWidthBelow(BREAKPOINT_PHONE) // (max-width: 767.98px)
export const PHONE_DOWN_PX = maxWidth(BREAKPOINT_PHONE - 1) // (max-width: 767px): the form the stylesheets use
export const PHONE_UP = minWidth(BREAKPOINT_PHONE) // (min-width: 768px)
export const SPLIT_UP = minWidth(BREAKPOINT_SPLIT) // (min-width: 1280px)
export const SPLIT_DOWN = maxWidthBelow(BREAKPOINT_SPLIT) // (max-width: 1279.98px)
export const SPLIT_NARROW_DOWN = maxWidth(BREAKPOINT_SPLIT_NARROW_UNTIL) // (max-width: 1359px)

// Container query prelude (a width of the component's own container, not of the viewport).
export const CONTAINER_NARROW_DOWN = maxWidth(BREAKPOINT_CONTAINER_NARROW - 1) // (max-width: 599px)

// The trigger of the 44px hit areas that Product writes (P/product.css, `(pointer: coarse), (max-width: 767px)`, the pilot's C3): a coarse
// pointer, or a phone-width viewport. redesign tramo A r4 (W0-PA2-07 b): the inherited `coarseHitArea` (C/ui/src/styles/touchTarget.js) does
// NOT use it: since W0-PA1-02 it uses COARSE alone (its hosts were never measured at phone width). TOUCH_OR_PHONE has no use in the source
// of the app; it stays because it is the documented name of the Product trigger (docs/REDESIGN_PLAYBOOK.md) that new Product code in JS
// (matchMedia) is to use, and breakpoints.test.js pins its text.
// redesign tramo A r2 (W0-PA1-02): COARSE is the coarse-pointer trigger alone, the one coarseHitArea had before W0-5
export const COARSE = '(pointer: coarse)'
export const TOUCH_OR_PHONE = `(pointer: coarse), ${PHONE_DOWN_PX}`
