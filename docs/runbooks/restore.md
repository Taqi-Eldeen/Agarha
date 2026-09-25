# Backup and restore

| What                                       | Backup                                                                                                                                                                | RPO                | RTO     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------- |
| PostgreSQL (RDS)                           | Automated snapshots + point-in-time recovery; retention 14 days prod, 3 days staging; Multi-AZ in prod                                                                | 5 min              | 1–4 h   |
| Redis                                      | Not backed up: rate limits and queues are rebuildable; scheduled jobs are re-registered at worker start                                                               | n/a                | minutes |
| Media (R2)                                 | R2 has no object versioning: 11-nines durability; photos can be re-uploaded by dealers. Optional nightly `rclone sync` to an S3 bucket in the AWS account (not built) | 24 h with the sync | hours   |
| Verification documents (R2 `private-docs`) | As above; a lost document means asking the dealer to re-upload                                                                                                        | 24 h with the sync | hours   |
| Infrastructure                             | Terraform state in S3 (versioned) + code                                                                                                                              | 0                  | 1–2 h   |

## Point-in-time restore (bad migration, accidental delete)

1. Note the time just **before** the damage (UTC). Stop writes if damage continues: scale `api` and
   `worker` to 0 or turn on maintenance at Cloudflare.
2. Restore to a **new** instance:
   ```sh
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier agarha-production \
     --target-db-instance-identifier agarha-production-restore-$(date +%Y%m%d%H%M) \
     --restore-time 2026-01-01T10:15:00Z --db-subnet-group-name agarha-production \
     --vpc-security-group-ids <db-sg>
   ```
3. Either copy the lost rows back (`pg_dump -t <table> --data-only` from the restored instance), or,
   for wide damage, point `DATABASE_URL` in `agarha-production/infra` at the restored instance and
   redeploy (then import it into Terraform state or rename it).
4. Verify: row counts on `listings`, `leads`, `users`; smoke tests; then re-enable traffic.
5. Delete the temporary instance when done.

## Quarterly restore drill (staging)

Restore the latest production snapshot into a temporary instance in the production account, run
row-count checks and a read-only smoke against it, record the time taken (target under 2 hours), and
delete it. Production data never goes to staging; staging uses the synthetic seed.
