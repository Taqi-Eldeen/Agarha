#!/usr/bin/env bash
# Runs the one-off migrate task (same commit as the deploy) in the environment's private subnets and
# fails the deploy if it doesn't exit 0. Usage: scripts/ci/run-migrations.sh staging|production
set -euo pipefail
ENV="${1:?environment}"
CLUSTER="agarha-${ENV}"
cd "$(dirname "$0")/../../infra/terraform"
TASK_DEF="$(terraform output -raw migrate_task_definition)"
SUBNETS="$(terraform output -json private_subnets | jq -r 'join(",")')"
SG="$(terraform output -raw tasks_security_group)"
ARN="$(aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE --task-definition "$TASK_DEF" \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' --output text)"
echo "migrate task: $ARN"
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$ARN"
CODE="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$ARN" --query 'tasks[0].containers[0].exitCode' --output text)"
[ "$CODE" = "0" ] || { echo "::error::migrations failed (exit $CODE); see /agarha/${ENV}/migrate logs"; exit 1; }
echo "migrations applied"
