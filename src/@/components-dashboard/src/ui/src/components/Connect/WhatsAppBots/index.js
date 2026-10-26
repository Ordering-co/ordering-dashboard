import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Skeleton from 'react-loading-skeleton'
import { List as MenuIcon, ArrowRepeat, BoxArrowUpRight, Whatsapp } from 'react-bootstrap-icons'
import { WhatsAppBotsList as WhatsAppBotsListController, useLanguage } from '../../../../../index'
import { addQueryToUrl, removeQueryToUrl, URL_CHANGE_EVENT } from '../../../utils'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Button, IconButton, Switch } from '../../../styles'
import { NotFoundSource, Pagination } from '../../Shared'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { WhatsAppBotPanel } from './WhatsAppBotPanel'
import { WhatsAppBotCreate } from './WhatsAppBotCreate'
import { WhatsAppBotTest } from './WhatsAppBotTest'

import {
  Container,
  HeaderContainer,
  HeaderActions,
  HeaderTitleContainer,
  CountBadge,
  Description,
  TableWrapper,
  BotsTable,
  BotIdentity,
  BrandLogo,
  BotName,
  PhoneCell,
  StatusBadge,
  StatusControl,
  ToggleError,
  TestListButton,
  ErrorBox,
  PaginationWrapper
} from './styles'

const SKELETON_ROWS = 3

const getInitials = (name = '') => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(word => word[0].toUpperCase())
  .join('')

const botIdFromSearch = (search) => {
  const id = new URLSearchParams(search || '').get('id')
  return id && /^\d+$/.test(id) ? id : null
}

const useBotId = () => {
  const location = useLocation()
  // replaceState updates the address bar without telling react-router.
  // null means "follow the router"; a string, even empty, is the address bar.
  const [queryOverride, setQueryOverride] = useState(null)

  useEffect(() => {
    const update = () => setQueryOverride(window.location.search)
    window.addEventListener(URL_CHANGE_EVENT, update)
    return () => window.removeEventListener(URL_CHANGE_EVENT, update)
  }, [])

  useEffect(() => {
    setQueryOverride(null)
  }, [location.search])

  return botIdFromSearch(queryOverride === null ? location.search : queryOverride)
}

const WhatsAppBotsUI = (props) => {
  const {
    botsState,
    settingsState,
    createState,
    brandsState,
    toggleState = { savingId: null, error: null },
    getBots,
    setBotEnabled,
    saveBotSettings,
    reloadBotSettings,
    loadBrands,
    loadMoreBrands,
    createBot,
    botId,
    connectionState,
    connectWithMeta,
    reconnectAnother,
    saveManualCredentials,
    savePin,
    downloadPin,
    verifyRegistration,
    runDoctor,
    disconnect,
    reloadConnection
  } = props
  const { loading, error, bots, pagination } = botsState
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [createOpen, setCreateOpen] = useState(false)
  const [testPhone, setTestPhone] = useState(null)
  const pendingConnectRef = useRef(null)
  const openBot = bots.find(bot => String(bot.id) === String(botId))

  useEffect(() => {
    const pending = pendingConnectRef.current
    if (!pending || String(botId) !== pending.id || typeof connectWithMeta !== 'function') return
    pendingConnectRef.current = null
    connectWithMeta({ pin: pending.pin })
  }, [botId, connectWithMeta])

  const openCreate = () => {
    removeQueryToUrl(['id'])
    setCreateOpen(true)
  }

  useOpenFromQuery('add', openCreate, { ready: !loading, accept: (value) => value === '1' })

  const isEmpty = !loading && !error && bots.length === 0
  const total = pagination?.total ?? 0
  const refreshPage = () => getBots(pagination?.currentPage || 1)
  const botLabel = (id) => t('WHATSAPP_BOT_NAME', 'WhatsApp bot #_id_').replace('_id_', id)

  return (
    <Container>
      <HeaderContainer>
        <HeaderTitleContainer>
          {isCollapse && (
            <IconButton color='black' onClick={() => handleMenuCollapse(false)}>
              <MenuIcon />
            </IconButton>
          )}
          <h1>{t('CONNECT_WHATSAPP_BOTS', 'WhatsApp bots')}</h1>
          {!loading && !error && total > 0 && <CountBadge>{total}</CountBadge>}
        </HeaderTitleContainer>
        <HeaderActions>
          <Button color='primary' borderRadius='8px' onClick={openCreate}>
            {t('ADD_WHATSAPP_BOT', 'Add WhatsApp bot')}
          </Button>
          <Button
            color='lightPrimary'
            borderRadius='8px'
            className={loading ? 'loading' : ''}
            disabled={loading}
            onClick={refreshPage}
          >
            {t('REFRESH', 'Refresh')}
            <ArrowRepeat size={16} style={{ marginLeft: 5 }} />
          </Button>
        </HeaderActions>
      </HeaderContainer>
      <Description>
        {t('WHATSAPP_BOTS_DESCRIPTION', 'WhatsApp numbers that take orders through the guided webview.')}
      </Description>

      {error && (
        <ErrorBox role='alert'>
          <p>{t('WHATSAPP_BOTS_LOAD_ERROR', 'The WhatsApp bots could not be loaded.')} {error.map(code => t(code, code)).join(', ')}</p>
          <Button color='primary' borderRadius='8px' onClick={refreshPage}>
            {t('RETRY', 'Retry')}
          </Button>
        </ErrorBox>
      )}

      {isEmpty && (
        <NotFoundSource content={t('WHATSAPP_BOTS_EMPTY', 'There are no WhatsApp bots yet.')} />
      )}

      {!error && !isEmpty && (
        <TableWrapper>
          <BotsTable>
            <thead>
              <tr>
                <th>{t('WHATSAPP_BOT', 'Bot')}</th>
                <th>{t('WHATSAPP_NUMBER', 'WhatsApp number')}</th>
                <th />
                <th className='status'>{t('STATUS', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(SKELETON_ROWS).keys()].map(index => (
                <tr key={index}>
                  <td>
                    <BotIdentity>
                      <Skeleton width={40} height={40} borderRadius={8} />
                      <BotName>
                        <Skeleton width={140} />
                        <Skeleton width={70} height={12} />
                      </BotName>
                    </BotIdentity>
                  </td>
                  <td><Skeleton width={130} /></td>
                  <td><Skeleton width={168} height={36} borderRadius={8} /></td>
                  <td className='status'>
                    <StatusControl>
                      <Skeleton width={72} height={24} borderRadius={8} />
                      <Skeleton width={25} height={14} borderRadius={15} />
                    </StatusControl>
                  </td>
                </tr>
              ))}
              {!loading && bots.map(bot => {
                const title = bot.brand?.name || botLabel(bot.id)
                const selected = String(bot.id) === String(botId)
                return (
                  <tr
                    key={bot.id}
                    className={selected ? 'selected' : ''}
                    onClick={() => {
                      setCreateOpen(false)
                      addQueryToUrl({ id: bot.id })
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setCreateOpen(false)
                        addQueryToUrl({ id: bot.id })
                      }
                    }}
                    tabIndex={0}
                    aria-selected={selected}
                  >
                    <td>
                      <BotIdentity>
                        <BrandLogo aria-hidden='true'>
                          {bot.brand?.logo
                            ? <img src={bot.brand.logo} alt='' loading='lazy' />
                            : bot.brand?.name ? getInitials(bot.brand.name) : <Whatsapp />}
                        </BrandLogo>
                        <BotName>
                          <span className='title'>{title}</span>
                          {bot.brand?.name && <span className='subtitle'>{botLabel(bot.id)}</span>}
                        </BotName>
                      </BotIdentity>
                    </td>
                    <td>
                      {bot.phone
                        ? (
                          <PhoneCell>
                            <Whatsapp aria-hidden='true' />
                            <span>{bot.phone}</span>
                          </PhoneCell>
                          )
                        : <span className='muted'>{t('WHATSAPP_BOT_NO_PHONE', 'No number yet')}</span>}
                    </td>
                    <td
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {bot.phone && (
                        <TestListButton
                          type='button'
                          onClick={() => setTestPhone(bot.phone)}
                        >
                          <BoxArrowUpRight aria-hidden='true' />
                          {t('WHATSAPP_TEST_AGENT', 'Test WhatsApp Agent')}
                        </TestListButton>
                      )}
                    </td>
                    <td
                      className='status'
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <StatusControl>
                        <StatusBadge active={bot.enabled}>
                          {bot.enabled ? t('ENABLED', 'Enabled') : t('DISABLED', 'Disabled')}
                        </StatusBadge>
                        <Switch
                          notAsync
                          ariaLabel={bot.enabled ? t('DISABLE', 'Disable') : t('ENABLE', 'Enable')}
                          defaultChecked={bot.enabled}
                          disabled={toggleState.savingId === bot.id}
                          onChange={(enabled) => setBotEnabled(bot.id, enabled)}
                        />
                      </StatusControl>
                      {toggleState.error?.id === bot.id && (
                        <ToggleError role='alert'>
                          {t('WHATSAPP_BOT_UPDATE_ERROR', 'The bot could not be updated.')}
                        </ToggleError>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </BotsTable>
        </TableWrapper>
      )}

      {!error && total > 0 && (
        <PaginationWrapper>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            defaultPageSize={pagination.pageSize}
            handleChangePage={(page) => getBots(page)}
            handleChangePageSize={(size) => getBots(1, size)}
          />
        </PaginationWrapper>
      )}
      <WhatsAppBotPanel
        open={Boolean(botId)}
        botId={botId}
        title={openBot?.brand?.name || (botId ? botLabel(botId) : '')}
        brandId={openBot?.brandId ?? null}
        brandName={openBot?.brand?.name || ''}
        enabled={typeof openBot?.enabled === 'boolean' ? openBot.enabled : undefined}
        enabledSaving={toggleState.savingId != null && String(toggleState.savingId) === String(botId)}
        onEnabledChange={(value) => openBot && setBotEnabled(openBot.id, value)}
        brandsState={brandsState}
        loadBrands={loadBrands}
        loadMoreBrands={loadMoreBrands}
        settingsState={settingsState}
        saveBotSettings={saveBotSettings}
        reloadBotSettings={reloadBotSettings}
        connectionProps={connectionState && {
          connectionState,
          connectWithMeta,
          reconnectAnother,
          saveManualCredentials,
          savePin,
          downloadPin,
          verifyRegistration,
          runDoctor,
          disconnect,
          reloadConnection
        }}
        onClose={() => removeQueryToUrl(['id'])}
      />
      <WhatsAppBotCreate
        open={createOpen}
        brandsState={brandsState}
        createState={createState}
        loadBrands={loadBrands}
        loadMoreBrands={loadMoreBrands}
        createBot={createBot}
        onCreated={(draft, id) => {
          if (draft.authType !== 'business_login' || !(Number(id) > 0)) return
          pendingConnectRef.current = { id: String(id), pin: draft.pin || '' }
          addQueryToUrl({ id: String(id) })
        }}
        onClose={() => setCreateOpen(false)}
      />
      <WhatsAppBotTest
        open={Boolean(testPhone)}
        phone={testPhone}
        onClose={() => setTestPhone(null)}
      />
    </Container>
  )
}

export const WhatsAppBots = (props) => {
  const botId = useBotId()
  const whatsAppBotsProps = {
    ...props,
    botId,
    UIComponent: WhatsAppBotsUI
  }
  return <WhatsAppBotsListController {...whatsAppBotsProps} />
}
