import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useLanguage, useSession, useApi } from '../../../../../index'
import { CircleAlert, Download as DownloadIcon } from '../../Shared/Icon'
import { Button, EmptyState, Skeleton } from '../../Shared/Product'
import '../BusinessPaymentReports/panels.css'

import {
  DetailWrapper,
  ActionBar,
  IframeWrapper
} from './styles'

const EXT_REPORTS_BASE = 'https://eatstreet-payment-reports.plugins.orderingplus.com'
const RESPONSIVE_STYLE_ID = '__responsive_override'
const RESPONSIVE_CSS = 'body,html{width:100%!important;max-width:100%!important;margin:0;padding:0}table{width:100%!important;table-layout:auto!important}td,th{word-break:break-word}'
const EXPAND_THRESHOLD = 600

export const EatStreetReportDetail = ({ reportId }) => {
  const [, t] = useLanguage()
  const [{ token }] = useSession()
  const [ordering] = useApi()

  const [htmlState, setHtmlState] = useState({ loading: true, rawHtml: null, error: null })
  const iframeRef = useRef(null)
  const wrapperRef = useRef(null)
  // redesign business-payments FD (D8): the lock of the scroll of the body (the old SideBar's scroll chaining) is gone;
  // in a SplitView the panel has its own scroll.

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const expanded = entry.contentRect.width > EXPAND_THRESHOLD
        const iframe = iframeRef.current
        if (!iframe?.contentDocument) return
        const doc = iframe.contentDocument
        const existing = doc.getElementById(RESPONSIVE_STYLE_ID)
        if (expanded && !existing) {
          const style = doc.createElement('style')
          style.id = RESPONSIVE_STYLE_ID
          style.textContent = RESPONSIVE_CSS
          doc.head.appendChild(style)
        } else if (!expanded && existing) {
          existing.remove()
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [htmlState.rawHtml])

  const fetchHtmlReport = useCallback(async () => {
    setHtmlState({ loading: true, rawHtml: null, error: null })
    try {
      const response = await fetch(`${EXT_REPORTS_BASE}/api/reports/html-proxy/${reportId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ query: { project: ordering.project } })
      })
      const htmlText = await response.text()
      if (!htmlText) {
        setHtmlState({ loading: false, rawHtml: null, error: t('NO_HTML_AVAILABLE', 'No HTML report available') })
        return
      }
      setHtmlState({ loading: false, rawHtml: htmlText, error: null })
    } catch (err) {
      setHtmlState({ loading: false, rawHtml: null, error: err.message })
    }
  }, [reportId, token, ordering])

  useEffect(() => {
    if (reportId) fetchHtmlReport()
  }, [reportId])

  const handleDownloadPdf = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    iframe.contentWindow.print()
  }, [])

  // redesign business-payments FD (D9): the box of the report while it loads, and an error with a way to ask again
  if (htmlState.loading) {
    return (
      <div className='bpp-skeleton' data-fill='' role='status' aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <Skeleton size='30%' block='var(--od-x-control-height)' />
        <Skeleton className='bpp-skeleton-frame' />
      </div>
    )
  }

  if (htmlState.error) {
    return (
      <div className='bpp-error'>
        <EmptyState
          tone='error'
          icon={CircleAlert}
          title={t('BUSINESS_PAYMENTS_REPORT_LOAD_ERROR', "We couldn't load this report.")}
          description={htmlState.error}
          action={<Button onClick={fetchHtmlReport}>{t('TRY_AGAIN', 'Try again')}</Button>}
        />
      </div>
    )
  }

  return (
    <DetailWrapper>
      <ActionBar>
        <Button variant='secondary' icon={DownloadIcon} onClick={handleDownloadPdf}>
          {t('DOWNLOAD_PDF', 'Download PDF')}
        </Button>
      </ActionBar>
      <IframeWrapper ref={wrapperRef}>
        <iframe
          ref={iframeRef}
          srcDoc={htmlState.rawHtml}
          title='Report'
        />
      </IframeWrapper>
    </DetailWrapper>
  )
}
