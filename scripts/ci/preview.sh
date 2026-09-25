#!/usr/bin/env bash
# PR preview environments on the staging stack (see .github/workflows/preview.yml).
#   scripts/ci/preview.sh up <pr> <image-tag>   branch DB (create+migrate+seed), api + web services, DNS
#   scripts/ci/preview.sh down <pr>             remove services, routing, DNS and the branch DB
# Needs: AWS credentials for staging, terraform state access, CLOUDFLARE_API_TOKEN/ZONE_ID, DOMAIN, jq.
set -euo pipefail
CMD="${1:?up|down}"
PR="${2:?pr number}"
[[ "$PR" =~ ^[0-9]{1,7}$ ]] || { echo "invalid PR number" >&2; exit 2; }
TAG="${3:-}"
DOMAIN="${DOMAIN:?}"
CLUSTER="agarha-staging"
WEB_HOST="pr-$PR.$DOMAIN"
API_HOST="pr-$PR-api.$DOMAIN"
cd "$(dirname "$0")/../.."

tf() { terraform -chdir=infra/terraform output -raw "$1"; }
terraform -chdir=infra/terraform init -input=false -backend-config=envs/staging.backend.hcl >/dev/null
LISTENER="$(tf https_listener_arn)"
ALB_DNS="$(tf alb_dns_name)"
VPC="$(tf vpc_id)"
SG="$(tf tasks_security_group)"
SUBNETS="$(terraform -chdir=infra/terraform output -json private_subnets | jq -r 'join(",")')"
REGISTRY="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com/agarha"
NET="awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=DISABLED}"

# One-off task on the migrate task definition with a command/env override; fails on non-zero exit.
run_task() {
  local overrides="$1" arn code
  arn="$(aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE --task-definition agarha-staging-migrate \
    --network-configuration "$NET" --overrides "$overrides" --query 'tasks[0].taskArn' --output text)"
  aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$arn"
  code="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$arn" --query 'tasks[0].containers[0].exitCode' --output text)"
  [ "$code" = "0" ] || { echo "task failed ($code): $overrides" >&2; exit 1; }
}

cf() { curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'content-type: application/json' "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/$1" "${@:2}"; }

# Clone the staging task definition for $1 with a new image and extra environment.
register() {
  local svc="$1" image="$2" extra_env="$3"
  aws ecs describe-task-definition --task-definition "agarha-staging-$svc" --query taskDefinition \
    | jq --arg fam "agarha-staging-$svc-pr-$PR" --arg image "$image" --argjson env "$extra_env" '
        {family: $fam, requiresCompatibilities, networkMode, cpu, memory, executionRoleArn, taskRoleArn, runtimePlatform,
         containerDefinitions: [.containerDefinitions[0] | .image = $image
           | .environment = ((.environment // []) | map(select(.name as $n | ($env | map(.name) | index($n)) | not)) + $env)]}' \
    > /tmp/td.json
  aws ecs register-task-definition --cli-input-json file:///tmp/td.json --query 'taskDefinition.taskDefinitionArn' --output text
}

target_group() {
  local name="$1" port="$2" health="$3"
  aws elbv2 describe-target-groups --names "$name" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null \
    || aws elbv2 create-target-group --name "$name" --protocol HTTP --port "$port" --vpc-id "$VPC" --target-type ip \
         --health-check-path "$health" --query 'TargetGroups[0].TargetGroupArn' --output text
}

rule() {
  local host="$1" tg="$2" priority="$3"
  local existing
  existing="$(aws elbv2 describe-rules --listener-arn "$LISTENER" --query "Rules[?Conditions[?Values[0]=='$host']].RuleArn | [0]" --output text)"
  if [ "$existing" = "None" ] || [ -z "$existing" ]; then
    aws elbv2 create-rule --listener-arn "$LISTENER" --priority "$priority" \
      --conditions "Field=host-header,Values=$host" --actions "Type=forward,TargetGroupArn=$tg" >/dev/null
  fi
}

service() {
  local name="$1" td="$2" tg="$3" container="$4" port="$5"
  if [ "$(aws ecs describe-services --cluster "$CLUSTER" --services "$name" --query 'services[0].status' --output text)" = "ACTIVE" ]; then
    aws ecs update-service --cluster "$CLUSTER" --service "$name" --task-definition "$td" >/dev/null
  else
    aws ecs create-service --cluster "$CLUSTER" --service-name "$name" --task-definition "$td" --desired-count 1 \
      --launch-type FARGATE --network-configuration "$NET" \
      --load-balancers "targetGroupArn=$tg,containerName=$container,containerPort=$port" >/dev/null
  fi
}

dns() {
  local host="$1" id
  id="$(cf "dns_records?name=$host" | jq -r '.result[0].id // empty')"
  [ -n "$id" ] || cf dns_records -X POST --data "{\"type\":\"CNAME\",\"name\":\"$host\",\"content\":\"$ALB_DNS\",\"proxied\":true,\"ttl\":1}" >/dev/null
}

if [ "$CMD" = "up" ]; then
  : "${TAG:?image tag required for up}"
  DB="agarha_pr_$PR"
  # Branch database: create + migrate (the migrate image of this PR), then synthetic seed data.
  run_task "{\"containerOverrides\":[{\"name\":\"migrate\",\"command\":[\"node\",\"dist/db/preview-db.js\",\"create\",\"$PR\"]}]}"
  run_task "{\"containerOverrides\":[{\"name\":\"migrate\",\"command\":[\"node\",\"dist-tools/scripts/seed.js\"],\"environment\":[{\"name\":\"DATABASE_NAME\",\"value\":\"$DB\"}]}]}"
  API_TD="$(register api "$REGISTRY/api:$TAG" "[{\"name\":\"DATABASE_NAME\",\"value\":\"$DB\"},{\"name\":\"API_PUBLIC_URL\",\"value\":\"https://$API_HOST\"},{\"name\":\"PUBLIC_WEB_URL\",\"value\":\"https://$WEB_HOST\"},{\"name\":\"CORS_ORIGINS\",\"value\":\"https://$WEB_HOST\"}]")"
  WEB_TD="$(register web "$REGISTRY/web:$TAG" "[{\"name\":\"API_INTERNAL_URL\",\"value\":\"https://$API_HOST\"}]")"
  API_TG="$(target_group "ag-pr-$PR-api" 4000 /v1/health)"
  WEB_TG="$(target_group "ag-pr-$PR-web" 3000 /api/health)"
  rule "$API_HOST" "$API_TG" $((1000 + PR * 2 % 40000))
  rule "$WEB_HOST" "$WEB_TG" $((1001 + PR * 2 % 40000))
  service "api-pr-$PR" "$API_TD" "$API_TG" api 4000
  service "web-pr-$PR" "$WEB_TD" "$WEB_TG" web 3000
  dns "$WEB_HOST"
  dns "$API_HOST"
  aws ecs wait services-stable --cluster "$CLUSTER" --services "api-pr-$PR" "web-pr-$PR"
  echo "preview ready: https://$WEB_HOST"
elif [ "$CMD" = "down" ]; then
  for s in "api-pr-$PR" "web-pr-$PR"; do aws ecs delete-service --cluster "$CLUSTER" --service "$s" --force >/dev/null 2>&1 || true; done
  for host in "$WEB_HOST" "$API_HOST"; do
    arn="$(aws elbv2 describe-rules --listener-arn "$LISTENER" --query "Rules[?Conditions[?Values[0]=='$host']].RuleArn | [0]" --output text)"
    [ "$arn" != "None" ] && [ -n "$arn" ] && aws elbv2 delete-rule --rule-arn "$arn"
    id="$(cf "dns_records?name=$host" | jq -r '.result[0].id // empty')"
    [ -n "$id" ] && cf "dns_records/$id" -X DELETE >/dev/null
  done
  aws ecs wait services-inactive --cluster "$CLUSTER" --services "api-pr-$PR" "web-pr-$PR" || true
  for tg in "ag-pr-$PR-api" "ag-pr-$PR-web"; do
    arn="$(aws elbv2 describe-target-groups --names "$tg" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || true)"
    [ -n "$arn" ] && aws elbv2 delete-target-group --target-group-arn "$arn" || true
  done
  run_task "{\"containerOverrides\":[{\"name\":\"migrate\",\"command\":[\"node\",\"dist/db/preview-db.js\",\"drop\",\"$PR\"]}]}"
  echo "preview removed"
else
  echo "usage: preview.sh up|down <pr> [tag]" >&2
  exit 2
fi
