import styled from 'styled-components'

// redesign drivers-dashboard B4 (decisions 1 and 7): the board is laid out by drivers-board.css (B3). The one thing it lacks is where the
// panel of the chosen driver goes in the list view of a phone: the map is not mounted there, so the panel follows the list and stays at the
// foot of the window while the page scrolls. The old containers (DriversDashboardContainer, FilterContainer, DriversContainer,
// WrapperDriversList, WrapperDriversLocation) were only imported by this folder's index.js and are gone with the old layout.
// redesign drivers-dashboard B4 (live, 390): the sticky box is the map column itself (it only holds the panel in the list view): a sticky
// panel inside it could not leave its column, which sits under the list, and stayed off screen.
export const DriversBoard = styled.div`
  &[data-view='list'] > .odd-map {
    position: sticky;
    inset-block-end: 0;
    z-index: var(--od-x-layer-raised);
  }

  &[data-view='list'] > .odd-map > .odd-panel {
    max-block-size: 45vh;
  }
`
