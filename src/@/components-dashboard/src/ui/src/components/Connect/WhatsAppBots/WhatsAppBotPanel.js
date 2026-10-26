import React, { useEffect, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import { settingsPatch } from '../../../../../components/WhatsAppBotsList/botSettings'
import { useLanguage } from '../../../../../index'
import { Button, Input, Switch } from '../../../styles'
import { Confirm, SideBar } from '../../Shared'
import { BrandSelect } from './BrandSelect'
import { WhatsAppBotConnection } from './WhatsAppBotConnection'
import {
  PanelBody,
  PanelTitle,
  Field,
  Hint,
  ColorRow,
  ColorPair,
  ColorClear,
  SectionLabel,
  SkeletonStack,
  Swatch,
  BranchSelect,
  SavedNote,
  ErrorBox,
  ConnectionCard,
  ConnectionActions,
  EnableRow
} from './styles'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const DEFAULT_PRIMARY = '#c4271b'
const DEFAULT_SECONDARY = '#ffc72c'

const swatchValue = (value, fallback) => {
  if (HEX_COLOR.test(value)) return value
  return value ? '#ffffff' : fallback
}

const SKELETON_FILL = { line: 'sk-line', grow: 'sk-grow', fixed: 'sk-fixed' }

const Bar = ({ width, height, radius = 8, fill = 'line' }) => (
  <Skeleton
    inline
    width={width}
    height={height}
    borderRadius={radius}
    containerClassName={SKELETON_FILL[fill]}
  />
)

export const SettingsSkeleton = () => (
  <SkeletonStack aria-hidden='true'>
    {[['72px', 40], ['64px', 22], ['140px', 40]].map(([labelWidth, controlHeight]) => (
      <Field as='div' key={labelWidth}>
        <Bar width={labelWidth} height={16} fill='fixed' />
        <Bar height={controlHeight} width={controlHeight === 22 ? 42 : undefined} fill={controlHeight === 22 ? 'fixed' : 'line'} />
      </Field>
    ))}
    <SectionLabel as='div'>
      <Bar width={180} height={16} fill='fixed' />
    </SectionLabel>
    <ColorPair>
      {['108px', '132px'].map(labelWidth => (
        <Field as='div' key={labelWidth}>
          <Bar width={labelWidth} height={16} fill='fixed' />
          <ColorRow>
            <Bar width={42} height={42} fill='fixed' />
            <Bar height={42} fill='grow' />
            <Bar width={72} height={42} fill='fixed' />
          </ColorRow>
        </Field>
      ))}
    </ColorPair>
    <ConnectionActions>
      <Bar height={42} />
    </ConnectionActions>
  </SkeletonStack>
)

export const ColorField = ({ label, hint, value, fallback, onChange }) => {
  const [, t] = useLanguage()
  return (
    <Field as='div'>
      {label}
      <ColorRow>
        <Swatch
          type='color'
          aria-hidden='true'
          tabIndex={-1}
          value={swatchValue(value, fallback)}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          aria-label={label}
          value={value}
          maxLength={7}
          spellCheck={false}
          placeholder={fallback}
          onChange={(event) => onChange(event.target.value)}
        />
        <ColorClear type='button' onClick={() => onChange('')}>
          {t('WHATSAPP_BOT_CLEAR_COLOR', 'Clear')}
        </ColorClear>
      </ColorRow>
      {hint ? <Hint>{hint}</Hint> : null}
    </Field>
  )
}

const brandIdText = (brandId) => (brandId == null || brandId === '' ? '' : String(brandId))

export const WhatsAppBotPanel = (props) => {
  const {
    open,
    settingsState,
    saveBotSettings,
    reloadBotSettings,
    onClose,
    title,
    brandId,
    brandName,
    brandsState,
    loadBrands,
    loadMoreBrands,
    connectionProps,
    enabled,
    enabledSaving = false,
    onEnabledChange
  } = props
  const { loading, saving, error, saved } = settingsState
  const {
    brands = [],
    loading: brandsLoading = false,
    loadingMore: brandsLoadingMore = false,
    loaded: brandsLoaded = false,
    error: brandsError = null,
    hasNextPage: brandsHasNextPage = false
  } = brandsState || {}
  const [, t] = useLanguage()
  const [draft, setDraft] = useState(saved)
  const savedBrandId = brandIdText(brandId)
  const [draftBrandId, setDraftBrandId] = useState(savedBrandId)
  const [confirmBrand, setConfirmBrand] = useState(false)

  useEffect(() => {
    setDraft(saved)
  }, [saved])

  useEffect(() => {
    setDraftBrandId(savedBrandId)
    setConfirmBrand(false)
  }, [savedBrandId])

  useEffect(() => {
    if (!open || brandsLoaded || brandsLoading) return
    loadBrands?.()
  }, [open, brandsLoaded, brandsLoading])

  if (!open) return null

  const patch = saved && draft ? settingsPatch(saved, draft) : {}
  const brandChanged = draftBrandId !== savedBrandId && draftBrandId !== ''
  const canSave = !saving && (Object.keys(patch).length > 0 || brandChanged)
  const showSaved = Boolean(settingsState.savedNotice) && !saving && !error && Object.keys(patch).length === 0 && !brandChanged
  const selectedBrand = brands.find(brand => String(brand.id) === draftBrandId) ||
    (draftBrandId ? { id: Number(draftBrandId), name: brandName || title, enabled: true, logo: null } : null)

  const update = (key, value) => setDraft(prev => ({ ...(prev || saved), [key]: value }))

  const save = () => {
    if (!canSave) return
    if (brandChanged) {
      setConfirmBrand(true)
      return
    }
    saveBotSettings(patch)
  }

  const confirmBrandChange = () => {
    setConfirmBrand(false)
    saveBotSettings(patch, {
      franchiseId: Number(draftBrandId),
      brand: selectedBrand
    })
  }

  return (
    <SideBar open={open} onClose={onClose} defaultSideBarWidth={640} sidebarId='whatsapp_bot_settings'>
      <PanelBody>
        <PanelTitle>{title}</PanelTitle>
        {loading && <SettingsSkeleton />}
        {error && (
          <ErrorBox role='alert'>
            <p>{error.map(code => t(code, code)).join(', ')}</p>
            {!saved && (
              <Button color='primary' borderRadius='8px' onClick={reloadBotSettings}>
                {t('RETRY', 'Retry')}
              </Button>
            )}
          </ErrorBox>
        )}
        {saved && draft && (
          <>
            <Field as='div'>
              {t('WHATSAPP_BOT_BRAND', 'Brand')}
              <BrandSelect
                aria-label={t('WHATSAPP_BOT_BRAND', 'Brand')}
                value={draftBrandId}
                brands={brands}
                disabled={saving}
                loading={brandsLoading && !brandsLoaded}
                loadingMore={brandsLoadingMore}
                hasNextPage={brandsHasNextPage}
                onLoadMore={loadMoreBrands}
                fallbackName={brandName || title}
                placeholder={t('WHATSAPP_BOT_SELECT_BRAND', 'Select a brand')}
                loadingLabel={t('WHATSAPP_BOT_BRANDS_LOADING', 'Loading brands...')}
                loadingMoreLabel={t('WHATSAPP_BOT_BRANDS_LOADING_MORE', 'Loading more brands...')}
                disabledLabel={t('WHATSAPP_BOT_BRAND_DISABLED_LABEL', 'Disabled')}
                onChange={setDraftBrandId}
              />
              {brandsError && (
                <ErrorBox role='alert'>
                  <p>{t('WHATSAPP_BOT_BRANDS_ERROR', 'The brands could not be loaded.')}</p>
                  <Button type='button' color='primary' borderRadius='8px' onClick={loadBrands}>
                    {t('RETRY', 'Retry')}
                  </Button>
                </ErrorBox>
              )}
            </Field>
            {typeof enabled === 'boolean' && (
              <EnableRow>
                <span>{t('WHATSAPP_ENABLE_AGENT', 'Enable Agent')}</span>
                <Switch
                  notAsync
                  ariaLabel={t('WHATSAPP_ENABLE_AGENT', 'Enable Agent')}
                  defaultChecked={enabled}
                  disabled={saving || enabledSaving}
                  onChange={onEnabledChange}
                />
              </EnableRow>
            )}
            <Field as='div'>
              {t('WHATSAPP_BOT_BRANCH_LABEL', 'Branch selection')}
              <BranchSelect
                aria-label={t('WHATSAPP_BOT_BRANCH_LABEL', 'Branch selection')}
                value={draft.branchSelectionMode}
                onChange={(event) => update('branchSelectionMode', event.target.value)}
              >
                <option value='auto'>{t('WHATSAPP_BOT_BRANCH_AUTO', 'Pick the closest open store')}</option>
                <option value='marketplace'>{t('WHATSAPP_BOT_BRANCH_MARKETPLACE', 'Let the customer choose the store')}</option>
              </BranchSelect>
              <Hint>
                {draft.branchSelectionMode === 'marketplace'
                  ? t('WHATSAPP_BOT_BRANCH_MARKETPLACE_HINT', 'The agent lists the branches that serve the address so the customer chooses.')
                  : t('WHATSAPP_BOT_BRANCH_AUTO_HINT', 'The agent picks the closest open branch that serves the address.')}
              </Hint>
            </Field>
            <ConnectionCard>
              <SectionLabel>{t('WHATSAPP_WEBVIEW_COLORS', 'WhatsApp webview colors')}</SectionLabel>
              <ColorPair>
                <ColorField
                  label={t('WHATSAPP_BOT_PRIMARY_COLOR', 'Primary color')}
                  value={draft.primaryColor}
                  fallback={DEFAULT_PRIMARY}
                  onChange={(value) => update('primaryColor', value)}
                />
                <ColorField
                  label={t('WHATSAPP_BOT_SECONDARY_COLOR', 'Secondary color')}
                  value={draft.secondaryColor}
                  fallback={DEFAULT_SECONDARY}
                  onChange={(value) => update('secondaryColor', value)}
                />
              </ColorPair>
              <Hint>{t('WHATSAPP_BOT_COLOR_HINT', 'Six characters, like #c4271b. Clear the field to use the default.')}</Hint>
              <ConnectionActions>
                <Button color='primary' borderRadius='8px' disabled={!canSave} onClick={save}>
                  {saving ? t('WHATSAPP_BOT_SAVING', 'Saving') : t('WHATSAPP_BOT_SAVE', 'Save')}
                </Button>
                {showSaved && <SavedNote>{t('WHATSAPP_BOT_SAVED', 'Saved')}</SavedNote>}
              </ConnectionActions>
            </ConnectionCard>
          </>
        )}
        {connectionProps && <WhatsAppBotConnection {...connectionProps} />}
      </PanelBody>
      <Confirm
        open={confirmBrand}
        title={t('WHATSAPP_BOT_BRAND_CHANGE_TITLE', 'Are you sure you want to change the brand?')}
        content={t('WHATSAPP_BOT_BRAND_CHANGE_MESSAGE', 'Active conversations will be reset and move to the new brand. Closed conversations stay as they are.')}
        acceptText={t('WHATSAPP_BOT_BRAND_CHANGE_CONFIRM', 'Confirm change')}
        cancelText={t('CANCEL', 'Cancel')}
        onAccept={confirmBrandChange}
        onCancel={() => setConfirmBrand(false)}
        onClose={() => setConfirmBrand(false)}
        closeOnBackdrop={false}
      />
    </SideBar>
  )
}
