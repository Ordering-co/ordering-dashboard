# Maintain a Dashboard surface

1. Identify the route, access rules, API contract, tenant settings and existing
   tests. Keep permission checks and route behavior with the feature.
2. Use the existing Product wrappers and semantic tokens where they fit. Keep
   feature logic outside the shared UI. See [Brand](BRAND.md).
3. Exercise loading, empty, partial and error states. Check light and dark,
   right-to-left, narrow and desktop layouts, zoom, keyboard focus and touch.
   Use local fixtures for accounts, orders and integrations.
4. Classify new routes and actions for the [command palette](COMMAND_PALETTE.md).
   Use unprefixed translation keys in UI code, regenerate catalogs and run
   `pnpm i18n:check-generated` and `pnpm i18n:verify`.
5. Run focused Vitest and browser tests, followed by the build and the guards
   for the files you changed. Use the [audit rubric](redesign/audit-rubric.md)
   for a new or substantially changed surface.

```sh
pnpm brand:check
pnpm brand:test
pnpm ui:check
pnpm redesign:ratchet
pnpm redesign:orders-imports
pnpm redesign:dates
pnpm exec playwright test --config scripts/product-ui/playwright.config.mjs
```

The Product gallery tests assert rendering, theme and direction, viewport,
focus, overlays and accessibility in a real browser. Test outputs belong in
ignored output folders or CI artifacts. Review appearance separately when
changing layout or styling.
