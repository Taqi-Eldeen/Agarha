# ADR-0010: Hosting region

- Status: **Open** — default `eu-central-1` (Frankfurt) is wired in · Date: 2026-09
- Needs: owner decision after legal advice on PDPL (Law 151/2020) cross-border transfer.

## Options

| Region                 | Latency to Cairo | Notes                                                        |
| ---------------------- | ---------------- | ------------------------------------------------------------ |
| eu-central-1 Frankfurt | ~55–65 ms        | Full service set, cheapest of the three, GDPR-grade controls |
| me-central-1 UAE       | ~45–60 ms        | Closer; some services arrive later; slightly higher prices   |
| me-south-1 Bahrain     | ~50–60 ms        | Opt-in region                                                |

No hyperscaler region exists in Egypt today. PDPL requires a licence or adequacy for transfers
outside Egypt; the Personal Data Protection Center's executive regulations govern the procedure.

## Decision (default)

Frankfurt. Everything is one Terraform variable (`aws_region`) and per-environment tfvars; Cloudflare
sits in front, so user-facing latency is dominated by the edge anyway.

## Consequences

- Changing region after launch means a database migration with downtime: decide before production.
