---
name: translate-keys
description: >-
  Fill missing i18n locales in this repo's translation catalog from English
  source strings. Use when the user asks to translate keys, run /translate-keys,
  or i18n:verify fails due to empty supportedLocales.
---

# translate-keys (ordering-dashboard)

> Dual install: keep the `.claude` and `.cursor` copies of this skill synchronized.

Fill empty locale slots in `i18n/translations.json` using English (`sourceLanguage`) as the source.

## Hard rules

1. **Read target languages from `i18n/config.json`** (`supportedLocales`) and generate translations for **exactly those locales**. Do not hardcode language names (Spanish, French, etc.) in your plan — always load the config array.
2. **DO NOT skip any keys from the exported batch.** Output the exact same number of keys as the input batch.
3. For each key in a batch, fill **every** locale listed in that key's `missingLocales` array. Count must match: `Object.keys(translations).length === missingLocales.length` and every value non-empty.
4. Preserve placeholder tokens verbatim from English: `_attribute_`, `_from_`, `_to_`, `_min_`, `_driver_`, `_PRODUCT_`, `_NUMBER_`, `_email_`, `:amount:`, `%s`, `%d`, HTML tags like `<b>`.
5. Do not invent new catalog keys. Do not change English (`en`) unless the user explicitly asks.
6. Keep translation-only changes in the catalogs; do not modify application source as part of this workflow.
7. Prefer small batches (default **40 keys**) so nothing is omitted. Loop until missing count is 0 or the user stops.
8. **Never translate `runtime_variable_fallback` keys** (empty `en`, e.g. `t('SIGNUP_DRIVER_EMAIL', contactEmail)`). `i18n:missing` already excludes them. Do not invent "Not applicable" / placeholder locale strings for empty EN.

## Workflow (mandatory)

Husky pre-commit already runs `i18n:generate` when `src/` changes. Still run generate yourself if you are filling locales without a fresh commit.

### 1) Refresh English from code (if catalog may be stale)

```bash
pnpm i18n:generate
```

### 2) Export a missing batch

```bash
pnpm i18n:missing --limit 40 --write i18n/batch-missing.json
```

Use `--offset N` to continue after previous batches. Runtime-variable keys are omitted from this list automatically.

### 3) Fill the batch

Open `i18n/batch-missing.json`. For **every** entry in `keys`:

- Read `en` (source string). If `en` is empty, do **not** fill locales; remove that key from consideration and re-export missing (should not happen).
- Set `translations.<locale>` for **each** locale in `missingLocales`.
- Keep the same `keys.length` as the input file.
- Write result to `i18n/batch-filled.json` (or overwrite the missing file after filling).

Translation quality: natural UI copy for food-ordering marketplace. Keep tone consistent with English. Do not transliterate brand names that should stay in English.

### 4) Apply into the catalog

```bash
pnpm i18n:apply-batch i18n/batch-filled.json --strict
```

`--strict` fails if any key in the batch is missing a filled locale (no-skip enforcement).

### 5) Verify progress

```bash
pnpm i18n:missing --summary
pnpm i18n:verify
```

`i18n:verify` passes when every **non-runtime** key has every `supportedLocales` value. Repeat from step 2 with the next `--offset` until verify passes.

## Anti-patterns

- Translating only a subset of locales "to save tokens"
- Rewriting the entire `translations.json` in one shot
- Dropping keys from the batch output
- Replacing placeholders with translated words
- Hardcoding `es,fr,it,...` instead of reading `supportedLocales`
- Filling empty-EN / runtime_variable keys with "Not applicable" or similar fake copy

## Done criteria for one skill run

- At least one batch applied with `--strict` success, **or**
- Full catalog: `pnpm i18n:verify` exits 0

Report: batches applied, keys filled, remaining incomplete keys from `i18n/missing --summary`.
