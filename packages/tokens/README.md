# @agarha/tokens

Single source of design tokens (section 9 of the brief), in DTCG JSON under `tokens/`.
`pnpm build` runs Style Dictionary and writes:

| Output                        | Used by                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `build/css/tokens.css`        | web + admin (`import '@agarha/tokens/css'`). Light on `:root`, dark via `prefers-color-scheme` or `[data-theme=dark]`. |
| `build/css/tokens.native.css` | mobile NativeWind `global.css` (`.dark:root`).                                                                         |
| `build/tailwind-preset.js`    | Tailwind 3 preset for web, admin and NativeWind. Colours resolve to CSS vars so one class works in both themes.        |
| `build/native/theme.js`       | Plain RN theme object (hex values, numbers) for places NativeWind can't reach (maps, navigation, status bar).          |

Colour tokens are stored as `R G B` channels so Tailwind alpha modifiers (`bg-brand/10`) work.
Dark values live in `$extensions.agarha.dark` next to the light value, so a colour cannot exist in one theme only.

Tests check WCAG AA contrast for text colours on both surfaces in both themes.
