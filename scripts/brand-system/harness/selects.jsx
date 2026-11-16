import React, { useState } from 'react'
import styled, { useTheme } from 'styled-components'

import { getOrderingAction } from '../../../src/brand/adapter'
import { MultiSelect } from '../../../src/@/components-dashboard/src/ui/src/styles/MultiSelect'
import { Select as PopperSelect } from '../../../src/@/components-dashboard/src/ui/src/styles/Select'
import { Select as FirstSelect } from '../../../src/@/components-dashboard/src/ui/src/styles/Select/FirstSelect'
import { StandardField } from '../../../src/@/components-dashboard/src/ui/src/styles/StandardField'
import { Pagination, SearchBar } from './shared'
import { SearchContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SearchBar/styles'
import { PageButton as NumberedPageButton } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Pagination/styles'
import { PageButton as CompactPageButton } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/PaginationButton/styles'
// (O-7): the open lists need the --od-x-layer-* roles; loaded when the surface mounts (layer-roles.jsx)
import { withLayerRoles } from './layer-roles'

// BusinessOwnerSelector/styles.js is gone (the picker moved to Product). The FirstSelect
// styled-consumer checks keep their stand-in: the same wrapper and option rules, owned by the harness.
const BusinessOwnerSelectorWrapper = styled.div`
  & > .select {
    width: 100%;
    & > .list {
      width: 100%;
      & > .list-wrapper > div > div {
        text-overflow: ellipsis;
        overflow: hidden;
      }
    }
  }
`
const BusinessOwnerOption = styled.div`
  white-space: nowrap;
  font-size: var(--od-type-control-value-size);
`

const option = (value, label, extra = {}) => ({
  value,
  content: <span>{label}</span>,
  showOnSelected: <span>{label}</span>,
  ...extra
})

const baseOptions = [
  option('alpha', 'Alpha option'),
  option('beta', 'Beta option with an exceptionally long translated label'),
  option('disabled', 'Disabled option', { disabled: true }),
  option(null, 'Null option'),
  option('hidden', 'Hidden option', { showDisable: true })
]

const ownerOptions = baseOptions.map(item => ({ ...item, content: <BusinessOwnerOption>{item.content.props.children}</BusinessOwnerOption> }))

const editableOptions = [
  option('alpha', 'Alpha editable'),
  option('beta', 'Beta editable', { editFunctionality: true, deleteFunctionality: true }),
  option(null, 'Add option')
]

const textOption = (value, label) => ({ value, content: label, showOnSelected: label })
const textOptions = [
  textOption('alpha', 'Alpha'),
  textOption('beta', 'Beta'),
  textOption('gamma', 'Gamma'),
  textOption('delta', 'Delta')
]

const CustomSearchInput = React.forwardRef((props, ref) => <input data-testid='custom-search-input' ref={ref} {...props} />)
CustomSearchInput.displayName = 'CustomSearchInput'
const fixtureCellStyle = { minWidth: 0 }
const ForcedCustomSearch = styled(SearchContainer).attrs({ isCustomInput: true })``
const ForcedDefaultSearch = styled(SearchContainer).attrs({ isCustomInput: false })``
const fixtureFollowupStyle = { display: 'block', marginTop: 4 }
const standardFieldTheme = (baseTheme, alternate) => ({
  ...baseTheme,
  fonts: {
    ...baseTheme.fonts,
    primary: {
      name: alternate ? 'Standard Parent Two' : 'Standard Parent One',
      family: alternate ? '"Standard Parent Two", system-ui' : '"Standard Parent One", system-ui',
      local: true,
      weights: [400]
    }
  },
  ordering: {
    ...baseTheme.ordering,
    component: {
      ...baseTheme.ordering.component,
      density: {
        ...baseTheme.ordering.component.density,
        compactControlHeight: alternate ? '38px' : '36px',
        touchTargetMinimum: alternate ? '54px' : '52px'
      }
    }
  }
})

const SelectsFixtureBody = () => {
  const theme = useTheme()
  const firstPosition = new URLSearchParams(window.location.search).get('firstPosition') || undefined
  const [popperValue, setPopperValue] = useState('alpha')
  const [popperReceipt, setPopperReceipt] = useState(null)
  const [noSelectedReceipt, setNoSelectedReceipt] = useState(null)
  const [notAsyncValue, setNotAsyncValue] = useState('alpha')
  const [customCount, setCustomCount] = useState(0)
  const [popperSearch, setPopperSearch] = useState('')
  const [popperPage, setPopperPage] = useState(1)
  const [popperPageSize, setPopperPageSize] = useState(10)
  const [firstReceipt, setFirstReceipt] = useState(null)
  const [firstSubmits, setFirstSubmits] = useState(0)
  const [firstNoSelectedCalls, setFirstNoSelectedCalls] = useState(0)
  const [firstNoSelectedReceipt, setFirstNoSelectedReceipt] = useState(null)
  const [firstNotAsyncValue, setFirstNotAsyncValue] = useState('alpha')
  const [firstSearch, setFirstSearch] = useState('')
  const [firstPage, setFirstPage] = useState(1)
  const [editReceipt, setEditReceipt] = useState(null)
  const [deleteReceipt, setDeleteReceipt] = useState(null)
  const [multiReceipt, setMultiReceipt] = useState(null)
  const [multiValues, setMultiValues] = useState(['alpha'])
  const [multiSearch, setMultiSearch] = useState('')
  const [multiPage, setMultiPage] = useState(1)
  const [multiPageSize, setMultiPageSize] = useState(10)
  const [multiSubmits, setMultiSubmits] = useState(0)
  const [multiResets, setMultiResets] = useState(0)
  const [multiCalls, setMultiCalls] = useState([])
  const [stringLoadingResets, setStringLoadingResets] = useState(0)
  const [stringLoadingCalls, setStringLoadingCalls] = useState([])
  const [immediateSearch, setImmediateSearch] = useState('')
  const [searchSubmits, setSearchSubmits] = useState(0)
  const [searchFormData, setSearchFormData] = useState([])
  const [paginationProbeSubmits, setPaginationProbeSubmits] = useState(0)
  const [lazySearch, setLazySearch] = useState('')
  const [customSearch, setCustomSearch] = useState('')
  const [page, setPage] = useState(5)
  const [pageReceipt, setPageReceipt] = useState(null)
  const [pageSize, setPageSize] = useState(10)
  const [alternateStandardTheme, setAlternateStandardTheme] = useState(false)
  const parentStandardTheme = standardFieldTheme(theme, alternateStandardTheme)

  return (
    <main data-testid='selects-fixture' style={{ boxSizing: 'border-box', display: 'grid', gap: 20, maxWidth: 1000, minWidth: 0, padding: 24, width: '100%' }}>
      <output data-testid='resolved-action'>{getOrderingAction(theme)}</output>

      <section aria-label='Popper selects' style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', minWidth: 0 }}>
        <div data-testid='popper-main' style={fixtureCellStyle}>
          <PopperSelect
            className='fixture-popper-main'
            defaultValue={popperValue}
            options={baseOptions}
            onChange={value => { setPopperReceipt(value); setPopperValue(value) }}
            isSecondIcon
            isShowSearchBar
            searchValue={popperSearch}
            handleChangeSearch={setPopperSearch}
            searchBarPlaceholder='Search Popper options'
            isShowCustomOption
            customOptionTitle='Create custom option'
            handleCustomOptionClick={() => setCustomCount(value => value + 1)}
            pagination={{ currentPage: popperPage, pageSize: popperPageSize, totalPages: 3 }}
            handleChangePage={setPopperPage}
            handleChangePageSize={setPopperPageSize}
            optionInnerMaxHeight='180px'
          />
        </div>
        <div data-testid='popper-no-selected' style={fixtureCellStyle}>
          <PopperSelect defaultValue='alpha' options={baseOptions} noSelected onChange={setNoSelectedReceipt} />
        </div>
        <div data-testid='popper-not-async' style={fixtureCellStyle}>
          <PopperSelect defaultValue={notAsyncValue} options={baseOptions} notAsync onChange={setPopperReceipt} />
          <button type='button' style={fixtureFollowupStyle} onClick={() => setNotAsyncValue('beta')}>Change Popper prop</button>
        </div>
        <div data-testid='popper-local' style={fixtureCellStyle}><PopperSelect placeholder='Local pagination' options={textOptions} pagination={{ currentPage: 1, pageSize: 2, totalPages: 2 }} handleChangePage={setPopperPage} handleChangePageSize={setPopperPageSize} /></div>
        <div data-testid='popper-lazy' style={fixtureCellStyle}><PopperSelect placeholder='Lazy pagination' options={textOptions} pagination={{ currentPage: 1, pageSize: 2, totalPages: 2 }} handleChangePage={setPopperPage} handleChangePageSize={setPopperPageSize} useLazyPagination /></div>
      </section>

      <section aria-label='First selects' style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', minWidth: 0 }}>
        <form data-testid='first-main' style={fixtureCellStyle} onSubmit={event => { event.preventDefault(); setFirstSubmits(value => value + 1) }}>
          <FirstSelect
            className='fixture-first-main'
            type='primary'
            defaultValue='alpha'
            options={editableOptions}
            onChange={setFirstReceipt}
            onEdit={(value, index) => setEditReceipt(`${value.value}:${index}`)}
            onDelete={setDeleteReceipt}
            isShowSearchBar
            searchValue={firstSearch}
            handleChangeSearch={setFirstSearch}
            searchBarPlaceholder='Search First options'
            pagination={{ currentPage: firstPage, pageSize: 2, totalPages: 3 }}
            handleChangePage={setFirstPage}
            optionInnerMaxHeight='180px'
            optionBottomBorder
          />
        </form>
        <div data-testid='first-disabled' style={fixtureCellStyle}>
          <FirstSelect placeholder='Disabled First select' options={baseOptions} isDisabled />
        </div>
        <div data-testid='first-loading' style={fixtureCellStyle}>
          <FirstSelect placeholder='Loading First select' options={baseOptions} isLoading pagination={{ currentPage: 1, pageSize: 3, totalPages: 1 }} />
        </div>
        <div data-testid='first-no-selected' style={fixtureCellStyle}><FirstSelect defaultValue='alpha' options={baseOptions} position={firstPosition} noSelected onChange={value => { setFirstNoSelectedReceipt(value); setFirstNoSelectedCalls(count => count + 1) }} /></div>
        <div data-testid='first-not-async' style={fixtureCellStyle}>
          <FirstSelect defaultValue={firstNotAsyncValue} options={baseOptions} notAsync onChange={setFirstReceipt} />
          <button type='button' style={fixtureFollowupStyle} onClick={() => setFirstNotAsyncValue('beta')}>Change First prop</button>
        </div>
      </section>

      <section aria-label='FirstSelect styled consumer' style={{ maxWidth: 300 }}>
        <BusinessOwnerSelectorWrapper data-testid='first-owner-styles'>
          <FirstSelect placeholder='Owner contract' options={ownerOptions} position='left' />
        </BusinessOwnerSelectorWrapper>
      </section>

      <section aria-label='Multi selects' style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', minWidth: 0 }}>
        <form data-testid='multi-form' style={fixtureCellStyle} onReset={() => setMultiResets(count => count + 1)} onSubmit={event => { event.preventDefault(); setMultiSubmits(value => value + 1) }}>
          <div data-testid='multi-main'>
            <MultiSelect
              className='fixture-multi-main'
              placeholder='Choose multiple values'
              options={[option('default', 'All values'), ...baseOptions]}
              defaultValue={multiValues}
              onChange={value => {
                setMultiReceipt(value)
                setMultiCalls(current => [...current, value])
                setMultiValues(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])
              }}
              isShowSearchBar
              searchValue={multiSearch}
              handleChangeSearch={setMultiSearch}
              searchBarPlaceholder='Search Multi options'
              pagination={{ currentPage: multiPage, pageSize: multiPageSize, totalPages: 3 }}
              handleChangePage={setMultiPage}
              handleChangePageSize={setMultiPageSize}
              optionInnerMaxHeight='180px'
              optionInnerMargin='2px'
              optionBottomBorder
              isFullWidthOptions
              dropdownMinWidth='100%'
            />
          </div>
          <input aria-label='Multi reset witness' defaultValue='seed' />
          <button type='submit'>Submit Multi form</button>
        </form>
        <div data-testid='multi-text' style={fixtureCellStyle}>
          <MultiSelect options={textOptions} defaultValue={['alpha', 'beta', 'gamma', 'delta']} useTextStyle andText='plus' hideChevronIcon />
        </div>
        <div data-testid='multi-loading' style={fixtureCellStyle}><MultiSelect placeholder='Loading Multi' options={textOptions} defaultValue={[]} isLoading /></div>
        <form data-testid='multi-string-loading' style={fixtureCellStyle} onReset={() => setStringLoadingResets(count => count + 1)}>
          <MultiSelect options={[option('default', 'Loading sentinel')]} defaultValue='default' isLoading dropdownMinWidth='100%' onChange={value => setStringLoadingCalls(current => [...current, value])} />
          <input aria-label='String loading reset witness' defaultValue='seed' />
        </form>
      </section>

      <section aria-label='Direct search bars' style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', minWidth: 0 }}>
        <form data-testid='search-immediate' onSubmit={event => {
          event.preventDefault()
          setSearchSubmits(value => value + 1)
          setSearchFormData([...new FormData(event.currentTarget).entries()])
        }}><SearchBar search={immediateSearch} onSearch={setImmediateSearch} placeholder='Immediate search' customClass='fixture-search-immediate' /></form>
        <div data-testid='search-lazy'><SearchBar search={lazySearch} onSearch={setLazySearch} placeholder='Lazy search' lazyLoad customClass='fixture-search-lazy' /></div>
        <div data-testid='search-custom'><SearchBar search={customSearch} onSearch={setCustomSearch} placeholder='Custom search' CustomInput={CustomSearchInput} hideSearchIcon /></div>
        <ForcedCustomSearch isCustomInput={false}><input aria-label='Final custom search style' /></ForcedCustomSearch>
        <ForcedDefaultSearch isCustomInput><input aria-label='Final default search style' /></ForcedDefaultSearch>
      </section>

      <section aria-label='Pagination fixture' data-testid='pagination-main'>
        <Pagination currentPage={page} totalPages={10} handleChangePage={value => { setPageReceipt(value); setPage(value) }} defaultPageSize={pageSize} handleChangePageSize={setPageSize} />
      </section>
      <section aria-label='Hidden page size fixture' data-testid='pagination-hidden'><Pagination currentPage={1} totalPages={3} handleChangePage={setPageReceipt} isHidePagecontrol /></section>

      <section aria-label='Standard fields' style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', minWidth: 0 }}>
        <StandardField data-testid='standard-popper'><PopperSelect placeholder='Standard Popper' options={baseOptions} /></StandardField>
        <StandardField data-testid='standard-first'><FirstSelect placeholder='Standard First' options={baseOptions} /></StandardField>
        <StandardField data-testid='standard-multi'><MultiSelect placeholder='Standard Multi' options={baseOptions} defaultValue={[]} /></StandardField>
      </section>

      <section aria-label='Standard field theme boundary' style={{ minWidth: 0 }}>
        <StandardField data-testid='standard-themed' theme={parentStandardTheme}>
          <FirstSelect placeholder='Themed Standard First' options={baseOptions} />
        </StandardField>
        <button type='button' data-testid='standard-theme-toggle' onClick={() => setAlternateStandardTheme(value => !value)}>Toggle Standard field theme</button>
        <output data-testid='standard-theme-name'>{alternateStandardTheme ? 'two' : 'one'}</output>
      </section>

      <section aria-label='Standard field scope negatives' data-testid='standard-scope-negatives'>
        <StandardField>
          <div className='select-input' data-testid='standard-similar-select'><div data-testid='standard-similar-select-child' /></div>
          <div className='multi-select-extra' data-testid='standard-similar-multi'><div data-testid='standard-similar-multi-child' /></div>
        </StandardField>
        <div className='select' data-testid='standard-outside-select'><div data-testid='standard-outside-select-child' /></div>
        <div className='multi-select' data-testid='standard-outside-multi'><div data-testid='standard-outside-multi-child' /></div>
      </section>

      <output data-testid='popper-receipt'>{String(popperReceipt)}</output>
      <output data-testid='no-selected-receipt'>{String(noSelectedReceipt)}</output>
      <output data-testid='custom-count'>{customCount}</output>
      <output data-testid='popper-search'>{popperSearch}</output>
      <output data-testid='popper-page'>{popperPage}</output>
      <output data-testid='popper-page-size'>{popperPageSize}</output>
      <output data-testid='first-submits'>{firstSubmits}</output>
      <output data-testid='first-no-selected-calls'>{firstNoSelectedCalls}</output>
      <output data-testid='first-receipt'>{String(firstReceipt)}</output>
      <output data-testid='first-no-selected-receipt'>{String(firstNoSelectedReceipt)}</output>
      <output data-testid='first-search'>{firstSearch}</output>
      <output data-testid='first-page'>{firstPage}</output>
      <output data-testid='edit-receipt'>{String(editReceipt)}</output>
      <output data-testid='delete-receipt'>{String(deleteReceipt)}</output>
      <output data-testid='multi-receipt'>{String(multiReceipt)}</output>
      <output data-testid='multi-search'>{multiSearch}</output>
      <output data-testid='multi-page'>{multiPage}</output>
      <output data-testid='multi-page-size'>{multiPageSize}</output>
      <output data-testid='string-loading-resets'>{stringLoadingResets}</output>
      <output data-testid='string-loading-calls'>{JSON.stringify(stringLoadingCalls)}</output>
      <output data-testid='multi-resets'>{multiResets}</output>
      <output data-testid='multi-calls'>{JSON.stringify(multiCalls)}</output>
      <output data-testid='multi-submits'>{multiSubmits}</output>
      <form aria-label='Pagination native contracts' onSubmit={event => { event.preventDefault(); setPaginationProbeSubmits(value => value + 1) }}>
        <NumberedPageButton as='a' href='#pagination-probe' data-testid='pager-numbered-as'>N</NumberedPageButton>
        <NumberedPageButton forwardedAs='a' data-testid='pager-numbered-forwarded'>N</NumberedPageButton>
        <CompactPageButton as='a' href='#pagination-probe' data-testid='pager-compact-as'>C</CompactPageButton>
        <CompactPageButton forwardedAs='a' ref={element => { window.__paginationButtonRef = element }} data-testid='pager-compact-forwarded'>C</CompactPageButton>
      </form>
      <output data-testid='pagination-probe-submits'>{paginationProbeSubmits}</output>
      <output data-testid='immediate-search'>{immediateSearch}</output>
      <output data-testid='search-submits'>{searchSubmits}</output>
      <output data-testid='search-form-data'>{JSON.stringify(searchFormData)}</output>
      <output data-testid='lazy-search'>{lazySearch}</output>
      <output data-testid='custom-search'>{customSearch}</output>
      <output data-testid='page-receipt'>{String(pageReceipt)}</output>
      <output data-testid='page-size'>{pageSize}</output>
    </main>
  )
}

export const SelectsFixture = withLayerRoles(SelectsFixtureBody)
