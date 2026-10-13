import React, { useState } from 'react'

export const DragAndDrop = ({ onDrop, children, className, style, disabled }) => {
  const [classname, setClassname] = useState()

  const handleDrop = (e) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    onDrop(e.dataTransfer)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setClassname('dragover')
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setClassname()
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      style={style}
      className={className + ' ' + classname}
    >
      {children}
    </div>
  )
}
