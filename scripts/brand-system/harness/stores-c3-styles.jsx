import React from 'react'

import {
  ProdcutGalleryContainer as PgProdcutGalleryContainer,
  GalleryItemBottom as PgGalleryItemBottom,
  UploadImageIconContainer as PgUploadImageIconContainer,
  DropDownWrapper as PgDropDownWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductGallery/styles'
import {
  ProdcutVideosContainer as PvProdcutVideosContainer,
  AddNewVideo as PvAddNewVideo,
  GalleryItem as PvGalleryItem,
  GalleryURL as PvGalleryURL
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductVideos/styles'
import {
  Container as PsgContainer,
  InfoWrapper as PsgInfoWrapper,
  IconWrapper as PsgIconWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductStartGuide/styles'
import {
  Header as PiHeader,
  IngredientOption as PiIngredientOption
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductIngredient/styles'
import {
  Header as PidHeader,
  ActionSelectorWrapper as PidActionSelectorWrapper,
  InputWrapper as PidInputWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductIngredientDetails/styles'
import {
  Header as PtdHeader,
  UploadImageIcon as PtdUploadImageIcon,
  FormController as PtdFormController,
  ActionSelectorWrapper as PtdActionSelectorWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductTagDetails/styles'
import {
  SelectButtonGroup as PtlSelectButtonGroup,
  ProductTagWrapper as PtlProductTagWrapper,
  TagImageWrapper as PtlTagImageWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductTagsList/styles'

// Presentation-only fixture: the real Stores product media/tags/ingredients
// styled surfaces for batch c3-product-media-tags-ingredients, no controller,
// SDK, account or network. Seven source files are mounted; `Header`
// (ProductIngredient / ProductIngredientDetails / ProductTagDetails),
// `ActionSelectorWrapper` (ProductIngredientDetails / ProductTagDetails) and
// `GalleryItem` (ProductGallery / ProductVideos — ProductGallery's own
// `GalleryItem` is not mounted here, but the name still collides at the
// import site) are all aliased with a folder-prefix matching their
// data-testid prefix, the same convention stores-c1/c2-styles.jsx use.
// `ProductGallery`'s and `ProductTagDetails`'s own `UploadImageIconContainer`
// exports are NOT imported: neither one's own selector is in this batch's
// assignment, and `ProductGallery`'s `p`/`svg` rules are declared directly on
// that styled node (still mounted, aliased `PgUploadImageIconContainer`),
// while `ProductTagDetails`'s `UploadImageIconContainer` gates nothing tested
// (its only child, `UploadImageIcon`, is mounted standalone below per the
// b8/c1/c2 "mount each leaf surface standalone" convention).
//
// Real-nesting notes and adaptations (checked against each source styles.js
// and its consuming index.js before mounting):
// - ProductGallery/styles.js's `ProdcutGalleryContainer > h1` is a genuine
//   direct child (`<ProdcutGalleryContainer><h1>...</h1>
//   <GalleryImagesContainer>...</GalleryImagesContainer>
//   </ProdcutGalleryContainer>`) — mounted with the h1 alone, skipping
//   `GalleryImagesContainer`/`GalleryItem`/`GalleryImage`, which gate none of
//   this batch's selectors.
// - `UploadImageIconContainer`'s `svg` (50px) and `p` (12px) are genuine
//   descendants of the same node (`<UploadImageIconContainer><ImageIcon />
//   <p>{t('DRAG_AND_DROP', ...)}</p></UploadImageIconContainer>`, the
//   `ImageIcon`/`PlusCircle` branch depending on call site) — mounted as-is,
//   a decorative svg standing in for the real icon.
// - `GalleryItemBottom > input` and its sibling `DropDownWrapper` are both
//   genuine direct children in the real per-photo row
//   (`<GalleryItemBottom><input name='title' .../><DropDownWrapper>...
//   </DropDownWrapper></GalleryItemBottom>`) — mounted together rather than
//   in isolation, since `DropDownWrapper` only ever appears there.
// - `DropDownWrapper`'s `> div > > div > .dropdown-item` and `button > svg`
//   wrap a react-bootstrap `DropdownButton`/`Dropdown.Item`
//   (`title={<ThreeDotsVertical />}`), the identical shape the b8/c1/c2
//   fixtures documented for this same component: a `.dropdown` wrapper with a
//   toggle `<button>` containing the title icon directly (`button > svg`) and
//   a `.dropdown-menu` holding `.dropdown-item` entries reached via the
//   rule's `> div > > div > .dropdown-item` path — mounted with the same
//   plain `div`/`button` elements carrying those literal classNames, reusing
//   the b8/c1/c2 precedent rather than re-deriving react-bootstrap's real DOM.
// - ProductVideos/styles.js's `ProdcutVideosContainer > h1` is a genuine
//   direct child, mounted alone the same way as ProductGallery's equivalent.
// - `AddNewVideo`'s `input` and `button` are genuine descendants
//   (`<AddNewVideo><Input name='video' .../><div style={{ width: 18 }} />
//   <Button color='primary'>{t('ADD', ...)}</Button></AddNewVideo>`) —
//   mounted with plain `input`/`button` elements standing in for the shared
//   `Input`/`Button` primitives (neither is part of this batch), the spacer
//   `div` omitted as it carries no rule under test.
// - `GalleryItem`'s `button` and `GalleryURL`'s root are genuine siblings in
//   the real per-video row (`<GalleryItem><GalleryURL>{video?.video}
//   </GalleryURL><Button onClick={...}>Delete</Button></GalleryItem>`) —
//   mounted together.
// - `GalleryURL` (`pv-galleryurl-root`) is the THIRD and, per the assignment,
//   only new user of the `identifier` role in all of L4 since batch b2: it
//   paints a raw, standalone URL in `var(--od-type-identifier-font)` with
//   `var(--od-type-identifier-ligatures)`, unlike every other role in this
//   batch, which is prose/label text. Mounted with a synthetic,
//   obviously-fake video URL (`https://video.example/watch?id=SYNTH0FAKE1`)
//   standing in for the real `video?.video` value — no real domain, no
//   network request, just a string that reads as a URL for the typography
//   rule to apply to.
// - ProductStartGuide/styles.js's `Container > h2` is genuine
//   (`<Container><h2>...</h2>{guideList.map(guide => guide.enabled && (
//   <GuideItemContainer>...))}</Container>`). `IconWrapper > svg` and
//   `InfoWrapper`'s `h3`/`p` are genuine children of the mapped
//   `GuideItemContainer` (`<GuideItemContainer><IconWrapper>{guide.icon}
//   </IconWrapper><InfoWrapper><h3>{guide.title}</h3>
//   {guide.description && <p>{guide.description}</p>}</InfoWrapper>
//   </GuideItemContainer>`) — mounted as direct children of `Container`,
//   skipping the intermediate `GuideItemContainer`, which carries no rule
//   under test (same "mount each leaf surface standalone" convention).
// - ProductIngredient/styles.js's `Header > h1` is genuine
//   (`<Header><h1>...</h1><Button>...</Button></Header>`).
// - `IngredientOption` is the ONE native-button conversion in this batch (per
//   the assignment): index.js renders it `as='button' type='button'
//   aria-pressed={ingredient.id === currentIngredient?.id}
//   onClick={...}` — mounted identically. Its `span` and `svg` children
//   (`<IngredientOption as='button' ...><span>{ingredient?.name}</span>
//   <ChevronRight /></IngredientOption>`) are genuine.
// - ProductIngredientDetails/styles.js's `Header > h1` is genuine, sharing its
//   parent with a `div` that wraps `ActionSelectorWrapper` and a close
//   `IconButton` (`<Header><h1>...</h1><div>{!isAddMode &&
//   <ActionSelectorWrapper>...</ActionSelectorWrapper>}<IconButton
//   onClick={...}><XLg /></IconButton></div></Header>`) — mounted with the
//   `IconButton` as a literal `<button>`, per the b8/c1/c2 convention for
//   that Shared/UI wrapper.
// - `ActionSelectorWrapper`'s `> div > > div > .dropdown-item` and
//   `button > svg` wrap the same react-bootstrap `DropdownButton` shape
//   documented above for ProductGallery's `DropDownWrapper` — mounted the
//   same way.
// - `InputWrapper`'s `label` is genuine (`<InputWrapper><label>{t('NAME',
//   ...)}</label><Input .../></InputWrapper>`) — mounted with a literal
//   `<input>` standing in for the shared `Input` primitive.
// - ProductTagDetails/styles.js's `Header > h1` and its sibling
//   `ActionSelectorWrapper` are genuine (`<Header><h1>...</h1>
//   <ActionSelectorWrapper>...</ActionSelectorWrapper></Header>`), the
//   dropdown shape identical to the ones above.
// - `ptd-uploadimageicon-span` is an ORPHANED SELECTOR: `UploadImageIcon`'s
//   own `styles.js` rule declares a `span{}` child style, but index.js only
//   ever renders `<UploadImageIcon><ImageIcon /></UploadImageIcon>` — no
//   `<span>` anywhere in this file's live UI (grepped the whole index.js).
//   Mounted a SYNTHETIC PROBE `<span>` alongside the real decorative icon so
//   the rule has something to resolve against; this span does not exist in
//   the live render.
// - `FormController`'s `label` is genuine (`<FormController><label>{t('NAME',
//   ...)}</label><Input .../></FormController>`) — mounted the same way as
//   ProductIngredientDetails's `InputWrapper`.
// - ProductTagsList/styles.js's `SelectButtonGroup`'s `button` is genuine
//   (`<SelectButtonGroup><Button onClick={handleSelectAllTags}>Select all
//   </Button><Button onClick={handleSelectNoneTags}>Select none</Button>
//   </SelectButtonGroup>`) — mounted with two literal `<button>` elements.
// - `ProductTagWrapper` is explicitly NOT converted to a native button in this
//   batch, even though it carries an `onClick`
//   (`<ProductTagWrapper onClick={(e) => handleOpenProductTagDetail(e, tag)}>
//   <div><Checkbox className='product-tag-checkbox' .../>
//   <TagImageWrapper>...</TagImageWrapper><span className='tag-name'>
//   {tag.name}</span></div><ChevronRight /></ProductTagWrapper>`): it renders
//   a `Checkbox` (a real form control) as a descendant, and nesting a
//   checkbox inside a `<button>` is invalid HTML — mounted as-is, a `div`
//   with `onClick`, the `Checkbox` standing in as a literal
//   `<input type='checkbox'>` per the b7/c1 convention for that Shared/UI
//   primitive.
// - `TagImageWrapper`'s `svg` (16px) is genuine, the real fallback branch of a
//   conditional (`<TagImageWrapper>{tag?.image ? <img alt='' /> :
//   <ImageIcon />}</TagImageWrapper>`) — mounted with a decorative svg
//   standing in for `ImageIcon`.
//
// This batch has no HERO/SIMULACION region.
export const StoresC3StylesFixture = () => {
  return (
    <main data-testid='stores-c3-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <section data-testid='c3-dashboard-surfaces' aria-label='Product media, tags and ingredients dashboard surfaces'>

        <div data-testid='product-gallery-group' aria-label='Product gallery'>
          <PgProdcutGalleryContainer>
            <h1 data-testid='pg-prodcutgallerycontainer-h1'>Product images</h1>
          </PgProdcutGalleryContainer>

          <PgUploadImageIconContainer>
            <svg data-testid='pg-uploadimageiconcontainer-svg' viewBox='0 0 16 16' width='50' height='50' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            <p data-testid='pg-uploadimageiconcontainer-p'>Drag and drop</p>
          </PgUploadImageIconContainer>

          <PgGalleryItemBottom>
            <input data-testid='pg-galleryitembottom-input' type='text' aria-label='Photo title' defaultValue='Toppings close-up' readOnly />
            <PgDropDownWrapper>
              <div className='dropdown'>
                <button type='button' aria-label='More actions'>
                  <svg data-testid='pg-dropdownwrapper-button-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><circle cx='2' cy='8' r='1.4' /><circle cx='8' cy='8' r='1.4' /><circle cx='14' cy='8' r='1.4' /></svg>
                </button>
                <div className='dropdown-menu'>
                  <div>
                    <button type='button' className='dropdown-item' data-testid='pg-dropdownwrapper-div-div-dropdown-item'>Delete</button>
                  </div>
                </div>
              </div>
            </PgDropDownWrapper>
          </PgGalleryItemBottom>
        </div>

        <div data-testid='product-videos-group' aria-label='Product videos'>
          <PvProdcutVideosContainer>
            <h1 data-testid='pv-prodcutvideoscontainer-h1'>Product videos</h1>
          </PvProdcutVideosContainer>

          <PvGalleryItem>
            {/* pv-galleryurl-root: THIRD identifier-role user in all of L4 since b2 — see file header. */}
            <PvGalleryURL data-testid='pv-galleryurl-root'>https://video.example/watch?id=SYNTH0FAKE1</PvGalleryURL>
            <button type='button' data-testid='pv-galleryitem-button'>Delete</button>
          </PvGalleryItem>

          <PvAddNewVideo>
            <input data-testid='pv-addnewvideo-input' type='text' placeholder='Youtube Video URL' aria-label='Youtube Video URL' readOnly />
            <button type='button' data-testid='pv-addnewvideo-button'>Add</button>
          </PvAddNewVideo>
        </div>

        <div data-testid='product-start-guide-group' aria-label='Product start guide'>
          <PsgContainer>
            <h2 data-testid='psg-container-h2'>How do you want to start?</h2>
            {/* GuideItemContainer wrapper skipped: it gates neither IconWrapper's nor InfoWrapper's tested selectors, see file header. */}
            <PsgIconWrapper>
              <svg data-testid='psg-iconwrapper-svg' viewBox='0 0 16 16' width='24' height='24' aria-hidden='true' focusable='false'><path d='M4 2h6l4 4v8H4z' fill='none' stroke='currentColor' /></svg>
            </PsgIconWrapper>
            <PsgInfoWrapper>
              <h3 data-testid='psg-infowrapper-h3'>Start with an empty menu</h3>
              <p data-testid='psg-infowrapper-p'>Start with an empty menu and enter your menu items</p>
            </PsgInfoWrapper>
          </PsgContainer>
        </div>

        <div data-testid='product-ingredient-group' aria-label='Product ingredients'>
          <PiHeader>
            <h1 data-testid='pi-header-h1'>Ingredients / Properties</h1>
            <button type='button'>Add ingredient</button>
          </PiHeader>

          {/* Native-button conversion: the only one in this batch, see file header. */}
          <PiIngredientOption as='button' type='button' aria-pressed='false' data-testid='pi-ingredientoption-root'>
            <span>Sample ingredient</span>
            <svg data-testid='pi-ingredientoption-svg' viewBox='0 0 16 16' width='13' height='13' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' /></svg>
          </PiIngredientOption>
        </div>

        <div data-testid='product-ingredient-details-group' aria-label='Product ingredient details'>
          <PidHeader>
            <h1 data-testid='pid-header-h1'>Add ingredient</h1>
            <div>
              <PidActionSelectorWrapper>
                <div className='dropdown'>
                  <button type='button' aria-label='More actions'>
                    <svg data-testid='pid-actionselectorwrapper-button-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><circle cx='2' cy='8' r='1.4' /><circle cx='8' cy='8' r='1.4' /><circle cx='14' cy='8' r='1.4' /></svg>
                  </button>
                  <div className='dropdown-menu'>
                    <div>
                      <button type='button' className='dropdown-item' data-testid='pid-actionselectorwrapper-div-div-dropdown-item'>Delete</button>
                    </div>
                  </div>
                </div>
              </PidActionSelectorWrapper>
              <button type='button' aria-label='Close'>
                <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M3 3l10 10M13 3L3 13' fill='none' stroke='currentColor' /></svg>
              </button>
            </div>
          </PidHeader>

          <PidInputWrapper>
            <label data-testid='pid-inputwrapper-label'>Name</label>
            <input type='text' aria-label='Name' defaultValue='Cheddar cheese' readOnly />
          </PidInputWrapper>
        </div>

        <div data-testid='product-tag-details-group' aria-label='Product tag details'>
          <PtdHeader>
            <h1 data-testid='ptd-header-h1'>Add new label</h1>
            <PtdActionSelectorWrapper>
              <div className='dropdown'>
                <button type='button' aria-label='More actions'>
                  <svg data-testid='ptd-actionselectorwrapper-button-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><circle cx='2' cy='8' r='1.4' /><circle cx='8' cy='8' r='1.4' /><circle cx='14' cy='8' r='1.4' /></svg>
                </button>
                <div className='dropdown-menu'>
                  <div>
                    <button type='button' className='dropdown-item' data-testid='ptd-actionselectorwrapper-div-div-dropdown-item'>Delete</button>
                  </div>
                </div>
              </div>
            </PtdActionSelectorWrapper>
          </PtdHeader>

          <PtdUploadImageIcon>
            <svg viewBox='0 0 16 16' width='45' height='45' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            {/* SYNTHETIC PROBE — ptd-uploadimageicon-span is an orphaned selector, see file header. */}
            <span data-testid='ptd-uploadimageicon-span'>Synthetic probe — no live span here</span>
          </PtdUploadImageIcon>

          <PtdFormController>
            <label data-testid='ptd-formcontroller-label'>Name</label>
            <input type='text' aria-label='Name' defaultValue='Spicy' readOnly />
          </PtdFormController>
        </div>

        <div data-testid='product-tags-list-group' aria-label='Product tags list'>
          <PtlSelectButtonGroup>
            <button type='button' data-testid='ptl-selectbuttongroup-button'>Select all</button>
            <button type='button'>Select none</button>
          </PtlSelectButtonGroup>

          {/* NOT converted to a native button: contains a Checkbox, and nesting a checkbox inside a button is invalid, see file header. */}
          <PtlProductTagWrapper onClick={() => {}}>
            <div>
              <input type='checkbox' className='product-tag-checkbox' aria-label='Select tag' readOnly />
              <PtlTagImageWrapper>
                <svg data-testid='ptl-tagimagewrapper-svg' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
              </PtlTagImageWrapper>
              <span className='tag-name' data-testid='ptl-producttagwrapper-span-tag-name'>Vegetarian</span>
            </div>
            <svg viewBox='0 0 16 16' width='13' height='13' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' /></svg>
          </PtlProductTagWrapper>
        </div>

      </section>

    </main>
  )
}
