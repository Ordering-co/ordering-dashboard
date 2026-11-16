import React from 'react'

// Only the School controller's data/effects are replaced. Its real UI receives
// synthetic canToggle/saving/enabled state and counted callbacks from the fixture.
export const SchoolModuleToggle = ({ UIComponent, ...props }) => <UIComponent {...props} />
