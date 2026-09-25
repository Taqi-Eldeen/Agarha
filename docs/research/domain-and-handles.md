# Domain and handle check — Agarha / Aggarha / Ajarha

Checked 2026-09-25 from the build environment: DNS over HTTPS (Cloudflare resolver) plus RDAP
(Verisign) for `.com`/`.net`, and public profile URLs for social handles. **An NXDOMAIN answer suggests
a name is free but does not prove it; confirm at a registrar before relying on it.** Social platforms
block anonymous checks, so most handle results need a manual check from a signed-in account.

## Domains

| Domain          | Result                                                                  | Action                                                                                             |
| --------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `agarha.com`    | **Registered** since 2014-08-13 (Hostinger), parked, expires 2028-08-13 | Blocker for the default config: approach the owner via the registrar/broker, or use another domain |
| `agarha.net`    | **Registered** 2025-11-26                                               | —                                                                                                  |
| `agarha.app`    | NXDOMAIN — likely available                                             | Register (HSTS-preloaded TLD)                                                                      |
| `agarha.eg`     | NXDOMAIN — likely available                                             | Register via an Egyptian registrar (needs an Egyptian entity/CR)                                   |
| `agarha.com.eg` | NXDOMAIN — likely available                                             | Register with `agarha.eg`                                                                          |
| `aggarha.com`   | **Registered** 2026-01-11 (GoDaddy), all client locks set               | —                                                                                                  |
| `aggarha.eg`    | NXDOMAIN — likely available                                             | Defensive registration                                                                             |
| `aggarha.app`   | NXDOMAIN — likely available                                             | —                                                                                                  |
| `ajarha.com`    | NXDOMAIN — likely available                                             | Defensive registration (common transliteration)                                                    |
| `ajarha.eg`     | NXDOMAIN — likely available                                             | —                                                                                                  |
| `ajarha.app`    | NXDOMAIN — likely available                                             | —                                                                                                  |
| `ajjarha.com`   | NXDOMAIN — likely available                                             | —                                                                                                  |

**Recommendation:** register `agarha.eg`, `agarha.com.eg`, `agarha.app`, `ajarha.com` now (under
USD 150/year in total), and open a broker enquiry for `agarha.com`. The code and Terraform take the
domain from one variable (`domain` in `infra/terraform/envs/*.tfvars`, `NEXT_PUBLIC_SITE_URL`,
`EXPO_PUBLIC_WEB_HOST`, app-links config), so switching to `agarha.eg` costs configuration, not code.

## Social handles

| Handle    | Instagram | Facebook | TikTok | X          | YouTube                   | Telegram                      |
| --------- | --------- | -------- | ------ | ---------- | ------------------------- | ----------------------------- |
| `agarha`  | manual    | manual   | manual | manual     | **Taken** ("Agarha 2017") | **Taken** (unrelated account) |
| `aggarha` | manual    | manual   | manual | manual     | Free (404)                | Free                          |
| `ajarha`  | manual    | manual   | manual | Free (404) | Free (404)                | Free                          |

"Manual" means the platform returned a login wall or redirect for every name, so nothing can be
concluded. Fallbacks if `agarha` is taken: `agarha.eg`, `agarha_eg`, `agarhaapp`.

## Trademark

Search the Egyptian Trademark Office (ITDA) and WIPO Global Brand Database for "أجّرها", "Agarha" and
"Ajarha" in classes 35 (online marketplace), 39 (vehicle rental) and 42 (software) before brand spend.
Listed in `docs/legal-checklist.md`.
