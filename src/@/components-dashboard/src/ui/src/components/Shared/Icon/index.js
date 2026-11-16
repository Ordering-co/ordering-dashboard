import React, { forwardRef } from 'react'
import {
  ListChecks as LucideListChecks,
  House as LucideHouse,
  UserRound as LucideUserRound,
  Phone as LucidePhone,
  Banknote as LucideBanknote,
  Store as LucideStore,
  GraduationCap as LucideGraduationCap,
  Users as LucideUsers,
  ChartNoAxesColumnIncreasing as LucideChartNoAxesColumnIncreasing,
  Settings as LucideSettings,
  Star as LucideStar,
  Truck as LucideTruck,
  TrendingUp as LucideTrendingUp,
  ExternalLink as LucideExternalLink,
  ShoppingBag as LucideShoppingBag,
  PackagePlus as LucidePackagePlus,
  Pencil as LucidePencil,
  FileText as LucideFileText,
  Download as LucideDownload,
  Upload as LucideUpload,
  Plug as LucidePlug,
  LogOut as LucideLogOut,
  ArrowRight as LucideArrowRight,
  BookOpen as LucideBookOpen,
  CalendarDays as LucideCalendarDays,
  Check as LucideCheck,
  ChevronDown as LucideChevronDown,
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  CircleMinus as LucideCircleMinus,
  CirclePlus as LucideCirclePlus,
  CircleX as LucideCircleX,
  Copy as LucideCopy,
  Columns3 as LucideColumns3,
  Eye as LucideEye,
  EyeOff as LucideEyeOff,
  Globe as LucideGlobe,
  Info as LucideInfo,
  Image as LucideImage,
  Link as LucideLink,
  Video as LucideVideo,
  LockKeyhole as LucideLockKeyhole,
  Mail as LucideMail,
  Maximize2 as LucideMaximize2,
  Menu as LucideMenu,
  Minimize2 as LucideMinimize2,
  Minus as LucideMinus,
  PanelLeftClose as LucidePanelLeftClose,
  Plus as LucidePlus,
  RotateCw as LucideRotateCw,
  Search as LucideSearch,
  Send as LucideSend,
  Square as LucideSquare,
  SquarePlus as LucideSquarePlus,
  SquareCheck as LucideSquareCheck,
  Trash2 as LucideTrash2,
  TriangleAlert as LucideTriangleAlert,
  X as LucideX,
  ChartColumn as LucideChartColumn,
  LayoutGrid as LucideLayoutGrid,
  SlidersHorizontal as LucideSlidersHorizontal,
  ArrowDownWideNarrow as LucideArrowDownWideNarrow,
  Rows3 as LucideRows3,
  WifiOff as LucideWifiOff,
  RefreshCw as LucideRefreshCw,
  Bike as LucideBike,
  Ellipsis as LucideEllipsis,
  Printer as LucidePrinter,
  Receipt as LucideReceipt,
  Navigation as LucideNavigation,
  Ban as LucideBan,
  CircleCheck as LucideCircleCheck,
  MessageSquare as LucideMessageSquare,
  MapPin as LucideMapPin,
  Wallet as LucideWallet,
  Clock as LucideClock,
  Megaphone as LucideMegaphone,
  Package as LucidePackage,
  Workflow as LucideWorkflow,
  PanelLeftOpen as LucidePanelLeftOpen,
  ChevronsUpDown as LucideChevronsUpDown,
  CircleHelp as LucideCircleHelp,
  GripVertical as LucideGripVertical,
  Languages as LucideLanguages,
  ArrowLeft as LucideArrowLeft,
  Calendar as LucideCalendar,
  CircleAlert as LucideCircleAlert,
  Timer as LucideTimer,
  RotateCcw as LucideRotateCcw,
  Inbox as LucideInbox,
  FilterX as LucideFilterX,
  LoaderCircle as LucideLoaderCircle,
  User as LucideUser,
  ArrowUp as LucideArrowUp,
  ArrowDown as LucideArrowDown,
  ChevronUp as LucideChevronUp,
  History as LucideHistory,
  ListFilter as LucideListFilter,
  Lightbulb as LucideLightbulb,
  ThumbsUp as LucideThumbsUp,
  ThumbsDown as LucideThumbsDown,
  CreditCard as LucideCreditCard,
  CornerDownLeft as LucideCornerDownLeft,
  LogIn as LucideLogIn,
  UserCheck as LucideUserCheck,
  Repeat as LucideRepeat,
  ShoppingBasket as LucideShoppingBasket,
  Gift as LucideGift,
  Monitor as LucideMonitor,
  Earth as LucideEarth,
  PanelLeft as LucidePanelLeft
} from 'lucide-react'
import { tokens } from '~/brand/ordering.tokens.generated'

const withOrderingDefaults = Component => {
  const Icon = forwardRef(function OrderingIcon ({
    size = tokens.component.density.iconSize,
    strokeWidth = tokens.stroke.icon,
    title,
    children,
    ...props
  }, ref) {
    const labelled = Boolean(title || props['aria-label'] || props['aria-labelledby'])
    return (
      <Component
        size={size}
        strokeWidth={strokeWidth}
        focusable='false'
        aria-hidden={!labelled}
        role={labelled ? 'img' : undefined}
        {...props}
        ref={ref}
      >
        {title && <title>{title}</title>}
        {children}
      </Component>
    )
  })
  Icon.displayName = `Ordering${Component.displayName}`
  return Icon
}

// Named exports keep the vocabulary explicit. Add a glyph only with a reviewed
// consumer equivalence; brand marks never enter this product-icon module.
export const ArrowRight = /* #__PURE__ */ withOrderingDefaults(LucideArrowRight)
export const BookOpen = /* #__PURE__ */ withOrderingDefaults(LucideBookOpen)
export const CalendarDays = /* #__PURE__ */ withOrderingDefaults(LucideCalendarDays)
export const Check = /* #__PURE__ */ withOrderingDefaults(LucideCheck)
export const ChevronDown = /* #__PURE__ */ withOrderingDefaults(LucideChevronDown)
export const ChevronLeft = /* #__PURE__ */ withOrderingDefaults(LucideChevronLeft)
export const ChevronRight = /* #__PURE__ */ withOrderingDefaults(LucideChevronRight)
export const CircleX = /* #__PURE__ */ withOrderingDefaults(LucideCircleX)
export const Columns3 = /* #__PURE__ */ withOrderingDefaults(LucideColumns3)
export const Eye = /* #__PURE__ */ withOrderingDefaults(LucideEye)
export const EyeOff = /* #__PURE__ */ withOrderingDefaults(LucideEyeOff)
export const Globe = /* #__PURE__ */ withOrderingDefaults(LucideGlobe)
export const Info = /* #__PURE__ */ withOrderingDefaults(LucideInfo)
export const LockKeyhole = /* #__PURE__ */ withOrderingDefaults(LucideLockKeyhole)
export const Mail = /* #__PURE__ */ withOrderingDefaults(LucideMail)
export const Maximize2 = /* #__PURE__ */ withOrderingDefaults(LucideMaximize2)
export const Menu = /* #__PURE__ */ withOrderingDefaults(LucideMenu)
export const Minimize2 = /* #__PURE__ */ withOrderingDefaults(LucideMinimize2)
export const Minus = /* #__PURE__ */ withOrderingDefaults(LucideMinus)
export const PanelLeftClose = /* #__PURE__ */ withOrderingDefaults(LucidePanelLeftClose)
export const Plus = /* #__PURE__ */ withOrderingDefaults(LucidePlus)
export const Search = /* #__PURE__ */ withOrderingDefaults(LucideSearch)
export const Send = /* #__PURE__ */ withOrderingDefaults(LucideSend) // redesign W1-6 (T1-6-4a): the chat's send button
export const Square = /* #__PURE__ */ withOrderingDefaults(LucideSquare)
export const SquareCheck = /* #__PURE__ */ withOrderingDefaults(LucideSquareCheck)
export const Trash2 = /* #__PURE__ */ withOrderingDefaults(LucideTrash2)
export const TriangleAlert = /* #__PURE__ */ withOrderingDefaults(LucideTriangleAlert)
export const X = /* #__PURE__ */ withOrderingDefaults(LucideX)
export const CircleMinus = /* #__PURE__ */ withOrderingDefaults(LucideCircleMinus)
export const CirclePlus = /* #__PURE__ */ withOrderingDefaults(LucideCirclePlus)
export const Copy = /* #__PURE__ */ withOrderingDefaults(LucideCopy)
export const SquarePlus = /* #__PURE__ */ withOrderingDefaults(LucideSquarePlus)
export const Image = /* #__PURE__ */ withOrderingDefaults(LucideImage)
export const Link = /* #__PURE__ */ withOrderingDefaults(LucideLink)
export const Video = /* #__PURE__ */ withOrderingDefaults(LucideVideo)
export const RotateCw = /* #__PURE__ */ withOrderingDefaults(LucideRotateCw)
export const ListChecks = /* #__PURE__ */ withOrderingDefaults(LucideListChecks)
export const House = /* #__PURE__ */ withOrderingDefaults(LucideHouse)
export const UserRound = /* #__PURE__ */ withOrderingDefaults(LucideUserRound)
export const Phone = /* #__PURE__ */ withOrderingDefaults(LucidePhone)
export const Banknote = /* #__PURE__ */ withOrderingDefaults(LucideBanknote)
export const Store = /* #__PURE__ */ withOrderingDefaults(LucideStore)
export const GraduationCap = /* #__PURE__ */ withOrderingDefaults(LucideGraduationCap)
export const Users = /* #__PURE__ */ withOrderingDefaults(LucideUsers)
export const ChartNoAxesColumnIncreasing = /* #__PURE__ */ withOrderingDefaults(LucideChartNoAxesColumnIncreasing)
export const Settings = /* #__PURE__ */ withOrderingDefaults(LucideSettings)
export const Star = /* #__PURE__ */ withOrderingDefaults(LucideStar)
export const Truck = /* #__PURE__ */ withOrderingDefaults(LucideTruck)
export const TrendingUp = /* #__PURE__ */ withOrderingDefaults(LucideTrendingUp)
export const ExternalLink = /* #__PURE__ */ withOrderingDefaults(LucideExternalLink)
export const ShoppingBag = /* #__PURE__ */ withOrderingDefaults(LucideShoppingBag)
export const PackagePlus = /* #__PURE__ */ withOrderingDefaults(LucidePackagePlus)
export const Pencil = /* #__PURE__ */ withOrderingDefaults(LucidePencil) // redesign SP-F3 (C): edit a category
export const FileText = /* #__PURE__ */ withOrderingDefaults(LucideFileText)
export const Download = /* #__PURE__ */ withOrderingDefaults(LucideDownload)
export const Upload = /* #__PURE__ */ withOrderingDefaults(LucideUpload) // redesign stores 3.A: Importers in the phone «More actions» menu
export const Plug = /* #__PURE__ */ withOrderingDefaults(LucidePlug)
export const LogOut = /* #__PURE__ */ withOrderingDefaults(LucideLogOut)

// Orders pilot (Part 2): glyphs of the redesigned sidebar and orders family.
export const ChartColumn = /* #__PURE__ */ withOrderingDefaults(LucideChartColumn)
export const LayoutGrid = /* #__PURE__ */ withOrderingDefaults(LucideLayoutGrid)
export const SlidersHorizontal = /* #__PURE__ */ withOrderingDefaults(LucideSlidersHorizontal)
export const ArrowDownWideNarrow = /* #__PURE__ */ withOrderingDefaults(LucideArrowDownWideNarrow)
export const Rows3 = /* #__PURE__ */ withOrderingDefaults(LucideRows3)
export const WifiOff = /* #__PURE__ */ withOrderingDefaults(LucideWifiOff)
export const RefreshCw = /* #__PURE__ */ withOrderingDefaults(LucideRefreshCw)
export const Bike = /* #__PURE__ */ withOrderingDefaults(LucideBike)
export const Ellipsis = /* #__PURE__ */ withOrderingDefaults(LucideEllipsis)
export const Printer = /* #__PURE__ */ withOrderingDefaults(LucidePrinter)
export const Receipt = /* #__PURE__ */ withOrderingDefaults(LucideReceipt)
export const Navigation = /* #__PURE__ */ withOrderingDefaults(LucideNavigation)
export const Ban = /* #__PURE__ */ withOrderingDefaults(LucideBan)
export const CircleCheck = /* #__PURE__ */ withOrderingDefaults(LucideCircleCheck)
export const MessageSquare = /* #__PURE__ */ withOrderingDefaults(LucideMessageSquare)
export const MapPin = /* #__PURE__ */ withOrderingDefaults(LucideMapPin)
export const Wallet = /* #__PURE__ */ withOrderingDefaults(LucideWallet)
export const Clock = /* #__PURE__ */ withOrderingDefaults(LucideClock)
export const Megaphone = /* #__PURE__ */ withOrderingDefaults(LucideMegaphone)
export const Package = /* #__PURE__ */ withOrderingDefaults(LucidePackage)
export const Workflow = /* #__PURE__ */ withOrderingDefaults(LucideWorkflow)
export const PanelLeftOpen = /* #__PURE__ */ withOrderingDefaults(LucidePanelLeftOpen)
export const ChevronsUpDown = /* #__PURE__ */ withOrderingDefaults(LucideChevronsUpDown)
export const CircleHelp = /* #__PURE__ */ withOrderingDefaults(LucideCircleHelp)
export const GripVertical = /* #__PURE__ */ withOrderingDefaults(LucideGripVertical)
export const Languages = /* #__PURE__ */ withOrderingDefaults(LucideLanguages)
export const ArrowLeft = /* #__PURE__ */ withOrderingDefaults(LucideArrowLeft)
export const Calendar = /* #__PURE__ */ withOrderingDefaults(LucideCalendar)
export const CircleAlert = /* #__PURE__ */ withOrderingDefaults(LucideCircleAlert)
export const Timer = /* #__PURE__ */ withOrderingDefaults(LucideTimer)
export const RotateCcw = /* #__PURE__ */ withOrderingDefaults(LucideRotateCcw)
export const Inbox = /* #__PURE__ */ withOrderingDefaults(LucideInbox)
export const FilterX = /* #__PURE__ */ withOrderingDefaults(LucideFilterX)
export const LoaderCircle = /* #__PURE__ */ withOrderingDefaults(LucideLoaderCircle)
export const User = /* #__PURE__ */ withOrderingDefaults(LucideUser)
export const ArrowUp = /* #__PURE__ */ withOrderingDefaults(LucideArrowUp)
export const ArrowDown = /* #__PURE__ */ withOrderingDefaults(LucideArrowDown)
export const ChevronUp = /* #__PURE__ */ withOrderingDefaults(LucideChevronUp)
export const History = /* #__PURE__ */ withOrderingDefaults(LucideHistory)
export const ListFilter = /* #__PURE__ */ withOrderingDefaults(LucideListFilter)
export const Lightbulb = /* #__PURE__ */ withOrderingDefaults(LucideLightbulb)
// redesign reviews (D8): the thumbs of a product review
export const ThumbsUp = /* #__PURE__ */ withOrderingDefaults(LucideThumbsUp)
export const ThumbsDown = /* #__PURE__ */ withOrderingDefaults(LucideThumbsDown)
// redesign BM-B (D3): a saved card of the Billing payment-method picker
export const CreditCard = /* #__PURE__ */ withOrderingDefaults(LucideCreditCard)
// redesign (R2): the ⌘K palette's «Open» key hint and its fallback glyph for an item without an icon
export const CornerDownLeft = /* #__PURE__ */ withOrderingDefaults(LucideCornerDownLeft)
export const LogIn = /* #__PURE__ */ withOrderingDefaults(LucideLogIn)
// redesign AC-D (G5): the glyphs of the promotion templates (they were react-bootstrap-icons)
export const UserCheck = /* #__PURE__ */ withOrderingDefaults(LucideUserCheck)
export const Repeat = /* #__PURE__ */ withOrderingDefaults(LucideRepeat)
export const ShoppingBasket = /* #__PURE__ */ withOrderingDefaults(LucideShoppingBasket)
export const Gift = /* #__PURE__ */ withOrderingDefaults(LucideGift)
// redesign B2: Builder's type glyphs (TypeGlyph): kiosk app, franchise website, dashboard (they were react-bootstrap-icons)
export const Monitor = /* #__PURE__ */ withOrderingDefaults(LucideMonitor)
export const Earth = /* #__PURE__ */ withOrderingDefaults(LucideEarth)
export const PanelLeft = /* #__PURE__ */ withOrderingDefaults(LucidePanelLeft)
