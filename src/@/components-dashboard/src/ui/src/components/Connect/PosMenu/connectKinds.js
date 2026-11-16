// redesign SC-A: the kind of integration a Connect page manages. The POS pieces here (table, panel, card, model) serve two
// pages; a kind says what differs between them. `pos` is /connect/pos-menu and the default: with no kind, or an unknown one, every
// piece does what it always did. `sales_channel` is /connect/sales-channels. `importer` is /connect/importers (redesign IM-A, );
// `columnManager` and `cardStatus` exist only on it: whoever reads them takes `undefined` as true. No React and no t(): the labels live
// in the pieces.

const freezeKind = (config) => Object.freeze({
  ...config,
  columns: Object.freeze([...config.columns]),
  lockedColumns: Object.freeze([...config.lockedColumns]),
  actions: Object.freeze([...config.actions])
})

export const CONNECT_KINDS = Object.freeze({
  pos: freezeKind({
    kind: 'pos',
    integrationType: 'pos',
    storageKey: 'pos-menu-panel',
    callProviders: true,
    columns: ['id', 'business', 'pos', 'status'],
    lockedColumns: ['id', 'pos'],
    actions: ['sync_menu', 'sync_business'],
    externalIdEditable: false
  }),
  sales_channel: freezeKind({
    kind: 'sales_channel',
    integrationType: 'sales_channel',
    storageKey: 'sales-channels-panel',
    callProviders: false,
    columns: ['id', 'business', 'pos', 'sales_channels'],
    lockedColumns: ['id'],
    actions: ['push_menu'],
    externalIdEditable: true
  }),
  // redesign IM-A: main did not pass an integrationType to the controller on this page (null: the wrapper sends undefined)
  importer: freezeKind({
    kind: 'importer',
    integrationType: null,
    storageKey: 'importers-panel',
    callProviders: false,
    columns: ['id', 'business'],
    lockedColumns: ['id'],
    actions: [],
    externalIdEditable: false,
    columnManager: false,
    cardStatus: false
  })
})

export const connectKind = (kind) => (
  Object.prototype.hasOwnProperty.call(CONNECT_KINDS, kind) ? CONNECT_KINDS[kind] : CONNECT_KINDS.pos
)
