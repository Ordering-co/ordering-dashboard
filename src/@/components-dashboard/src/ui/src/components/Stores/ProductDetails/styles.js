import styled from 'styled-components'
import './product-editor.css'

// redesign SP-F1 (D1): the panel of the product editor. Every rule lives in product-editor.css (tokens only, and no
// container-type, contain or transform: the legacy fixed SideBars that the sections open must paint over the page).
export const BarContainer = styled.aside.attrs({
  className: 'odc-root odc-pe-panel'
})``
