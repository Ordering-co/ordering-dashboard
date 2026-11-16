import React, { useRef, useState } from 'react'

export const Image = React.forwardRef((props, ref) => {
  const internalRef = useRef(null)
  const imageRef = ref || internalRef
  const [error, setError] = useState(false)
  const [remove, setRemove] = useState(false)

  const onError = () => {
    if (!error) {
      setError(true)
    } else {
      setRemove(true)
    }
  }

  return (
    <>
      {
        !error && props.src && <img className={props.className} style={props.style} src={props.src} ref={imageRef} onError={onError} alt='profile-image' />
      }
      {
        !error && !props.src && props.fallback && props.fallback
      }
      {
        error && !remove && typeof props.fallback === 'string' && <img className={props.className} style={props.style} src={props.fallback} ref={imageRef} onError={onError} alt='profile-image' />
      }
      {
        error && remove && typeof props.fallback === 'string' && <div className={props.className} style={props.style} ref={imageRef} />
      }
      {
        error && typeof props.fallback !== 'string' && <div className={props.className} style={props.style} ref={imageRef}>{props.fallback}</div>
      }
    </>
  )
})

Image.displayName = 'Image'
