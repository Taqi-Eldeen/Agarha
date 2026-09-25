# ADR-0019: Review eligibility

- Status: Proposed · Date: 2026-09

## Decision

- Only a signed-in customer with a lead (call, WhatsApp or availability request) to the dealer can
  review, and only 24 h or more after the lead (`REVIEW_PROMPT_DELAY_MS`).
- One review per customer per dealer per 30 days.
- Every review is held as `pending` until a moderator approves it (admin console → Reviews), which
  filters abuse and off-platform extortion ("pay or I post a bad review").
- Dealers can post a public reply to a published review; they cannot edit or delete the review.
- Reviews stay after the lead is purged (ADR-0020); the lead link is nulled.
- Aggregate ratings appear once a dealer has at least one published review, and feed JSON-LD.
