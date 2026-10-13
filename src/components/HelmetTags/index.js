import React, { useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { useTheme } from 'styled-components'
import helmetData from '../../helmetdata.json'
import settings from '../../config'
import { useConfig } from '~components'

export const HelmetTags = (props) => {
  const { page } = props
  const theme = useTheme()

  /** react-helmet must not receive Fragment children — it stringifies element.type (Symbol for <>). */

  const [{ configs }] = useConfig()

  const metaTag = (page && helmetData[page]) ? helmetData[page] : helmetData.app

  const displayName = configs?.dashboard_title?.value || settings.app_name
  const seoInjectedTitle =
    (typeof window !== 'undefined' && window.__SEO__?.title) || null

  const hmt = props.helmetMetaTags || {}

  const effectiveSeoTitle =
    seoInjectedTitle && seoInjectedTitle !== displayName ? seoInjectedTitle : null

  const titleBody = String(
    props.helmetTitle ??
    hmt.title ??
    effectiveSeoTitle ??
    metaTag.title ??
    ''
  ).trim()
  const canRenderTitle = !!page && !!displayName && !!titleBody

  const ogTitle = String(import.meta.env.VITE_OG_TITLE ?? '').trim()
  const ogDescription = String(import.meta.env.VITE_OG_DESCRIPTION ?? '').trim()
  const ogUrl = String(import.meta.env.VITE_OG_URL ?? '').trim()
  const ogSiteName = String(import.meta.env.VITE_OG_SITE_NAME ?? '').trim()
  const ogImage = String(import.meta.env.VITE_OG_IMAGE ?? '').trim()

  useEffect(() => {
    if (!theme?.third_party_code?.head) return

    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = theme.third_party_code.head

    const scripts = tempDiv.querySelectorAll('script')
    scripts.forEach(script => {
      const scriptExists = [...document.head.querySelectorAll('script')].some(existingScript => {
        if (script.src && existingScript.src === script.src) {
          return true
        }

        if (!script.src && existingScript.innerHTML === script.innerHTML) {
          return true
        }

        return false
      })
      if (!scriptExists) {
        const newScript = document.createElement('script')
        if (script.src) {
          newScript.src = script.src
        } else {
          newScript.innerHTML = script.innerHTML
        }
        document.head.appendChild(newScript)
      }
    })
  }, [theme?.third_party_code?.head])

  const noscriptContent = (() => {
    if (!theme?.third_party_code?.head) return ''
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = theme.third_party_code.head
    const noscript = tempDiv.querySelector('noscript')
    return noscript ? noscript.innerHTML : ''
  })()

  const descriptionBody = String(
    props.description ??
    hmt.description ??
    metaTag.description ??
    ''
  )

  return (
    <Helmet titleTemplate={!canRenderTitle ? '' : `${displayName} - %s`}>
      {canRenderTitle && (
        <title id={`route-${page}`}>
          {titleBody}
        </title>
      )}
      <meta
        name='description'
        content={descriptionBody}
      />
      <meta
        name='keywords'
        content={String(props.keywords ?? hmt.keywords ?? metaTag.keywords ?? '')}
      />
      {props.robots
        ? (
        <meta name='robots' content={props.robots} />
          )
        : (
            metaTag.robots && <meta name='robots' content={metaTag.robots} />
          )}
      {props.canonicalUrl
        ? (
        <link rel='canonical' href={props.canonicalUrl} />
          )
        : (
            metaTag.canonicalUrl && <link rel='canonical' href={metaTag.canonicalUrl} />
          )}
      {noscriptContent && (
        <noscript>{noscriptContent}</noscript>
      )}
      {ogTitle && <meta property='og:title' content={ogTitle} />}
      {ogDescription && <meta property='og:description' content={ogDescription} />}
      {ogUrl && <meta property='og:url' content={ogUrl} />}
      {ogSiteName && <meta property='og:site_name' content={ogSiteName} />}
      {ogImage && <meta property='og:image' content={ogImage} />}
      {ogImage && <meta property='og:image:type' content='image/png' />}
    </Helmet>
  )
}
