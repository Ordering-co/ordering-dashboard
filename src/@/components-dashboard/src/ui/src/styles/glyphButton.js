import { css } from 'styled-components'

// A glyph that carries a click handler is a control, so the adoption wraps it in a
// real `<button>`. The wrapper must not be VISIBLE, though: before the conversion the
// card showed a bare 16x16 icon, and a `<button>` brings the browser's own chrome with
// it. Measured in the b2 harness, the wrapped icon rendered as a 32x25 box with a 2px
// outset border and a grey fill -- a visible change to every chart card, shipped by b1
// before anyone looked at it.
//
// This resets the wrapper to nothing and leaves the icon exactly where it was, so the
// control becomes reachable without becoming visible.
//
// It declares no colour and no font ON PURPOSE. Every block that uses it already has an
// `svg` rule that still reaches the glyph through the wrapper, and that rule keeps
// owning both. A `font: inherit` here would also have added a typography site to rows
// whose site count was already published.
export const glyphButtonReset = css`
  button {
    display: flex;
    align-items: center;
    padding: 0;
    border: none;
    background: none;
  }
`

// For a glyph that floats over its container (the play button laid over a video).
// The reset above makes the button a flex box, and when the glyph inside it is the one
// declared `position: absolute`, the box has nothing in flow and collapses to 0x0 in the
// container's corner: reachable, but with nowhere to paint the focus ring. So the BUTTON
// is the positioned element here and the glyph stays static inside it. Its top-left
// corner is where the glyph's was, so the glyph lands on the same pixel.
//
// The coarse-pointer minimum grows the box around the glyph, not past it: the glyph is
// centred and the negative margin pulls the box back by half the growth on each side.
// `glyphSize` is the glyph's own `font-size`, which the caller's `svg` rule keeps owning.
//
// Scoped to a class, not to `button`: a bare selector would pin ANY later button in the
// container (a remove or download control) onto the same 45%/45% spot, the shape of the
// L5 round-5 P1 in `EnterprisePromotionConditions`. The markup carries the class.
export const OVERLAY_GLYPH_BUTTON_CLASS = 'od-glyph-overlay'

export const overlayGlyphButton = ({ top, left, glyphSize }) => css`
  button.${OVERLAY_GLYPH_BUTTON_CLASS} {
    position: absolute;
    top: ${top};
    left: ${left};
    justify-content: center;

    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme?.colors?.primary};
      outline-offset: 2px;
      border-radius: ${props => props.theme?.ordering?.radius?.control ?? '4px'};
    }

    @media (pointer: coarse) {
      min-height: ${props => props.theme?.ordering?.component?.density?.touchTargetMinimum ?? '44px'};
      min-width: ${props => props.theme?.ordering?.component?.density?.touchTargetMinimum ?? '44px'};
      margin: min(0px, calc((${glyphSize} - ${props => props.theme?.ordering?.component?.density?.touchTargetMinimum ?? '44px'}) / 2));
    }
  }
`
