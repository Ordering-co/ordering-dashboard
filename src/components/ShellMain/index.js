import React from 'react'
import { MainLandmarkContext } from '~ui/src/components/Login/AuthLayout/MainLandmarkContext'

// (#76a): the one <main> landmark of the shell; the sidebar's "Skip to content" link points at #main-content.
// `display: contents` draws no box, so the routed content stays a direct flex child of Layout, exactly as before the wrapper.
export const ShellMain = ({ children }) => (
  <main id='main-content' className='od-shell-main' data-slot='shell-main' style={{ display: 'contents' }}>
    {/* pages drawn below tell their own <main> (the auth form column) to stand down */}
    <MainLandmarkContext.Provider value>
      {children}
    </MainLandmarkContext.Provider>
  </main>
)
