# Infrastructure

Everything outside a laptop is Terraform (section 10: no manual console changes in production).

| Path                      | What                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docker-compose.yml`      | Local: Postgres 16 + PostGIS, Redis 7, MinIO (both buckets). `--profile app` also runs the images.                                                                                   |
| `terraform/`              | AWS (VPC, ECS Fargate, RDS Postgres, ElastiCache Redis, ECR, Secrets Manager, CloudWatch, Route 53 health checks, Budgets) + Cloudflare (DNS, WAF, rate limits, TLS, Turnstile, R2). |
| `terraform/envs/*.tfvars` | Per-environment sizing. Secrets and account ids come from `TF_VAR_*` in CI.                                                                                                          |
| `terraform/tests/`        | `terraform test` against mock providers: min 2 API instances, rollback, encryption, Cloudflare-only ingress, admin allowlist, TLS 1.2+.                                              |

```bash
# local dependencies
docker compose -f infra/docker-compose.yml up -d

# terraform (CI does this; see .github/workflows/deploy.yml and docs/runbooks/deploy.md)
cd infra/terraform
terraform init -backend-config=envs/staging.backend.hcl
terraform plan -var-file=envs/staging.tfvars -var image_tag=$(git rev-parse HEAD)
terraform test        # no credentials needed
```

Topology: Cloudflare (DNS, CDN, WAF, bot management, rate limits) → ALB (accepts Cloudflare IPs only)
→ ECS services `web`, `admin`, `api` (≥ 2, CPU autoscaling) and `worker` in private subnets →
RDS (multi-AZ in production, PITR) and ElastiCache (TLS + AUTH). Media and documents live in R2:
`public-media` behind `media.agarha.com`, `private-docs` only through 5-minute signed URLs.

Open decision: the AWS region (`aws_region`, default `eu-central-1`) waits on the Cairo latency test
and legal advice on PDPL cross-border transfer (ADR-0010). Changing it is one variable before the
first production apply.
