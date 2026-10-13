# i18n — Ordering Dashboard

Source of truth for UI translation keys (`useLanguage` / `t('KEY', 'fallback')`).

## Config (locales SSoT)

[`config.json`](./config.json):

```json
{
  "product": "dashboard",
  "prefix": "DASHBOARD_",
  "sourceLanguage": "en",
  "supportedLocales": ["es", "fr", "it", "de", "pt", "da", "nl", "ar", "el", "bg", "tr"],
  "catalogPath": "i18n/translations.json",
  "legacyCatalogPath": "dashboard-translations.json"
}
```

- Catalog keys are **unprefixed**. Sync applies `DASHBOARD_` at POST time.
- Runtime already prefixes via `app_internal_name: dashboard`.

## Commands

```bash
pnpm i18n:generate                         # scan src/ → translations.json + legacy JSON
pnpm i18n:verify                           # fail if keys/locales incomplete
pnpm i18n:missing --summary
pnpm i18n:missing --limit 40 --write i18n/batch-missing.json
pnpm i18n:apply-batch i18n/batch-filled.json --strict
pnpm i18n:sync                             # dry-run (default)
pnpm i18n:sync:live                        # authorized API + sync credentials required
```

Fill locales with project skill [`.cursor/skills/translate-keys/SKILL.md`](../.cursor/skills/translate-keys/SKILL.md) (`/translate-keys`).

## Legacy file

`generate` still updates root `dashboard-translations.json` (`{ translation: { KEY: en } }`). Prefer `i18n/translations.json` for multi-locale work going forward.

## CI

The quality gate in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) checks generated catalogues and locale completeness. CI does not perform live translation sync.

Live sync requires an authorized translation API and local credentials: `ORDERING_API_BASE_URL`, `ORDERING_API_VERSION`, and `ORDERING_TRANSLATION_SYNC_KEY`. Supply credentials through the process environment or an untracked `i18n/.env`; never include the sync key in browser configuration or commit it. The default sync command is a dry run.

## Scope

Scans all of `src/` including in-tree `src/@/components-dashboard`. Controllers and UI live in this repo (not a submodule).
