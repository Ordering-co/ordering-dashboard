import React from 'react'

export const Layout = (props) => {
  return (
    // --app-width leaves room for the docked assistant (utils/assistantDock)
    <div className='d-flex' style={{ maxWidth: 'var(--app-width, 100vw)', width: 'var(--app-width, 100vw)', paddingTop: props.pt ?? 0 }}>
      {props.children}
    </div>
  )
}
