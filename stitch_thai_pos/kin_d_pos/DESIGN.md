---
name: Kin-D POS
colors:
  surface: '#fbf9f9'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#534434'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#867461'
  outline-variant: '#d8c3ad'
  surface-tint: '#855300'
  primary: '#855300'
  on-primary: '#ffffff'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#ffb95f'
  secondary: '#a73a00'
  on-secondary: '#ffffff'
  secondary-container: '#fd651e'
  on-secondary-container: '#571a00'
  tertiary: '#0053db'
  on-tertiary: '#ffffff'
  tertiary-container: '#94aeff'
  on-tertiary-container: '#003ba1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#ffdbce'
  secondary-fixed-dim: '#ffb599'
  on-secondary-fixed: '#370e00'
  on-secondary-fixed-variant: '#7f2b00'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#003ea8'
  background: '#fbf9f9'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
typography:
  headline-lg:
    fontFamily: IBM Plex Sans Thai, ibmPlexSans, sans-serif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: IBM Plex Sans Thai, ibmPlexSans, sans-serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: IBM Plex Sans Thai, ibmPlexSans, sans-serif
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: IBM Plex Sans Thai, ibmPlexSans, sans-serif
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: IBM Plex Sans Thai, ibmPlexSans, sans-serif
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-strong:
    fontFamily: IBM Plex Sans Thai, ibmPlexSans, sans-serif
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  label-lg:
    fontFamily: IBM Plex Sans Thai, ibmPlexSans, sans-serif
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: IBM Plex Sans Thai, ibmPlexSans, sans-serif
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  price-display:
    fontFamily: IBM Plex Sans Thai, ibmPlexSans, sans-serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
  price-total:
    fontFamily: IBM Plex Sans Thai, ibmPlexSans, sans-serif
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  grid-base: 4px
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-5: 20px
  space-6: 24px
  space-8: 32px
  card-p-mobile: 16px
  min-target: 48px
---

## Brand & Style

The design system delivers an ultra-legible, tactile, and high-efficiency interface tailored for busy Thai restaurant operators, floor staff, and kitchen managers aged 40–60. The aesthetic balances warmth, operational clarity, and ergonomic safety under kitchen lighting or fast-paced lunchtime rush hours.

### Visual Style
- **Warm Utilitarian Minimalism**: Crisp card containers, warm culinary-inspired accents, and generous touch targets eliminate mis-taps.
- **Cognitive Ergonomics**: High tonal contrast (WCAG AAA prioritized for active states), high-visibility status cues, and tabular numerals ensure rapid glanceability from arm's length.
- **Tone**: Dependable, welcoming, brisk, and respectful of high-volume dining workflows.

## Colors

The palette is tuned specifically for quick comprehension under diverse lighting conditions—from ambient dining rooms to bright commercial kitchens.

### Primary & Accent
- **Primary (`#F59E0B` / amber-500)**: Primary actions, pending states, brand touchpoints, active category chips.
- **Accent (`#EA580C` / orange-600)**: High-priority checkout buttons, urgent kitchen calls, badge highlights, and promotional tags.

### Neutrals & Surfaces
- **Canvas / App Background**: `#FAFAFA` (neutral-50)
- **Surface / Card Background**: `#FFFFFF` (white)
- **Card Border**: `#E5E5E5` (neutral-200)
- **Text Primary**: `#171717` (neutral-900)
- **Text Secondary / Metadata**: `#525252` (neutral-600)
- **Text Muted / Placeholder**: `#A3A3A3` (neutral-400)

### Operational Status Badges (Semantic)
- **รอ (Pending)**: Background `#FEF3C7` (amber-100), Text `#B45309` (amber-700)
- **ทำอยู่ (Cooking / In-Progress)**: Background `#DBEAFE` (blue-100), Text `#1D4ED8` (blue-700)
- **เสิร์ฟแล้ว (Served)**: Background `#D1FAE5` (emerald-100), Text `#047857` (emerald-700)
- **จ่ายแล้ว (Paid)**: Background `#F5F5F5` (neutral-100), Text `#525252` (neutral-600)
- **ยกเลิก (Cancelled)**: Background `#FFE4E6` (rose-100), Text `#BE123C` (rose-700)

## Typography

The design system standardizes on **IBM Plex Sans Thai** (paired with IBM Plex Sans for Latin characters and numbers).

### Rules & Readability Standards
- **Minimum font size**: 16px across body, controls, and interactive elements to guarantee effortless scanning for senior operators (50+ years old). Secondary notes and badge tags may use 14px only when coupled with high color contrast.
- **Hierarchy Weight**: Headings strictly leverage Weight 600 (SemiBold). Body text leverages Weight 400 (Regular). Key actions and totals use Weight 600 or 700.
- **Line Heights for Thai Script**: Thai tone marks and vowel diacritics require relaxed line heights (minimum 1.4× to 1.5×) to avoid clipping and overlap.
- **Price Presentation**: Standardized to `฿1,250` or `฿85` using `font-variant-numeric: tabular-nums` and right alignment across tables, order summaries, and item tiles.

## Layout & Spacing

The layout is engineered around a mobile-first standard viewport of **390px** width (typical iPhone / handheld Android POS terminal), scaling seamlessly to tablet POS stands.

### Grid & Spacing Model
- **Grid Increment**: Strict 4px base increment.
- **Margins**: 16px outer margin on mobile (`p-4` / 16px).
- **Gutter**: 12px to 16px between list items and grid cards.
- **Card Padding**: 16px (`p-4`) uniformly inside all order tickets, food item rows, and summary panels.
- **Touch Target Integrity**: All tap areas (buttons, quantity toggles, table selectors, checkboxes) maintain an absolute minimum height and width of **48px**.

## Elevation & Depth

To maximize battery efficiency, reduce visual fatigue, and ensure clarity on low-cost POS screens:

- **Primary Elevation**: `shadow-sm` exclusively (`box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)`).
- **Structural Separation**: Clear borders (`1px solid #E5E5E5`) take precedence over deep drop shadows.
- **Active / Layered Panels**: Bottom sheets (cart drawer, payment keypad modal) utilize a subtle ambient backdrop blur (`rgba(0, 0, 0, 0.4)`) with crisp `border-t border-neutral-200` to anchor the interaction.

## Shapes

The interface embraces approachable, ergonomic curvature:
- **Standard Cards & Modals**: `16px` (`rounded-2xl`).
- **Primary Buttons & Form Inputs**: `12px` (`rounded-xl`) to preserve button structure with 48px heights.
- **Status Badges & Quick Action Chips**: `9999px` (`rounded-full`) for high distinction against rectangular cards.
- **Quantity Stepper Buttons**: `8px` (`rounded-lg`) inside compact order rows.

## Components

### 1. Buttons
- **Primary Button**: Background `#EA580C` (orange-600), text white, height 52px, text size 18px (Font weight 600), border-radius 12px. Used for "ชำระเงิน" (Checkout) and "ส่งเข้าครัว" (Send to Kitchen).
- **Secondary Button**: Background `#F59E0B` (amber-500), text neutral-900, height 48px, text size 16px. Used for add-item actions and print receipt.
- **Outline Button**: Background white, border `1.5px solid #E5E5E5`, text neutral-800, min-height 48px. Used for "พักบิล" (Hold Order) or "ยกเลิก" (Cancel).
- **Quantity Stepper**: Circular or rounded-square buttons (40×40px min target inside 48px wrapper) with `+` and `−` symbols, flanking an 18px bold counter.

### 2. Status Badges
Rendered as pill tags (`rounded-full`) with uppercase-level clarity, horizontal padding 12px, vertical padding 4px:
- **รอ**: Background `#FEF3C7`, text `#B45309`, text-14px, weight 600.
- **ทำอยู่**: Background `#DBEAFE`, text `#1D4ED8`, text-14px, weight 600.
- **เสิร์ฟแล้ว**: Background `#D1FAE5`, text `#047857`, text-14px, weight 600.
- **จ่ายแล้ว**: Background `#F5F5F5`, text `#525252`, text-14px, weight 600.
- **ยกเลิก**: Background `#FFE4E6`, text `#BE123C`, text-14px, weight 600.

### 3. Food Item & Order Cards
- Container: `#FFFFFF`, border `1px solid #E5E5E5`, `rounded-2xl` (16px), shadow `shadow-sm`, padding 16px.
- Thai Menu Display:
  - Title: 16px Weight 600 neutral-900 (e.g., "ข้าวกะเพราหมูกรอบ", "ต้มยำกุ้งน้ำข้น", "ชาเย็น").
  - Options / Add-ons: 14px Weight 400 neutral-500 (e.g., "ไข่ดาวกรอบ, เผ็ดมาก").
  - Price: Tabular-nums, 16px–18px Weight 600, right-aligned (e.g., `฿85`).

### 4. Input Fields & Search
- Height: 48px minimum.
- Border: `1px solid #E5E5E5`, focus ring `2px solid #F59E0B`.
- Text: 16px neutral-900 with clear `#A3A3A3` placeholder (e.g., "ค้นหาเมนู หรือ ใส่หมายเลขโต๊ะ...").

### 5. Filter & Category Chips
- Horizontal scrolling track, pill-shaped (`rounded-full`), min-height 44px.
- Inactive: `#FFFFFF` background, border `1px solid #E5E5E5`, text neutral-700.
- Active: `#F59E0B` background, text neutral-900, weight 600.

### 6. Order Summary Bottom Bar
- Sticky mobile bottom bar: `#FFFFFF`, `border-t border-neutral-200`, `shadow-sm`.
- Displays total order count, total price (`฿1,250` in 24px/weight 700 tabular numerals), and immediate 52px "ชำระเงิน" call to action.