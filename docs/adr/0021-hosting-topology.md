# ADR-0021: AWS ECS Fargate behind Cloudflare, one AWS account per environment

- Status: Proposed · Date: 2026-09

## Decision

- Cloudflare in front of everything: DNS, TLS, WAF managed rules, rate limits, Turnstile, R2 and CDN.
  The ALB only accepts Cloudflare IP ranges.
- AWS (Terraform in `infra/terraform`): VPC across 2 AZs, ECS Fargate services (api, worker, web,
  admin), RDS PostgreSQL (Multi-AZ in production), ElastiCache Redis, ECR, Secrets Manager, KMS,
  CloudWatch alarms, Route 53 health checks, AWS Budgets.
- Separate AWS accounts for staging and production; images are built once and promoted by digest.
- Hostnames are single-level so Cloudflare Universal SSL covers them: `staging.`, `staging-api.`,
  `staging-admin.`, `staging-media.`; production uses the apex, `api.`, `admin.`, `media.`;
  previews `pr-<n>.` and `pr-<n>-api.`.
- The production Terraform state owns zone-wide Cloudflare settings.

## Consequences

- Estimated run-rate: roughly USD 450–650/month production, USD 150–200 staging (budget alarms at 600).
