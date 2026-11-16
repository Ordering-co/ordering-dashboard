// redesign SP-F0 (E0)
// The width states of the editor panels fixed at the end of a page (the store editor in /stores/list, the product editor in
// /stores/products): one pure function, so both shells pick their width from the same rule (data-size = 'full' | 'wide' | 'base').
// Promoted unchanged from Stores/BusinessDetails (SL-F2, B2).

// The widths of the editor, as the state that picks them: 500px with the Overview; 1000px with a section on a window of
// 1000px or more; the whole width with Expand, on a window of 500px or less, or when a section asks for it.
export const EDITOR_PANEL_FULL_UP_TO = 500
export const EDITOR_PANEL_WIDE_FROM = 1000
export const EDITOR_PANEL_EXPAND_FROM = 576 // the Expand button is only offered above this width, as before

export const getPanelSize = ({ width, isExpand, sectionOpen, isExtendExtraOpen }) => {
  if (width <= EDITOR_PANEL_FULL_UP_TO || isExpand || (sectionOpen && isExtendExtraOpen)) return 'full'
  if (sectionOpen) return width >= EDITOR_PANEL_WIDE_FROM ? 'wide' : 'full'
  return 'base'
}
