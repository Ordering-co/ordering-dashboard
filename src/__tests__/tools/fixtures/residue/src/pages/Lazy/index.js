import React from 'react'

export const Lazy = () => {
  const load = () => import('~ui/components/Starred')
  return <button onClick={load}>load</button>
}
