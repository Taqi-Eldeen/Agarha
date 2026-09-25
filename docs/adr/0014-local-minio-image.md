# ADR-0014: MinIO image for local S3

- Status: Accepted · Date: 2026-09

## Context

MinIO stopped publishing community images on Docker Hub in 2025.

## Decision

`infra/docker-compose.yml` uses the community-maintained `pgsty/minio` build pinned to a release tag.
The API's default local driver is a signed local-disk mock, so MinIO is only needed to test the real
S3 path.
