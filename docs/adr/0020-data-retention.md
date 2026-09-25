# ADR-0020: Data retention and account deletion

- Status: **Open** — defaults built, need legal review against PDPL · Date: 2026-09

## Decision (default)

| Data                            | Retention                                                           |
| ------------------------------- | ------------------------------------------------------------------- |
| Leads                           | 24 months, then purged (daily job)                                  |
| Rejected verification documents | 90 days after rejection                                             |
| Approved verification documents | While the dealer is active + 24 months                              |
| Notification delivery logs      | 90 days                                                             |
| Analytics events                | PostHog project retention (set to 12 months)                        |
| Deleted accounts                | Anonymised immediately; sessions revoked; reviews kept without name |

Every module implements a `PrivacyContributor` (export + erase). Customers can export their data and
delete their account in-app and on the web. The full inventory is in `docs/data-map.md`.
