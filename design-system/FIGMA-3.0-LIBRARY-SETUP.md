# Figma Library Setup — Unite 3.0

Apply these steps in [Unite-UI-Ripul](https://www.figma.com/design/yd41AzUQz0x3glKWxaSn5b/Unite-UI-Ripul) to migrate the Unite 2.0 library to Unite 3.0 colors.

## 1. Create variable collection

1. Open **Local variables** → **Create collection** → name: `Unite 3.0`
2. Mode: **Light** (single mode for v1)
3. Import values from [`figma-3.0-variables.json`](figma-3.0-variables.json)

## 2. Color migration (critical)

| Old (2.0) | New (3.0) | Variable |
|-----------|-----------|----------|
| `#009DDC` | `#00B8CD` | `color/primary/500` |
| — | `#008FA0` | `color/primary/400` (hover) |
| — | `#FDD26E` | `color/brand/yellow/500` |
| — | `#FF8400` | `color/brand/orange/500` |

**Actions:**

- Select all → Find `#009DDC` → replace with variable `color/primary/500`
- Audit: buttons, links, tabs, focus rings, icons using old blue

## 3. Foundations page (`Design System 3.0`)

Create a page with frames:

1. **Colors** — primary + tints (10–80%), yellow, orange, neutrals, status, greys
2. **Typography** — Lato specimens (10–20, Regular/Bold/ExtraBold)
3. **Spacing** — 4px grid bars
4. **Radius** — 4, 8, 12, 16 samples
5. **Shadows** — sm, md, lg, focus ring

## 4. Component rebinding (Library page)

Re-bind existing components (do not rebuild structure):

| Component | Properties to bind |
|-----------|-------------------|
| `button` primary-* | fill → `color/primary/500`, hover → `400` |
| `button` secondary-* | stroke → `color/primary/500` |
| `input-box` | stroke default `color/grey/4`, focus `color/primary/500` |
| `side-menu` | fill `color/neutral/dark/500`, active accent `color/primary/500` |
| `secondary-menu` | active text/underline `color/primary/500` |

## 5. Publish

- Enable library publish for `Unite 3.0` collection
- Document in file description: *Colors = 3.0 brand; structure = 2.0 Figma*

## Machine-readable tokens

- SCSS: [`styles/design-system/design-system.scss`](../../styles/design-system/design-system.scss)
- AI JSON: [`unite-3.0-ai-spec.json`](unite-3.0-ai-spec.json)
