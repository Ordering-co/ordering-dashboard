import React, { useState, useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { a11yDark, a11yLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useTheme } from 'styled-components'

import { useLanguage, useUtils, IntegrationLogs as IntegrationLogsController } from '../../../../../index'

import { Modal } from '../Modal'
import { Pagination } from '../Pagination'
import { ChevronDown, X } from '../Icon'

import {
  AccordionHeader,
  AccordionPanel,
  AccordionRoot,
  ActionIconWrapper,
  BoxColor,
  CodeToggleButton,
  ContextAwareToggle,
  ContextAwareWrapper,
  DataListTable,
  DateTimeWrapper,
  EventTypeContainer,
  GroupFilterButton,
  LogAccordionItem,
  LogsContainer,
  LogContainer,
  LogRowButton,
  NoData,
  Option,
  RelatedEvents,
  TableWrapper,
  Table,
  Timestatus,
  UserInfoContainer,
  ViewContainer,
  WrapperPagination
} from './integration-log-styles'

export const IntegrationLogsUI = (props) => {
  const {
    model,
    modelId,
    logsList,
    paginationProps,
    getLogs,
    actionDisabled,
    selectedLogState,
    setSelectedLogState,
    relatedGroupEvent,
    setRelatedGroupEvent
  } = props

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const [showAllTrace, setShowAllTrace] = useState(false)

  const typeOptions = [
    { type: 'info', label: t('INFO', 'Info') },
    { type: 'warning', label: t('WARNING', 'Warning') },
    { type: 'critical', label: t('CRITICAL', 'Critical') }
  ]

  const handleSelectLog = (log) => {
    if (actionDisabled) return
    setSelectedLogState({
      ...selectedLogState,
      log
    })
    setOpen(!open)
  }

  const handleChangePage = (page) => {
    getLogs(page, 10)
  }

  const handleChangePageSize = (pageSize) => {
    const expectedPage = Math.ceil(paginationProps.from / pageSize)
    getLogs(expectedPage, pageSize)
  }

  const formatDisplayValue = (value) => {
    if (value == null) return ''
    if (typeof value !== 'object') return value

    if (Array.isArray(value)) {
      return value.map((item) => formatDisplayValue(item)).join(', ')
    }

    const { file, line, function: fn, class: cls, type } = value
    if (file != null || line != null || fn || cls || type) {
      const callable = [cls, type, fn].filter(Boolean).join(cls && type ? '::' : ' ')
      const location = file != null && line != null ? `${file}:${line}` : (file || line || '')
      return [callable, location ? `(${location})` : ''].filter(Boolean).join(' ') || JSON.stringify(value)
    }

    return JSON.stringify(value, null, 2)
  }

  const renderDynamicData = (data, excludeKeys = []) => {
    const renderItem = (key, value) => {
      if (excludeKeys.includes(key) || value == null) {
        return null
      }

      if (key === 'execution_time') {
        value = `${value} ${t('MS', 'ms')}`
      }

      if (Array.isArray(value) && key === 'trace') {
        return (
          <div key={key}>
            <strong>{t(key.toUpperCase(), key)}:</strong>
            <ul>
              {(showAllTrace ? value : value.slice(0, 6)).map((item, index) => (
                <li key={index}>{formatDisplayValue(item)}</li>
              ))}
              {value.length > 6 && (
                <li>
                  <CodeToggleButton
                    type='button'
                    onClick={() => setShowAllTrace((prev) => !prev)}
                  >
                    {showAllTrace ? t('SHOW_LESS', 'Show less') : `${t('SHOW_MORE', 'Show more')} (${value.length - 6} more)`}
                  </CodeToggleButton>
                </li>
              )}
            </ul>
          </div>
        )
      }

      if (Array.isArray(value)) {
        return (
          <div key={key}>
            <strong>{t(key.toUpperCase(), key)}:</strong>
            <ul>
              {value.map((item, index) => (
                <li key={index}>{formatDisplayValue(item)}</li>
              ))}
            </ul>
          </div>
        )
      }

      if (typeof value === 'object' && value !== null) {
        return (
          <div key={key}>
            <strong>{t(key.toUpperCase(), key)}:</strong>
            <ul>
              {Object.entries(value).map(([subKey, subValue]) => (
                renderItem(subKey, subValue)
              ))}
            </ul>
          </div>
        )
      }

      return (
        <li key={key}>
          <strong>{t(key.toUpperCase(), key)}:</strong> {value}
        </li>
      )
    }

    return (
      <div>
        <ul>
          {Object.entries(data).map(([key, value]) => renderItem(key, value))}
        </ul>
      </div>
    )
  }

  const CollapsibleCodeBlock = ({ language, content, previewLines = 10 }) => {
    const [isExpanded, setIsExpanded] = useState(false)

    const toggleExpand = () => setIsExpanded((prev) => !prev)
    const formattedContent =
      language === 'json'
        ? (() => {
            try {
              return JSON.stringify(JSON.parse(content), null, 2)
            } catch (error) {
              console.error('Invalid JSON content:', error)
              return content
            }
          })()
        : content

    const lineCount = formattedContent.split('\n').length

    return (
      <div>
        <SyntaxHighlighter
          language={language}
          style={theme.ordering?.mode === 'dark' ? a11yDark : a11yLight}
          showLineNumbers
          wrapLines
          lineProps={(lineNumber) =>
            lineNumber > previewLines && !isExpanded
              ? { style: { display: 'none' } }
              : {}
          }
        >
          {formattedContent}
        </SyntaxHighlighter>
        {lineCount > previewLines && (
          <CodeToggleButton
            type='button'
            onClick={toggleExpand}
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </CodeToggleButton>
        )}
      </div>
    )
  }

  useEffect(() => {
    if (logsList.loading || logsList.logs.length > 0 || paginationProps.totalPages <= 1) return
    if (paginationProps.currentPage !== paginationProps.totalPages) {
      handleChangePage(paginationProps.currentPage)
    } else {
      handleChangePage(paginationProps.currentPage - 1)
    }
  }, [logsList.logs, paginationProps])

  return (
    <>
      <LogsContainer
        data-disabled={actionDisabled ? '' : undefined}
        inert={actionDisabled ? '' : undefined}
      >
        <ViewContainer flexEnd>
          <div className='box-wrapper'>
            <div className='box-container'>
              {typeOptions.map((type, i) => (
                <div key={i} className='text-wrapper'>
                    <BoxColor severity={type?.type}></BoxColor>
                    <p>{type?.label}</p>
                </div>
              ))}
            </div>
          </div>
        </ViewContainer>
        {relatedGroupEvent && (
          <GroupFilterButton color='primary' type='button' onClick={() => setRelatedGroupEvent('')}>
            <p>
              {t('GROUP', 'Group')} : {relatedGroupEvent}
            </p>
            <X />
          </GroupFilterButton>
        )}
        <TableWrapper hasGroupRelated={relatedGroupEvent}>
          {(logsList.loading || logsList.logs.length > 0)
            ? (
                <Table>
                  <thead>
                    <tr>
                      <th></th>
                      {!model && (<th>{t('MODEL', 'Model')}</th>)}
                      {!modelId && (<th>{t('MODEL_ID', 'Model ID')}</th>)}
                      <th>{t('EVENT', 'Event')}</th>
                      <th>{t('CREATED_AT', 'Created at')}</th>
                    </tr>
                  </thead>
                  {logsList.loading
                    ? (
                        [...Array(10).keys()].map(i => (
                      <tbody key={i}>
                        <tr>
                          <td>
                            <UserInfoContainer>
                              <p><Skeleton width={100} /></p>
                              <p><Skeleton width={120} /></p>
                            </UserInfoContainer>
                          </td>
                          <td>
                            <DataListTable>
                              <tbody>
                                <tr>
                                  <td><Skeleton width={100} /></td>
                                  <td><Skeleton width={20} /></td>
                                  <td><Skeleton width={20} /></td>
                                </tr>
                              </tbody>
                            </DataListTable>
                          </td>
                          <td>
                            <DateTimeWrapper>
                              <Skeleton />
                            </DateTimeWrapper>
                          </td>
                          <td>
                            <Skeleton />
                          </td>
                        </tr>
                      </tbody>
                        ))
                      )
                    : (
                        !logsList.error && logsList.logs?.map(log => (
                      <tbody
                        key={log.id}
                        data-slot='integration-log-row'
                        data-severity={log?.type}
                        onClick={() => handleSelectLog(log)}
                      >
                        <tr>
                          <td>
                            <Option noPadding>
                              <Timestatus timeState={log?.type} />
                            </Option>
                          </td>
                          {!model && (
                            <td>
                              <UserInfoContainer>
                                <p>{log?.model || ''}</p>
                              </UserInfoContainer>
                            </td>
                          )}
                          {!modelId && (
                            <td>
                              <UserInfoContainer>
                                <Option>
                                  <p>{log?.model_id || ''}</p>
                                </Option>
                              </UserInfoContainer>
                            </td>
                          )}
                          <td>
                            <EventTypeContainer isFirst={model && modelId}>
                              <LogRowButton
                                type='button'
                                disabled={actionDisabled}
                                aria-label={`${t('VIEW_DETAILS', 'View details')}: ${t((log?.event?.replace(/\./g, '__')?.toUpperCase()) || 'UNKNOWN', log?.event) || ''}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleSelectLog(log)
                                }}
                              >
                                {t((log?.event?.replace(/\./g, '__')?.toUpperCase()) || 'UNKNOWN', log?.event) || ''}
                              </LogRowButton>
                            </EventTypeContainer>
                          </td>
                          <td>
                            <DateTimeWrapper>
                              {parseDate(log.created_at, { utc: true })}
                            </DateTimeWrapper>
                          </td>
                        </tr>
                      </tbody>
                        ))
                      )}
                </Table>
              )
            : (
                <NoData>{t('NO_DATA', 'No data')}</NoData>
              )}
        </TableWrapper>
        {logsList?.logs.length > 0 && (
          <WrapperPagination>
            <Pagination
              isHidePagecontrol
              currentPage={paginationProps.currentPage}
              totalPages={paginationProps.totalPages}
              handleChangePage={handleChangePage}
              handleChangePageSize={handleChangePageSize}
            />
          </WrapperPagination>
        )}
      </LogsContainer>
      {open && (
        <Modal
          width='70%'
          height='85vh'
          style={{ overflowY: 'auto' }}
          padding='30px'
          title={t('LOG', 'Log')}
          open={open}
          onClose={() => {
            setOpen(false)
            handleSelectLog({})
          }}
        >
          {selectedLogState?.loading && (
            <Skeleton count={10} />
          )}
          {!selectedLogState?.loading && (
            <AccordionRoot defaultValue={[]}>
              <LogContainer>
                <RelatedEvents>
                  <div className='related-events'>
                    <CodeToggleButton
                      type='button'
                      onClick={() => {
                        setRelatedGroupEvent(selectedLogState?.log?.group_key)
                        setOpen(false)
                        setSelectedLogState((prev) => ({ ...prev, log: {} }))
                      }}
                    >
                      {t('VIEW_RELATED_GROUP_EVENTS', 'View group related events')}
                    </CodeToggleButton>
                  </div>
                  {selectedLogState?.log?.exception && (
                    <LogAccordionItem value='exception'>
                      <AccordionHeader render={<div />}>
                        <ContextAwareToggle>
                          <ContextAwareWrapper>
                            <h5>
                              {t('EXCEPTION', 'Exception')}:
                            </h5>
                            <ActionIconWrapper>
                              <ChevronDown className='down-arrow' />
                            </ActionIconWrapper>
                          </ContextAwareWrapper>
                        </ContextAwareToggle>
                      </AccordionHeader>
                      <AccordionPanel>
                          {renderDynamicData(selectedLogState?.log?.exception)}
                      </AccordionPanel>
                    </LogAccordionItem>
                  )}
                  {selectedLogState?.log?.request && (
                    <LogAccordionItem value='request'>
                      <AccordionHeader render={<div />}>
                        <ContextAwareToggle>
                          <ContextAwareWrapper>
                            <h5>
                              {t('REQUEST', 'Request')}:
                            </h5>
                            <ActionIconWrapper>
                              <ChevronDown className='down-arrow' />
                            </ActionIconWrapper>
                          </ContextAwareWrapper>
                        </ContextAwareToggle>
                      </AccordionHeader>
                      <AccordionPanel>
                          {renderDynamicData(selectedLogState?.log?.request, ['payload', 'payload_type'])}
                          {selectedLogState?.log?.request?.payload && selectedLogState?.log?.request?.payload_type && (
                            <CollapsibleCodeBlock
                              language={selectedLogState?.log?.request?.payload_type}
                              content={selectedLogState?.log?.request?.payload}
                              previewLines={10}
                            />
                          )}
                      </AccordionPanel>
                    </LogAccordionItem>
                  )}
                  {selectedLogState?.log?.response?.content_type && (
                    <LogAccordionItem value='response'>
                      <AccordionHeader render={<div />}>
                        <ContextAwareToggle>
                          <ContextAwareWrapper>
                            <h5>
                              {t('RESPONSE', 'Response')}:
                            </h5>
                            <ActionIconWrapper>
                              <ChevronDown className='down-arrow' />
                            </ActionIconWrapper>
                          </ContextAwareWrapper>
                        </ContextAwareToggle>
                      </AccordionHeader>
                      <AccordionPanel>
                          {renderDynamicData(selectedLogState?.log?.response, ['content', 'content_type'])}
                          {selectedLogState?.log?.response?.content && selectedLogState?.log?.response?.content_type && (
                            <CollapsibleCodeBlock
                              language={selectedLogState?.log?.response?.content_type}
                              content={selectedLogState?.log?.response?.content}
                              previewLines={10}
                            />
                          )}
                      </AccordionPanel>
                    </LogAccordionItem>
                  )}
                </RelatedEvents>
              </LogContainer>
            </AccordionRoot>
          )}
        </Modal>
      )}
    </>
  )
}

export const IntegrationLogs = (props) => {
  const integrationLogsProps = {
    ...props,
    UIComponent: IntegrationLogsUI
  }
  return <IntegrationLogsController {...integrationLogsProps} />
}
