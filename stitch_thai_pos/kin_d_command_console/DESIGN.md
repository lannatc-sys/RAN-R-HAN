---
name: Kin-D Command Console
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002113'
  on-tertiary-container: '#009668'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: IBM Plex Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  data-mono:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter-xs: 0.25rem
  gutter-sm: 0.5rem
  gutter-md: 1rem
  gutter-lg: 1.5rem
  gutter-xl: 2rem
  margin-mobile: 1rem
  margin-desktop: 2rem
  sidebar-width-expanded: 16.25rem
  sidebar-width-collapsed: 4.5rem
  topbar-height: 4rem
---

## Brand & Style

The design system powers an executive-grade Point-of-Sale (POS) Super Admin and multi-location merchant management ecosystem. Built for founders, multi-unit franchise operators, and platform super administrators, the interface balances mission-critical operational precision with high-density data management.

The design movement merges **Corporate Precision** with **Utility Modernism**:
- **Bimodal Navigation Shell**: A persistent, deep slate/neutral-900 navigation spine establishes authority and visual anchor points, while the primary canvas operates in a high-efficiency neutral-50 environment engineered for prolonged screen exposure without visual fatigue.
- **Architectural Clarity**: Micro-radii (8px), disciplined hair-line dividers, and high-contrast diagnostic indicators eliminate cognitive latency during high-stakes operational interventions (e.g., store downtime, payment gateway outages, inventory runouts).
- **Executive Restraint**: Accent color is applied strictly to signify current state, active navigation, or metric status—avoiding decorative noise and prioritizing instant visual telemetry.

## Colors

The system employs a dual-context surface model where high-density dark navigation brackets a luminous, high-clarity data workspace.

### Core Palette
- **Primary (`#0F172A` - Slate 900)**: The command anchor. Used across deep structural panels, sidebars, primary high-priority buttons, and critical metric labels.
- **Secondary (`#F59E0B` - Amber 500)**: Dynamic operational focal point. Applied exclusively for active route states, pending approvals, warning alerts, and focus rings.
- **Tertiary (`#10B981` - Emerald 500)**: Health, online status, synchronized hardware terminals, and positive fiscal metrics.
- **Critical / Urgent (`#F43F5E` - Rose 500)**: Terminal failures, transaction rollbacks, disconnected register hardware, and high-severity platform exceptions.
- **Neutral (`#64748B` - Slate 500)**: Informational meta-text, structural strokes, neutral badges, and inactive navigation nodes.

### Canvas & Surface Tokens
- **Canvas Base**: `#F8FAFC` (Slate 50) for uniform, anti-glare application backdrops.
- **Surface Elevation 0 (Card White)**: `#FFFFFF` with razor-thin structural borders in `#E2E8F0` (Slate 200).
- **Navigation Shell**: `#0F172A` surface with active item backdrops at `rgba(245, 158, 11, 0.12)` and text in `#FFFFFF`.
- **Dividers & Strokes**: `#E2E8F0` on light canvas; `#1E293B` within the deep sidebar.

## Typography

Typography establishes an uncompromising split between structural metric reporting and frictionless tabular data legibility.

- **Headlines & Interface Labels (IBM Plex Sans)**: Chosen for its industrial, engineered structural rhythm. The distinct geometric apertures provide authority in high-level executive cards, panel headers, and financial metric KPIs.
- **Body & Tabular Feeds (Inter)**: Delivers peerless rendering across low-resolution and high-density monitors. Ideal for dense table records, live order streams, and nested audit logs.
- **Numerical & Status Data**: All numerical values, currencies, transaction IDs, and order totals utilize tabular numbers (`font-feature-settings: 'tnum' 1, 'cv05' 1`) to preserve vertical decimal alignment within comparative accounting tables.

## Layout & Spacing

The layout is governed by a **Persistent Rail & Responsive Canvas** topology:

- **Navigation Spine**: Fixed left-hand navigation with a standard width of `260px` (`16.25rem`), collapsible to `72px` (`4.5rem`) for dense terminal monitoring. It spans full viewport height (`100vh`) with zero margin.
- **Utility Header**: Sticky `64px` (`4rem`) top utility bar hosting location switchers, global hardware sync indicators, quick order searches, and platform profile controls.
- **Primary Grid**: A 12-column fluid grid system across desktop screens with an 8pt base grid rhythm:
  - Desktop (`≥ 1280px`): 24px column gutters, 32px canvas margins.
  - Tablet (`768px - 1279px`): 16px gutters, 24px margins; secondary summary columns drop beneath the primary data table.
  - Mobile (`< 768px`): Fluid single-column layout, 16px margins, sidebar collapses into a slide-over off-canvas drawer.
- **Component Padding**: Dense operational cards use a standardized `16px` padding; major summary metric tiles utilize `20px` to `24px`.

## Elevation & Depth

Visual hierarchy uses crisp, structured boundaries rather than dramatic physical shadows, matching modern enterprise SaaS rigor:

- **The Border-First Principle**: Every card, popover, modal, and drawer relies on a definitive 1px border (`#E2E8F0` on light backgrounds; `#1E293B` on dark navigation components).
- **Surface Elevation Levels**:
  - **Flat / Surface 0**: `#F8FAFC` base application background. No shadow.
  - **Raised / Surface 1 (Cards, Tables)**: `#FFFFFF` background, 1px `#E2E8F0` solid border, backed by subtle ambient grounding: `0px 1px 3px rgba(15, 23, 42, 0.04), 0px 1px 2px rgba(15, 23, 42, 0.02)`.
  - **Floating / Surface 2 (Dropdowns, Flyouts, Popovers)**: `#FFFFFF` background, 1px `#CBD5E1` border, cast with: `0px 4px 6px -1px rgba(15, 23, 42, 0.07), 0px 2px 4px -2px rgba(15, 23, 42, 0.05)`.
  - **Overlay / Surface 3 (Modals, Slide-over Drawers)**: `#FFFFFF`, surrounded by `0px 20px 25px -5px rgba(15, 23, 42, 0.1), 0px 8px 10px -6px rgba(15, 23, 42, 0.06)`. Background scrim uses `#0F172A` at 60% opacity with a `2px` subtle backdrop blur.

## Shapes

The design system commits strictly to an 8px (`0.5rem`) geometric language to convey architectural order, enterprise discipline, and spatial efficiency.

- **Cards, Panels, & Tables**: `rounded-lg` (8px / `0.5rem`). No outer container exceeds this radius, maintaining unified geometry across high-density layouts.
- **Interactive Controls (Buttons, Inputs, Selectors)**: Exactly 8px radius, matching outer card enclosures for seamless vertical visual rhythm.
- **Pills & Status Badges**: Exceptionally set to fully-rounded (`9999px`) to create clear shape differentiation between static operational cards and dynamic telemetry flags.
- **Avatars & Location Glyphs**: 8px radius with 1px inset boundary, maintaining consistency with form inputs.

## Components

### Navigation & Sidebar Controls
- **Sidebar Canvas**: Slate 900 (`#0F172A`) base with Slate 800 (`#1E293B`) section borders.
- **Nav Link (Default)**: `#94A3B8` text, transparent background, 8px radius, 12px horizontal padding.
- **Nav Link (Active State)**: Crisp white text (`#FFFFFF`), warm amber left accent pill (`3px` width, `#F59E0B`), and subtle amber-tinted background (`rgba(245, 158, 11, 0.1)`).

### Buttons
- **Primary Action**: Slate 900 (`#0F172A`) solid fill, `#FFFFFF` text, 8px radius, 1px solid `#0F172A`. Hover: `#1E293B`. Focus-visible: 2px offset ring in `#F59E0B`.
- **Secondary Action**: White (`#FFFFFF`) surface, `#0F172A` label, 1px border in `#E2E8F0`. Hover: `#F8FAFC` fill, `#CBD5E1` border.
- **Accent / Highlight**: Amber 500 (`#F59E0B`) solid fill, `#FFFFFF` or `#78350F` high-contrast text, used exclusively for primary POS deployment tasks, order voids, and overrides.

### High-Contrast Alert & Status Badges
Badges use pill shape (`9999px`), 11px uppercase bold typography (`label-sm`), with a subtle inner dot indicator:
- **Active / Operational**: Emerald light fill (`#ECFDF5`), Emerald border (`#A7F3D0`), Emerald text (`#065F46`), with a solid `#10B981` pulse dot.
- **Warning / Degraded**: Amber light fill (`#FFFBEB`), Amber border (`#FDE68A`), Amber text (`#92400E`), with a solid `#F59E0B` status dot.
- **Urgent / Outage**: Rose light fill (`#FFF1F2`), Rose border (`#FECDD3`), Rose text (`#9F1239`), with a solid `#F43F5E` critical beacon dot.
- **Inactive / Off-duty**: Slate light fill (`#F1F5F9`), Slate border (`#E2E8F0`), Slate text (`#475569`).

### Input Fields & Controls
- **Text Inputs & Dropdowns**: Height `38px` (compact enterprise standard), `#FFFFFF` fill, 1px border `#E2E8F0`, 8px radius. Inactive placeholder in `#94A3B8`.
- **Active / Focused Input**: Border transitions to `#0F172A` with a 2px outer glow ring of `rgba(245, 158, 11, 0.35)` to marry corporate stability with signature brand warmth.
- **Checkboxes & Radios**: 8px (checkbox) or circular (radio), `#0F172A` checked background with white checkmark icon, `#E2E8F0` resting stroke.

### Cards & Data Tables
- **Metrics Cards**: White background, 8px radius, 1px `#E2E8F0` border, `16px` or `20px` internal padding. KPI values set in `headline-xl` (IBM Plex Sans) with tabular micro-deltas (+12.4% vs last week).
- **Tabular Data Views**: Striped or clean border-bottom format with `#F8FAFC` column header row, `#475569` uppercase sticky labels, and cell heights pinned to `48px` for maximum visual scanning speed.