import React, { useState } from 'react'
import styled, { useTheme } from 'styled-components'

import { FeeBillRows } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/FeeBillRows'
import { TaxBillRows } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/TaxBillRows'
import { parseNumber, parsePrice, t } from './bill-rows-language'

const BillFrame = styled.div`
  color: ${props => props.theme.colors.headingColor};
  width: 100%;
  table {
    border-collapse: collapse;
    font-size: 14px;
    width: 100%;
  }
  td {
    padding: 5px 0;
    vertical-align: middle;
  }
  tr td:nth-child(2) {
    text-align: ${props => props.theme?.rtl ? 'left' : 'right'};
    white-space: nowrap;
  }
  .icon {
    align-items: center;
    display: flex;
    min-width: 0;
  }
`

const ActualLikeIconWrapper = styled.span.attrs({ className: 'fixture-info-wrapper' })`
  cursor: pointer;
  display: inline-flex;
  height: 20px;
  margin-inline-start: 5px;
  position: relative;
`

const ExclamationWrapper = styled(ActualLikeIconWrapper).attrs({ className: 'fixture-exclamation-wrapper' })``

const fees = [
  {
    id: 11,
    name: 'Combined service fee with a deliberately long customer supplied name',
    fixed: 2.5,
    percentage: 5,
    summary: { fixed: 2.5, percentage: 4, percentage_after_discount: 3 }
  },
  { id: 12, name: 'Summary override', fixed: 0, percentage: 0, summary: { amount: 9.25, fixed: 200, percentage: 100 } },
  { id: 13, name: 'After discount', fixed: 0, percentage: 10, summary: { fixed: 1, percentage: 4, percentage_after_discount: 2 } },
  { id: 14, name: 'Zero fee', fixed: 1, percentage: 1, summary: { amount: 0 } },
  { id: 15, name: 'Not a number fee', fixed: 0, percentage: 0, summary: { amount: 'not-a-number' } },
  { fee_id: 16, fixed: 1, percentage: 0, summary: { amount: 1 } }
]

const taxes = [
  { id: 21, name: 'Product tax fractional', target: 'product', type: 2, rate: 7.5, summary: { tax: 4.2, tax_after_discount: 3.8 } },
  { id: 22, name: 'Order tax', target: 'order', type: 2, rate: 6, summary: { tax: 2.4 } },
  { id: 23, name: 'Included type one', target: 'product', type: 1, rate: 4, summary: { tax: 5 } },
  { id: 24, name: 'Zero tax', target: 'product', type: 2, rate: 3, summary: { tax: 0 } },
  { id: 25, name: 'Zero rate', target: 'product', type: 2, rate: 0, summary: { tax: 2 } },
  { id: 26, target: 'product', type: 2, rate: 8, summary: { tax: 1 } }
]

const interactiveFee = { id: 31, name: 'Interactive fee', fixed: 1, percentage: 0, summary: { amount: 1 } }
const interactiveTax = { id: 32, name: 'Interactive tax', target: 'product', type: 2, rate: 3.25, summary: { tax: 2 } }

const Table = ({ children, label, testId }) => (
  <table aria-label={label} data-testid={testId}>
    <tbody>{children}</tbody>
  </table>
)

export const BillRowsFixture = () => {
  const theme = useTheme()
  const [receipts, setReceipts] = useState([])
  const record = (variant, source, payload) => {
    setReceipts(current => [...current, {
      variant,
      id: payload?.data?.id ?? payload?.data?.fee_id,
      open: payload?.open,
      type: payload?.type,
      sameReference: payload?.data === source
    }])
  }
  return (
    <main
      className='bill-rows-fixture'
      data-testid='bill-rows-fixture'
      style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default }}
    >
      <style>{`
        .bill-rows-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
        .bill-rows-fixture * { box-sizing: border-box; }
        .bill-rows-fixture h1, .bill-rows-fixture h2 { margin: 0; }
        .bill-rows-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 12px; min-width: 0; padding: 16px; }
        .bill-rows-fixture output { display: block; max-width: 100%; overflow-wrap: anywhere; }
        @media (max-width: 420px) { .bill-rows-fixture { gap: 12px; padding: 12px; } .bill-rows-section { padding: 12px; } }
      `}</style>
      <h1>Ordering.co bill row fixtures</h1>

      <section className='bill-rows-section' aria-label='Fee contracts'>
        <h2>Fee contracts</h2>
        <BillFrame>
          <Table label='Fee contract rows' testId='fee-contracts'>
            <FeeBillRows fees={fees} parsePrice={parsePrice} t={t} />
          </Table>
        </BillFrame>
      </section>

      <section className='bill-rows-section' aria-label='Tax contracts'>
        <h2>Tax contracts</h2>
        <BillFrame>
          <Table label='Product tax rows' testId='tax-product-contracts'>
            <TaxBillRows taxes={taxes} target='product' parsePrice={parsePrice} parseNumber={parseNumber} t={t} />
          </Table>
          <Table label='Order tax rows' testId='tax-order-contracts'>
            <TaxBillRows taxes={taxes} target='order' parsePrice={parsePrice} parseNumber={parseNumber} t={t} />
          </Table>
        </BillFrame>
      </section>

      <section className='bill-rows-section' aria-label='Interactive wrappers'>
        <h2>Interactive wrappers</h2>
        <BillFrame>
          <Table label='Icon wrapper rows' testId='icon-wrappers'>
            <FeeBillRows
              fees={[interactiveFee]}
              parsePrice={parsePrice}
              t={t}
              IconWrapper={ActualLikeIconWrapper}
              setOpenTaxModal={payload => record('icon-fee', interactiveFee, payload)}
            />
            <TaxBillRows
              taxes={[interactiveTax]}
              target='product'
              parsePrice={parsePrice}
              parseNumber={parseNumber}
              t={t}
              IconWrapper={ActualLikeIconWrapper}
              setOpenTaxModal={payload => record('icon-tax', interactiveTax, payload)}
            />
          </Table>
          <Table label='Exclamation wrapper rows' testId='exclamation-wrappers'>
            <FeeBillRows
              fees={[interactiveFee]}
              parsePrice={parsePrice}
              t={t}
              iconVariant='exclamation'
              ExclamationWrapper={ExclamationWrapper}
              setOpenTaxModal={payload => record('exclamation-fee', interactiveFee, payload)}
            />
            <TaxBillRows
              taxes={[interactiveTax]}
              target='product'
              parsePrice={parsePrice}
              parseNumber={parseNumber}
              t={t}
              iconVariant='exclamation'
              ExclamationWrapper={ExclamationWrapper}
              setOpenTaxModal={payload => record('exclamation-tax', interactiveTax, payload)}
            />
          </Table>
          <Table label='Wrapper gate rows' testId='wrapper-gates'>
            <FeeBillRows fees={[interactiveFee]} parsePrice={parsePrice} t={t} setOpenTaxModal={() => record('missing-wrapper', interactiveFee, {})} />
            <TaxBillRows taxes={[interactiveTax]} target='product' parsePrice={parsePrice} parseNumber={parseNumber} t={t} IconWrapper={ActualLikeIconWrapper} />
          </Table>
        </BillFrame>
      </section>
      <output data-testid='bill-row-receipts'>{JSON.stringify(receipts)}</output>
    </main>
  )
}
