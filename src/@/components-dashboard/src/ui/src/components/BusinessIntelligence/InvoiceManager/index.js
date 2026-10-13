import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  List as MenuIcon
} from 'react-bootstrap-icons'
import { useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton } from '../../../styles'
import { InvoiceDetails } from '../InvoiceDetails'
import { SideBar, LearnDropDown } from '../../Shared'
import { invoiceOptionValues } from './utils'
import { addQueryToUrl, removeQueryToUrl, learnOptionsValues } from '../../../utils'

import {
  InvoiceManagerContainer,
  HeaderContainer,
  InvoiceListContainer,
  InvoiceItemContainer,
  IconWrapper,
  InvoiceListDetailsWrapper
} from './styles'

export const InvoiceManager = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [openInvoiceDetail, setOpenInvoiceDetail] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  const invoiceOptionList = invoiceOptionValues({ t })

  const learnOptions = learnOptionsValues(['invoice_manager'], t)

  const handleOpenInvoiceDetail = (index, isInitialRender) => {
    setOpenInvoiceDetail(true)
    setSelectedInvoice(index)
    if (!isInitialRender) {
      addQueryToUrl({ invoice: index })
    }
  }

  const handleCloseInvoiceDetail = () => {
    setOpenInvoiceDetail(false)
    setSelectedInvoice(null)
    removeQueryToUrl(['invoice', 'tab'])
  }

  useEffect(() => {
    const invoice = query.get('invoice')
    if (invoice) {
      handleOpenInvoiceDetail(invoice, true)
    }
  }, [])

  return (
    <>
      <InvoiceManagerContainer>
        <HeaderContainer>
          {isCollapse && (
            <IconButton
              color='black'
              onClick={() => handleMenuCollapse(false)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <h1>{t('INVOICE_MANAGER', 'Invoice manager')}</h1>
          <LearnDropDown
            learnOptions={learnOptions}
          />
        </HeaderContainer>
        <InvoiceListContainer>
          {
            invoiceOptionList.map((invoice, i) => (
              <InvoiceItemContainer
                key={i}
                onClick={() => handleOpenInvoiceDetail(invoice.key)}
              >
                <IconWrapper>{invoice?.icon}</IconWrapper>
                <InvoiceListDetailsWrapper>
                  <h2>{invoice?.name}</h2>
                  <p>{invoice?.description}</p>
                </InvoiceListDetailsWrapper>
              </InvoiceItemContainer>
            ))
          }
        </InvoiceListContainer>
      </InvoiceManagerContainer>
      {
        openInvoiceDetail && (
          <SideBar
            sidebarId='invoice_details'
            open={openInvoiceDetail}
            onClose={handleCloseInvoiceDetail}
            showExpandIcon
          >
            <InvoiceDetails
              selectedInvoice={selectedInvoice}
            />
          </SideBar>
        )
      }
    </>
  )
}
