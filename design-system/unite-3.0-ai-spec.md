# Unite EMR 3.0 — AI Agent Design System Spec

Use this document with `unite-3.0-ai-spec.json` when building prototypes, HTML modules, or UI for Unite 3.0.

## Source of truth

| Layer | Authority | Notes |
|-------|-----------|-------|
| **Colors** | Brand Guidelines v2.1 (2025) | Unite 3.0 palette only |
| **UI structure** | Figma [KYCs - Contracts - Terminations](https://www.figma.com/design/xi4zYHXzRJja5qiEfPMc72/KYCs---Contracts---Terminations) | Spacing, radius, component sizes, states |
| **Typography** | Lato | Web applications — Light/Regular/Bold/ExtraBold |

**Never use Unite 2.0 primary `#009DDC`.** Use `#00B8CD` instead.

## Brand colors (Unite 3.0)

| Token | Hex | Use |
|-------|-----|-----|
| Primary | `#00B8CD` | Buttons, links, focus, active nav, emblem |
| Primary hover | `#008FA0` | Hover states |
| Yellow (secondary) | `#FDD26E` | Accents, VIP tags, highlights |
| Orange (secondary) | `#FF8400` | Warnings, status |
| Neutral dark | `#4E4E4E` | Body text, sidebar |
| Neutral light | `#D9D9D6` | Borders, subtle surfaces |
| Page background | `#F7F7F7` | App canvas |
| Surface | `#FFFFFF` | Cards, inputs, header |

Each brand base has tints at **10%, 20%, 40%, 60%, 80%** (lighter mixes on white). See SCSS `--unite-color-*-10` through `-80`.

## Typography

- **Font:** `Lato` from Google Fonts (`300, 400, 700, 900`)
- **Default body:** 14px Regular
- **Form labels / hints:** 10px Regular, `#808080`
- **Input text:** 12px Regular, `#4E4E4E`
- **Buttons / nav:** 12px Bold
- **Headings:** ExtraBold at 16–20px

Type ramp classes: `.text-{10|12|14|16|18|20}-{regular|bold|extrabold}`

## Spacing & radius (from Figma Library)

- **Grid:** 4px base (`4, 8, 12, 16, 20, 24, 32…`)
- **Button radius:** `4px`
- **Input radius:** `4px`
- **Card radius:** `8px`
- **Modal radius:** `12px`

## Core components

### Buttons (height 30px default, radius 4px)

| Variant | Default | Hover |
|---------|---------|-------|
| Primary | bg `#00B8CD`, white text | bg `#008FA0` |
| Secondary | white bg, 1px `#00B8CD` border | border/text `#008FA0` |
| Tertiary | transparent, text `#00B8CD` | light primary tint bg |
| Inactive | bg/border `#E6E6E6`, text `#B3B3B3` | — |

Classes: `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--tertiary`, `.btn--negative`, `.btn--sm` (22px)

### Inputs (height 33px)

- Border: `1px #E6E6E6`
- Focus: border `#00B8CD` + `box-shadow: 0 0 0 3px rgba(0,184,205,0.25)`
- Read-only bg: `#F0FCFC`

Classes: `.form-input`, `.form-label`, `.form-group`, `.form-select`, `.form-checkbox`, `.form-toggle`

### Layout

- **Header:** 40px, white, bottom border `#E6E6E6`
- **Sidebar:** 40px collapsed (`#4E4E4E`), active item left border `#00B8CD`
- **Secondary nav:** 12px Bold, active underline `#00B8CD`

Classes: `.app-shell`, `.app-header`, `.app-sidebar`, `.secondary-nav`, `.card`, `.table`, `.modal`, `.alert`, `.badge`

## SCSS usage

```scss
@import 'styles/design-system/design-system';
```

Or from repo root:

```scss
@import 'unite-design-system';
```

## Figma alignment

When designing new modules in Figma:

1. Create color variables from `figma-3.0-variables.json`
2. Re-bind all components that used `#009DDC` → `primary/500` (`#00B8CD`)
3. Keep existing component structure from Library page

## Live preview

Open [`preview/index.html`](../../preview/index.html) in a browser to see all tokens and components rendered with the compiled CSS.

Scroll to **Patient Register** for the full production-style module layout.

## Module layout (Patient Register)

| Pattern | Classes |
|---------|---------|
| App topbar | `.app-topbar`, `.app-topbar__row`, `.app-topbar__utilities`, `.app-topbar__page-actions` |
| Module tabs | `.module-tabs`, `.module-tabs__item.is-active` |
| Form panel | `.form-panel`, `.form-panel__header`, `.form-panel__body` |
| Floating inputs | `.form-field--floating.is-filled`, `.form-field__label`, `.form-input` (49px) |
| 4-column grid | `.form-grid.form-grid--4` |
| Right rail | `.form-layout`, `.form-layout__rail`, `.profile-photo`, `.form-toggle` |
| Upload | `.upload-dropzone` |
| Utility btn | `.btn--pill`, `.topbar-link` |

## Agent checklist

- [ ] Primary interactions use `#00B8CD`, not `#009DDC`
- [ ] Font family is Lato
- [ ] Button height 30px (22px tertiary), radius 4px
- [ ] Input height 33px, focus ring uses primary
- [ ] Page bg `#F7F7F7`, text `#4E4E4E`
- [ ] Import design-system SCSS or mirror tokens from JSON
