import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import {
  ArrowClockwise,
  ArrowReturnLeft,
  BarChartLine,
  BoundingBox,
  Clock,
  Gear,
  GraphUp,
  HouseDoor,
  ListCheck,
  Mortarboard,
  People,
  Search,
  Shop,
  Sliders,
  Truck,
  BagCheck,
  FileEarmarkText,
  PersonFill,
  ChevronLeft,
  BoxArrowInRight,
  PlusCircle,
  Phone
} from 'react-bootstrap-icons'
import { useLanguage, useAssistant, CommandPalette as CommandPaletteController } from '../../../../index'
import { useCommandPalette } from '../../contexts/CommandPaletteContext'
import { useDashboardNavigation } from '../../hooks/useDashboardNavigation'
import { seedCommandPaletteI18n } from '../../../../utils/commandPaletteI18nSeed'
import { COMMAND_GROUPS } from '../../../../utils/commandPaletteCatalog'
import { getOrderStatus } from '../../utils'
import {
  Overlay,
  Content,
  VisuallyHidden,
  InputRow,
  ContextChip,
  Kbd,
  ItemIcon,
  ItemText,
  ItemTitle,
  ItemSubtitle,
  ItemEnd,
  Badge,
  StatusRow,
  Spinner,
  EmptyState,
  Footer,
  TriggerButton,
  TriggerKeys
} from './styles'

const ICONS = {
  home: HouseDoor,
  orders: ListCheck,
  delivery: Truck,
  stores: Shop,
  schools: Mortarboard,
  connect: BoundingBox,
  users: People,
  marketing: GraphUp,
  intelligence: BarChartLine,
  myProducts: BagCheck,
  builder: Phone,
  logs: FileEarmarkText,
  settings: Gear,
  field: Sliders,
  profile: PersonFill,
  recent: Clock,
  create: PlusCircle
}

/**
 * Pages whose panels follow every URL change: navigate without a remount.
 * (`/orders` is remounted: its status tab ignores a repeated same URL.)
 */
const getIcon = (item) => ICONS[item.icon] || (item.group === 'settings' ? Gear : BoxArrowInRight)

const CommandItemRow = ({ item, onSelect }) => {
  const Icon = getIcon(item)
  return (
    <Command.Item value={item.id} onSelect={() => onSelect(item)}>
      <ItemIcon className='command-item-icon' aria-hidden='true'>
        {item.logo ? <img src={item.logo} alt='' loading='lazy' /> : <Icon size={15} />}
      </ItemIcon>
      <ItemText>
        <ItemTitle>{item.title}</ItemTitle>
        {item.subtitle && <ItemSubtitle>{item.subtitle}</ItemSubtitle>}
      </ItemText>
      {item.badge && <Badge>{item.badge}</Badge>}
      {item.requires === 'business' && <ItemEnd aria-hidden='true'>›</ItemEnd>}
    </Command.Item>
  )
}

/** Status copy per remote section. */
const REMOTE_TEXTS = {
  businesses: {
    loading: ['COMMAND_PALETTE_BUSINESS_LOADING', 'Searching stores…'],
    error: ['COMMAND_PALETTE_BUSINESS_ERROR', 'Couldn’t search stores. Pages and settings still work.'],
    empty: ['COMMAND_PALETTE_BUSINESS_EMPTY', 'No stores match “_query_”']
  },
  orders: {
    loading: ['COMMAND_PALETTE_ORDERS_LOADING', 'Searching orders…'],
    error: ['COMMAND_PALETTE_ORDERS_ERROR', 'Couldn’t search orders. Pages and settings still work.']
  },
  users: {
    loading: ['COMMAND_PALETTE_USERS_LOADING', 'Searching users…'],
    error: ['COMMAND_PALETTE_USERS_ERROR', 'Couldn’t search users. Pages and settings still work.']
  }
}

const remoteText = (t, key, kind) => {
  const entry = REMOTE_TEXTS[key]?.[kind]
  return entry ? t(entry[0], entry[1]) : ''
}

const getRemoteStatusText = ({ t, section, context, query }) => {
  const { status } = section.search
  const hasItems = section.items.length > 0
  if (status === 'loading') return remoteText(t, section.key, 'loading')
  if (status === 'error') return remoteText(t, section.key, 'error')
  if (status === 'success' && !hasItems && section.key === 'businesses') {
    if (query) return remoteText(t, 'businesses', 'empty').replace('_query_', query)
    if (context) return t('COMMAND_PALETTE_BUSINESS_NONE', 'No stores to show')
  }
  return ''
}

const retryValue = (section) => `${section.key}-retry`

// Visual rows only: the live region outside the listbox announces the status
const RemoteStatus = ({ t, section, context, query, onRetry }) => {
  const { status } = section.search
  const hasItems = section.items.length > 0
  if (status === 'loading' && !hasItems) {
    return (
      <StatusRow aria-hidden='true'>
        <Spinner aria-hidden='true' />
        {remoteText(t, section.key, 'loading')}
      </StatusRow>
    )
  }
  if (status === 'error') {
    return (
      <Command.Item value={retryValue(section)} onSelect={() => onRetry(section)}>
        <ItemIcon className='command-item-icon' aria-hidden='true'><ArrowClockwise size={15} /></ItemIcon>
        <ItemText>
          <ItemTitle>{t('COMMAND_PALETTE_RETRY', 'Retry')}</ItemTitle>
          <ItemSubtitle>{remoteText(t, section.key, 'error')}</ItemSubtitle>
        </ItemText>
      </Command.Item>
    )
  }
  if (status === 'success' && !hasItems) {
    const text = getRemoteStatusText({ t, section, context, query })
    return text ? <StatusRow aria-hidden='true'>{text}</StatusRow> : null
  }
  return null
}

const CommandPaletteUI = (props) => {
  const {
    isOpen,
    setOpen,
    query,
    setQuery,
    sections,
    businessContext,
    handleSelect,
    handleExitContext,
    shortcut,
    restoreFocus
  } = props
  const [, t] = useLanguage()
  seedCommandPaletteI18n(t)

  const trimmed = query.trim()
  const hasItems = sections.some(section => section.items.length)
  const remoteSections = sections.filter(section => section.remote)
  const remoteBusy = remoteSections.some(section => section.search.status === 'loading' || section.search.status === 'error')
  const showEmpty = !hasItems && !remoteBusy && !!trimmed
  const liveText = showEmpty
    ? t('COMMAND_PALETTE_NO_RESULTS', 'No results for “_query_”').replace('_query_', trimmed)
    : remoteSections
      .map(section => getRemoteStatusText({ t, section, context: businessContext, query: trimmed }))
      .concat(sections.map(section => section.notice))
      .filter(Boolean)
      .join(' ')

  // Clicking an action, Back or Retry must not leave the keyboard stranded
  const inputRef = useRef(null)
  const focusInput = () => inputRef.current && inputRef.current.focus()
  useEffect(() => {
    if (isOpen) focusInput()
  }, [businessContext?.id])

  // Remote rows arrive after the query changed: keep a valid selection so
  // Enter always opens something (cmdk only re-selects when the query changes)
  const [selected, setSelected] = useState('')
  const itemIds = sections.flatMap(section => [
    ...section.items.map(item => item.id),
    ...(section.remote && section.search.status === 'error' ? [retryValue(section)] : [])
  ])
  const itemKey = itemIds.join('|')
  const firstIdRef = useRef('')
  useEffect(() => {
    const first = itemIds[0] || ''
    // Follow the top row while the selection is still the automatic one;
    // once the person moved with the arrows, keep their choice if it exists
    if (!itemIds.includes(selected) || selected === firstIdRef.current) setSelected(first)
    firstIdRef.current = first
  }, [itemKey])

  const handleRetry = (section) => {
    section.search.retry()
    focusInput()
  }

  const groupLabel = (key) => {
    const group = COMMAND_GROUPS[key]
    return group ? t(group.labelKey, group.label) : key
  }

  const handleInputKeyDown = (event) => {
    if (event.key === 'Backspace' && businessContext && !query) {
      event.preventDefault()
      handleExitContext()
    }
  }

  const handleEscape = (event) => {
    if (businessContext) {
      event.preventDefault()
      handleExitContext()
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Overlay />
        <Content
          aria-describedby={undefined}
          onEscapeKeyDown={handleEscape}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            restoreFocus && restoreFocus()
          }}
          data-testid='command-palette'
        >
          <Dialog.Title asChild>
            <VisuallyHidden>{t('COMMAND_PALETTE_LABEL', 'Search the dashboard')}</VisuallyHidden>
          </Dialog.Title>
          <Command
            shouldFilter={false}
            value={selected}
            onValueChange={setSelected}
            loop
            vimBindings={false}
            label={t('COMMAND_PALETTE_LABEL', 'Search the dashboard')}
          >
            <InputRow>
              {businessContext
                ? (
                  <ContextChip
                    type='button'
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleExitContext}
                    aria-label={`${t('COMMAND_PALETTE_BACK', 'Back')}: ${businessContext.title}`}
                  >
                    <ChevronLeft size={12} aria-hidden='true' />
                    <span>{businessContext.title}</span>
                  </ContextChip>
                  )
                : <Search size={18} aria-hidden='true' />}
              <Command.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                onKeyDown={handleInputKeyDown}
                autoFocus
                maxLength={120}
                placeholder={businessContext
                  ? t('COMMAND_PALETTE_CONTEXT_PLACEHOLDER', 'Choose a store: search by name or ID')
                  : t('COMMAND_PALETTE_PLACEHOLDER_RECORDS', 'Search pages, settings, stores, orders and users…')}
              />
              <Kbd aria-hidden='true'>Esc</Kbd>
            </InputRow>
            <Command.List>
              {sections.map(section => {
                const status = section.remote
                  ? <RemoteStatus t={t} section={section} context={businessContext} query={trimmed} onRetry={handleRetry} />
                  : section.notice ? <StatusRow>{section.notice}</StatusRow> : null
                if (!section.items.length && !status) return null
                return (
                  <Command.Group key={section.key} heading={businessContext ? t('COMMAND_PALETTE_CHOOSE_STORE_HINT', 'Choose a store') : groupLabel(section.key)}>
                    {section.items.map(item => (
                      <CommandItemRow key={item.id} item={item} onSelect={handleSelect} />
                    ))}
                    {status}
                  </Command.Group>
                )
              })}
              {showEmpty && (
                <EmptyState aria-hidden='true'>
                  <p>{t('COMMAND_PALETTE_NO_RESULTS', 'No results for “_query_”').replace('_query_', trimmed)}</p>
                  <p>{t('COMMAND_PALETTE_NO_RESULTS_HINT_RECORDS', 'Try a page, a setting, a store, an order number, a name or a phone.')}</p>
                </EmptyState>
              )}
            </Command.List>
            <VisuallyHidden role='status' aria-live='polite'>{liveText}</VisuallyHidden>
            <Footer aria-hidden='true'>
              <span><Kbd>↑</Kbd><Kbd>↓</Kbd>{t('COMMAND_PALETTE_HINT_NAVIGATE', 'Navigate')}</span>
              <span><Kbd><ArrowReturnLeft size={10} /></Kbd>{t('COMMAND_PALETTE_HINT_OPEN', 'Open')}</span>
              <span><Kbd>Esc</Kbd>{businessContext ? t('COMMAND_PALETTE_BACK', 'Back') : t('COMMAND_PALETTE_HINT_CLOSE', 'Close')}</span>
              <span style={{ marginInlineStart: 'auto' }}>{shortcut?.label}</span>
            </Footer>
          </Command>
        </Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Global command palette (⌘K / Ctrl+K). Mount once in the authenticated shell.
 */
export const CommandPalette = (props) => {
  const { isAvailable, isOpen, initialRequest, setOpen, shortcut, restoreFocus } = useCommandPalette()
  const navigate = useDashboardNavigation({ closeCommandPalette: true })
  const { setOpen: setAssistantOpen } = useAssistant()
  const handleNavigate = useCallback((path, options) => {
    if (initialRequest?.fromAssistant) setAssistantOpen(!window.innerWidth || window.innerWidth >= 768)
    navigate(path, options)
  }, [initialRequest, navigate, setAssistantOpen])

  const [, t] = useLanguage()
  const getOrderStatusLabel = useCallback((status) => {
    const found = getOrderStatus(status)
    return found ? t(found.slug, found.value) : ''
  }, [t])

  if (!isAvailable) return null

  return (
    <CommandPaletteController
      {...props}
      UIComponent={CommandPaletteUI}
      isOpen={isOpen}
      initialRequest={initialRequest}
      setOpen={setOpen}
      shortcut={shortcut}
      restoreFocus={restoreFocus}
      onNavigate={handleNavigate}
      getOrderStatusLabel={getOrderStatusLabel}
    />
  )
}

/**
 * Visible entry point for people who don't use the keyboard shortcut.
 */
export const CommandPaletteTrigger = ({ className }) => {
  const [, t] = useLanguage()
  const { isAvailable, open, shortcut } = useCommandPalette()
  if (!isAvailable) return null
  return (
    <TriggerButton
      type='button'
      className={className}
      onClick={open}
      aria-haspopup='dialog'
      aria-keyshortcuts={shortcut.ariaKeyShortcuts}
      data-testid='command-palette-trigger'
    >
      <Search aria-hidden='true' />
      <span>{t('COMMAND_PALETTE_TRIGGER', 'Search')}</span>
      <TriggerKeys aria-hidden='true'>
        {shortcut.keys.map(key => <Kbd key={key}>{key}</Kbd>)}
      </TriggerKeys>
    </TriggerButton>
  )
}
