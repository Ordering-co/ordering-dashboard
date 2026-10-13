import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from 'styled-components'
import { useLanguage, useApi, useConfig, useSession, useToast, ToastType, InvoiceDriverManager as InvoiceDriverManagerController } from '../../../../../index'
import { DragScroll, SpinnerLoader } from '../../Shared'
import {
  InvoiceDriversContainer,
  DetailsHeader,
  DetailsList,
  Tab,
  InvoicePdfWrapper,
  LoadingWrapper
} from './styles'
import { InvoiceGeneral } from '../InvoiceGeneral'
import { InvoicePayMethods } from '../InvoicePayMethods'
import { InvoiceDriverPdf } from '../InvoiceDriverPdf'
import { canCopyInvoicePdfHtml, useInvoicePdfLogo } from '../invoicePdfLogo'
import { downloadInvoicePdfFromHtml } from '../downloadInvoicePdf'
import { Download } from 'react-bootstrap-icons'
import { IconButton } from '../../../styles'
import { addQueryToUrl } from '../../../utils'

const InvoiceDriverManagerUI = (props) => {
  const {
    exportInvoiceList
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [{ configs }] = useConfig()
  const theme = useTheme()
  const [selectedDetailType, setSelectedDetailType] = useState('general')
  const invoicePdfRef = useRef(null)
  const logo = useInvoicePdfLogo(configs, theme?.images?.logos?.logoPdf)
  const invoiceReady = !exportInvoiceList?.loading && !!exportInvoiceList?.invoice
  const canDownloadPdf = canCopyInvoicePdfHtml({ invoiceReady, logoStatus: logo.status })
  const [downloading, setDownloading] = useState(false)

  const changeSelectedAnalyticsStatus = (detailType, isInitialRender) => {
    window.scrollTo(0, 0)
    setSelectedDetailType(detailType)
    if (!isInitialRender) {
      addQueryToUrl({ tab: detailType })
    }
  }

  const handleDownloadPdf = async () => {
    if (!canDownloadPdf || downloading || !invoicePdfRef.current) return
    setDownloading(true)
    try {
      await downloadInvoicePdfFromHtml({
        html: invoicePdfRef.current.innerHTML,
        logoSrc: logo.src,
        root: ordering.root,
        token
      })
    } catch (err) {
      showToast(ToastType.Error, err.message)
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    const tab = query.get('tab')
    if (tab) {
      changeSelectedAnalyticsStatus(tab, true)
    } else {
      changeSelectedAnalyticsStatus(selectedDetailType)
    }
  }, [])

  return (
    <InvoiceDriversContainer>
      <DetailsHeader>
        <h2>{t('DRIVER_INVOICE', 'Driver invoice')}</h2>
        <IconButton
          color='black'
          disabled={!canDownloadPdf || downloading}
          onClick={handleDownloadPdf}
        >
          <Download />
        </IconButton>
      </DetailsHeader>
      <DetailsList>
        <DragScroll>
          <Tab
            active={selectedDetailType === 'general'}
            onClick={() => changeSelectedAnalyticsStatus('general')}
          >
            {t('GENERAL', 'General')}
          </Tab>

          <Tab
            active={selectedDetailType === 'payment_methods'}
            onClick={() => changeSelectedAnalyticsStatus('payment_methods')}
          >
            {t('PAYMENT_METHODS', 'Payment methods')}
          </Tab>
        </DragScroll>
      </DetailsList>
      {
        selectedDetailType === 'general' && <InvoiceGeneral {...props} />
      }
      {
        selectedDetailType === 'payment_methods' && <InvoicePayMethods {...props} />
      }
      <InvoicePdfWrapper ref={invoicePdfRef}>
        <InvoiceDriverPdf {...props} logoSrc={logo.src} />
      </InvoicePdfWrapper>
      {
        exportInvoiceList?.loading && (
          <LoadingWrapper>
            <SpinnerLoader />
          </LoadingWrapper>
        )
      }
    </InvoiceDriversContainer>
  )
}

export const InvoiceDriverManager = (props) => {
  const invoiceDriverManagerProps = {
    ...props,
    propsToFetch: ['id', 'name'],
    UIComponent: InvoiceDriverManagerUI
  }
  return <InvoiceDriverManagerController {...invoiceDriverManagerProps} />
}
