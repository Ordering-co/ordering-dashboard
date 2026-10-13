import React, { useEffect } from 'react'
import PropTypes from 'prop-types'

export const AppleLogin = (props) => {
  const { UIComponent, initParams, onSuccess, onFailure } = props

  useEffect(() => {
    if (window.document.getElementById('apple-login')) {
      return
    }
    const AppleIDSignInOnSuccess = document.addEventListener('AppleIDSignInOnSuccess', (data) => {
      onSuccess(data)
    })
    const AppleIDSignInOnFailure = document.addEventListener('AppleIDSignInOnFailure', (error) => {
      onFailure(error)
    })
    createScriptApple()

    return () => {
      document.removeEventListener('AppleIDSignInOnSuccess', AppleIDSignInOnSuccess)
      document.removeEventListener('AppleIDSignInOnFailure', AppleIDSignInOnFailure)
    }
  }, [])

  /**
   * loading script of de Apple login sdk
   */
  const createScriptApple = () => {
    const js = window.document.createElement('script')
    js.id = 'apple-login'
    js.src =
      'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
    js.async = true
    js.defer = true

    window.document.body.appendChild(js)
  }

  /**
   * start Login Apple
   */
  const initLoginApple = () => {
    window.AppleID.auth.init(initParams)

    handleLoginApple()
  }

  /**
   * handilng the response of login apple when login
   */
  const handleLoginApple = async () => {
    try {
      const data = await window.AppleID.auth.signIn()
      return data
    } catch {}
  }

  return <>{UIComponent && <UIComponent {...props} initLoginApple={initLoginApple} />}</>
}

AppleLogin.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * loading script of de Apple login sdk
   */
  createScriptApple: PropTypes.func,
  /**
   * start Login Apple
   */
  initLoginApple: PropTypes.func,
  /**
   * handilng the response of login apple when login
   */
  handleLoginApple: PropTypes.func
}
