import styled from 'styled-components'

// redesign settings A: the hub's own look moved to settings-hub.css (Product tokens). What stays here is the
// page box and the scrolling column, which `styles.test.jsx` pins.

export const HubPage = styled.div`
  flex: 1;
  box-sizing: border-box;
  /* The shell has no fixed header: the window minus whatever sits above the layout (banners, trial offer). SidebarNav measures
     that and publishes it as --odc-shell-notice-block on the layout, which this page inherits (0 without a menu). 100vh stays as
     the fallback; dvh follows the phone's browser toolbar, which 100vh does not (it is taller than what the screen shows). */
  height: calc(100vh - var(--odc-shell-notice-block, 0px));
  height: calc(100dvh - var(--odc-shell-notice-block, 0px));
  max-height: calc(100vh - var(--odc-shell-notice-block, 0px));
  max-height: calc(100dvh - var(--odc-shell-notice-block, 0px));
  min-height: 0;
  min-width: 0;
  overflow: clip;
  overflow-anchor: none;
  display: flex;
  flex-direction: column;
  padding: var(--od-space-5) var(--od-space-4) var(--od-space-4);
  background: var(--od-bg);
`

export const ListColumn = styled.div`
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overflow-anchor: none;
`
