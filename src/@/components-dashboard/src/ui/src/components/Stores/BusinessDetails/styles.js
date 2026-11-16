import styled from 'styled-components'
import './store-editor.css'

// redesign SL-F2 (B2): the panel of the store editor. Every rule lives in store-editor.css (tokens only, and no
// container-type, contain or transform: the legacy fixed SideBars that the sections open must paint over the page).
export const BarContainer = styled.aside.attrs({
  className: 'odc-root odc-se-panel'
})``
