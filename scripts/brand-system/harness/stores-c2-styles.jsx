import React from 'react'

import {
  MetaTitle as PemfMetaTitle,
  MetaContainer as PemfMetaContainer,
  MetaAddContainer as PemfMetaAddContainer,
  RoundBorder as PemfRoundBorder
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductExtraMetaFields/styles'
import {
  MetaTitle as PeomfMetaTitle,
  MetaContainer as PeomfMetaContainer,
  MetaAddContainer as PeomfMetaAddContainer,
  RoundBorder as PeomfRoundBorder
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductExtraOptionMetaFields/styles'
import {
  MetaTitle as PesmfMetaTitle,
  MetaContainer as PesmfMetaContainer,
  MetaAddContainer as PesmfMetaAddContainer,
  RoundBorder as PesmfRoundBorder
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductExtraSubOptionMetaFields/styles'
import {
  Header as PexHeader,
  OptionNameWrapper as PexOptionNameWrapper,
  ExtraOptionEditContainer as PexExtraOptionEditContainer,
  FormControl as PexFormControl,
  Details as PexDetails,
  MoreContainer as PexMoreContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductExtras/styles'
import {
  Header as PeodHeader,
  ActionSelectorWrapper as PeodActionSelectorWrapper,
  InputWrapper as PeodInputWrapper,
  ModifierOptionsContainer as PeodModifierOptionsContainer,
  ActionsContainer as PeodActionsContainer,
  UploadImageIcon as PeodUploadImageIcon
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductExtraOptionDetails/styles'
import {
  InputWrapper as PeofInputWrapper,
  EnableWrapper as PeofEnableWrapper,
  CheckboxWrapper as PeofCheckboxWrapper,
  SelectboxGroup as PeofSelectboxGroup,
  ActionsContainer as PeofActionsContainer,
  UploadImageIcon as PeofUploadImageIcon
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductExtraOptionForm/styles'
import {
  Header as PeoHeader,
  OptionNameContainer as PeoOptionNameContainer,
  ActionSelectorWrapper as PeoActionSelectorWrapper,
  AddOptionForm as PeoAddOptionForm,
  MinimumPurchase as PeoMinimumPurchase,
  MaxPurchase as PeoMaxPurchase,
  OptionImage as PeoOptionImage,
  ArrowWrpper as PeoArrowWrpper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductExtraOptions/styles'
import {
  InputWrapper as PesInputWrapper,
  EnableWrapper as PesEnableWrapper,
  ActionSelectorWrapper as PesActionSelectorWrapper,
  ActionsContainer as PesActionsContainer,
  UploadImageIcon as PesUploadImageIcon
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductExtraSuboption/styles'

// Presentation-only fixture: the real Stores product-extras/suboptions styled
// surfaces for batch c2-product-extras-suboptions, no controller, SDK, account
// or network. Eight source files are mounted; `MetaTitle`/`MetaContainer`/
// `MetaAddContainer`/`RoundBorder` (the three ProductExtra*MetaFields files),
// `Header` (ProductExtras / ProductExtraOptionDetails / ProductExtraOptions),
// `InputWrapper` (ProductExtraOptionDetails / ProductExtraOptionForm /
// ProductExtraSuboption), `EnableWrapper` (ProductExtraOptionForm /
// ProductExtraSuboption), `ActionsContainer` (ProductExtraOptionDetails /
// ProductExtraOptionForm / ProductExtraSuboption), `ActionSelectorWrapper`
// (ProductExtraOptionDetails / ProductExtraOptions / ProductExtraSuboption),
// `UploadImageIcon` (ProductExtraOptionDetails / ProductExtraOptionForm /
// ProductExtraSuboption) and `Details` (ProductExtras only, aliased anyway per
// the assignment's naming-collision list) are all aliased at the import site
// with a folder-prefix matching their data-testid prefix, the same convention
// stores-c1-styles.jsx uses for `Container`/`Tab`.
//
// Real-nesting notes and adaptations (checked against each source styles.js
// and its consuming index.js before mounting):
// - The three ProductExtra*MetaFields files (ProductExtraMetaFields,
//   ProductExtraOptionMetaFields, ProductExtraSubOptionMetaFields) are
//   structurally identical to each other and to batch c1's ProductMetaFields:
//   `MetaContainer`'s `.meta_type` and `.meta_value > svg` are genuine
//   descendants (`<MetaContainer><div className='meta_type'>{...}</div><div
//   className='meta_key'><RoundBorder>{...}</RoundBorder></div><div
//   className='meta_value'><RoundBorder>{...}</RoundBorder><BsTrash
//   onClick={...} /></div></MetaContainer>`, verified in all three index.js
//   files) — mounted the same way with a decorative svg standing in for
//   `BsTrash`. Unlike c1's `ProductMetaFields`, none of these three declares
//   `font-size` twice inside the same `input{}`/`h4{}` block, so each
//   `MetaAddContainer input` testid is a single real `<input>`, no `-14`/`-16`
//   split needed this time.
// - ProductExtras/styles.js's `Header > h1` and its sibling `button` are a
//   genuine direct-child pair (`<Header><h1>...</h1><Button>...</Button
//   ></Header>`). `OptionNameWrapper`'s `> span.name` and `button > svg` are
//   genuine (`<OptionNameWrapper><span className='name'>{extra.name}</span>
//   <IconButton onClick={...}><Pencil /></IconButton></OptionNameWrapper>`,
//   `IconButton` mounted as a literal `<button>` per the b8/c1 convention for
//   that Shared/UI wrapper). `ExtraOptionEditContainer > h2` and `FormControl`
//   `label` are genuine (`<ExtraOptionEditContainer><h2>...</h2><FormControl>
//   <label>...</label><Input /></FormControl>...</ExtraOptionEditContainer>`).
// - ProductExtras/styles.js's `MoreContainer`'s own `svg{}` rule (20px) is
//   SHADOWED in the live render: index.js nests `OptionNameWrapper` (whose
//   `button > svg` rule is 14px) and `Details` (whose own `svg{}` rule is
//   13px) directly inside `MoreContainer`
//   (`<MoreContainer><OptionNameWrapper>...</OptionNameWrapper><Details>
//   <ChevronRight /></Details></MoreContainer>`), and both of those rules are
//   more specific than `MoreContainer`'s own descendant `svg{}` selector, so
//   the 20px declaration never paints any glyph today. Mounted a SYNTHETIC
//   PROBE — a bare `<svg>` as a direct sibling of `OptionNameWrapper` and
//   `Details` inside `MoreContainer`, outside both, so the plain descendant
//   selector has something to resolve against that isn't shadowed.
// - ProductExtras/styles.js's `Details` root (14px, on the styled `div`
//   itself) is genuine, but its only real child is `<ChevronRight />`, which
//   carries its own nested `svg{}` rule (13px) — there is never a text node
//   for the 14px declaration to paint. Mounted the real node as-is (a
//   decorative svg standing in for `ChevronRight`), per the assignment's
//   instruction to mount it unchanged.
// - ProductExtraOptionDetails/styles.js's `Header > h1` is genuine
//   (`<Header><h1>...</h1><ActionSelectorWrapper>...</ActionSelectorWrapper>
//   </Header>`). `InputWrapper`'s `label` and `ModifierOptionsContainer`'s
//   `h2` are both genuine (`<InputWrapper header><label>...</label><Input />
//   </InputWrapper>`, `<ModifierOptionsContainer><h2>...</h2>
//   <SubOptionContainer>...</SubOptionContainer></ModifierOptionsContainer>`)
//   — mounted `InputWrapper` as a leaf sibling of the `h2` inside
//   `ModifierOptionsContainer` rather than reproducing the intermediate
//   `SubOptionContainer`/`LeftSubOptionContent` wrappers, which gate nothing
//   `InputWrapper`'s own `label` selector depends on (same "mount each leaf
//   surface standalone" convention the b8/c1 fixtures use).
// - `ActionSelectorWrapper`'s `> div > > div > .dropdown-item` and
//   `button > svg` in ProductExtraOptionDetails, ProductExtraOptions and
//   ProductExtraSuboption all wrap a react-bootstrap `DropdownButton`/
//   `Dropdown.Item` (`title={<ThreeDots />}`), the identical shape the b8/c1
//   fixtures documented for this same component: a `.dropdown` wrapper with a
//   toggle `<button>` containing the title icon directly (`button > svg`) and
//   a `.dropdown-menu` holding `.dropdown-item` entries reached via the
//   rule's `> div > > div > .dropdown-item` path — mounted with the same
//   plain `div`/`button` elements carrying those literal classNames in all
//   three files, reusing the b8/c1 precedent rather than re-deriving
//   react-bootstrap's real DOM from scratch.
// - `ActionsContainer > svg` in ProductExtraOptionDetails,
//   ProductExtraOptionForm and ProductExtraSuboption NEVER RESOLVES in any of
//   the three live renders: in ProductExtraOptionDetails, the only svg near
//   `ActionsContainer` is `PlusCircle` INSIDE an `IconButton`'s native
//   `<button>` (`<ActionsContainer><IconButton color='primary' type='submit'>
//   <PlusCircle /></IconButton></ActionsContainer>`) — a descendant, not a
//   direct child; in ProductExtraOptionForm and ProductExtraSuboption,
//   `ActionsContainer` only ever wraps `EnableWrapper`/`ActionSelectorWrapper`
//   (`<ActionsContainer top><EnableWrapper>...</EnableWrapper>
//   </ActionsContainer>`, `<ActionsContainer><EnableWrapper>...
//   </EnableWrapper><ActionSelectorWrapper>...</ActionSelectorWrapper>
//   </ActionsContainer>`) — there is no svg at all. Mounted a SYNTHETIC PROBE
//   `<svg>` as a direct child of `ActionsContainer` in all three files,
//   alongside the real content each one actually renders there.
// - `UploadImageIcon` (TERNARY: `font-size: ${({ small }) => small ? '16px'
//   : '32px'}`) appears in ProductExtraOptionDetails, ProductExtraOptionForm
//   and ProductExtraSuboption. Each file has exactly ONE real call site
//   (grepped, no ternary/conditional prop-spreading at the call site):
//   ProductExtraOptionDetails and ProductExtraSuboption both call
//   `<UploadImageIcon small>` — the 16px branch is the one with a live call
//   site in each of those two files. ProductExtraOptionForm calls
//   `<UploadImageIcon>` with no `small` prop anywhere — the 16px/`small`
//   branch is DEAD in that file (its one and only call site never passes the
//   prop). Mounted BOTH branches in all three files per the assignment (the
//   32px/no-`small` instance carries the table's base testid, the 16px/
//   `small` instance carries the same testid with a `-small` suffix), so both
//   are observable regardless of which one has a live call site.
// - NEW finding (not in the assignment's flagged list): ProductExtraSuboption/
//   styles.js's `InputWrapper`'s `label` rule (14px) is an ORPHANED SELECTOR —
//   grepping the whole index.js for `<label` returns zero matches. Every
//   `InputWrapper` instance in this file wraps a `Controller`/`Input` pair or
//   a bare `.default` div (`<InputWrapper><Controller ... render={() => (
//   <Input .../>)} /></InputWrapper>`, `<InputWrapper maxHeight><div
//   className='default' /></InputWrapper>`) — never a `<label>` element,
//   unlike ProductExtraOptionDetails and ProductExtraOptionForm, where
//   `InputWrapper` genuinely renders a `<label>` child. Mounted a SYNTHETIC
//   PROBE `<label>` inside `InputWrapper` carrying the table's testid — this
//   label does not exist in this file's live UI.
// - ProductExtraOptionForm/styles.js's `EnableWrapper`'s `span` and
//   `CheckboxWrapper`'s `label` are genuine (`<ActionsContainer top>
//   <EnableWrapper><span>...</span><Controller ... render={() => (<Switch
//   .../>)} /></EnableWrapper></ActionsContainer>`, `<CheckboxWrapper>
//   <Checkbox .../><label htmlFor='...'>...</label></CheckboxWrapper>`) —
//   `EnableWrapper` only ever appears nested inside `ActionsContainer` in this
//   file, so it is mounted there rather than as a standalone sibling.
//   `SelectboxGroup`'s `> p` is also genuine, the real fallback branch of a
//   conditional (`<SelectboxGroup>{cond ? <Select .../> : <p>...</p>}
//   </SelectboxGroup>`) — mounted with a plain `div` standing in for `Select`
//   in its truthy branch and the real `<p>` in its falsy branch.
// - ProductExtraSuboption/styles.js's `EnableWrapper`'s `span` is genuine and,
//   like ProductExtraOptionForm, only ever appears nested inside
//   `ActionsContainer` (`<ActionsContainer><EnableWrapper><span>...</span>
//   <Switch .../></EnableWrapper><ActionSelectorWrapper>...
//   </ActionSelectorWrapper></ActionsContainer>`) — mounted there, alongside
//   the real `ActionSelectorWrapper` and the `ActionsContainer` probe above.
// - ProductExtraOptions/styles.js's `Header > input` and its sibling
//   `ActionSelectorWrapper` (wrapped in a real `div`) are genuine
//   (`<Header><input .../><div><ActionSelectorWrapper>...
//   </ActionSelectorWrapper></div></Header>`). `OptionNameContainer` is
//   mounted TWICE — once with `isHeader` (12px/secondary, the real column
//   heading row: `<OptionItem isHeader><OptionNameContainer isHeader>Name
//   </OptionNameContainer>...</OptionItem>`) and once without (14px/content,
//   the real data row: `<OptionNameContainer><OptionImage>...</OptionImage>
//   <span>{option.name}</span></OptionNameContainer>`) — both genuine.
//   `MinimumPurchase`/`MaxPurchase` are each mounted twice the same way, from
//   the same header/data rows. `OptionImage svg` is genuine, the real
//   fallback of a conditional (`<OptionImage>{option?.image ? <img /> :
//   <ImageIcon />}</OptionImage>`) — mounted with a decorative svg standing
//   in for `ImageIcon`. `ArrowWrpper svg` is genuine from the data row
//   (`<ArrowWrpper><ChevronRight /></ArrowWrpper>`; the header row's
//   `<ArrowWrpper />` renders no icon at all). `AddOptionForm > input` is a
//   genuine direct child — the "min" input in the add-option form
//   (`<AddOptionForm><OptionNameContainer><input name='name' .../>
//   </OptionNameContainer><input name='min' .../><input name='max' .../>
//   <IconButton type='submit' .../></AddOptionForm>`) is a direct child of
//   `AddOptionForm`, unlike the "name" input, which is nested one level
//   deeper inside `OptionNameContainer`.
//
// This batch has no HERO/SIMULACION region and no native-button conversion:
// per the assignment, none of this lot's `div`s are clickable controls.
export const StoresC2StylesFixture = () => {
  return (
    <main data-testid='stores-c2-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <section data-testid='c2-dashboard-surfaces' aria-label='Product extras and suboptions dashboard surfaces'>

        <div data-testid='product-extra-meta-fields-group' aria-label='Product extra custom fields'>
          <PemfMetaTitle data-testid='pemf-metatitle-root'>Custom Fields</PemfMetaTitle>
          <PemfMetaContainer>
            <div className='meta_type' data-testid='pemf-metacontainer-meta-type'>text</div>
            <div className='meta_key'>
              <PemfRoundBorder data-testid='pemf-roundborder-root'>extra_event_key</PemfRoundBorder>
            </div>
            <div className='meta_value'>
              <PemfRoundBorder>Sample extra value</PemfRoundBorder>
              <svg data-testid='pemf-metacontainer-meta-value-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><path d='M3 4h10M6 4V2h4v2M4 4l1 10h6l1-10' fill='none' stroke='currentColor' /></svg>
            </div>
          </PemfMetaContainer>
          <PemfMetaAddContainer>
            <div className='meta_type'>text</div>
            <div className='meta_key'>
              <input data-testid='pemf-metaaddcontainer-input' type='text' placeholder='key' aria-label='key' />
            </div>
          </PemfMetaAddContainer>
        </div>

        <div data-testid='product-extra-option-meta-fields-group' aria-label='Product extra option custom fields'>
          <PeomfMetaTitle data-testid='peomf-metatitle-root'>Custom Fields</PeomfMetaTitle>
          <PeomfMetaContainer>
            <div className='meta_type' data-testid='peomf-metacontainer-meta-type'>number</div>
            <div className='meta_key'>
              <PeomfRoundBorder data-testid='peomf-roundborder-root'>option_event_key</PeomfRoundBorder>
            </div>
            <div className='meta_value'>
              <PeomfRoundBorder>42</PeomfRoundBorder>
              <svg data-testid='peomf-metacontainer-meta-value-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><path d='M3 4h10M6 4V2h4v2M4 4l1 10h6l1-10' fill='none' stroke='currentColor' /></svg>
            </div>
          </PeomfMetaContainer>
          <PeomfMetaAddContainer>
            <div className='meta_type'>number</div>
            <div className='meta_key'>
              <input data-testid='peomf-metaaddcontainer-input' type='text' placeholder='key' aria-label='key' />
            </div>
          </PeomfMetaAddContainer>
        </div>

        <div data-testid='product-extra-suboption-meta-fields-group' aria-label='Product extra suboption custom fields'>
          <PesmfMetaTitle data-testid='pesmf-metatitle-root'>Custom Fields</PesmfMetaTitle>
          <PesmfMetaContainer>
            <div className='meta_type' data-testid='pesmf-metacontainer-meta-type'>boolean</div>
            <div className='meta_key'>
              <PesmfRoundBorder data-testid='pesmf-roundborder-root'>suboption_event_key</PesmfRoundBorder>
            </div>
            <div className='meta_value'>
              <PesmfRoundBorder>true</PesmfRoundBorder>
              <svg data-testid='pesmf-metacontainer-meta-value-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><path d='M3 4h10M6 4V2h4v2M4 4l1 10h6l1-10' fill='none' stroke='currentColor' /></svg>
            </div>
          </PesmfMetaContainer>
          <PesmfMetaAddContainer>
            <div className='meta_type'>boolean</div>
            <div className='meta_key'>
              <input data-testid='pesmf-metaaddcontainer-input' type='text' placeholder='key' aria-label='key' />
            </div>
          </PesmfMetaAddContainer>
        </div>

        <div data-testid='product-extras-group' aria-label='Product options list'>
          <PexHeader>
            <h1 data-testid='pex-header-h1'>Product options</h1>
            <button type='button'>Add product option</button>
          </PexHeader>

          <PexMoreContainer>
            <PexOptionNameWrapper>
              <span className='name' data-testid='pex-optionnamewrapper-span-name'>Toppings</span>
              <button type='button' aria-label='Edit option'>
                <svg data-testid='pex-optionnamewrapper-button-svg' viewBox='0 0 16 16' width='14' height='14' aria-hidden='true' focusable='false'><path d='M2 14l1-4 9-9 3 3-9 9-4 1z' fill='none' stroke='currentColor' /></svg>
              </button>
            </PexOptionNameWrapper>
            {/* Details' only real child is a ChevronRight — the root's own 14px font-size never paints any text, see file header. */}
            <PexDetails data-testid='pex-details-root'>
              <svg data-testid='pex-details-svg' viewBox='0 0 16 16' width='13' height='13' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' /></svg>
            </PexDetails>
            {/* SYNTHETIC PROBE — see file header: MoreContainer's own svg{} rule (20px) is shadowed by OptionNameWrapper's button > svg (14px) and Details' svg (13px); a sibling of both is needed for the 20px declaration to ever resolve. */}
            <svg data-testid='pex-morecontainer-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
          </PexMoreContainer>

          <PexExtraOptionEditContainer>
            <h2 data-testid='pex-extraoptioneditcontainer-h2'>Product option</h2>
            <PexFormControl>
              <label data-testid='pex-formcontrol-label'>Name</label>
              <input type='text' aria-label='Name' defaultValue='Toppings' readOnly />
            </PexFormControl>
          </PexExtraOptionEditContainer>
        </div>

        <div data-testid='product-extra-option-details-group' aria-label='Product extra option details'>
          <PeodHeader>
            <h1 data-testid='peod-header-h1'>Product option</h1>
            <PeodActionSelectorWrapper>
              <button type='button' className='snooze'>Snooze</button>
              <div className='dropdown'>
                <button type='button' aria-label='More actions'>
                  <svg data-testid='peod-actionselectorwrapper-button-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><circle cx='2' cy='8' r='1.4' /><circle cx='8' cy='8' r='1.4' /><circle cx='14' cy='8' r='1.4' /></svg>
                </button>
                <div className='dropdown-menu'>
                  <div>
                    <button type='button' className='dropdown-item' data-testid='peod-actionselectorwrapper-div-div-dropdown-item'>Delete option</button>
                  </div>
                </div>
              </div>
            </PeodActionSelectorWrapper>
          </PeodHeader>

          <PeodModifierOptionsContainer>
            <h2 data-testid='peod-modifieroptionscontainer-h2'>Modifier options</h2>
            <PeodInputWrapper header>
              <label data-testid='peod-inputwrapper-label'>Name</label>
              <input type='text' aria-label='Name' readOnly />
            </PeodInputWrapper>
          </PeodModifierOptionsContainer>

          <PeodActionsContainer>
            <button type='button' aria-label='Add suboption'>
              <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M8 3v10M3 8h10' fill='none' stroke='currentColor' /></svg>
            </button>
            {/* SYNTHETIC PROBE — see file header: the real svg (PlusCircle) hangs inside the IconButton's native <button>, never a direct child of ActionsContainer, so `> svg` never resolves live. */}
            <svg data-testid='peod-actionscontainer-svg' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M8 3v10M3 8h10' fill='none' stroke='currentColor' /></svg>
          </PeodActionsContainer>

          {/* TERNARY — see file header. Real call site passes `small` (16px branch is the one with a live call site here). */}
          <PeodUploadImageIcon>
            <svg data-testid='peod-uploadimageicon-dyn' viewBox='0 0 16 16' width='32' height='32' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            <span>Put your image here</span>
          </PeodUploadImageIcon>
          <PeodUploadImageIcon small>
            <svg data-testid='peod-uploadimageicon-dyn-small' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            <span>Put your image here</span>
          </PeodUploadImageIcon>
        </div>

        <div data-testid='product-extra-option-form-group' aria-label='Product extra option form'>
          <PeofInputWrapper primary noMargin>
            <label data-testid='peof-inputwrapper-label'>Option name</label>
            <input type='text' aria-label='Option name' defaultValue='Toppings' readOnly />
          </PeofInputWrapper>

          <PeofCheckboxWrapper>
            <input type='checkbox' id='peof-with-half-option' aria-label='Allow half option and price' readOnly />
            <label htmlFor='peof-with-half-option' data-testid='peof-checkboxwrapper-label'>Allow half option & price</label>
          </PeofCheckboxWrapper>

          <PeofSelectboxGroup>
            <div>Select option</div>
            <p data-testid='peof-selectboxgroup-p'>No choices available</p>
          </PeofSelectboxGroup>

          <PeofActionsContainer top>
            <PeofEnableWrapper>
              <span data-testid='peof-enablewrapper-span'>Enable</span>
              <input type='checkbox' aria-label='Enable' defaultChecked readOnly />
            </PeofEnableWrapper>
            {/* SYNTHETIC PROBE — see file header: ActionsContainer here only ever wraps EnableWrapper, no svg at all in the live render — `> svg` never resolves. */}
            <svg data-testid='peof-actionscontainer-svg' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M8 3v10M3 8h10' fill='none' stroke='currentColor' /></svg>
          </PeofActionsContainer>

          {/* TERNARY — see file header. Real call site omits `small` entirely — the small/16px branch is DEAD in this file. */}
          <PeofUploadImageIcon>
            <svg data-testid='peof-uploadimageicon-dyn' viewBox='0 0 16 16' width='32' height='32' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            <span>Put your image here</span>
          </PeofUploadImageIcon>
          <PeofUploadImageIcon small>
            <svg data-testid='peof-uploadimageicon-dyn-small' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            <span>Put your image here (never called this way — see file header)</span>
          </PeofUploadImageIcon>
        </div>

        <div data-testid='product-extra-options-group' aria-label='Product extra options'>
          <PeoHeader>
            <input data-testid='peo-header-input' type='text' aria-label='Extra name' defaultValue='Toppings' readOnly />
            <div>
              <PeoActionSelectorWrapper>
                <div className='dropdown'>
                  <button type='button' aria-label='More actions'>
                    <svg data-testid='peo-actionselectorwrapper-button-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><circle cx='2' cy='8' r='1.4' /><circle cx='8' cy='8' r='1.4' /><circle cx='14' cy='8' r='1.4' /></svg>
                  </button>
                  <div className='dropdown-menu'>
                    <div>
                      <button type='button' className='dropdown-item' data-testid='peo-actionselectorwrapper-div-div-dropdown-item'>Custom Fields</button>
                    </div>
                  </div>
                </div>
              </PeoActionSelectorWrapper>
            </div>
          </PeoHeader>

          <div>
            <PeoOptionNameContainer isHeader data-testid='peo-optionnamecontainer-root-12'>Name</PeoOptionNameContainer>
            <PeoMinimumPurchase isHeader data-testid='peo-minimumpurchase-root-12'>Min</PeoMinimumPurchase>
            <PeoMaxPurchase isHeader data-testid='peo-maxpurchase-root-12'>Max</PeoMaxPurchase>
          </div>

          <div>
            <PeoOptionNameContainer data-testid='peo-optionnamecontainer-root-14'>
              <PeoOptionImage>
                <svg data-testid='peo-optionimage-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
              </PeoOptionImage>
              <span>Extra cheese</span>
            </PeoOptionNameContainer>
            <PeoMinimumPurchase data-testid='peo-minimumpurchase-root-14'>0</PeoMinimumPurchase>
            <PeoMaxPurchase data-testid='peo-maxpurchase-root-14'>1</PeoMaxPurchase>
            <PeoArrowWrpper>
              <svg data-testid='peo-arrowwrpper-svg' viewBox='0 0 16 16' width='13' height='13' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' /></svg>
            </PeoArrowWrpper>
          </div>

          <PeoAddOptionForm>
            <PeoOptionNameContainer>
              <input type='text' aria-label='Write a name' placeholder='Write a name' readOnly />
            </PeoOptionNameContainer>
            <input data-testid='peo-addoptionform-input' type='text' aria-label='Min' readOnly />
            <input type='text' aria-label='Max' readOnly />
          </PeoAddOptionForm>
        </div>

        <div data-testid='product-extra-suboption-group' aria-label='Product extra suboption'>
          {/* SYNTHETIC PROBE — see file header: no InputWrapper instance in this file ever renders a <label>; every one wraps a Controller/Input pair or a bare .default div. */}
          <PesInputWrapper>
            <label data-testid='pes-inputwrapper-label'>Name</label>
            <input type='text' aria-label='Name' defaultValue='Extra cheese' readOnly />
          </PesInputWrapper>

          <PesActionsContainer>
            <PesEnableWrapper>
              <span data-testid='pes-enablewrapper-span'>Enable</span>
              <input type='checkbox' aria-label='Enable' defaultChecked readOnly />
            </PesEnableWrapper>
            <PesActionSelectorWrapper>
              <div className='dropdown'>
                <button type='button' aria-label='More actions'>
                  <svg data-testid='pes-actionselectorwrapper-button-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><circle cx='2' cy='8' r='1.4' /><circle cx='8' cy='8' r='1.4' /><circle cx='14' cy='8' r='1.4' /></svg>
                </button>
                <div className='dropdown-menu'>
                  <div>
                    <button type='button' className='dropdown-item' data-testid='pes-actionselectorwrapper-div-div-dropdown-item'>Snooze</button>
                  </div>
                </div>
              </div>
            </PesActionSelectorWrapper>
            {/* SYNTHETIC PROBE — see file header: ActionsContainer here wraps EnableWrapper/ActionSelectorWrapper only, no svg at all — `> svg` never resolves. */}
            <svg data-testid='pes-actionscontainer-svg' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M8 3v10M3 8h10' fill='none' stroke='currentColor' /></svg>
          </PesActionsContainer>

          {/* TERNARY — see file header. Real call site passes `small` (16px branch is the one with a live call site here). */}
          <PesUploadImageIcon>
            <svg data-testid='pes-uploadimageicon-dyn' viewBox='0 0 16 16' width='32' height='32' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            <span>Put your image here</span>
          </PesUploadImageIcon>
          <PesUploadImageIcon small>
            <svg data-testid='pes-uploadimageicon-dyn-small' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            <span>Put your image here</span>
          </PesUploadImageIcon>
        </div>

      </section>

    </main>
  )
}
