/**
 * Ordering.co Product wrappers (orders pilot, Part 2, wave 4).
 *
 * Governed components on Base UI + --od-* release tokens + --od-x-* candidates
 * (src/brand/candidates.css). Redesigned surfaces import from here; the
 * Shared/UI facade stays the compatibility layer for legacy consumers.
 * Gallery: `pnpm ui:gallery`. Rules: docs/redesign/wrapper-brief.md.
 */
export { Button, IconButton } from './Button'
export { Checkbox } from './Checkbox'
export { Status, StatusBadge, SlaBadge, Count, STATUS_FAMILIES, SLA_LEVELS } from './Status'
export { Avatar, getInitials } from './Avatar'
export { EmptyState, Skeleton } from './Feedback'
export { Tabs, TabPanel } from './Tabs'
export { Menu } from './Menu'
export { Tooltip } from './Tooltip' // redesign bugs-d row 36c (W1-D-26)
export { DataTable } from './DataTable'
export { SelectionBar } from './SelectionBar'
export { SaveBar } from './SaveBar' // redesign UF-B1b
export { LeaveGuardContext, LeaveDialog, useLeaveGuardHost, useLeaveGuard, useNestedLeaveGuard, useRequestLeave } from './LeaveGuard' // redesign stores 2.A
export { ColumnManager } from './ColumnManager'
export { FilterBar, SearchField, FilterPill, FilterChips, InlineNotice } from './FilterBar'
export { FilterPopover, ChecklistPopover, PopoverFoot, summarizeIds } from './FilterPopover'
export { ListPopover } from './ListPopover' // redesign stores 2.D
export { Select, SelectField } from './Select' // redesign (K-1): the form select
export { pillValue, withoutLeadingLabel } from './filterValueText'
export { Dialog, ConfirmDialog } from './Dialog'
export { AlertDialog } from './AlertDialog'
export { AssignCommentDialog } from './AssignCommentDialog' // redesign deliveries-followups P3
export { Sheet } from './Sheet'
export { DateRangePopover } from './DateRangePopover'
// redesign W0-2 r2 (W0-P1-02): the step wizard is imported by file (`Shared/Product/Wizard`), not from this barrel,
// so it stays in the create-order chunk that loads on demand (N-05) instead of the entry bundle.
export { SplitView, useSplitView } from './SplitView'
export { SectionSplit, useSectionSplit } from './SectionSplit' // redesign 2.B
export { OrderRoute } from './OrderRoute'
export { ActivityTimeline } from './ActivityTimeline'
export { SegmentedControl } from './SegmentedControl'
// redesign W0-7 (T0-21…T0-28b): the cross-family wrappers (forms, pagination, page header, map frame, record panel,
// section nav, day picker) and the frames of the legacy image, color and phone pieces.
export { Field, TextField, TextArea, PasswordField, NumberField, useFieldFrame } from './Field' // redesign tramo B r2 (W0-QB1-04): useFieldFrame
export { Switch } from './Switch'
export { AsyncSwitch } from './AsyncSwitch' // redesign 2.G
export { TimeField } from './TimeField' // redesign 2.E
export { SecretField } from './SecretField' // redesign 2.C
export { CopyButton } from './CopyButton' // redesign stores 5.15a
export { RadioGroup } from './RadioGroup'
export { Pagination } from './Pagination'
export { SelectableList } from './SelectableList' // redesign promoted from Users/StaffDirectory/StaffStoresSection
export { PageHeader } from './PageHeader'
export { MapFrame, MAP_FRAME_SIZES } from './MapFrame'
export { RecordPanel } from './RecordPanel'
export { SectionNav } from './SectionNav'
export { RecordCard, RecordCardList } from './RecordCard' // redesign W1-1 (T1-1)
export { CatalogCard } from './CatalogCard' // redesign F1 (N-FD2, N-SU1)
export { ProjectCode } from './ProjectCode' // redesign F2 (N-SU2)
export { DatePicker } from './DatePicker'
export { ScheduleEditor } from './ScheduleEditor' // redesign SL-F3 (C)
export { Metric, MetricGrid } from './Metric' // redesign bi FA0 (D3, auditor 10: promoted from Home TodaySummary)
// redesign W0-7 (T0-29): ImageField, ColorField and PhoneField are imported by file (`Shared/Product/ImageField`, …),
// not from this barrel: they wrap legacy pieces (Shared/UI) whose imports load bootstrap.css, which repaints the page
// of any consumer of the barrel.
export { useProductDir } from './useProductDir'
export { useEditorPanel } from './useEditorPanel' // redesign SP-F0 (E0)
export { tokenOffset, tokenPx } from './positioning'
export { cx } from './classNames'
export { WebsocketStatus } from './WebsocketStatus' // (row 32, driver-store-status P-7): promoted from Orders/WebsocketStatus
