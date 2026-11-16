import React from 'react'

import {
  TabOption as PosdTabOption
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/PaymentOptionStripeDirect/styles'
import {
  Option as PoslOption
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/PaymentOptionStripeLink/styles'

// Presentation-only fixture: the real Stores payment-gateway styled surfaces
// for batch d1-payment-methods, no controller, SDK, account or network.
// Two source files are mounted — one per payment gateway folder under
// Stores/ that still has governed styles: StripeDirect keeps only `TabOption`
// and StripeLink only `Option`.
// Because several files export the same names (`TabOption`, `Option`,
// `Container`), EVERY import in this file uses a
// folder-prefix alias matching its data-testid prefix, with no exceptions,
// even where a given name would not otherwise collide — uniform aliasing is
// the only discipline safe enough at this cardinality: one misplaced alias
// mounts a sibling gateway's node and the assertion still turns green
// against the wrong source.
//
// Alias map (source file -> prefix -> testid prefix), both confirmed by
// opening each file's own styles.js and its consuming index.js before
// mounting:
//   PaymentOptionStripeDirect     -> Posd* -> posd-*   (1 node)
//   PaymentOptionStripeLink       -> Posl* -> posl-*   (1 node)
// Total: 2 nodes.
// PaymethodOptionPaypalExpress/styles.js and PaymethodOptionStripeRedirect/styles.js were deleted as dead code; pmpe-*, pmsr-* rows (8 -> 2 nodes, ROLE_SIZES 5 -> 1, glyphs 3 -> 1) went with them.
// Lot 5.9: the payments section moved to Product wrappers, so
// PaymentOption, PaymentOptionConfig, PaymentOptionGlobal and
// PaymentOptionMethods no longer have a styles.js to mount (PaymentOption's
// keeps only EmptyMessage, with no rule); their 16 nodes (po-, poc-, pog-,
// pom-) are gone.
// Lot 5.10a: the Paypal, Mercado Pago, Stripe direct and Stripe
// link forms moved onto ProviderPanel. PaymentOptionPaypal and
// PaymentOptionMercadoPago have no styles.js left; PaymentOptionStripeDirect/
// styles.js keeps only TabOption and TabOptionName (the other gateways import
// them) and PaymentOptionStripeLink/styles.js only Option. Their 14 nodes
// (pomp-, popp-, the posd- Header and dropdown, the posl- Header, dropdown,
// message and TabOption) and the Container save-guard mounts of posd, popp and
// posl are gone. The native-checkbox assertions that read posl-taboption-control
// now read posd-taboption-control, the surviving TabOption (same CSS).
// Lot 5.10b: the Epayco, Credomatic and Square forms moved onto
// ProviderPanel and their styles.js are deleted, as is PaymentOption/styles.js
// (it only exported Square's EmptyMessage). Their 16 nodes (pocr-, poe-, posq-)
// and the Epayco save-guard section (sg-poe-: its BodyContainer no longer
// exists) are gone, with the Button import that only the save guard used.
// Lot 5.11: Stripe Connect moved onto a ProviderPanel wrapper and
// PaymethodOptionStripeConnect/styles.js is deleted. Its 4 nodes (pmsc-: Header
// h1, the dropdown shape and the StripeConnectButton icon) are gone.
//
// `TabOption`'s checkbox icon (`RiCheckboxBlankLine`/`RiCheckboxFill` in the
// real files) is mounted as a decorative synthetic svg standing in for the
// real icon, `aria-hidden='true'` as in the product. All TabOption uses
// are mounted as the converted native control the product renders:
// `as='button' type='button' role='checkbox' aria-checked`, with the accessible
// name taken from its own text. Every fixture glyph is the empty box, so every
// aria-checked here is 'false', bound to the same state the glyph shows.
//
// This batch has no HERO/SIMULACION region.
export const StoresD1StylesFixture = () => {
  return (
    <main data-testid='stores-d1-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <section data-testid='d1-payment-gateways' aria-label='Payment gateway configuration surfaces'>

        {/* PaymentOptionStripeDirect/styles.js — 1 node: TabOption>svg. The
            file keeps only TabOption and TabOptionName since the form moved
            onto ProviderPanel (lot 5.10a). It is the single TabOption
            declaration, so it also carries the native-checkbox, 44px coarse-pointer and
            accessibility-tree assertions that PaymentOptionStripeLink's own
            TabOption carried before it was retired. */}
        <div data-testid='payment-option-stripedirect-group' aria-label='Stripe direct gateway'>
          <PosdTabOption as='button' type='button' role='checkbox' aria-checked='false' onClick={() => {}} data-testid='posd-taboption-control'>
            <svg data-testid='posd-taboption-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            <span>All sites</span>
          </PosdTabOption>
        </div>

        {/* PaymentOptionStripeLink/styles.js — 1 node: Option's own root
            declaration (`font-size: var(--od-type-control-value-size)` on the
            styled node itself, no nested selector). It is genuine: index.js's
            config-options map renders
            `{ content: <Option>{t(item.text.toUpperCase())}</Option> }`,
            passed as the `content` for each dynamic Select option row —
            the option list itself only materializes inside the Select's
            popover, which this presentation fixture does not reproduce
            (same "mount the leaf node standalone" precedent used
            elsewhere in L4 for content handed to a Select/Dropdown
            component). Mounted standalone here with synthetic label text. */}
        <div data-testid='payment-option-stripelink-group' aria-label='Stripe link gateway'>
          <PoslOption data-testid='posl-option-root'>Enable SMS notifications</PoslOption>
        </div>

      </section>

    </main>
  )
}
