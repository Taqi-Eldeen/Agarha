# ADR-0012: Text on accent stays dark in both themes

- Status: Accepted · Date: 2026-09

## Decision

The accent/featured colour is a bright amber. White text on it fails WCAG AA (≈2.1:1), so
`color.fg.onAccent` is a near-black in light **and** dark themes (≥ 7:1). Tokens:
`packages/tokens/tokens/color.json`.
