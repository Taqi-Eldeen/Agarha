# Runbooks

| Runbook                            | When                                               |
| ---------------------------------- | -------------------------------------------------- |
| [deploy.md](deploy.md)             | Shipping to staging and production                 |
| [rollback.md](rollback.md)         | A release is bad                                   |
| [incident.md](incident.md)         | An alarm fires or users report an outage           |
| [restore.md](restore.md)           | Data loss or corruption; region or account loss    |
| [database.md](database.md)         | Schema changes, PostGIS, connections, slow queries |
| [secrets.md](secrets.md)           | Adding or rotating keys                            |
| [otp-outage.md](otp-outage.md)     | Customers or dealers can't get sign-in codes       |
| [dependencies.md](dependencies.md) | Dependabot, CVEs, framework upgrades               |

Environments: `staging` (AWS account A, `staging.agarha.com`) and `production` (AWS account B,
apex). Cluster names `agarha-staging` / `agarha-production`; services `api`, `worker`, `web`, `admin`;
logs in CloudWatch under `/agarha/<env>/<service>`.
