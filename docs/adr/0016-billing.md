# ADR-0016: Dealer billing — plans, VAT, featured listings, Paymob

- Status: **Open** — built against a mock gateway · Date: 2026-09
- Needs: Paymob merchant contract; confirmation of prices and the VAT treatment with an accountant.

## Decision (default)

- Customers never pay Agarha. Dealers pay for plans and featured placement only.
- Plans (seeded in `apps/api/scripts/seed-data.ts`, editable from the admin console):

  | Plan  | EGP / month | Live listings | Team members | Featured credits / month |
  | ----- | ----------- | ------------- | ------------ | ------------------------ |
  | Free  | 0           | unlimited     | 3            | 0                        |
  | Pro   | 1,499       | 60            | 8            | 4                        |
  | Fleet | 3,999       | unlimited     | 25           | 12                       |

  **Open:** Free has no listing cap while Pro caps at 60, so Pro is sold on team size and featured
  credits only. This keeps supply growing during launch, but the caps need a pricing decision before
  billing is switched on.

- Featured listing: 50 EGP/day (`FEATURED_PRICE_PER_DAY_EGP`).
- Prices include 14 % VAT (`VAT_RATE = 0.14`); invoices show the VAT portion.
- Renewal invoices open 3 days before period end; cancelling at period end falls back to Free.
- `PaymentGateway` port with a `MockGateway` (HMAC-signed webhooks) and a Paymob adapter. Card data
  never touches our servers (hosted checkout / iframe), keeping us out of PCI DSS scope beyond SAQ A.

## Consequences

- E-invoicing with the Egyptian Tax Authority is required once registered for VAT: not built at v1
  (open question).
