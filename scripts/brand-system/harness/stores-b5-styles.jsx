import React, { useId, useState } from 'react'

import {
  Accordion as TreeNodeAccordion,
  AccordionContent as TreeNodeAccordionContent,
  AccordionItem as TreeNodeAccordionItem,
  AccordionToggle as TreeNodeAccordionToggle,
  CheckboxWrapper as TreeNodeCheckboxWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessMenuCategoryTreeNode/styles'
import {
  Header as CustomFieldsHeader,
  MetaTitle as CustomFieldsMetaTitle,
  MetaContainer as CustomFieldsMetaContainer,
  MetaAddContainer as CustomFieldsMetaAddContainer,
  RoundBorder as CustomFieldsRoundBorder,
  NoMetaField as CustomFieldsNoMetaField
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessMenuCustomFields/styles'
import {
  FormInput as AddFormFormInput,
  Option as AddFormOption,
  SelectWrapper as AddFormSelectWrapper,
  UploadImageIcon as AddFormUploadImageIcon,
  InputWrapper as AddFormInputWrapper,
  SkipButton as AddFormSkipButton,
  TimeBlock as AddFormTimeBlock
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessProductAddForm/styles'
import {
  BusinessProductListTable as ProductListTable,
  WrapperNotFound as ProductListWrapperNotFound
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessProductList/styles'
import {
  HeaderContainer as CategoriesHeaderContainer,
  CategoryEnableWrapper as CategoriesCategoryEnableWrapper,
  SelectedCategoriesWrapper as CategoriesSelectedCategoriesWrapper,
  SearchWrapper as CategoriesSearchWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessProductsCategories/styles'
import {
  BusinessEnableWrapper as CatDetailsBusinessEnableWrapper,
  CategoryNameWrapper as CatDetailsCategoryNameWrapper,
  ParentCategorySelectWrapper as CatDetailsParentCategorySelectWrapper,
  Option as CatDetailsOption,
  ActionSelectorWrapper as CatDetailsActionSelectorWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessProductsCategoyDetails/styles'
import {
  BusinessEnableWrapper as CatInfoBusinessEnableWrapper,
  CategoryNameWrapper as CatInfoCategoryNameWrapper,
  ParentCategorySelectWrapper as CatInfoParentCategorySelectWrapper,
  Option as CatInfoOption,
  ActionSelectorWrapper as CatInfoActionSelectorWrapper,
  InfoConatiner as CatInfoInfoConatiner,
  SkipButton as CatInfoSkipButton,
  SwitchWrapper as CatInfoSwitchWrapper,
  ColorWrapper as CatInfoColorWrapper,
  ShapeWrapper as CatInfoShapeWrapper,
  ShapeBoxWrapper as CatInfoShapeBoxWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessProductsCategoyInfo/styles'
import {
  ProductHeader as ListingProductHeader,
  ViewMethodButton as ListingViewMethodButton,
  BusinessNameWrapper as ListingBusinessNameWrapper,
  Breadcrumb as ListingBreadcrumb
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessProductsListing/styles'
import {
  DetailsContainer as SharedDetailsContainer,
  InputWrapper as SharedDetailsInputWrapper,
  SwitchWrapper as SharedDetailsSwitchWrapper,
  SearchbarWrapper as SharedDetailsSearchbarWrapper,
  ProductExtraWrapper as SharedDetailsProductExtraWrapper,
  ProductOptionWrapper as SharedDetailsProductOptionWrapper,
  ProductSuboptionWrapper as SharedDetailsProductSuboptionWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessSharedMenuProductDetails/styles'
import {
  ProductItem as SharedProductsItem
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessSharedMenuProducts/styles'

// Presentation-only fixture: the real Stores menu / products / categories
// styled surfaces for batch b5-business-menu, no controller, SDK, account or
// network. Every interactive node here is mounted exactly as it exists in
// today's source: a styled `div`/`span` with `onClick` stays that element
// (never promoted to `<button>`, never given invented `type='button'` or
// `aria-pressed` attributes) — the coordinator converts these and aligns the
// fixture itself, per this batch's explicit instruction.
// `Stores/BusinessMenuShare/styles.js` declares no font-size and is out of
// this batch's mount list.
//
// BusinessMenuChannels/styles.js and BusinessMenuOptions/styles.js were deleted as dead code; channels-*, menu-options-* rows (ROLE_SIZES 51 -> 47, glyphs 12 -> 10) went with them.
// BusinessMenu/styles.js was deleted as dead code; menu-tab row (ROLE_SIZES 47 -> 46) went with it.
//
// Ten source `styles.js` files are mounted below, 60 font-size
// declarations total. Several export names collide across these files
// (`Option` ×3, `SkipButton` ×2, `InputWrapper` ×2, `SwitchWrapper` ×2,
// `ActionSelectorWrapper` ×2, `MetaTitle`, `RoundBorder`, `ShapeWrapper`,
// `ColorWrapper`), so every import is aliased at the import site, e.g.
// `Header as CustomFieldsHeader`.
//
// Real-nesting adaptations and dead-CSS notes (checked against each source
// styles.js and its consuming index.js before mounting):
// - BusinessMenuCategoryTreeNode/styles.js's `AccordionItem` rule is
//   `> div { span { font-size: 14px } } }`: index.js renders
//   `<AccordionItem><div><CheckboxWrapper>…</CheckboxWrapper>
//   <span>{category.name}</span></div>…</AccordionItem>`, the wrapping
//   `div` a direct child and the `span` its child (a genuine descendant of
//   `AccordionItem`, matching the real combinator), mounted the same way.
// - BusinessMenuCategoryTreeNode/styles.js's `CheckboxWrapper`
//   (`svg { font-size: 18px }`) is rendered in index.js as
//   `<CheckboxWrapper as='button' type='button' role='checkbox'
//   aria-checked aria-label onClick={…}>` for the category (tri-state,
//   `mixed` here) and for each product, mounted the same way with its
//   `aria-hidden` status icon as a genuine direct child.
// - BusinessMenuCustomFields/styles.js's `Header` rule is `> svg {
//   display: none; @media (min-width: 1000px) { display: block; font-size:
//   24px } }` (a direct-child combinator): index.js's only `<Header>` usage
//   wraps just `<MetaTitle>…</MetaTitle>`, no `svg` anywhere — DEAD in this
//   component. Mounted here literally with a direct-child `svg` for
//   declaration verification only.
// - BusinessMenuCustomFields/styles.js's `MetaContainer` carries
//   `.meta_type { font-size: 14px }` and `.meta_value { … svg { font-size:
//   20px; … } }` (the `svg` rule is a bare descendant selector in the
//   source CSS, but index.js renders the icon
//   (`<BsTrash onClick={…}/>`) as a genuine direct child of
//   `<div className='meta_value'>`, alongside `<RoundBorder>…</RoundBorder>`
//   — real markup: `<MetaContainer><div className='meta_type'>…</div>
//   <div className='meta_key'><RoundBorder>…</RoundBorder></div>
//   <div className='meta_value'><RoundBorder>…</RoundBorder><BsTrash/>
//   </div></MetaContainer>`, mounted with that exact shape, one
//   representative instance covering `meta_type`, the nested `RoundBorder`
//   and the `meta_value` icon in one mount.
// - BusinessMenuCustomFields/styles.js's `MetaAddContainer` is
//   `styled(MetaContainer)` and adds `input { font-size: 16px }`, a bare
//   descendant rule matching any input inside it; index.js renders a real
//   `<input id='meta_value' … />` as a direct child of
//   `<div className='meta_value'>`, mounted the same way.
// - BusinessMenuCustomFields/styles.js's `RoundBorder` and `NoMetaField`
//   declare font-size on themselves; `NoMetaField` is the empty-state
//   sibling rendered instead of the `MetaContainer` list, mounted as a
//   standalone leaf with its real text.
// - BusinessProductAddForm/styles.js's `FormInput` rule is `> h1 {
//   font-size: 20px; … }` (direct-child combinator): index.js renders the
//   h1 as a direct child (alongside `ProductImage`), mounted the same way.
// - BusinessProductAddForm/styles.js's `Option` declares font-size on
//   itself; index.js uses it as inline `content` for select options
//   (`content: <Option>{t('ITEM', 'Item')}</Option>`), mounted as a leaf
//   with representative text.
// - BusinessProductAddForm/styles.js's `SelectWrapper` declares
//   `label { font-size: 14px }` (bare descendant) and `> div { > div:first-
//   child { font-size: 14px; … } … }` (direct-child chain). index.js
//   renders `<SelectWrapper><label>…</label><Select className='select'
//   …/></SelectWrapper>`; `Select` resolves to `Shared/UI/FirstSelect.jsx`,
//   whose root renders `className={classNames('od-ui',
//   'od-first-select-root', className || 'select')}` (here `className=
//   'select'` is passed explicitly) as the sole child of `SelectWrapper`,
//   and whose trigger (`className='od-first-select-trigger'`) is that
//   root's first (and, absent open content, only) child — a genuine
//   `:first-child`. Mounted as `<SelectWrapper><label>…</label>
//   <div className='select'><div>…</div></div></SelectWrapper>`, matching
//   that live shape (not the dead `select-wrapper` shape).
// - BusinessProductAddForm/styles.js's `UploadImageIcon` rule is a bare
//   descendant `span { font-size: 14px }`: index.js renders
//   `<UploadImageIcon><BiImage/><span>…</span></UploadImageIcon>`, the span
//   a genuine direct child, mounted the same way.
// - BusinessProductAddForm/styles.js's `InputWrapper` rule is a bare
//   descendant `label { font-size: 14px }`: index.js renders the label as a
//   direct child (alongside `Input`), mounted the same way.
// - BusinessProductAddForm/styles.js's `SkipButton` declares font-size on
//   itself; it is a `styled.div` with a real `onClick` in index.js
//   (`<SkipButton onClick={() => handleTutorialSkip()}>{t('TUTORIAL_SKIP',
//   'Skip')}</SkipButton>`), kept as a plain `div`, unconverted.
// - BusinessProductAddForm/styles.js's `TimeBlock` rule is a direct-child
//   `> select { font-size: 14px; … }`: index.js renders
//   `<TimeBlock><select>…</select><span>:</span><select>…</select>
//   </TimeBlock>`, the first `<select>` a genuine direct child, mounted the
//   same way with one representative `<select>`.
// - BusinessProductList/styles.js's `BusinessProductListTable` carries a
//   bare `th { font-size: 12px; font-weight: 700 }` (not scoped under
//   `thead`, but the only `<th>`s in the real markup live in
//   `<thead><tr><th>…</th>…</tr></thead>`), mounted with that same
//   `table > thead > tr > th` nesting, one representative `th`.
// - BusinessProductList/styles.js's `WrapperNotFound` declares font-size on
//   itself; mounted as a standalone leaf with its real text.
// - BusinessProductsCategories/styles.js's `HeaderContainer` rule is a bare
//   descendant `h1 { font-size: 14px; … }`: index.js renders the h1 as a
//   direct child, mounted the same way.
// - BusinessProductsCategories/styles.js's `CategoryEnableWrapper`
//   (`span { font-size: 14px; …; font-size: 12px; … }` — two physical
//   `font-size` declarations on the same `span` rule; the second wins the
//   cascade, 12px) is DEAD: exported but never imported by its own
//   index.js (a same-named, unrelated export exists in
//   `SingleBusinessCategoryEdit/styles.js`, out of this batch). Mounted
//   here literally with one `span` child covering both declarations, for
//   declaration verification only.
// - BusinessProductsCategories/styles.js's `SelectedCategoriesWrapper` rule
//   is a bare descendant `p { font-size: 14px }`: it is a `styled.div` with
//   a real `onClick` in index.js (`<SelectedCategoriesWrapper onClick={()
//   => setShowCategories(!showCategories)}><p>…</p><Pencil/>
//   </SelectedCategoriesWrapper>`), kept as a plain `div`, unconverted, the
//   `p` a genuine direct child.
// - BusinessProductsCategories/styles.js's `SearchWrapper` carries
//   `svg { font-size: 18px }` and `input { font-size: 14px }` (bare
//   descendants): index.js renders `<SearchWrapper><Search/><input …/>
//   </SearchWrapper>`, both genuine direct children, mounted the same way.
// - BusinessProductsCategoyDetails/styles.js's `BusinessEnableWrapper` rule
//   is a bare descendant `span { font-size: 20px; … }`: index.js's live
//   (non-loading) branch renders `<BusinessEnableWrapper
//   className='business_enable_control'><span>…</span><Switch …/>
//   </BusinessEnableWrapper>`, the span a genuine direct child, mounted the
//   same way, no inline override at this call site.
// - BusinessProductsCategoyDetails/styles.js's `CategoryNameWrapper`
//   carries `label { font-size: 14px }` and `input { font-size: 14px }`
//   (bare descendants): index.js renders `<CategoryNameWrapper>
//   <label>…</label><Input …/></CategoryNameWrapper>`, both genuine direct
//   children, mounted with a plain `<input>` standing in for `Input`.
// - BusinessProductsCategoyDetails/styles.js's `ParentCategorySelectWrapper`
//   and `Option` are exported but NEVER imported by this file's own
//   index.js (its import list stops at `ActionSelectorWrapper`) — both
//   DEAD, distinct from the identically-shaped, live exports of the same
//   names in `BusinessProductsCategoyInfo/styles.js`. Mounted here
//   literally (label as a direct child of the wrapper; `Option` as a
//   standalone leaf) for declaration verification only.
// - BusinessProductsCategoyDetails/styles.js's `ActionSelectorWrapper` carries
//   `button { … svg { font-size: 20px } }` and `> div { > div {
//   .dropdown-item { font-size: 12px } } }`. index.js renders a real
//   `react-bootstrap` `DropdownButton` (`<DropdownButton
//   title={<ThreeDots/>}>` / `<Dropdown.Item>`) whose toggle resolves to a
//   real `<button>` containing the icon directly as a child, and whose menu
//   item resolves to a real item element two direct-child divs deep — the
//   same mechanism documented for stores-b3/b4's Dropdown-based action
//   menus. Mounted here with a plain `<button>` standing in for the toggle
//   (icon as its direct child) and a plain `div > div > div.dropdown-item`
//   standing in for the menu shape.
// - BusinessProductsCategoyInfo/styles.js's `BusinessEnableWrapper` rule is
//   a bare descendant `span { font-size: 20px; … }`, but this file's ONLY
//   call site (the "add as subcategory" branch) renders
//   `<span style={{ fontSize: 15 }}>{t('ADD_AS_SUBCATEGORY', …)}</span>` —
//   a real inline-style override that wins over the styled-components rule.
//   Mounted here literally with that inline `style={{ fontSize: 15 }}`
//   preserved (not sanitized away), so the fixture reflects that the
//   declared 20px never actually resolves at this component's real DOM
//   node.
// - BusinessProductsCategoyInfo/styles.js's `CategoryNameWrapper` carries
//   `label { font-size: 14px }` and `input, textarea { font-size: 14px }`
//   (bare descendants): index.js renders `<CategoryNameWrapper>
//   <label>…</label><Input …/></CategoryNameWrapper>` (repeated per field),
//   one representative instance mounted with a plain `<input>` standing in
//   for `Input`.
// - BusinessProductsCategoyInfo/styles.js's `ParentCategorySelectWrapper`
//   rule is a bare descendant `label { font-size: 14px }`: index.js renders
//   `<ParentCategorySelectWrapper><label>…</label><DefaultSelect …/>
//   </ParentCategorySelectWrapper>`, the label a genuine direct child,
//   mounted the same way — live here (unlike BusinessProductsCategoyDetails).
// - BusinessProductsCategoyInfo/styles.js's `Option` declares font-size on
//   itself; index.js uses it as inline `content` for select options
//   (`content: <Option>{category?.name}</Option>`), mounted as a leaf —
//   live here (unlike BusinessProductsCategoyDetails).
// - BusinessProductsCategoyInfo/styles.js's `ActionSelectorWrapper` is the
//   same DropdownButton/Dropdown.Item shape as above, confirmed against
//   this file's own index.js. Mounted the same way.
// - BusinessProductsCategoyInfo/styles.js's `InfoConatiner` rule is a bare
//   descendant `h1 { font-size: 20px; … }`. This export is DEAD: never
//   imported by this file's own index.js (a same-named, unrelated export
//   exists in `BusinessDetail/styles.js`, out of this batch). Mounted here
//   literally with a direct-child `h1` for declaration verification only.
// - BusinessProductsCategoyInfo/styles.js's `SkipButton` declares font-size
//   on itself; it is a `styled.div` with a real `onClick` in index.js
//   (`<SkipButton onClick={() => handleTutorialSkip()}>{t('TUTORIAL_SKIP',
//   'Skip')}</SkipButton>`), kept as a plain `div`, unconverted.
// - BusinessProductsCategoyInfo/styles.js's `SwitchWrapper` rule is a
//   direct-child `> span { font-size: 16px; … }`: index.js renders
//   `<SwitchWrapper><span>{t('RIBBON', 'Ribbon')}</span><Switch …/>
//   </SwitchWrapper>`, the span a genuine direct child, mounted the same
//   way.
// - BusinessProductsCategoyInfo/styles.js's `ColorWrapper` rule is a
//   direct-child `> label { font-size: 14px; … }`: index.js renders
//   `<ColorWrapper><label>…</label><ColorPicker …/></ColorWrapper>`, the
//   label a genuine direct child, mounted the same way.
// - BusinessProductsCategoyInfo/styles.js's `ShapeWrapper` is
//   `styled(ColorWrapper)` and independently re-declares
//   `> label { font-size: 14px }`: index.js renders `<ShapeWrapper>
//   <label>…</label><ShapeContentWrapper>…</ShapeContentWrapper>
//   </ShapeWrapper>`, the label a genuine direct child, mounted the same
//   way (a separate declaration site from `ColorWrapper`'s, though both
//   resolve to 14px on their own respective label).
// - BusinessProductsCategoyInfo/styles.js's `ShapeBoxWrapper` rule is a
//   bare descendant `svg { font-size: 16px; … }`: it is a `styled.div` with
//   a real `onClick` in index.js (`<ShapeBoxWrapper … onClick={() =>
//   handleChangeRibbon({ shape: shape[key] })}><div/><RecordCircleFill/ or
//   Circle/></ShapeBoxWrapper>`), kept as a plain `div`, unconverted, the
//   icon a genuine direct child (second, after a plain swatch `div`).
// - BusinessProductsListing/styles.js's `ProductHeader` rule is a bare
//   descendant `h1 { font-size: 14px; … }`. index.js's own markup inside
//   `<ProductHeader>` has no literal `<h1>`; the h1 comes from the nested
//   `<SingleBusinessCategoryEdit/>` sub-component (`Stores/
//   SingleBusinessCategoryEdit/index.js`, out of this batch), which renders
//   `<SingleCategoryContainer><CategoryContent><h1>…</h1>…
//   </CategoryContent></SingleCategoryContainer>` — a genuine descendant of
//   `ProductHeader`, two wrapper layers deep. Mounted here with two plain
//   wrapper `div`s standing in for those two intervening layers, so the
//   `h1` is a real descendant (not a direct child), matching the source.
// - BusinessProductsListing/styles.js's `ViewMethodButton` carries a bare
//   `svg { font-size: 16px }` and `&.batch { svg { font-size: 18px } }`
//   (compiling to the compound descendant selector `.batch svg`).
//   index.js's only call site passes `className='batch'`
//   (`<ViewMethodButton className='batch' onClick={() =>
//   openBatchImageUploader()}><RiImageAddFill/></ViewMethodButton>`) — the
//   base (non-`.batch`) 16px rule is DEAD, never rendered without that
//   class. Both are mounted: a bare instance for declaration verification
//   of the dead base rule, and a `className='batch'` instance matching the
//   real, live call site, both with the icon as a genuine direct child.
// - BusinessProductsListing/styles.js's `BusinessNameWrapper` declares two
//   separate `h1 { … }` blocks: the first sets `font-size: 20px` on the h1
//   itself; the second nests `svg { font-size: 0.7em; … }` under `h1`
//   (compiling to the descendant chain `h1 svg`). index.js renders
//   `<BusinessNameWrapper><h1 onClick={…}>{name} <BisDownArrow
//   className={…}/></h1><LearnDropDown …/></BusinessNameWrapper>` — the h1
//   a genuine direct child, and the icon a genuine direct child of that h1
//   (an inline glyph next to the business name text, not scoped by its own
//   selector — the 0.7em rule sizes it relative to the h1's own font-size).
//   Mounted with that exact nesting.
// - BusinessProductsListing/styles.js's `Breadcrumb` declares font-size on
//   itself; index.js renders `<Breadcrumb><span className='business'
//   onClick={…}>…</span><ChevronRight/><span>…</span></Breadcrumb>` — the
//   first `span` carries a real `onClick` and is kept as a plain `span`,
//   unconverted, mounted with that exact shape.
// - BusinessSharedMenuProductDetails/styles.js's `DetailsContainer` rule is
//   a direct-child `> h1 { font-size: 20px; … }`: index.js renders the h1
//   as a direct child (alongside `InputWrapper`), mounted the same way.
// - BusinessSharedMenuProductDetails/styles.js's `InputWrapper` rule is a
//   bare descendant `label { font-size: 14px; … }`: index.js renders the
//   label as a direct child (alongside `Input`), mounted the same way.
// - BusinessSharedMenuProductDetails/styles.js's `SwitchWrapper` rule is
//   `label { &:first-child { font-size: 14px; … } } }`, compiling to the
//   compound selector `label:first-child` (not a child combinator — `&`
//   binds directly to `label`). index.js renders `<SwitchWrapper>
//   <label>…</label><Switch …/></SwitchWrapper>`, the label a genuine
//   direct child and, being the only label, a genuine `:first-child`,
//   mounted with a real `<label>` (not a wrapping element).
// - BusinessSharedMenuProductDetails/styles.js's `SearchbarWrapper` rule is
//   a bare descendant `label { font-size: 16px; … }`: index.js renders the
//   label as a direct child (alongside `SearchBar`), mounted the same way.
// - BusinessSharedMenuProductDetails/styles.js's `ProductExtraWrapper`,
//   `ProductOptionWrapper` and `ProductSuboptionWrapper` each declare a
//   direct-child `> span { font-size: 14px; … }`: index.js renders each as
//   `<XWrapper><Checkbox …/><span>…</span></XWrapper>`, the span a genuine
//   direct child in all three, mounted the same way, one representative
//   instance per wrapper.
// - BusinessSharedMenuProducts/styles.js's `ProductItem` carries a bare
//   `span { font-size: 14px; flex: 1 }` and a direct-child `> svg {
//   font-size: 13px; … }`. It is a `styled.div` with a real `onClick` in
//   index.js (`<ProductItem … onClick={e => handleOpenProduct(e,
//   product)}><Checkbox .../><span>{product.name}</span>
//   <ChevronRight/></ProductItem>`), kept as a plain `div`, unconverted,
//   both the span and the icon genuine direct children.
// Mirrors BusinessMenuCategoryTreeNode/index.js for one category with one product, with
// the real styled components: the row is an `Accordion` whose click toggles, the category
// checkbox and the chevron expander are siblings, and the products live in an
// `AccordionContent` that is clipped with max-height 0 and `inert` while collapsed.
const TreeNodeFixture = ({ open = false, category, product, categoryState, productChecked = false, ids }) => {
  const contentId = useId()
  const [active, setActive] = useState(open)
  const glyph = <svg data-testid={ids.categoryIcon} viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
  return (
    <>
      <TreeNodeAccordion onClick={() => setActive(v => !v)}>
        <TreeNodeAccordionItem margin={0}>
          <div>
            <TreeNodeCheckboxWrapper as='button' type='button' role='checkbox' aria-checked={categoryState} aria-label={category} onClick={() => {}} data-testid={ids.category}>
              {glyph}
            </TreeNodeCheckboxWrapper>
            <span data-testid={ids.name}>{category}</span>
          </div>
          <TreeNodeAccordionToggle aria-expanded={active} aria-controls={contentId} aria-label={category} data-testid={ids.toggle}>
            <svg data-testid={ids.toggleIcon} className={active ? 'accordion__icon rotate' : 'accordion__icon'} viewBox='0 0 16 16' width='1em' height='1em' aria-hidden='true' focusable='false'><path d='M3 5h10L8 11z' fill='currentColor' /></svg>
          </TreeNodeAccordionToggle>
        </TreeNodeAccordionItem>
      </TreeNodeAccordion>
      <TreeNodeAccordionContent id={contentId} inert={active ? undefined : ''} style={{ maxHeight: !active && '0px' }} data-testid={ids.content}>
        <TreeNodeAccordionItem margin={20} isProduct>
          <div>
            <TreeNodeCheckboxWrapper as='button' type='button' role='checkbox' aria-checked={productChecked} aria-label={product} active={productChecked} onClick={() => {}} data-testid={ids.product}>
              <svg data-testid={ids.productIcon} viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M4 8l3 3 5-6' fill='none' stroke='currentColor' /></svg>
            </TreeNodeCheckboxWrapper>
            <span data-testid={ids.productName}>{product}</span>
          </div>
        </TreeNodeAccordionItem>
      </TreeNodeAccordionContent>
    </>
  )
}

export const StoresB5StylesFixture = () => {
  return (
    <main data-testid='stores-b5-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <section data-testid='business-menu-category-tree-node-group' aria-label='Category tree node'>
        <TreeNodeFixture
          open
          category='Sandwiches'
          product='Club sandwich'
          categoryState='mixed'
          productChecked
          ids={{ category: 'tree-category-checkbox', categoryIcon: 'tree-checkbox-icon', name: 'tree-item-name', toggle: 'tree-category-toggle', toggleIcon: 'tree-toggle-icon', content: 'tree-content', product: 'tree-product-checkbox', productIcon: 'tree-product-checkbox-icon', productName: 'tree-product-name' }}
        />
      </section>

      <section data-testid='business-menu-custom-fields-group' aria-label='Menu custom fields'>
        <CustomFieldsHeader>
          <CustomFieldsMetaTitle data-testid='fields-title'>Custom Fields</CustomFieldsMetaTitle>
          {/* Dead: the `> svg` rule (shown only above 1000px) has no
              consumer — index.js's only <Header> wraps just <MetaTitle>.
              Mounted literally to verify the declaration resolves. */}
          <svg data-testid='fields-header-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
        </CustomFieldsHeader>

        <CustomFieldsMetaContainer>
          <div className='meta_type' data-testid='fields-meta-type'>text</div>
          <div className='meta_key'>
            <CustomFieldsRoundBorder data-testid='fields-round-border'>size</CustomFieldsRoundBorder>
          </div>
          <div className='meta_value'>
            <CustomFieldsRoundBorder>Large</CustomFieldsRoundBorder>
            <svg data-testid='fields-meta-value-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M4 4h8v9H4z' fill='none' stroke='currentColor' /></svg>
          </div>
        </CustomFieldsMetaContainer>

        <CustomFieldsMetaAddContainer>
          <div className='meta_value'>
            <input id='meta_value' type='text' data-testid='fields-add-value-input' />
          </div>
        </CustomFieldsMetaAddContainer>

        <CustomFieldsNoMetaField data-testid='fields-no-metafield'>No MetaField</CustomFieldsNoMetaField>
      </section>

      <section data-testid='business-product-add-form-group' aria-label='Add product'>
        <AddFormFormInput>
          <h1 data-testid='add-form-heading'>New product</h1>
        </AddFormFormInput>

        <AddFormOption data-testid='add-form-option'>Item</AddFormOption>

        <AddFormSelectWrapper>
          <label data-testid='add-form-select-label'>Duration</label>
          <div className='select'>
            <div data-testid='add-form-select-trigger'>30 minutes</div>
          </div>
        </AddFormSelectWrapper>

        <AddFormUploadImageIcon>
          <span data-testid='add-form-upload-icon-text'>Put your image here</span>
        </AddFormUploadImageIcon>

        <AddFormInputWrapper>
          <label data-testid='add-form-input-label'>Custom duration</label>
        </AddFormInputWrapper>

        <AddFormSkipButton as='button' type='button' onClick={() => {}} data-testid='add-form-skip-button'>Skip</AddFormSkipButton>

        <AddFormTimeBlock>
          <select data-testid='add-form-time-select'><option>10</option></select>
          <span>:</span>
          <select><option>30</option></select>
        </AddFormTimeBlock>
      </section>

      <section data-testid='business-product-list-group' aria-label='Product list'>
        <ProductListTable>
          <thead>
            <tr>
              <th data-testid='product-list-header-cell'>Name</th>
              <th>Price</th>
            </tr>
          </thead>
        </ProductListTable>

        <ProductListWrapperNotFound data-testid='product-list-not-found'>No products found</ProductListWrapperNotFound>
      </section>

      <section data-testid='business-products-categories-group' aria-label='Product categories'>
        <CategoriesHeaderContainer>
          <h1 data-testid='categories-header-title'>Business category</h1>
        </CategoriesHeaderContainer>

        {/* Dead: CategoryEnableWrapper is exported but never imported by
            this component's own index.js. The rule declares font-size
            twice on the same span (14px then 12px); the second wins.
            Mounted once to verify both declarations resolve. */}
        <CategoriesCategoryEnableWrapper>
          <span data-testid='categories-enable-text'>Enabled</span>
        </CategoriesCategoryEnableWrapper>

        <CategoriesSelectedCategoriesWrapper onClick={() => {}}>
          <p data-testid='categories-selected-text'>Drinks</p>
        </CategoriesSelectedCategoriesWrapper>

        <CategoriesSearchWrapper>
          <svg data-testid='categories-search-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='7' cy='7' r='5' fill='none' stroke='currentColor' /></svg>
          <input type='text' placeholder='Search' data-testid='categories-search-input' />
        </CategoriesSearchWrapper>
      </section>

      <section data-testid='business-products-category-details-group' aria-label='Category details'>
        <CatDetailsBusinessEnableWrapper className='business_enable_control'>
          <span data-testid='cat-details-enable-text'>Drinks</span>
        </CatDetailsBusinessEnableWrapper>

        <CatDetailsCategoryNameWrapper>
          <label data-testid='cat-details-name-label'>Category name</label>
          <input data-testid='cat-details-name-input' />
        </CatDetailsCategoryNameWrapper>

        {/* Dead: ParentCategorySelectWrapper is exported but never imported
            by BusinessProductsCategoyDetails/index.js (distinct from the
            live, identically-named export in BusinessProductsCategoyInfo).
            Mounted literally to verify the declaration resolves. */}
        <CatDetailsParentCategorySelectWrapper>
          <label data-testid='cat-details-parent-label'>Parent category</label>
        </CatDetailsParentCategorySelectWrapper>

        {/* Dead: Option is exported but never imported by
            BusinessProductsCategoyDetails/index.js (distinct from the live,
            identically-named export in BusinessProductsCategoyInfo).
            Mounted literally to verify the declaration resolves. */}
        <CatDetailsOption data-testid='cat-details-option'>Drinks</CatDetailsOption>

        <CatDetailsActionSelectorWrapper>
          <button type='button'>
            <svg data-testid='cat-details-action-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='2' r='1' fill='currentColor' /><circle cx='8' cy='8' r='1' fill='currentColor' /><circle cx='8' cy='14' r='1' fill='currentColor' /></svg>
          </button>
          <div>
            <div>
              <div className='dropdown-item' data-testid='cat-details-dropdown-item'>Delete</div>
            </div>
          </div>
        </CatDetailsActionSelectorWrapper>
      </section>

      <section data-testid='business-products-category-info-group' aria-label='Category info'>
        <CatInfoCategoryNameWrapper>
          <label data-testid='cat-info-name-label'>Category name</label>
          <input data-testid='cat-info-name-input' />
        </CatInfoCategoryNameWrapper>

        <CatInfoParentCategorySelectWrapper>
          <label data-testid='cat-info-parent-label'>Parent category</label>
        </CatInfoParentCategorySelectWrapper>

        <CatInfoOption data-testid='cat-info-option'>Drinks</CatInfoOption>

        <CatInfoActionSelectorWrapper>
          <button type='button'>
            <svg data-testid='cat-info-action-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='2' r='1' fill='currentColor' /><circle cx='8' cy='8' r='1' fill='currentColor' /><circle cx='8' cy='14' r='1' fill='currentColor' /></svg>
          </button>
          <div>
            <div>
              <div className='dropdown-item' data-testid='cat-info-dropdown-item'>Delete</div>
            </div>
          </div>
        </CatInfoActionSelectorWrapper>

        {/* Dead: InfoConatiner is exported but never imported by
            BusinessProductsCategoyInfo/index.js (distinct from the live,
            identically-named export in Stores/BusinessDetail/styles.js,
            out of this batch). Mounted literally to verify the declaration
            resolves. */}
        <CatInfoInfoConatiner>
          <h1 data-testid='cat-info-heading'>Category</h1>
        </CatInfoInfoConatiner>

        <CatInfoSkipButton as='button' type='button' onClick={() => {}} data-testid='cat-info-skip-button'>Skip</CatInfoSkipButton>

        <CatInfoSwitchWrapper>
          <span data-testid='cat-info-ribbon-switch-text'>Ribbon</span>
        </CatInfoSwitchWrapper>

        <CatInfoColorWrapper>
          <label data-testid='cat-info-color-label'>Color</label>
        </CatInfoColorWrapper>

        <CatInfoShapeWrapper>
          <label data-testid='cat-info-shape-label'>Shape</label>
        </CatInfoShapeWrapper>

        <CatInfoShapeBoxWrapper onClick={() => {}}>
          <div />
          <svg data-testid='cat-info-shape-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
        </CatInfoShapeBoxWrapper>

        {/* This component's ONLY BusinessEnableWrapper call site carries a
            real inline `style={{ fontSize: 15 }}` on the span, overriding
            the styled-components rule's declared 20px. Preserved here
            exactly as source, not sanitized away. */}
        <CatInfoBusinessEnableWrapper style={{ paddingTop: 20, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 15 }} data-testid='cat-info-enable-text'>Add as subcategory</span>
        </CatInfoBusinessEnableWrapper>
      </section>

      <section data-testid='business-products-listing-group' aria-label='Products listing'>
        <ListingProductHeader>
          <div>
            <div>
              <h1 data-testid='listing-category-heading'>All</h1>
            </div>
          </div>
        </ListingProductHeader>

        {/* Dead: the base (non-`.batch`) svg rule is never rendered — the
            only call site always passes className='batch'. Mounted
            literally to verify the declaration resolves. */}
        <ListingViewMethodButton>
          <svg data-testid='listing-view-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
        </ListingViewMethodButton>

        <ListingViewMethodButton className='batch' onClick={() => {}}>
          <svg data-testid='listing-view-batch-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
        </ListingViewMethodButton>

        <ListingBusinessNameWrapper>
          <h1 data-testid='listing-business-name-heading' onClick={() => {}}>
            Pizza place
            <svg data-testid='listing-business-name-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M4 6l4 4 4-4' fill='none' stroke='currentColor' /></svg>
          </h1>
        </ListingBusinessNameWrapper>

        <ListingBreadcrumb data-testid='listing-breadcrumb'>
          <span className='business' onClick={() => {}}>Pizza place</span>
          <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' /></svg>
          <span>Drinks</span>
        </ListingBreadcrumb>
      </section>

      <section data-testid='business-shared-menu-product-details-group' aria-label='Shared menu product details'>
        <SharedDetailsContainer>
          <h1 data-testid='shared-details-heading'>Cheeseburger</h1>
        </SharedDetailsContainer>

        <SharedDetailsInputWrapper>
          <label data-testid='shared-details-price-label'>Price</label>
        </SharedDetailsInputWrapper>

        <SharedDetailsSwitchWrapper>
          <label data-testid='shared-details-switch-label'>Limit product quantity</label>
        </SharedDetailsSwitchWrapper>

        <SharedDetailsSearchbarWrapper>
          <label data-testid='shared-details-searchbar-label'>Product options</label>
        </SharedDetailsSearchbarWrapper>

        <SharedDetailsProductExtraWrapper>
          <span data-testid='shared-details-extra-text'>Extra cheese</span>
        </SharedDetailsProductExtraWrapper>

        <SharedDetailsProductOptionWrapper>
          <span data-testid='shared-details-option-text'>Size</span>
        </SharedDetailsProductOptionWrapper>

        <SharedDetailsProductSuboptionWrapper>
          <span data-testid='shared-details-suboption-text'>Large</span>
        </SharedDetailsProductSuboptionWrapper>
      </section>

      <section data-testid='business-shared-menu-products-group' aria-label='Shared menu products'>
        <SharedProductsItem onClick={() => {}}>
          <span data-testid='shared-products-item-text'>Cheeseburger</span>
          <svg data-testid='shared-products-item-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' /></svg>
        </SharedProductsItem>
      </section>

      {/* Last on purpose, so it moves nothing above it: a collapsed tree whose products
          are clipped by max-height 0 and must stay out of the tab order (inert). */}
      <section data-testid='business-menu-category-tree-collapsed-group' aria-label='Collapsed category tree node'>
        <TreeNodeFixture
          category='Desserts'
          product='Brownie'
          categoryState={false}
          ids={{ category: 'tree-collapsed-category-checkbox', toggle: 'tree-collapsed-toggle', content: 'tree-collapsed-content', product: 'tree-collapsed-product-checkbox' }}
        />
      </section>
    </main>
  )
}
