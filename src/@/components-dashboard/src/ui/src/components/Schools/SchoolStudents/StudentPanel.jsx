import React, { useEffect, useId, useRef, useState } from 'react'

import { useApi, useLanguage, useSession, useToast, ToastType } from '../../../../../index'
import { getStudent, attachParent, detachParent } from '../../../../../components/Schools/schoolApi'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Maximize2, Minimize2 } from '../../Shared/Icon'
import { Button, Field, IconButton, RecordPanel, Skeleton, useSplitView } from '../../Shared/Product'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { SchoolChips } from '../SchoolChips'
import { SchoolListError } from '../SchoolListError'
import { personName } from '../schoolDisplay'
import './students.css'

// redesign SC-B3 (decision 1A; M-SC12, M-SC15): the panel of a student, a RecordPanel inside the tab's SplitView. It loads the student
// itself and holds the guardians' work (assign and remove). The tab mounts it with `key` = the student, so opening another student starts
// with an empty search and no customer chosen (M-SC12).
//
// @param {object}   props.student            The row of the list (name, lastname, code): it names the panel while the student loads.
// @param {Function} props.onClose            `() => void`
// @param {boolean}  [props.expanded]         «Open as page».
// @param {Function} [props.onExpandedChange] `(next: boolean) => void`; without it there is no expand button.

const CUSTOMERS_PAGE_SIZE = 10 // as main
const CUSTOMER_SEARCH_PAUSE = 750 // main: the search box of the list told after 750 ms of no typing

// C18 (the anatomy of every dropdown of the redesigned pages): the list starts at the trigger and is as wide as it
const FIT_TRIGGER = { fitTrigger: true }

const apiText = (result) => {
  const message = Array.isArray(result) ? result[0] : result
  return typeof message === 'string' && message.trim() ? message : null
}

// the API wrappers of K/schoolApi never throw, but a double (or a future change) might: a failure is always an answer
const settle = async (call) => {
  try {
    return await call()
  } catch (error) {
    return { error: true, result: [error?.message] }
  }
}

const BodySkeleton = ({ label }) => (
  <div className='odc-school-student-skeleton' role='status' aria-busy='true' aria-label={label}>
    <Skeleton size='40%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton size='60%' />
    <Skeleton block='var(--od-x-control-height)' />
    <Skeleton block='var(--od-x-control-height)' />
  </div>
)

export const StudentPanel = ({ student, onClose, expanded = false, onExpandedChange }) => {
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const split = useSplitView()
  const phone = split.mode === 'full'
  const ids = useId()

  const [detail, setDetail] = useState(null)
  const [load, setLoad] = useState({ loading: true, failed: false, message: null })
  const detailRequest = useRef(0)
  const hasDetail = useRef(false)
  const mounted = useRef(true)

  const [customers, setCustomers] = useState([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDraft, setCustomerDraft] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerPaging, setCustomerPaging] = useState({ currentPage: 1, totalPages: 1, pageSize: CUSTOMERS_PAGE_SIZE })
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const customerRequest = useRef(0)
  const searchRef = useRef('')
  const searchTimer = useRef(null)

  const failureText = (result) => translateApiMessage(t, apiText(result), t('SOMETHING_WENT_WRONG_TRY_AGAIN', 'Something went wrong. Try again.'))

  // ---- the student ----
  const fetchDetail = async () => {
    const mine = ++detailRequest.current
    const refreshing = hasDetail.current
    if (!refreshing) setLoad({ loading: true, failed: false, message: null })
    const answer = await settle(() => getStudent(ordering, token, student.id))
    if (mine !== detailRequest.current || !mounted.current) return
    if (answer.error) {
      // redesign SC-B3 (M-SC15): a first load that fails is the panel's error with «Retry» (and no guardian tools); a refresh that fails
      // keeps what was on screen and says so (main's refreshDetail swallowed it)
      if (refreshing) showToast(ToastType.Error, failureText(answer.result))
      else setLoad({ loading: false, failed: true, message: apiText(answer.result) })
      return
    }
    hasDetail.current = true
    setDetail(answer.result)
    setLoad({ loading: false, failed: false, message: null })
  }

  // ---- the customers of the picker (level 3), as main ----
  const loadCustomers = async (page = 1, search = '') => {
    const mine = ++customerRequest.current
    setLoadingCustomers(true)
    const conditions = [{ attribute: 'level', value: 3 }]
    if (search) conditions.push({ attribute: 'name', value: { condition: 'ilike', value: `%${search}%` } })
    try {
      const { content } = await ordering.users().asDashboard()
        .select(['id', 'name', 'lastname', 'email'])
        .where({ conditions, conector: 'AND' })
        .get({ query: { page, page_size: CUSTOMERS_PAGE_SIZE } })
      if (mine !== customerRequest.current || !mounted.current) return
      setCustomers(content?.result || [])
      setCustomerPaging({
        currentPage: content?.pagination?.current_page || page,
        totalPages: content?.pagination?.total_pages || 1,
        pageSize: CUSTOMERS_PAGE_SIZE
      })
    } catch (err) {
      if (mine === customerRequest.current && mounted.current) setCustomers([])
    } finally {
      if (mine === customerRequest.current && mounted.current) setLoadingCustomers(false)
    }
  }

  // redesign SC-B3: a text is asked once; the same text again asks nothing
  const handleCustomerSearch = (value) => {
    const text = value || ''
    if (text === searchRef.current) return
    searchRef.current = text
    setCustomerSearch(text)
    loadCustomers(1, text)
  }

  // X-SC1: the search box of a C18 list tells on every key (main's waited 750 ms for a pause). The box shows what is typed (`customerDraft`);
  // the API is asked once, when the person pauses; emptying the box asks at once.
  const handleCustomerType = (value) => {
    const text = value || ''
    setCustomerDraft(text)
    clearTimeout(searchTimer.current)
    if (text === '') handleCustomerSearch('')
    else searchTimer.current = setTimeout(() => handleCustomerSearch(text), CUSTOMER_SEARCH_PAUSE)
  }

  useEffect(() => {
    mounted.current = true
    fetchDetail()
    loadCustomers(1, '')
    return () => {
      mounted.current = false
      clearTimeout(searchTimer.current)
    }
  }, [])

  // ---- the guardians ----
  const handleAttach = async () => {
    if (!selectedCustomerId) {
      showToast(ToastType.Error, t('SCHOOL_SELECT_CUSTOMER', 'Select a customer'))
      return
    }
    setSaving(true)
    const answer = await settle(() => attachParent(ordering, token, student.id, { user_id: selectedCustomerId }))
    if (!mounted.current) return
    setSaving(false)
    if (answer.error) {
      showToast(ToastType.Error, failureText(answer.result))
      return
    }
    showToast(ToastType.Success, t('SCHOOL_PARENT_ASSIGNED', 'Parent assigned'))
    setSelectedCustomerId(null)
    handleCustomerType('')
    fetchDetail()
  }

  // redesign SC-B3: no confirmation (the owner's decision, P-2)
  const handleDetach = async (userId) => {
    setRemovingId(userId)
    const answer = await settle(() => detachParent(ordering, token, student.id, userId))
    if (!mounted.current) return
    setRemovingId(null)
    if (answer.error) {
      showToast(ToastType.Error, failureText(answer.result))
      return
    }
    showToast(ToastType.Success, t('SCHOOL_PARENT_REMOVED', 'Parent removed'))
    fetchDetail()
  }

  // ---- what is shown ----
  const shown = detail ?? student
  const name = personName(shown) || t('SCHOOL_STUDENT', 'Student')
  const dash = '—'

  const customerOptions = customers.map((user) => ({
    value: user.id,
    content: `${personName(user)}${user.email ? ` · ${user.email}` : ''}`.trim()
  }))

  const expandAction = !phone && onExpandedChange && (
    <IconButton
      icon={expanded ? Minimize2 : Maximize2}
      label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
      onClick={() => onExpandedChange(!expanded)}
    />
  )

  let body
  if (load.failed && !detail) {
    body = <SchoolListError message={load.message} onRetry={fetchDetail} />
  } else if (!detail) {
    body = <BodySkeleton label={t('LOADING', 'Loading')} />
  } else {
    const guardians = detail.parents || []
    const titleId = (part) => `${ids}-${part}`
    body = (
      <div className='odc-school-student-body'>
        <section className='odc-school-student-section' aria-labelledby={titleId('class')}>
          <h3 id={titleId('class')} className='odc-school-student-section-title'>{t('SCHOOL_CLASS', 'Class')}</h3>
          <dl className='odc-school-student-facts'>
            <div className='odc-school-student-fact'>
              <dt>{t('SCHOOL_CLASSROOM', 'Classroom')}</dt>
              <dd>{detail.classroom?.name || dash}</dd>
            </div>
            <div className='odc-school-student-fact'>
              <dt>{t('SCHOOL_GRADE', 'Grade')}</dt>
              <dd>{detail.grade?.name || dash}</dd>
            </div>
          </dl>
        </section>

        <section className='odc-school-student-section' aria-labelledby={titleId('diet')}>
          <h3 id={titleId('diet')} className='odc-school-student-section-title'>{t('SCHOOL_DIET', 'Diet')}</h3>
          <dl className='odc-school-student-facts'>
            <div className='odc-school-student-fact'>
              <dt>{t('SCHOOL_ALLERGIES', 'Allergies')}</dt>
              <dd>
                <SchoolChips kind='allergen' values={detail.allergies} emptyLabel={dash} label={t('SCHOOL_ALLERGIES', 'Allergies')} />
              </dd>
            </div>
            <div className='odc-school-student-fact'>
              <dt>{t('SCHOOL_DIETARY_TAGS', 'Dietary tags')}</dt>
              <dd>
                <SchoolChips kind='dietary' values={detail.dietary_tags} emptyLabel={dash} label={t('SCHOOL_DIETARY_TAGS', 'Dietary tags')} />
              </dd>
            </div>
          </dl>
        </section>

        <section className='odc-school-student-section' aria-labelledby={titleId('guardians')}>
          <h3 id={titleId('guardians')} className='odc-school-student-section-title'>{t('SCHOOL_GUARDIANS', 'Guardians')}</h3>
          {guardians.length === 0
            ? <span className='odc-school-student-muted'>{dash}</span>
            : (
              <ul className='odc-school-student-guardians'>
                {guardians.map((parent) => (
                  <li key={parent.id} className='odc-school-student-guardian'>
                    <span className='odc-school-student-guardian-name' dir='auto'>
                      {personName(parent)}
                      {parent.email && <>{' · '}<bdi dir='ltr' className='odc-school-student-muted'>{parent.email}</bdi></>}
                    </span>
                    <Button
                      size='sm'
                      busy={removingId === parent.id}
                      aria-label={t('SCHOOL_REMOVE_GUARDIAN_NAMED', 'Remove _name_ as guardian').replace('_name_', () => personName(parent))}
                      onClick={() => handleDetach(parent.id)}
                    >
                      {t('REMOVE', 'Remove')}
                    </Button>
                  </li>
                ))}
              </ul>
              )}
          <div className='odc-school-student-assign'>
            <Field label={t('SCHOOL_ASSIGN_PARENT', 'Assign parent')}>
              {/* X-SC1, X-SC2: a C18 select like the others of the page. It is named by its own words, not by the Field label:
                  «Assign parent» is the button beside it. */}
              <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
                <FirstSelect
                  ariaLabel={t('SCHOOL_GUARDIAN_TO_ASSIGN', 'Guardian to assign')}
                  defaultValue={selectedCustomerId}
                  options={customerOptions}
                  placeholder={t('SCHOOL_SELECT_CUSTOMER', 'Select a customer')}
                  isShowSearchBar
                  searchValue={customerDraft}
                  handleChangeSearch={handleCustomerType}
                  isLoading={loadingCustomers}
                  pagination={customerPaging}
                  handleChangePage={(page) => loadCustomers(page, customerSearch)}
                  onChange={(value) => setSelectedCustomerId(value)}
                />
              </SelectSurfaceContext.Provider>
            </Field>
            <Button variant='primary' busy={saving} onClick={handleAttach}>
              {t('SCHOOL_ASSIGN_PARENT', 'Assign parent')}
            </Button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <RecordPanel
      title={name}
      subtitle={shown.code ? <bdi dir='ltr' className='odc-figure'>{shown.code}</bdi> : undefined}
      closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
      onClose={onClose}
      headerActions={expandAction || undefined}
    >
      {body}
    </RecordPanel>
  )
}
