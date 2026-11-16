import React, { useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { useTheme } from 'styled-components'
import helmetData from '../../helmetdata.json'
import settings from '../../config'
import { useConfig, useLanguage } from '~components'

const NO_INDEX = 'noindex, nofollow'

export const HelmetTags = (props) => {
  const { page } = props
  const theme = useTheme()

  /** react-helmet must not receive Fragment children — it stringifies element.type (Symbol for <>). */

  const [{ configs }] = useConfig()
  const [, t] = useLanguage()

  const metaTag = (page && helmetData[page]) ? helmetData[page] : helmetData.app

  // one brand on every route. Logged out (login, forgot password, 404) the project configs may not be loaded yet, so the
  // `dashboard_title` the worker injected in `__FIRST_LOAD__` comes before the app name, the one reserve every route shares.
  const firstLoadTitle = typeof window !== 'undefined' ? window.__FIRST_LOAD__?.configs?.dashboard_title?.value : null
  const displayName = configs?.dashboard_title?.value || firstLoadTitle || settings.app_name
  const seoInjectedTitle =
    (typeof window !== 'undefined' && window.__SEO__?.title) || null

  const hmt = props.helmetMetaTags || {}

  const effectiveSeoTitle =
    seoInjectedTitle && seoInjectedTitle !== displayName ? seoInjectedTitle : null

  const titleBody = String(
    props.helmetTitle ??
    hmt.title ??
    effectiveSeoTitle ??
    // the page title is a catalog key; the English text of helmetdata.json is the reserve of t()
    (metaTag.titleKey ? t(metaTag.titleKey, metaTag.title) : metaTag.title) ??
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
  const keywordsBody = String(props.keywords ?? hmt.keywords ?? metaTag.keywords ?? '')

  return (
    <Helmet titleTemplate={!canRenderTitle ? '' : `${displayName} - %s`}>
      {canRenderTitle && (
        <title id={`route-${page}`}>
          {titleBody}
        </title>
      )}
      {descriptionBody && (
        <meta
          name='description'
          content={descriptionBody}
        />
      )}
      {keywordsBody && (
        <meta
          name='keywords'
          content={keywordsBody}
        />
      )}
      {/* (D-64): an admin panel is never offered to search engines, whatever a page or its data says */}
      <meta name='robots' content={NO_INDEX} />
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
