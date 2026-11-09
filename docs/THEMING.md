# Website themes (Builder, themes v2)

How a Builder website's look is edited in the dashboard, and who owns each part. Read this before changing the theme editor, the website's settings in Builder, or the theme calls in `builderApi.js`.

This document describes how things work **today**. It is not a changelog: when any of this changes (an API contract, a control, a notice, an owner), edit this file in the same change so it stays true.

Not covered here: the dashboard's own look ([`docs/BRAND.md`](./BRAND.md), `src/theme.json`) and the legacy website and app editors under My Products.

## Who owns what

| Owner | Owns | Does not |
| --- | --- | --- |
| **ordering-theme-engine** (PHP package `orderingco/ordering-theme-engine`, TypeScript CLI `ordering-theme`) | The schema format (`docs/schema-format.md`, `docs/creating-a-schema.md`): nodes, types, `co.ordering` and `co.ordering.editor` extensions, the meta-schema, migrations (`co.ordering.migrate`), the resolver, the validation rules and their error codes, `runtimeRules(schema)` | Store themes or serve anything |
| **The product's repo** (`website-marketplace-v26` for `marketplace_website`) | Its schema `product.schema.json`: every key, default, image and page; the `editor` block (sections, groups, order); each node's label, help, control, range and options. Publishes it on every deploy (`pnpm theme:publish:<env>`). Renders the theme | Edit themes |
| **api-core** | The authority. Registers and re-validates each schema version; serves the current one (`GET …/theme/schema`); stores themes, drafts and the website's settings; validates every write; resolves; converts what was saved with another version (another base, or a rollback); clamps stored numbers out of range; presets; theme images. See the API theme and schema contract documentation | Decide how the editor looks |
| **ordering-dashboard** (this repo) | The Builder screens: the themes list, the theme editor and the website's settings. Draws the editor from the schema with a fixed catalog of controls; says what the API answers (refusals, conversions, values dropped or clamped); translates its own texts and the schema's label keys | Know theme keys, defaults or rules. A new component, property, image or page needs no dashboard change |
| **websites-router** | Serves the websites | Read the theme |

The dashboard follows api-core's current contract only: no fallbacks for fields or formats api-core no longer answers.

## Where it is

Route: `/builder/:productId` (admins). A website's detail has the tabs `general`, `site` and `theme`.

- `?tab=theme`: the themes list. `&theme=<id>` opens one in the editor; `&section=<key>` and, in a list section, `&item=<path>` (`components.button`) say what the editor has open, so a link opens it again. An unknown section or item opens the first one. Leaving the editor drops `theme`, `section` and `item`.
- `?tab=site`: the website's settings.

My Products' legacy website pages never create a website and send to Builder: a project with no website sees "Websites are now made in Builder". The legacy website's migration to Builder (`MyProducts/WebsiteMigration`) shows only when the build sets `VITE_WEBSITE_MIGRATION=true`; without it, a website already migrated also sees "Websites are now made in Builder".

| What | Controller (`src/@/components-dashboard/src/components/Builder/`) | UI (`src/@/components-dashboard/src/ui/src/components/Builder/`) |
| --- | --- | --- |
| API calls and their contract (doc comment on each) | `builderApi.js` | |
| Themes list: create, activate, delete, presets | `BuilderProductThemes` | `BuilderWebTheme/index.js`, `CreateThemePanel.js` |
| Theme editor: edits, resolve, save, publish, discard, reset, rename, images | `BuilderThemeEditor` | `BuilderWebTheme/ThemeEditor.js` (header, notices, save bar) |
| Editor drawn from the schema | | `ThemeSchemaEditor/` (`index.js` sections and lists, `SchemaGroup.js` groups and fields, `controls.js` the controls, `schemaNodes.js` schema and path helpers) |
| Website settings (`site` of the schema, scope) | `BuilderSiteSettings` | `ThemeSchemaEditor/SiteSettings.js`, `ScopeControl.js` |

## How the editor is drawn

1. `GET …/products/{id}/theme/schema` gives the `schema` and the common `format` (token names, `fonts`, derived colors and roles the API works out and the editor hides). A schema without `editor.sections` shows "The editor for this website isn't ready yet".
2. `editor.sections` gives the sections, their groups and order.
   - A card section shows exactly its groups' `paths`.
   - A list section (Components, Pages) walks every child in `order`, with a detail per item; a component shows a tab per part (`part`, `placement` of its cards).
3. Each node's control comes from `co.ordering.editor.control`, looked up in `CONTROLS` (`controls.js`): `color`, `level`, `range`, `select`, `segmented`, `toggle`, `border`, `shadow`, `typography`, `font`, `image`, `text`, `html`, `cards`, `scope`, plus `sortable_sections` for a page's sections. A control the dashboard doesn't know, or a value of the wrong shape, shows read-only.
   - `html` is `Shared/RichHtmlEditor` (Tiptap, loaded on demand): a visual editor with the CMS editor's tools (text style, bold, italic, underline, size, colors, lists, alignment, tables, links, images from the project's files, videos) and an "Edit as HTML" view. It opens in the visual editor only when the visual editor gives back the same HTML (`keepsHtml` in `richHtml.js`); HTML it would change (layout `div`s, classes, `<style>`, `<script>`, `<font>`…) opens as HTML, is saved as it is, and can't go to the visual editor until it could keep it. The Settings CMS pages still use summernote.
4. Nodes marked `hidden` or `$deprecated` are left out. `visible_if`, `disabled_if`, `platform` (per-platform values, `co.ordering.platforms`) and `co.ordering.follows` (a prop that follows Identity until set) shape what shows.
5. Texts are `{ key, default }`, shown with `t(key, default)` (`formatText`).
6. A saved value outside a control's options still shows as the chosen one.

In Website settings, `SiteSettingsEditor` gives `site.mode` the `scope` control whatever its schema declares (the published `marketplace_website` schema says `cards`), so the renderer has no special case for it. A `scope` node reads the product's `business_id` / `franchise_id`, never `settings.mode`: the selected type shows the project's store or franchise picker, and Marketplace clears both IDs. It shows as changed while it isn't its default (Marketplace), and its reset sets Marketplace with `setScopeMode`. Read-only, it shows the product's type. Other nodes still use their schema's control.

The website reads its type and settings from `values.site` of the active theme's `first_load`: api-core serves no theme, and so no `values.site`, while the website has no active theme, and the website is then a marketplace without them. `BuilderSiteSettings` lists the website's themes (`hasActiveTheme`: `null` while it doesn't know), and while none is active the Website settings tab says these settings wait for one, with a button to the Theme tab (`onGoToTheme`).

## Editing a theme

- Changes stay in the editor (`edits`, shaped like the theme; `null` takes the default back) until saved. A moment after the last change (`RESOLVE_DELAY`, 300 ms) `POST …/resolve` shows how the theme looks with them, and where each value comes from (`sources`).
- **Save draft**: `PUT …/draft` with the changes only, never the whole tree.
- **Publish**: saves what is pending, then `POST …/publish`. The active theme is the one customers see.
- **Discard draft**: `DELETE …/draft`.
- **Reset to preset**: `POST …/reset`, the whole theme or some sections (up to `BUILDER_RESET_MAX` paths per call).
- **Images**: `POST …/images` with the schema's image key; the API checks formats and limits and answers the url, set in the draft.
- The themes list holds up to `BUILDER_THEMES_MAX` (5). A new theme starts inactive from `blank`, the `current` one or a preset. Only an inactive theme can be deleted.

## What the editor says about saved values

api-core answers these; the dashboard only shows them.

| api-core answers | The dashboard shows |
| --- | --- |
| `upgraded_from` (theme detail, each list row): the theme was saved with another version (another base, or a later one the website went back from) and comes converted to `schema_version` | A band above the editor; a "Converted from _version_" pill in the list. Save draft is enabled with no changes and sends `values: {}`, which saves the conversion |
| `upgrade_dropped` (theme detail): paths converting it lost | Listed in that band |
| `invalid: [{ path, code }]` (theme detail): saved values this version no longer takes | Marked on their control and counted in a band; those the editor doesn't show are listed. A code ending `.out_of_range` is a number the API clamped to its closest limit: it shows there and saves there. Any other code is dropped on the next save. A change to the value clears its mark |
| `theme.invalid` (400) with `errors: [{ path, code }]` on save or publish | Each error on its control (a typography field's on its text style). Errors the editor doesn't show are listed in an alert, with a toast. Texts by code ending: `.alpha`, `.alias`, `.out_of_range`, `.format`, else a generic one |
| `preset.incompatible` (409) on reset | A toast: the preset can't be applied, the draft didn't change |
| `settings_invalid`, `settings_upgrade_dropped` (product) | The same for the website's settings, on the `site` tab; `settings` comes already cleaned or clamped. `settings.invalid` (400) refuses a save by path |

## Translations

- The editor's own texts are `t('BUILDER_THEME_*', 'Default')` in the code; `pnpm i18n:generate` picks them up.
- The schema's label keys (`BUILDER_THEME_SECTION_COLORS`…) aren't in any `t()` call. When a schema version adds keys, add them to `i18n/translations.json` by hand (generate keeps them) and fill every locale (using your translation workflow). Until then the schema's `default` shows.

## Tests

`src/@/components-dashboard/src/components/Builder/__tests__/` (controllers, `builderApi`) and `src/@/components-dashboard/src/ui/src/components/Builder/__tests__/` (`ThemeSchemaEditor`, `BuilderWebTheme`, `schemaNodes`, `ScopeControl`…). `themeNodesFixture.json` is a copy of a published `marketplace_website` schema; refresh it when a new schema version changes what the editor reads.

## Changing it

- **The API contract changes**: update `builderApi.js` doc comments, the controller, the UI, tests and this file together. Drop what api-core no longer answers.
- **A schema adds keys, components, images or pages**: nothing in the dashboard, beyond translating new label keys.
- **The format adds a control or editor metadata**: add it to `CONTROLS` or the reader in `ThemeSchemaEditor/`, with tests, and list it here.
