# Unite Customer Management UI - Design System

This document outlines the core styling, colors, typography, and UI framework configurations extracted from the Unite Customer Management UI project. AI agents can use this as a reference to replicate the visual identity in new projects.

## 1. Tech Stack & UI Libraries
- **CSS Framework**: Bootstrap 5.3.8 (customized via SCSS)
- **Component Library**: Kendo UI for Angular (`@progress/kendo-theme-fluent` and `@progress/kendo-theme-bootstrap` used as base, heavily customized)
- **Icons**: FontAwesome Free 7.1.0, Simple Line Icons, Material Design Iconic Font, Themify Icons.

## 2. Typography
- **Primary Font Family**: `"Lato", sans-serif`
- **Available/Imported Fonts**: `Nunito Sans`, `Poppins`, `Raleway`, `Inter`, `Mulish`
- **Base Font Size**: `0.875rem` (14px)
- **Base Text Color**: `#3e5569`
- **Heading Sizes**:
  - H1: `36px`
  - H2: `30px`
  - H3: `24px`
  - H4: `18px`
  - H5: `16px`
  - H6: `14px`
- **Heading Font Weight**: `700`

## 3. Color Palette

### Brand Colors
- **Primary**: `#00B8CD`
  - Hover/Active: `#039aab`
  - Light variant: `#E5F6F5`
  - Medium variant: `#b8f7fe`
- **Secondary**: `#4e4e4e`
  - Hover/Active: `#3D4547`
  - Light variant: `#e4eaef`

### State & Feedback Colors
- **Success (Green)**: `#00A674`
  - Light variant: `#b9f7df`
- **Warning (Yellow)**: `#ffc107`
  - Light variant: `#fbeccd`
- **Danger (Red)**: `#f64e60`
  - Light variant: `#ffdfe2`
- **Info (Blue)**: `#2962ff` (Indigo: `#3699ff`)
  - Light variant: `#d8e2ff`

### Neutrals (Grays)
- **White**: `#ffffff`
- **Light Gray Background**: `#f8f9fa` (gray-100)
- **Border Color**: `#d9d9d9`
- **Muted Text**: `#a1aab2` (gray-500)
- **Dark Text**: `#212529` (gray-900)

### Backgrounds
- **Main Body Background**: `#F6F6F6`
- **Content/Card Background**: `#ffffff`

### Dark Theme Colors (If Applicable)
- **Dark Layout Background**: `#323743`
- **Dark Card Background**: `#272b34`
- **Dark Text Color**: `#b2b9bf`
- **Dark Border Color**: `rgba(255, 255, 255, 0.2)`

## 4. Layout & Spacing
- **Global Border Radius**: `7px` (Large: `5px`, Small: `1px`)
- **Grid Gutter Width**: `20px`
- **Box Shadow**: `1px 0px 20px rgba(0, 0, 0, 0.08)` (Cards use: `rgb(145 158 171 / 20%) 0px 0px 2px 0px, rgb(145 158 171 / 12%) 0px 12px 24px -4px`)
- **Sidebar Configurations**:
  - Full Width: `250px`
  - Mini Width: `65px`
  - Background: `#ffffff`
- **Topbar Configuration**:
  - Height: `50px`

## 5. UI Component Overrides (Kendo & Bootstrap)
- **Kendo Buttons**:
  - Solid Success: uses `$success` (`#00A674`)
  - Solid Error: uses `red`
  - Solid Warning: uses `$warning` (`#ffc107`)
- **Kendo Switches**:
  - Track Background: `#E3E3E3`
  - Track Active (On): `#00B8CD` (Primary)
- **Kendo Checkboxes**:
  - Border Color: `#E2E2E2`
  - Hover Border: `#039aab` (Primary Hover)
- **Kendo Calendar**:
  - Selected Cell Text: `#ffffff`
  - Range Mid/Start/End Background: `#99DBD7`
- **Kendo Tabstrip**:
  - Item Hover Background: `#E5F6F5`
- **Custom Chips/Badges**:
  - Plan Badge Chip: Border `#00b8cd`, Background `#ebfcff`, Font size `12px`, Border-radius `12px`.
