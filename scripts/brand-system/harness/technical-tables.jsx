import React, { useCallback, useState } from 'react'
import { useTheme } from 'styled-components'

import { IntegrationLogsUI } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/IntegrationLogs'
import { PushTokens } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/PushTokens'

const requestPayload = JSON.stringify(Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`field_${String(index + 1).padStart(2, '0')}`, `value ${index + 1}`])))
const invalidResponse = '{"broken": true'
const logs = [
  {
    id: 101,
    type: 'critical',
    model: 'Order',
    model_id: 7001,
    event: 'order.failed',
    created_at: '2026-09-14T10:30:00Z',
    group_key: 'group-fixture-7',
    exception: {
      message: 'Fixture exception',
      execution_time: 27,
      metadata: { attempt: 3, nested: { reason: 'timeout' } },
      trace: [
        { class: 'Orders', type: 'Worker', function: 'dispatch', file: '/app/orders.js', line: 41 },
        { function: 'stepTwo', file: '/app/steps.js', line: 42 },
        { function: 'stepThree', file: '/app/steps.js', line: 43 },
        { function: 'stepFour', file: '/app/steps.js', line: 44 },
        { function: 'stepFive', file: '/app/steps.js', line: 45 },
        { function: 'stepSix', file: '/app/steps.js', line: 46 },
        { function: 'stepSeven', file: '/app/steps.js', line: 47 },
        { function: 'stepEight', file: '/app/steps.js', line: 48 }
      ]
    },
    request: {
      method: 'POST',
      endpoint: '/orders',
      payload_type: 'json',
      payload: requestPayload
    },
    response: {
      status: 500,
      content_type: 'json',
      content: invalidResponse
    }
  },
  {
    id: 102,
    type: 'warning',
    model: 'Delivery',
    model_id: 7002,
    event: 'delivery.delayed',
    created_at: '2026-09-14T11:45:00Z',
    group_key: 'group-fixture-8'
  },
  {
    id: 103,
    type: 'info',
    model: 'Customer',
    model_id: 7003,
    event: 'customer.updated',
    created_at: '2026-09-14T12:15:00Z',
    group_key: 'group-fixture-9'
  }
]

const initialTokens = Array.from({ length: 13 }, (_, index) => ({
  id: index + 1,
  user_id: 880,
  token: `fixture-token-${String(index + 1).padStart(2, '0')}`,
  app: index % 2 ? 'driver' : 'customer',
  created_at: `2026-09-${String(index + 1).padStart(2, '0')}T08:00:00Z`,
  updated_at: `2026-09-${String(index + 1).padStart(2, '0')}T09:00:00Z`
}))

const updatedTokens = [
  ...initialTokens,
  { id: 14, user_id: 880, token: 'fixture-token-14-updated', app: 'customer', created_at: '2026-09-14T08:00:00Z', updated_at: '2026-09-14T10:00:00Z' }
]
const populatedLogsList = { loading: false, error: null, logs }
const populatedPagination = { currentPage: 1, from: 1, pageSize: 10, totalPages: 3 }
const modelLogsList = { loading: false, error: null, logs: [logs[0]] }
const modelPagination = { currentPage: 1, from: 1, pageSize: 10, totalPages: 1 }
const emptyLogsList = { loading: false, error: null, logs: [] }
const emptyPagination = { currentPage: 3, from: 21, pageSize: 10, totalPages: 3 }

const Section = ({ children, label, testId }) => (
  <section aria-label={label} className='technical-table-section' data-testid={testId}>
    <h2>{label}</h2>
    {children}
  </section>
)

export const TechnicalTablesFixture = () => {
  const theme = useTheme()
  const [selectedLogState, setSelectedLogStateValue] = useState({ log: {}, loading: false, error: null })
  const [relatedGroupEvent, setRelatedGroupEventValue] = useState('')
  const [logReceipts, setLogReceipts] = useState([])
  const [tokens, setTokens] = useState(initialTokens)
  const [userId, setUserId] = useState(880)
  const setSelectedLogState = useCallback(update => {
    const next = typeof update === 'function' ? update(selectedLogState) : update
    setSelectedLogStateValue(next)
    setLogReceipts(receipts => [...receipts, { kind: 'selected', id: next.log?.id, sameReference: logs.includes(next.log) }])
  }, [selectedLogState])
  const setRelatedGroupEvent = useCallback(value => {
    setRelatedGroupEventValue(value)
    setLogReceipts(receipts => [...receipts, { kind: 'group', value }])
  }, [])
  const getLogs = useCallback((page, size, source = 'main') => {
    setLogReceipts(receipts => [...receipts, { kind: 'getLogs', page, size, source }])
  }, [])

  return (
    <main
      className='technical-tables-fixture'
      data-testid='technical-tables-fixture'
      style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default }}
    >
      <style>{`
        .technical-tables-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
        .technical-tables-fixture * { box-sizing: border-box; }
        .technical-tables-fixture h1, .technical-tables-fixture h2 { margin: 0; }
        .technical-table-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 12px; min-width: 0; padding: 16px; }
        .technical-table-frame { height: 430px; min-width: 0; width: 100%; }
        .technical-tables-fixture-controls { display: flex; flex-wrap: wrap; gap: 8px; }
        .technical-tables-fixture-controls button { min-height: 44px; white-space: normal; }
        .technical-tables-fixture output { display: block; max-width: 100%; overflow-wrap: anywhere; }
        @media (max-width: 420px) { .technical-tables-fixture { gap: 12px; padding: 12px; } .technical-table-section { padding: 12px; } }
      `}</style>
      <h1>Ordering.co technical tables</h1>
      <div className='technical-tables-fixture-controls'>
        <button type='button' onClick={() => setUserId(current => current + 1)}>Next token user</button>
        <button type='button' onClick={() => setTokens(updatedTokens)}>Update token list</button>
      </div>

      <Section label='Integration logs' testId='integration-logs'>
        <div className='technical-table-frame'>
          <IntegrationLogsUI
            logsList={populatedLogsList}
            paginationProps={populatedPagination}
            getLogs={(page, size) => getLogs(page, size, 'main')}
            selectedLogState={selectedLogState}
            setSelectedLogState={setSelectedLogState}
            relatedGroupEvent={relatedGroupEvent}
            setRelatedGroupEvent={setRelatedGroupEvent}
          />
        </div>
      </Section>

      <Section label='Model-scoped logs' testId='integration-logs-model'>
        <div className='technical-table-frame'>
          <IntegrationLogsUI
            model='Order'
            modelId={7001}
            logsList={modelLogsList}
            paginationProps={modelPagination}
            getLogs={(page, size) => getLogs(page, size, 'model')}
            selectedLogState={{ log: {}, loading: false }}
            setSelectedLogState={() => {}}
            relatedGroupEvent=''
            setRelatedGroupEvent={() => {}}
          />
        </div>
      </Section>

      <Section label='Empty final logs page' testId='integration-logs-empty-last'>
        <div className='technical-table-frame'>
          <IntegrationLogsUI
            logsList={emptyLogsList}
            paginationProps={emptyPagination}
            getLogs={(page, size) => getLogs(page, size, 'empty-last')}
            selectedLogState={{ log: {}, loading: false }}
            setSelectedLogState={() => {}}
            relatedGroupEvent=''
            setRelatedGroupEvent={() => {}}
          />
        </div>
      </Section>

      <Section label='Push tokens' testId='push-tokens'>
        <PushTokens userId={userId} pushTokens={tokens} />
      </Section>
      <output data-testid='technical-log-receipts'>{JSON.stringify(logReceipts)}</output>
      <output data-testid='technical-selected-log'>{JSON.stringify({ id: selectedLogState.log?.id, loading: selectedLogState.loading })}</output>
      <output data-testid='technical-related-group'>{relatedGroupEvent}</output>
      <output data-testid='technical-token-user'>{userId}</output>
      <output data-testid='technical-token-source-order'>{JSON.stringify(initialTokens.map(token => token.id))}</output>
    </main>
  )
}
