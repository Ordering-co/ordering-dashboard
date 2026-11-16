import React, { useEffect, useRef, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { BusinessAdd as BusinessAddController, useConfig, useEvent, useLanguage } from '../../../../../index'
import { allDaySchedule, PROBLEM_ORDER, slugFromName } from '../../../../../utils/storeAdd'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { getScheduleLabels } from '../../../utils/scheduleLabels'
import { ConfirmDialog, IconButton, PageHeader, ScheduleEditor } from '../../Shared/Product'
import { Menu as MenuIcon } from '../../Shared/Icon'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { getUniqueId } from '../../../utils'
import { StoreAddDetails } from './StoreAddDetails'
import { StoreAddGoogle } from './StoreAddGoogle'
import { StoreAddLocation } from './StoreAddLocation'
import { StoreAddOrders } from './StoreAddOrders'
import { StoreAddZone } from './StoreAddZone'
import { StoreAddImages } from './StoreAddImages'
import { StoreAddSummary } from './StoreAddSummary'
import { StoreAddOutcome } from './StoreAddOutcome'
import './store-add.css'

// redesign (/stores/add; decisions D1–D6 in redesign/pages/stores-add/decisions.md): the store add on Product. One page
// in the order of main's guided onboarding (your store · location · opening hours · orders and payments · images) with a fixed
// summary that says what will be created and what is missing, and «Create store» always in sight (from 1280px in the summary,
// below that in a bar at the foot). The Google search sits on top (Tiendas decision 9 A); since it is main's
// (StoreAddGoogle) and `?placeId=` still fills the form. this page is the only way to add a store; with
// `continueTutorial` (the list's «Add your first store») a created store goes back to the list, where the tutorial goes on with its
// category and product. Errors are said in their field and the focus goes to the first one. Leaving with
// changes asks first (decision 4). The controller sends main's requests; a store created with a write left over stays on the
// page as «created, this is missing» with a retry that never creates a second store.

const BusinessAddUI = (props) => {
  const {
    form,
    changeFields,
    schedule,
    changeSchedule,
    gallery,
    changeGallery,
    paymethodsList,
    paymethodIds,
    changePaymethodIds,
    zone,
    changeZone,
    cities,
    citiesLoading,
    cityId,
    changeCity,
    problems,
    dirty,
    submitState,
    submit,
    retry,
    retryPaymethods,
    placeId,
    handleOpenCategory,
    onCreated,
    leaving
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [events] = useEvent()
  const history = useHistory()
  // review 3: with the sidebar collapsed the page offers «Open menu», as main's add and the list do
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const apiKey = configs?.google_maps_api_key?.value
  const status = submitState.status
  const editable = status === 'editing'
  const busy = status === 'creating' || status === 'finishing'
  const [showErrors, setShowErrors] = useState(false)
  const [scheduleKey, setScheduleKey] = useState(0)
  // what Google filled in, by group, so a later business replaces it and a field the user changed becomes a suggestion (main's)
  const [googleApplied, setGoogleApplied] = useState({})
  const [addressVersion, setAddressVersion] = useState(0)

  const fieldRefs = { name: useRef(null), slug: useRef(null), email: useRef(null) }
  const paymentsRef = useRef(null)
  const zoneRef = useRef(null)
  const outcomeRef = useRef(null)

  // The project's time zone until an address gives one (D5). Not an edit: leaving still goes without asking.
  const projectTimezone = configs?.timezone?.value || configs?.default_timezone?.value
  useEffect(() => {
    if (!form.timezone && projectTimezone) changeFields({ timezone: projectTimezone }, { silent: true })
  }, [projectTimezone])

  // ---- leaving with changes asks (decision 4, D6) ---------------------------------------------------------------------------
  const [pendingLeave, setPendingLeave] = useState(null)
  // review 5: while the store is being created leaving asks too (the writes would go on with nobody to see how they ended)
  const guardOn = (dirty && editable) || busy
  useEffect(() => {
    if (!guardOn) return undefined
    const unblock = history.block((location, action) => {
      if (leaving.current) return undefined
      setPendingLeave({ location, action })
      return false
    })
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => {
      unblock()
      window.removeEventListener('beforeunload', warn)
    }
  }, [guardOn, history])

  const discardAndLeave = () => {
    const target = pendingLeave
    setPendingLeave(null)
    leaving.current = true
    if (!target) return
    if (target.action === 'POP') history.goBack()
    else if (target.action === 'REPLACE') history.replace(target.location)
    else history.push(target.location)
  }

  const goToStores = () => events.emit('go_to_page', { page: 'businesses' })

  // ---- Google business (main ): what each group of Google's data fills in the add --------------------------------------
  const getGoogleFields = (business) => ({
    name: { name: business.name, slug: business.name ? slugFromName(business.name) : '' },
    phone: { cellphone: business.phone },
    address: {
      address: business.address,
      location: business.location && { ...business.location, zipcode: business.zipcode || -1, zoom: 15 },
      timezone: business.timezone
    },
    schedule: { schedule: business.schedule },
    priceLevel: { price_level: business.priceLevel >= 1 ? `${business.priceLevel}` : null }
  })

  const handleGoogleChange = ({ schedule: nextSchedule, ...fields }) => {
    if (nextSchedule) {
      changeSchedule(nextSchedule)
      setScheduleKey(key => key + 1)
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'address') || Object.prototype.hasOwnProperty.call(fields, 'location')) setAddressVersion(version => version + 1)
    if (Object.keys(fields).length) changeFields(fields)
  }

  const handleGooglePhotos = (photos) => {
    const galleryPhotos = photos.filter(photo => photo.role === 'gallery').map(photo => ({ temp_id: getUniqueId(), file: photo.file }))
    if (galleryPhotos.length) changeGallery(previous => [...previous, ...galleryPhotos])
    const images = Object.fromEntries(photos.filter(photo => photo.role !== 'gallery').map(photo => [photo.role, photo.file]))
    if (Object.keys(images).length) changeFields(images)
  }

  // A store created with a write left over: the focus (and the view) go to what says so, once it is drawn. The panel stays while
  // «Try again» runs (review 4), so its buttons and the focus are not lost.
  const [outcomeShown, setOutcomeShown] = useState(false)
  useEffect(() => { if (status === 'partial') setOutcomeShown(true) }, [status])
  const showOutcome = outcomeShown && !!submitState.business && status !== 'created'
  useEffect(() => {
    if (status !== 'partial') return
    outcomeRef.current?.focus()
    outcomeRef.current?.scrollIntoView?.({ block: 'start' })
  }, [status, submitState.jobs])

  // ---- create ---------------------------------------------------------------------------------------------------------------
  const focusProblem = (keys) => {
    const first = PROBLEM_ORDER.find(key => keys.includes(key))
    if (!first) return
    if (fieldRefs[first]?.current) fieldRefs[first].current.focus()
    else if (first === 'payments') paymentsRef.current?.focus()
    // the first zone field that says what is wrong (the zone's own fields carry aria-invalid), else its first field
    else if (first.startsWith('zone')) (zoneRef.current?.querySelector('[aria-invalid="true"]') || zoneRef.current?.querySelector('input, select'))?.focus()
  }

  const handleCreate = async () => {
    if (busy) return
    setShowErrors(true)
    const result = await submit()
    if (result?.problems) focusProblem(Object.keys(result.problems))
    else if (!result?.ok && result?.error) {
      const slugError = result.error.some(message => /slug/i.test(String(message)))
      if (slugError) fieldRefs.slug.current?.focus()
    }
  }

  const apiErrorText = (() => {
    const error = submitState.error
    if (!error) return null
    if (error.network) return t('STORE_ADD_NETWORK_ERROR', 'The store could not be created: the connection failed. Try again; we check first that it was not created.')
    const fallback = t('STORE_ADD_CREATE_FAILED', 'The store could not be created.')
    const messages = (error.messages || []).map(message => translateApiMessage(t, message, null)).filter(Boolean)
    return messages.join(' ') || fallback
  })()
  const slugApiError = submitState.error?.messages?.find(message => /slug/i.test(String(message)))

  const configTypes = configs?.order_types_allowed?.value?.split('|').map(value => Number(value)) || []
  const deliveryAllowed = configTypes.includes(1)
  const disabled = !editable

  return (
    <div className='odc-sadd-page'>
      <PageHeader
        className='odc-sadd-head'
        title={t('ADD_NEW_STORE', 'Add new store')}
        onBack={goToStores}
        backLabel={t('STORES', 'Stores')}
        leading={isCollapse ? <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} /> : undefined}
      />

      {showOutcome && (
        <StoreAddOutcome
          ref={outcomeRef}
          business={submitState.business}
          jobs={submitState.jobs}
          paymethods={paymethodsList.paymethods}
          zone={zone}
          busy={busy}
          onRetry={retry}
          onContinue={() => {
            leaving.current = true
            if (onCreated) onCreated(submitState.business)
            else handleOpenCategory(submitState.business?.slug)
          }}
          onOpenStore={() => { leaving.current = true; history.push(`/stores/list?id=${submitState.business?.id}`) }}
        />
      )}

      <div className='odc-sadd-columns'>
        <form className='odc-sadd-form' noValidate onSubmit={event => { event.preventDefault(); handleCreate() }} aria-busy={busy || undefined}>
          <StoreAddGoogle
            initialPlaceId={placeId}
            getFields={getGoogleFields}
            values={{ ...form, schedule }}
            // the time zone the page put by itself and the all-day hours are not the user's: Google may replace them
            defaults={{ schedule: allDaySchedule(), ...(projectTimezone ? { timezone: projectTimezone } : {}) }}
            applied={googleApplied}
            onAppliedChange={setGoogleApplied}
            onChange={handleGoogleChange}
            photoRoles={['gallery', 'header', 'logo']}
            onPhotos={handleGooglePhotos}
            disabled={disabled}
          />

          <StoreAddDetails
            form={form}
            changeFields={changeFields}
            problems={{ ...problems, ...(slugApiError ? { slug: 'api' } : {}) }}
            showErrors={showErrors || !!slugApiError}
            disabled={disabled}
            fieldRefs={fieldRefs}
            slugApiErrorText={slugApiError ? translateApiMessage(t, slugApiError, null) : null}
          />

          <StoreAddLocation
            form={form}
            changeFields={changeFields}
            cities={cities}
            citiesLoading={citiesLoading}
            cityId={cityId}
            onCityChange={changeCity}
            apiKey={apiKey}
            addressVersion={addressVersion}
            disabled={disabled}
          />

          <section className='odc-sadd-group' aria-labelledby='odc-sadd-hours-title'>
            <h2 className='odc-sadd-group-title' id='odc-sadd-hours-title'>{t('STORE_ADD_OPENING_HOURS', 'Opening hours')}</h2>
            <ScheduleEditor
              key={scheduleKey}
              scheduleList={schedule}
              handleChangeScheduleState={changeSchedule}
              disableSchedule={disabled}
              labels={getScheduleLabels(t)}
            />
          </section>

          <StoreAddOrders
            paymethodsList={paymethodsList}
            paymethodIds={paymethodIds}
            onPaymethodsChange={changePaymethodIds}
            onRetryPaymethods={retryPaymethods}
            form={form}
            changeFields={changeFields}
            problems={problems}
            showErrors={showErrors}
            disabled={disabled}
            paymentsRef={paymentsRef}
            zoneSlot={(
              <div ref={zoneRef}>
                <StoreAddZone
                  zone={zone}
                  onZoneChange={changeZone}
                  problems={problems}
                  showErrors={showErrors}
                  disabled={disabled}
                  deliveryAllowed={deliveryAllowed}
                  apiKey={apiKey}
                  location={form.location}
                  currency={configs?.format_number_currency?.value?.trim() || ''}
                  // the project's unit as main sent it (none when unset); the zone says «km» on screen then
                  distanceUnit={configs?.distance_unit?.value}
                />
              </div>
            )}
          />

          <StoreAddImages
            form={form}
            changeFields={changeFields}
            gallery={gallery}
            onGalleryChange={changeGallery}
            disabled={disabled}
          />
        </form>

        <StoreAddSummary
          form={form}
          schedule={schedule}
          paymethods={paymethodsList.paymethods}
          paymethodIds={paymethodIds}
          zone={zone}
          gallery={gallery}
          cities={cities}
          cityId={cityId}
          problems={problems}
          showErrors={showErrors}
          status={status}
          errorText={apiErrorText}
          onCreate={handleCreate}
          onCancel={goToStores}
        />
      </div>

      <ConfirmDialog
        open={!!pendingLeave}
        tone='danger'
        title={busy ? t('STORE_ADD_LEAVE_BUSY_TITLE', 'The store is being created. Leave anyway?') : t('STORE_ADD_LEAVE_TITLE', 'Leave without creating the store?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={discardAndLeave}
        onCancel={() => setPendingLeave(null)}
      >
        {busy
          ? t('STORE_ADD_LEAVE_BUSY_TEXT', 'If you leave now you will not see whether every part of the store was saved.')
          : t('STORE_ADD_LEAVE_TEXT', 'What you filled in is not saved anywhere until you create the store.')}
      </ConfirmDialog>
    </div>
  )
}

export const BusinessAdd = ({ placeId, continueTutorial }) => {
  const history = useHistory()
  // set before any navigation the page starts itself (created, continue, open the store), so the leave guard lets it through
  const leaving = useRef(false)
  const handleOpenCategory = (slug) => {
    leaving.current = true
    history.push(`/stores/products/${slug}`)
  }
  // the list picks the tutorial up from this state (Stores/BusinessesListing)
  const handleContinueTutorial = (business) => {
    leaving.current = true
    history.push('/stores/list', { tutorialBusiness: business })
  }
  return (
    <BusinessAddController
      UIComponent={BusinessAddUI}
      placeId={placeId}
      leaving={leaving}
      handleOpenCategory={handleOpenCategory}
      onCreated={continueTutorial ? handleContinueTutorial : undefined}
    />
  )
}
