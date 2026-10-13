import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from 'styled-components'
import { useLanguage, useApi, useConfig, useSession, useToast, ToastType, InvoiceBusinessManager as InvoiceBusinessManagerController } from '../../../../../index'
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
import { InvoiceOrderType } from '../InvoiceOrdertype'
import { InvoiceBusinessPdf } from '../InvoiceBusinessPdf'
import { canCopyInvoicePdfHtml, useInvoicePdfLogo } from '../invoicePdfLogo'
import { downloadInvoicePdfFromHtml } from '../downloadInvoicePdf'
import { IconButton } from '../../../styles'
import { Download } from 'react-bootstrap-icons'
import { addQueryToUrl } from '../../../utils'

const InvoiceBusinessManagerUI = (props) => {
  const {
    exportInvoiceList,
    handleChangeDeliveryTypes
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [{ configs }] = useConfig()
  const theme = useTheme()
  const invoicePdfRef = useRef(null)
  const logo = useInvoicePdfLogo(configs, theme?.images?.logos?.logoPdf)
  const invoiceReady = !exportInvoiceList?.loading && !!exportInvoiceList?.invoice
  const canDownloadPdf = canCopyInvoicePdfHtml({ invoiceReady, logoStatus: logo.status })
  const [downloading, setDownloading] = useState(false)

  const [selectedDetailType, setSelectedDetailType] = useState('general')

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
        <h2>{t('BUSINESS_INVOICE', 'Business invoice')}</h2>
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

          <Tab
            active={selectedDetailType === 'order_type'}
            onClick={() => changeSelectedAnalyticsStatus('order_type')}
          >
            {t('ORDER_TYPE', 'Delivery Type')}
          </Tab>
        </DragScroll>
      </DetailsList>
      {
        selectedDetailType === 'general' && <InvoiceGeneral {...props} />
      }
      {
        selectedDetailType === 'payment_methods' && <InvoicePayMethods {...props} />
      }
      {
        selectedDetailType === 'order_type' && (
          <InvoiceOrderType
            {...props}
            handleChangeDeliveryTypes={handleChangeDeliveryTypes}
          />
        )
      }
      <InvoicePdfWrapper ref={invoicePdfRef}>
        <InvoiceBusinessPdf {...props} logoSrc={logo.src} />
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

export const InvoiceBusinessManager = (props) => {
  const invoiceBusinessManagerProps = {
    ...props,
    propsToFetch: ['name'],
    UIComponent: InvoiceBusinessManagerUI
  }
  return <InvoiceBusinessManagerController {...invoiceBusinessManagerProps} />
}
